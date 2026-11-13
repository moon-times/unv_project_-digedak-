// 피아노롤 편집 계산. 화면과 떼어 두어 테스트하기 쉽게 합니다.
// 멜로디는 한 번에 한 음입니다(quantize와 같은 규칙). 고친 음이 다른 음과 겹치면
// 앞 음은 고친 음 시작에서 자르고, 고친 음은 다음 음 시작에서 자릅니다(옆 음을 몰래 지우지 않게).
// 같은 칸에서 시작하는 음만 고친 음으로 바뀝니다.
import type { Note, Step } from "@/types/song";

/** 새로 넣는 음의 세기 (녹음 기본값과 같음) */
export const DEFAULT_VELOCITY = 0.8;
/** 음 오른쪽 끝에서 이 폭(px) 안을 잡으면 길이 조절 */
export const RESIZE_HANDLE_PX = 6;

const clampPitch = (pitch: number) => Math.min(127, Math.max(0, pitch));

/** grid 칸에 맞춥니다 (가까운 칸으로) */
export function snap(step: number, grid: Step) {
  return Math.max(0, Math.round(step / grid) * grid);
}

/**
 * index의 음(없으면 null = 새 음)을 note로 바꿔 넣고, 겹치는 다른 음을 정리합니다.
 * @returns 정리된 멜로디(시작 순)와 그 안에서 넣은 음의 위치
 */
export function placeNote(
  melody: Note[],
  index: number | null,
  note: Note,
): { melody: Note[]; index: number } {
  const placed: Note = {
    ...note,
    pitch: clampPitch(Math.round(note.pitch)),
    start: Math.max(0, note.start),
    duration: Math.max(1, note.duration),
  };
  const others: Note[] = [];
  melody.forEach((other, i) => {
    if (i === index) return;
    // 같은 칸에서 시작하는 음은 고친 음으로 바뀝니다.
    if (other.start === placed.start) return;
    const otherEnd = other.start + other.duration;
    // 고친 음보다 먼저 시작해 겹치는 음은 고친 음 시작에서 자릅니다.
    if (other.start < placed.start && otherEnd > placed.start) {
      others.push({ ...other, duration: placed.start - other.start });
      return;
    }
    // 고친 음 안에서 다음 음이 시작하면 고친 음을 거기서 자릅니다.
    if (other.start > placed.start)
      placed.duration = Math.min(placed.duration, other.start - placed.start);
    others.push(other);
  });
  const result = [...others, placed].sort((a, b) => a.start - b.start);
  return { melody: result, index: result.indexOf(placed) };
}

/** 빈 칸에 새 음을 넣습니다. 시작은 grid 칸 단위로 내림 */
export function addNote(
  melody: Note[],
  step: Step,
  pitch: number,
  length: Step,
  grid: Step,
) {
  return placeNote(melody, null, {
    pitch,
    start: Math.floor(step / grid) * grid,
    duration: Math.max(grid, length),
    velocity: DEFAULT_VELOCITY,
  });
}

export function deleteNote(melody: Note[], index: number): Note[] {
  return melody.filter((_, i) => i !== index);
}

/** 음을 옮긴 결과 (아직 멜로디에 넣기 전). 시작은 grid 칸에 맞추고 0 · 0 ~ 127 밖으로 나가지 않게 */
export function movedNote(
  note: Note,
  deltaSteps: number,
  deltaPitch: number,
  grid: Step,
): Note {
  return {
    ...note,
    start: snap(note.start + deltaSteps, grid),
    pitch: clampPitch(note.pitch + Math.round(deltaPitch)),
  };
}

/** 오른쪽 끝을 끌어 길이를 바꾼 결과. 끝은 grid 칸에 맞추고 최소 grid 한 칸 */
export function resizedNote(note: Note, deltaSteps: number, grid: Step): Note {
  const end = snap(note.start + note.duration + deltaSteps, grid);
  return { ...note, duration: Math.max(grid, end - note.start) };
}

/** 두 음이 같은지 (편집 전후 비교: 바뀐 게 없으면 store를 건드리지 않음) */
export function sameNote(a: Note, b: Note) {
  return (
    a.pitch === b.pitch &&
    a.start === b.start &&
    a.duration === b.duration &&
    a.velocity === b.velocity
  );
}

/** "2마디 3박" (1부터). 박 안에서 어긋나면 "2마디 3박 +1" (16분음표 칸) */
export function positionLabel(start: Step, barSteps: number, beatSteps = 4) {
  const bar = Math.floor(start / barSteps) + 1;
  const inBar = start % barSteps;
  const beat = Math.floor(inBar / beatSteps) + 1;
  const rest = inBar % beatSteps;
  return `${bar}마디 ${beat}박${rest ? ` +${rest}` : ""}`;
}

/** "1박", "2박 반", "16분음표 3개" 처럼 읽기 쉬운 길이 */
export function durationLabel(duration: Step, beatSteps = 4) {
  if (duration % beatSteps === 0) return `${duration / beatSteps}박`;
  if (duration * 2 === beatSteps) return "반 박";
  if ((duration * 2) % beatSteps === 0)
    return `${Math.floor(duration / beatSteps)}박 반`;
  return `16분음표 ${duration}개`;
}
