// 타임라인 배치 계산. 화면과 떼어 두어 테스트하기 쉽게 합니다.
import { stepsPerBar } from "@/app/studio/[id]/_components/transport";
import type { Note, SongState } from "@/types/song";

/** 타임라인이 그리는 데 쓰는 곡 데이터. 제목 · 빠르기가 바뀌어도 다시 그리지 않도록 이것만 구독합니다 */
export type TimelineSong = Pick<
  SongState,
  "melody" | "chords" | "accompaniment" | "timeSignature"
>;

/** 왼쪽 줄 이름 칸 폭(px) */
export const LABEL_WIDTH = 64;
/** 1 step(16분음표)의 가로 폭(px). 타임라인 칸 폭을 재기 전(첫 화면, 테스트)에 씁니다 */
export const STEP_WIDTH = 12;
/** 칸 폭에 맞춰 줄일 때의 최소 step 폭(px). 이보다 좁아지면 가로 스크롤 */
export const MIN_STEP_WIDTH = 6;
/** 곡이 짧거나 비어 있어도 보여 줄 최소 마디 수 (목업 기준) */
export const MIN_BARS = 8;

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

/** 타임라인 전체 길이(step). 마지막 음이 들어가는 마디까지, 최소 MIN_BARS 마디 */
export function timelineSteps(song: TimelineSong) {
  const barSteps = stepsPerBar(song.timeSignature);
  const { drums = [], bass = [], keys = [] } = song.accompaniment ?? {};
  let end = 0;
  for (const item of [
    ...song.melody,
    ...song.chords,
    ...drums,
    ...bass,
    ...keys,
  ]) {
    end = Math.max(end, item.start + item.duration);
  }
  return Math.max(Math.ceil(end / barSteps), MIN_BARS) * barSteps;
}

/**
 * 타임라인 칸 폭(px)에 전체 길이가 꽉 차도록 step 폭을 정합니다.
 * 폭을 아직 모르면(0) STEP_WIDTH, 곡이 길어 너무 좁아지면 MIN_STEP_WIDTH.
 */
export function fitStepWidth(containerWidth: number, totalSteps: number) {
  if (containerWidth <= 0) return STEP_WIDTH;
  return Math.max(MIN_STEP_WIDTH, (containerWidth - LABEL_WIDTH) / totalSteps);
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
