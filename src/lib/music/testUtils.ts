// 테스트용 멜로디를 짧게 적기 위한 도우미. 테스트 파일에서만 씁니다.
import type { Note } from "@/types/song";

/**
 * [MIDI 번호, 길이(step)] 목록을 이어 붙인 멜로디로 만듭니다.
 * pitch가 null이면 그 길이만큼 쉼표입니다.
 */
export function melodyOf(...parts: [number | null, number][]): Note[] {
  const notes: Note[] = [];
  let position = 0;
  for (const [pitch, duration] of parts) {
    if (pitch !== null)
      notes.push({ pitch, start: position, duration, velocity: 0.8 });
    position += duration;
  }
  return notes;
}

/** 모든 음을 semitones만큼 옮깁니다. */
export function transpose(melody: Note[], semitones: number): Note[] {
  return melody.map((note) => ({ ...note, pitch: note.pitch + semitones }));
}
