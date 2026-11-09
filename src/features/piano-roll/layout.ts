// 타임라인 배치 계산. 화면과 떼어 두어 테스트하기 쉽게 합니다.
import {
  countBars,
  stepsPerBar,
} from "@/app/studio/[id]/_components/transport";
import type { Note, SongState } from "@/types/song";

/** 1 step(16분음표)의 가로 폭(px) */
export const STEP_WIDTH = 12;
/** 곡이 짧거나 비어 있어도 보여 줄 최소 마디 수 */
export const MIN_BARS = 4;

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/** MIDI 번호 → "C4" */
export function noteName(pitch: number) {
  return `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

/** 타임라인 전체 길이(step). 마디 단위로 맞추고 최소 MIN_BARS 마디 */
export function timelineSteps(song: SongState) {
  return Math.max(countBars(song), MIN_BARS) * stepsPerBar(song.timeSignature);
}

/**
 * 음표를 그릴 음 높이 범위 [낮은 음, 높은 음]. 위아래로 한 음씩 여유를 두고,
 * minSpan 반음보다 좁으면 가운데를 기준으로 넓힙니다. 음표가 없으면 C4 옥타브.
 */
export function pitchRange(notes: Note[], minSpan = 12): [number, number] {
  if (notes.length === 0) return [60, 60 + minSpan - 1];
  let low = Math.min(...notes.map((n) => n.pitch)) - 1;
  let high = Math.max(...notes.map((n) => n.pitch)) + 1;
  const missing = minSpan - (high - low + 1);
  if (missing > 0) {
    low -= Math.floor(missing / 2);
    high += Math.ceil(missing / 2);
  }
  return [Math.max(0, low), Math.min(127, high)];
}
