// 분석 근거로 문장 틀을 채워 기본 설명을 만듭니다.
// LLM이 이 문장을 다듬지만, 실패하면 이 문장이 그대로 화면에 나갑니다.
import type { Style } from "@/types/song";
import { pitchClassName, usesFlats, type Key } from "./theory";

const STYLE_LABEL: Record<Style, string> = {
  pop: "팝",
  ballad: "발라드",
  rock: "록",
};

/** 진행을 너무 길게 늘어놓지 않도록 앞부분만 보여 줍니다. */
const MAX_CHORDS_IN_TEXT = 8;

export function koreanKeyName(key: Key): string {
  return `${pitchClassName(key.tonic, usesFlats(key))}${key.mode === "major" ? "장조" : "단조"}`;
}

export type ExplanationInput = {
  key: Key;
  histogram: number[];
  chordSymbols: string[];
  style: Style;
  bpm: number;
  notesPerBar: number;
};

export function buildExplanation({
  key,
  histogram,
  chordSymbols,
  style,
  bpm,
  notesPerBar,
}: ExplanationInput): string {
  if (chordSymbols.length === 0) {
    return `멜로디가 비어 있어 기본값(${koreanKeyName(key)}, ${STYLE_LABEL[style]})을 사용했습니다.`;
  }

  const flats = usesFlats(key);
  const topNotes = histogram
    .map((weight, pc) => ({ weight, pc }))
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(({ pc }) => pitchClassName(pc, flats));

  const shown = chordSymbols.slice(0, MAX_CHORDS_IN_TEXT).join(" → ");
  const progression =
    chordSymbols.length > MAX_CHORDS_IN_TEXT ? `${shown} …` : shown;
  const mood = key.mode === "major" ? "밝은" : "어두운";

  return [
    `멜로디에 ${topNotes.join(", ")} 음이 많이 쓰여 ${koreanKeyName(key)}로 판단했습니다.`,
    `마디마다 멜로디 음과 가장 잘 어울리면서 자연스럽게 이어지는 코드를 골라 ${progression}로 진행합니다.`,
    `템포 ${Math.round(bpm)}BPM, ${mood} 분위기, 마디당 평균 ${notesPerBar.toFixed(1)}개 음을 고려해 ${STYLE_LABEL[style]} 스타일을 추천합니다.`,
  ].join(" ");
}
