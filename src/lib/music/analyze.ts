// 규칙 엔진 분석의 진입점. 브라우저에서 외부 API 없이 실행됩니다.
// 결과는 /api/analyze와 같은 AnalysisResult 형식이라 LLM이 설명만 다듬어 돌려줄 수 있습니다.
import type { AnalysisResult, Note } from "@/types/song";
import { assignChords } from "./chords";
import { buildExplanation } from "./explain";
import { detectKey } from "./key";
import { recommendStyle, suggestBpm } from "./style";
import { keyName } from "./theory";

const DEFAULT_BPM = 100;

export type AnalyzeOptions = {
  /** 한 마디의 step 수. 4/4박자는 16 (1 step = 16분음표) */
  stepsPerBar?: number;
};

export function analyzeSong(
  melody: Note[],
  bpm: number,
  { stepsPerBar = 16 }: AnalyzeOptions = {},
): AnalysisResult {
  const tempo = Number.isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM;
  const { key, histogram } = detectKey(melody);
  const { chords } = assignChords(melody, key, stepsPerBar);

  const notesPerBar = chords.length === 0 ? 0 : melody.length / chords.length;
  const recommendedStyle = recommendStyle({
    bpm: tempo,
    mode: key.mode,
    notesPerBar,
  });

  return {
    key: keyName(key),
    chords,
    recommendedStyle,
    bpmSuggestion: suggestBpm(recommendedStyle, tempo),
    explanation: buildExplanation({
      key,
      histogram,
      chordSymbols: chords.map((chord) => chord.symbol),
      style: recommendedStyle,
      bpm: tempo,
      notesPerBar,
    }),
  };
}
