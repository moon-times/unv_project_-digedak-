// AI 리터치: Claude가 마디 정보를 보고 편곡 계획(구간마다 악기 연주 방식 · 세기)을 세웁니다. 서버(/api/retouch)에서만 씁니다.
// 음표는 만들지 않고 계획만 받으며, 실제 음표는 브라우저 반주 엔진(generateAccompaniment)이 계획대로 만듭니다.
// docs/specs/08_llm-retouch/design.md §4
import Anthropic from "@anthropic-ai/sdk";
import { ArrangementDraftSchema } from "@/lib/schemas";
import { countBars, stepsPerBar } from "@/lib/transport";
import { STYLE_LABEL } from "@/lib/music";
import {
  BASS_FEELS,
  DRUM_FEELS,
  GUITAR_FEELS,
  KEYS_FEELS,
  SECTION_ROLES,
  type ArrangementPlan,
  type ArrangementSection,
  type SongState,
} from "@/types/song";

export const RETOUCH_MODEL = "claude-sonnet-5-5";
/**
 * 이보다 긴 곡은 LLM에 보내지 않습니다 (계획 구간 상한과 같은 값, 30초 녹음은 180BPM이어도 23마디).
 * 저장된 곡은 사용자가 DB에 직접 쓸 수 있어, 상한이 없으면 음표 하나로 수백만 마디 요약을 만들게 할 수 있습니다.
 */
export const MAX_RETOUCH_BARS = 64;

/** LLM이 돌려주는 계획 (전환 상태 enabled는 화면이 정합니다) */
export type ArrangementDraft = Omit<ArrangementPlan, "enabled">;

const SYSTEM_PROMPT = `너는 흥얼거린 멜로디로 반주를 만들어 주는 음악 앱 "딕으닥"의 편곡자다.
곡의 마디별 정보(코드, 멜로디 음 개수, 평균 음높이, 쉬는 비율)를 보고 곡을 구간으로 나눠, 구간마다 악기를 어떻게 연주할지 정한다.
지금 반주는 처음부터 끝까지 같은 패턴이라 밋밋하다. 들었을 때 확실히 달라졌다고 느낄 만큼 대비를 크게 만든다.

흐름의 기본:
- 조용하게 시작(intro, 세기 1~2, 드럼 none 또는 half, 건반 pad)
- 쌓아 올림(verse → build, 세기를 한 단계씩 올림, 필인으로 다음 구간을 예고)
- 멜로디가 높고 음이 많은 곳을 코러스로 잡아 가장 크게(세기 5, 드럼 double, 베이스 octave, 시작에 크래시)
- 곡이 길면 코러스 뒤에 한 번 비우기(break, 악기 대부분 rest)
- 마무리(outro, 세기를 낮추거나 endingHit로 한 번에 끝냄)
- 곡이 짧으면(8마디 이하) 2~3구간이면 충분하다.

값의 뜻:
- drums: none(없음) / half(느린 반박자) / normal(장르 기본) / double(킥 매 박 + 16분 하이햇, 가장 꽉 참)
- bass: rest(없음) / long(마디마다 근음 하나 길게) / normal(장르 기본) / octave(8분음표 근음 · 옥타브, 달리는 느낌)
- keys: rest / pad(마디마다 화음 하나 길게) / normal / arpeggio(8분 분산화음)
- guitar: rest / normal / arpeggio(핑거피킹) / power(8분 파워코드, 강함)
- energy: 1~5, 음 세기
- fillAtEnd: 구간 마지막 박에 탐 필인 / crashAtStart: 구간 첫 박 크래시 / endingHit: 곡 마지막 마디를 한 번에 치고 끝냄

지킬 것:
- 마디 번호는 0부터, endBar는 그 마디 앞까지. 구간은 0번 마디부터 마지막 마디까지 빈틈없이, 겹치지 않게 순서대로.
- summary는 무엇을 어떻게 바꿨는지 "~했어요"체 1~2문장. 음악을 배운 적 없는 사람도 알아듣는 말로.`;

