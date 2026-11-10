// 음표를 박자 격자에 맞춥니다. 1 step = 16분음표.
// - quantize: 녹음 직후, 초 단위 음표 → step 단위 Note
// - snapNotes: 이미 step 단위인 멜로디를 더 큰 격자로 다시 맞추기 (보정 단계의 "박자 맞추기")
import type { Note, Step } from "@/types/song";
import type { RawNote } from "./notes";

/**
 * @param bpm 녹음할 때의 빠르기. 녹음 시작(카운트인이 끝난 순간)을 0초 = 첫 박으로 봅니다.
 * @param grid 맞출 격자 크기(step). 1 = 16분음표, 2 = 8분음표, 4 = 4분음표
 */
export function quantize(
  notes: RawNote[],
  bpm: number,
  grid: Step = 1,
): Note[] {
  const secondsPerStep = 60 / bpm / 4;
  return fitToGrid(
    notes.map((note) => ({
      pitch: Math.round(note.pitch),
      start: note.start / secondsPerStep,
      end: note.end / secondsPerStep,
      velocity: note.velocity,
    })),
    grid,
  );
}

/**
 * @param grid 맞출 격자 크기(step). 목업의 스냅 단위: 1(1/16) · 2(1/8) · 4(1박) · 마디 길이(1마디)
 */
export function snapNotes(notes: Note[], grid: Step): Note[] {
  return fitToGrid(
    notes.map((note) => ({ ...note, end: note.start + note.duration })),
    grid,
  );
}

/** start · end가 step 단위(소수 가능)인 음표를 grid 칸에 맞추고 겹침을 정리합니다 */
function fitToGrid(
  notes: { pitch: number; start: number; end: number; velocity: number }[],
  grid: Step,
): Note[] {
  const snap = (step: number) => Math.max(0, Math.round(step / grid) * grid);

  const snapped = notes
    .map((note) => {
      const start = snap(note.start);
      const end = Math.max(snap(note.end), start + grid);
      return {
        note: {
          pitch: Math.min(127, Math.max(0, note.pitch)),
          start,
          duration: end - start,
          velocity: Math.min(1, Math.max(0, note.velocity)),
        },
        length: note.end - note.start,
      };
    })
    .sort((a, b) => a.note.start - b.note.start);

  // 멜로디는 한 번에 한 음입니다. 같은 칸에 걸린 음은 원래 더 길었던 음을 남기고,
  // 앞 음이 다음 음과 겹치면 앞 음을 다음 음 시작에서 자릅니다.
  const result: { note: Note; length: number }[] = [];
  for (const item of snapped) {
    const last = result.at(-1);
    if (last && last.note.start === item.note.start) {
      if (item.length > last.length) result[result.length - 1] = item;
      continue;
    }
    if (last && last.note.start + last.note.duration > item.note.start) {
      last.note.duration = item.note.start - last.note.start;
    }
    result.push(item);
  }
  return result.map(({ note }) => note);
}
