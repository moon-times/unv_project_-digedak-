// 규칙 엔진의 설명 문장을 Claude가 읽기 쉽게 다듬습니다. 서버(/api/analyze)에서만 씁니다.
// 값(키 · 코드 · 장르 · BPM)은 바꾸지 않고 문장만 바꾸며, 검사에 걸리거나 실패하면 null을 돌려줍니다.
// docs/specs/07_llm-explanation/design.md §3
import Anthropic from "@anthropic-ai/sdk";

export const POLISH_MODEL = "claude-sonnet-5-5";
/** 다듬은 설명의 최대 길이(글자) */
export const MAX_POLISHED_LENGTH = 400;

export type PolishInput = {
  explanation: string;
  /** 한국어 키 이름. 다듬은 문장에 그대로 있어야 합니다 (예: "다장조") */
  keyName: string;
  chordSymbols: string[];
  styleLabel: string;
  bpm: number;
};

const SYSTEM_PROMPT = `너는 흥얼거린 멜로디로 반주를 만들어 주는 음악 앱 "딕으닥"의 설명을 다듬는다.
앱이 계산한 분석 설명을 받아, 음악을 배운 적 없는 사람도 이해할 수 있게 고쳐 쓴다.

지킬 것:
- "~해요"체로 3문장 이내.
- 키 이름, 코드 이름, 장르, 빠르기(BPM) 값은 받은 그대로 쓴다. 바꾸거나 새로 지어내지 않는다. 키 이름은 반드시 한 번 쓴다.
- 받은 설명에 없는 사실(악기, 감정 단정, 다른 코드 제안)을 덧붙이지 않는다.
- 다듬은 설명 문장만 출력한다. 인사, 머리말, 따옴표, 마크다운 없이.`;

/** 코드 기호처럼 보이는 낱말 (C, F#m, Bbmaj7, G7, Asus4, Bdim …). 한글 문장 속에서도 잡히게 앞뒤를 영문자 경계로 봅니다 */
const CHORD_PATTERN =
  /(?<![A-Za-z])[A-G](?:#|b)?(?:maj7|m7b5|m7|m|dim7|dim|aug|sus2|sus4|7|6|9)?(?:\/[A-G](?:#|b)?)?(?![A-Za-z0-9#])/g;

/** 다듬은 문장을 써도 되는지: 비어 있지 않고, 길이 안, 키 이름 그대로, 원래 설명 · 진행에 없는 코드를 지어내지 않음 */
export function checkPolished(text: string, input: PolishInput): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_POLISHED_LENGTH)
    return false;
  if (!trimmed.includes(input.keyName)) return false;
  // 원래 설명에 있던 기호(음 이름 "C, E, G" 등)와 코드 진행은 써도 됩니다.
  const known = new Set([
    ...input.chordSymbols,
    ...(input.explanation.match(CHORD_PATTERN) ?? []),
  ]);
  return (trimmed.match(CHORD_PATTERN) ?? []).every((symbol) =>
    known.has(symbol),
  );
}

let client: Anthropic | null = null;

/** ANTHROPIC_API_KEY가 없으면 다듬지 않습니다 (개발 · 미리보기에서도 흐름은 그대로). */
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // 요청마다 15초라, 검사에 걸려 다시 묻는 것(1회)까지 /api/analyze는 최대 30초 걸립니다 (Vercel 함수 기본 제한 300초 안).
  client ??= new Anthropic({ maxRetries: 0, timeout: 15_000 });
  return client;
}

async function askOnce(anthropic: Anthropic, input: PolishInput) {
  const response = await anthropic.beta.messages.create({
    model: POLISH_MODEL,
    max_tokens: 2000,
    output_config: { effort: "low" },
    // 안전 분류기가 거절하면 서버가 다른 모델로 이어서 답합니다 (Anthropic 권장 기본값).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `분석 설명: ${input.explanation}`,
          `키 이름: ${input.keyName}`,
          `코드 진행: ${input.chordSymbols.join(" → ")}`,
          `장르: ${input.styleLabel}`,
          `빠르기: ${Math.round(input.bpm)}BPM`,
        ].join("\n"),
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
}

/** 다듬은 문장, 또는 쓰지 못하면 null. 검사에 걸리면 한 번 더 묻습니다. */
export async function polishExplanation(
  input: PolishInput,
): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await askOnce(anthropic, input);
      if (text && checkPolished(text, input)) return text;
    } catch (error) {
      // 시간 초과 · 네트워크 · 한도(429) 등은 규칙 엔진 설명으로 넘어갑니다.
      console.error("설명을 다듬지 못했어요", error);
      return null;
    }
  }
  return null;
}