/** 구조화된 출력용 JSON 스키마. 숫자 범위 같은 제약은 받은 뒤 Zod와 normalizePlan이 검사합니다. */
const PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sections", "endingHit", "summary"],
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "startBar",
          "endBar",
          "role",
          "energy",
          "drums",
          "bass",
          "keys",
          "guitar",
          "fillAtEnd",
          "crashAtStart",
        ],
        properties: {
          startBar: { type: "integer" },
          endBar: { type: "integer" },
          role: { type: "string", enum: [...SECTION_ROLES] },
          energy: { type: "integer", enum: [1, 2, 3, 4, 5] },
          drums: { type: "string", enum: [...DRUM_FEELS] },
          bass: { type: "string", enum: [...BASS_FEELS] },
          keys: { type: "string", enum: [...KEYS_FEELS] },
          guitar: { type: "string", enum: [...GUITAR_FEELS] },
          fillAtEnd: { type: "boolean" },
          crashAtStart: { type: "boolean" },
        },
      },
    },
    endingHit: { type: "boolean" },
    summary: { type: "string" },
  },
};

/** LLM에 넘길 곡 요약: 마디마다 코드 · 멜로디 음 개수 · 평균 음높이 · 쉬는 비율 */
export function summarizeSong(song: SongState) {
  const barSteps = stepsPerBar(song.timeSignature);
  const bars = Array.from({ length: countBars(song) }, (_, bar) => {
    const start = bar * barSteps;
    const end = start + barSteps;
    const notes = song.melody.filter((n) => n.start >= start && n.start < end);
    const covered = new Set<number>();
    for (const n of song.melody)
      for (
        let s = Math.max(n.start, start);
        s < Math.min(n.start + n.duration, end);
        s++
      )
        covered.add(s);
    return {
      bar,
      chord:
        song.chords.find(
          (c) => c.start <= start && start < c.start + c.duration,
        )?.symbol ?? null,
      notes: notes.length,
      avgPitch: notes.length
        ? Math.round(notes.reduce((sum, n) => sum + n.pitch, 0) / notes.length)
        : null,
      rest: Math.round((1 - covered.size / barSteps) * 100) / 100,
    };
  });
  return {
    barCount: bars.length,
    style: STYLE_LABEL[song.style],
    bpm: Math.round(song.bpm),
    timeSignature: song.timeSignature.join("/"),
    bars,
  };
}

/**
 * 받은 구간을 곡 안으로 맞춥니다: 마디를 [0, barCount) 안으로 자르고, 시작 순으로 정렬하고,
 * 겹치면 앞 구간을 살립니다. 남는 구간이 없으면 null.
 */
export function normalizePlan(
  draft: ArrangementDraft,
  barCount: number,
): ArrangementDraft | null {
  const sections: ArrangementSection[] = [];
  const sorted = [...draft.sections].sort((a, b) => a.startBar - b.startBar);
  for (const section of sorted) {
    const prevEnd = sections.at(-1)?.endBar ?? 0;
    const startBar = Math.max(section.startBar, prevEnd, 0);
    const endBar = Math.min(section.endBar, barCount);
    if (startBar < endBar) sections.push({ ...section, startBar, endBar });
  }
  if (sections.length === 0) return null;
  return { ...draft, sections, summary: draft.summary.trim() };
}

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // 요청마다 30초, 형식이 틀려 다시 묻는 것(1회)까지 최대 60초 (Vercel 함수 기본 제한 300초 안)
  client ??= new Anthropic({ maxRetries: 0, timeout: 30_000 });
  return client;
}

async function askOnce(anthropic: Anthropic, song: SongState) {
  const response = await anthropic.beta.messages.create({
    model: RETOUCH_MODEL,
    max_tokens: 4000,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: PLAN_JSON_SCHEMA },
    },
    // 안전 분류기가 거절하면 서버가 다른 모델로 이어서 답합니다 (Anthropic 권장 기본값).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(summarizeSong(song)) }],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** 곡에 맞춘 편곡 계획, 또는 만들지 못하면 null. 형식이 틀리면 한 번 더 묻습니다. */
export async function planArrangement(
  song: SongState,
): Promise<ArrangementDraft | null> {
  const anthropic = getClient();
  const barCount = countBars(song);
  if (!anthropic || barCount === 0 || barCount > MAX_RETOUCH_BARS) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = ArrangementDraftSchema.safeParse(
        await askOnce(anthropic, song),
      );
      const plan = parsed.success && normalizePlan(parsed.data, barCount);
      if (plan) return plan;
    } catch (error) {
      // 시간 초과 · 네트워크 · 한도(429) 등은 리터치 실패로 (횟수는 깎지 않음)
      console.error("편곡 계획을 만들지 못했어요", error);
      return null;
    }
  }
  return null;
}
