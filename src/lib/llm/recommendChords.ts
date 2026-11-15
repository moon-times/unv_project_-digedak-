// AI 코드 재추천 (더 밝게 · 더 슬프게). 서버(/api/analyze)에서만 씁니다.
// Claude는 정해 둔 후보 안에서 코드 기호만 고르고, 멜로디와 부딪히는지는 규칙 엔진 점수로 서버가 다시 검사합니다.
// docs/specs/11_llm-recommend/design.md §3
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { GOOD_FIT_SCORE } from "@/features/piano-roll/chordEdit";
import {
  buildExplanation,
  chordPitchClasses,
  diatonicCandidates,
  koreanKeyName,
  parseChordSymbol,
  parseKey,
  pitchClassHistogram,
  pitchClassName,
  recommendCandidates,
  scalePitchClasses,
  scoreChordForNotes,
  usesFlats,
  type Key,
} from "@/lib/music";
import type { Chord, Note, Style } from "@/types/song";
import { checkPolished } from "./polishExplanation";

export const RECOMMEND_MODEL = "claude-sonnet-5-5";
export type RecommendRequest = "brighter" | "sadder";

export type RecommendInput = {
  melody: Note[];
  key: string;
  chords: Chord[];
  request: RecommendRequest;
  style: Style;
  bpm: number;
};

export type RecommendResult = {
  chords: Chord[];
  explanation: string;
  /** 실제로 바뀐 코드 수. 0이면 제안이 모두 걸러진 것 */
  changed: number;
};

const REQUEST_TEXT: Record<RecommendRequest, string> = {
  brighter:
    "더 밝게: 장3화음과 장조 쪽 화음을 늘리고, 단조 곡이면 같은 으뜸음 장조에서 빌린 화음(borrowed)을 써 본다.",
  sadder:
    "더 슬프게: 단3화음과 단조 쪽 화음을 늘리고, 장조 곡이면 같은 으뜸음 단조에서 빌린 화음(borrowed, 예: iv · ♭VI · ♭VII)을 써 본다.",
};

const SYSTEM_PROMPT = `너는 흥얼거린 멜로디로 반주를 만들어 주는 음악 앱 "딕으닥"의 화성 담당이다.
지금 코드 진행과 각 구간의 멜로디 음, 그 구간에서 멜로디와 부딪히지 않아 바꿀 수 있는 코드 목록(options)을 받는다.
요청한 느낌이 나도록 몇 구간의 코드를 그 구간의 options 안에서 바꾼다.

지킬 것:
- 각 구간은 반드시 그 구간의 options에 있는 코드로만 바꾼다. options가 비어 있으면 그 구간은 두고, 바꿀 곳이 없으면 changes를 비운다.
- 2~4구간만 바꾼다. 모든 구간을 바꾸지 않는다. 첫 구간과 마지막 구간이 으뜸화음이면 그대로 둔다.
- 요청과 반대 느낌이 나는 코드로는 바꾸지 않는다(밝게인데 단3화음으로 바꾸는 식).
- reason은 바꾼 결과만 "~했어요"체 1~2문장. 키 이름을 한 번 쓰고, 코드 이름은 changes에 넣은 것과 원래 코드만 쓴다. 구간 번호나 로마 숫자는 쓰지 않고, 음악을 배운 적 없는 사람도 알아듣게 쓴다.`;

const SuggestionSchema = z.object({
  changes: z.array(z.object({ index: z.number().int(), symbol: z.string() })),
  reason: z.string(),
});

const overlaps = (note: Note, chord: Chord) =>
  note.start < chord.start + chord.duration &&
  note.start + note.duration > chord.start;

function fit(melody: Note[], symbolPcs: number[], key: Key, chord: Chord) {
  return scoreChordForNotes(
    melody,
    symbolPcs,
    scalePitchClasses(key),
    chord.start,
    chord.start + chord.duration,
  );
}

/**
 * Claude에게 보낼 요약: 후보 목록과 구간마다 지금 코드 · 멜로디 음 · 바꿀 수 있는 코드(options).
 * options는 서버 검사(R3)를 통과하는 후보만이라, Claude가 고른 코드가 걸러져 이유 문장과 진행이 어긋나는 일을 줄입니다.
 */
export function recommendSummary(input: RecommendInput, key: Key) {
  const candidates = recommendCandidates(key);
  const flats = usesFlats(key);
  return {
    key: koreanKeyName(key),
    request: REQUEST_TEXT[input.request],
    candidates: candidates.map(({ symbol, roman, borrowed }) => ({
      symbol,
      roman,
      borrowed,
    })),
    sections: input.chords.map((chord, index) => {
      const notes = input.melody.filter((note) => overlaps(note, chord));
      const counts = new Map<number, number>();
      for (const note of notes)
        counts.set(note.pitch % 12, (counts.get(note.pitch % 12) ?? 0) + 1);
      return {
        index,
        chord: chord.symbol,
        melody: [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([pc]) => pitchClassName(pc, flats)),
        options: keepsTonic(input, key, index)
          ? []
          : candidates
              .filter(
                (c) =>
                  c.symbol !== chord.symbol &&
                  fitsSection(input, key, chord, chordPitchClasses(c)),
              )
              .map((c) => c.symbol),
      };
    }),
  };
}

/** 첫 · 마지막 구간의 으뜸화음은 두어 곡의 시작과 끝맺음을 지킵니다 (프롬프트만으로는 바꾸는 일이 있어 서버에서 막음). */
function keepsTonic(input: RecommendInput, key: Key, index: number) {
  const edge = index === 0 || index === input.chords.length - 1;
  return (
    edge && input.chords[index].symbol === diatonicCandidates(key)[0].symbol
  );
}

