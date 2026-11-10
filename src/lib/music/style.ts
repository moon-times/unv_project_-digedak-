// 스타일 규칙: BPM, 장·단조, 음 밀도로 어울리는 장르와 템포를 고릅니다.
// 사용자가 반주 단계에서 장르를 직접 바꿀 수 있으므로 "추천"만 합니다.
import type { Style } from "@/types/song";
import type { Mode } from "./theory";

/** 장르별 자연스러운 BPM 범위 */
export const STYLE_BPM_RANGE: Record<Style, [number, number]> = {
  ballad: [60, 90],
  pop: [90, 128],
  rock: [110, 160],
};

export type StyleInput = {
  bpm: number;
  mode: Mode;
  /** 마디당 평균 음 개수 */
  notesPerBar: number;
};

export function recommendStyle({ bpm, mode, notesPerBar }: StyleInput): Style {
  if (bpm >= 128) return "rock";
  if (bpm >= 110 && notesPerBar >= 6) return "rock";
  if (bpm <= 85) return "ballad";
  if (mode === "minor" && bpm < 100) return "ballad";
  return "pop";
}

/** 녹음한 BPM을 장르 범위 안으로 맞춘 추천 템포 (정수) */
export function suggestBpm(style: Style, bpm: number): number {
  const [min, max] = STYLE_BPM_RANGE[style];
  return Math.round(Math.min(max, Math.max(min, bpm)));
}