/** 이 구간을 이 구성음 코드로 바꿔도 되는지 (R3): 빌려 온 음 충돌 없음, 멜로디가 있으면 점수 기준 통과 */
function fitsSection(
  input: RecommendInput,
  key: Key,
  current: Chord,
  pcs: number[],
) {
  const notes = input.melody.filter((note) => overlaps(note, current));
  if (clashesWithBorrowedTone(notes, pcs, key)) return false;
  if (notes.length === 0) return true;
  const next = fit(input.melody, pcs, key, current);
  // 사용자가 직접 넣은 코드(G7 등)는 후보 밖이라 기호를 읽어 점수를 냅니다.
  const info = parseChordSymbol(current.symbol);
  const before = info
    ? fit(input.melody, chordPitchClasses(info), key, current)
    : -Infinity;
  return next >= GOOD_FIT_SCORE || next >= before;
}

/**
 * 제안 중 쓸 수 있는 것만 진행에 넣습니다 (R3): 후보 안의 기호이고, 그 구간에 멜로디가 있으면
 * 점수가 GOOD_FIT_SCORE 이상이거나 원래 코드 점수 이상일 때만. 위치 · 길이는 그대로.
 */
export function applySuggestions(
  input: RecommendInput,
  key: Key,
  changes: { index: number; symbol: string }[],
): { chords: Chord[]; changed: number } {
  const candidates = new Map(
    recommendCandidates(key).map((c) => [c.symbol, chordPitchClasses(c)]),
  );
  const chords = [...input.chords];
  const seen = new Set<number>();
  let changed = 0;
  for (const { index, symbol } of changes) {
    const current = input.chords[index];
    const pcs = candidates.get(symbol);
    if (!current || !pcs || seen.has(index) || current.symbol === symbol)
      continue;
    seen.add(index);
    if (keepsTonic(input, key, index)) continue;
    if (!fitsSection(input, key, current, pcs)) continue;
    chords[index] = { ...current, symbol };
    changed++;
  }
  return { chords, changed };
}

/**
 * 빌려 온 음(키 음계 밖의 구성음)과 반음으로 부딪히는 멜로디 음이 있는지.
 * 예: C장조 멜로디의 A 위에 Fm(A♭) → 점수 함수는 A를 "음계 안의 비구성음"으로만 깎아서 통과시키므로 따로 막습니다.
 */
function clashesWithBorrowedTone(notes: Note[], chordPcs: number[], key: Key) {
  const scale = scalePitchClasses(key);
  const outside = chordPcs.filter((pc) => !scale.includes(pc));
  return notes.some((note) =>
    outside.some((tone) => {
      const distance = (note.pitch - tone + 120) % 12;
      return distance === 1 || distance === 11;
    }),
  );
}

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // 요청마다 15초, 형식이 틀려 다시 묻는 것(1회)까지 최대 30초 (Vercel 함수 기본 제한 300초 안)
  client ??= new Anthropic({ maxRetries: 0, timeout: 15_000 });
  return client;
}

async function askOnce(
  anthropic: Anthropic,
  summary: ReturnType<typeof recommendSummary>,
) {
  const response = await anthropic.beta.messages.create({
    model: RECOMMEND_MODEL,
    max_tokens: 2000,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["changes", "reason"],
          properties: {
            changes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["index", "symbol"],
                properties: {
                  index: { type: "integer" },
                  symbol: {
                    type: "string",
                    enum: summary.candidates.map((c) => c.symbol),
                  },
                },
              },
            },
            reason: { type: "string" },
          },
        },
      },
    },
    // 안전 분류기가 거절하면 서버가 다른 모델로 이어서 답합니다 (Anthropic 권장 기본값).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(summary) }],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  try {
    return SuggestionSchema.safeParse(JSON.parse(text)).data ?? null;
  } catch {
    return null;
  }
}

/** 재추천한 진행과 설명, 또는 만들지 못하면 null. 형식이 틀리면 한 번 더 묻습니다. */
export async function recommendChords(
  input: RecommendInput,
): Promise<RecommendResult | null> {
  const anthropic = getClient();
  const key = parseKey(input.key);
  if (!anthropic || !key || input.chords.length === 0) return null;
  const summary = recommendSummary(input, key);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const suggestion = await askOnce(anthropic, summary);
      if (!suggestion) continue;
      const { chords, changed } = applySuggestions(
        input,
        key,
        suggestion.changes,
      );
      return {
        chords,
        changed,
        explanation: explanationFor(input, key, chords, suggestion.reason),
      };
    } catch (error) {
      // 시간 초과 · 네트워크 · 한도(429) 등은 곡을 바꾸지 않습니다.
      console.error("코드를 재추천하지 못했어요", error);
      return null;
    }
  }
  return null;
}

/** Claude의 이유 문장이 검사를 통과하면 그것을, 아니면 규칙 엔진 설명을 새 진행으로 다시 만듭니다. */
function explanationFor(
  input: RecommendInput,
  key: Key,
  chords: Chord[],
  reason: string,
): string {
  const symbols = [...chords, ...input.chords].map((c) => c.symbol);
  const reasonOk = checkPolished(reason, {
    // 키 이름 속 으뜸음("Bb단조"의 Bb)이 진행에 없는 코드 이름으로 읽히지 않도록 알려 둡니다.
    explanation: koreanKeyName(key),
    keyName: koreanKeyName(key),
    chordSymbols: symbols,
    styleLabel: "",
    bpm: input.bpm,
  });
  if (reasonOk) return reason.trim();
  return buildExplanation({
    key,
    histogram: pitchClassHistogram(input.melody),
    chordSymbols: chords.map((c) => c.symbol),
    style: input.style,
    bpm: input.bpm,
    notesPerBar: input.melody.length / Math.max(1, chords.length),
  });
}
