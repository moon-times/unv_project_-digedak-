import { describe, expect, test } from "vitest";
import { NoteSchema } from "@/lib/schemas";
import type { RawNote } from "./notes";
import { quantize, snapNotes } from "./quantize";

// 120 BPM에서 1 step(16분음표) = 0.125초
const raw = (pitch: number, start: number, end: number): RawNote => ({
  pitch,
  start,
  end,
  velocity: 0.8,
});

describe("quantize", () => {
  test("초 단위 음표를 가장 가까운 16분음표 칸에 맞춘다", () => {
    expect(quantize([raw(60, 0.02, 0.48), raw(62, 0.51, 1.1)], 120)).toEqual([
      { pitch: 60, start: 0, duration: 4, velocity: 0.8 },
      { pitch: 62, start: 4, duration: 5, velocity: 0.8 },
    ]);
  });

  test("grid로 더 큰 격자에 맞출 수 있다", () => {
    // grid 4 = 4분음표(0.5초)
    expect(quantize([raw(60, 0.3, 0.9)], 120, 4)).toEqual([
      { pitch: 60, start: 4, duration: 4, velocity: 0.8 },
    ]);
  });

  test("격자보다 짧은 음도 최소 한 칸 길이를 가진다", () => {
    expect(quantize([raw(60, 0.5, 0.52)], 120)[0]).toMatchObject({
      start: 4,
      duration: 1,
    });
  });

  test("같은 칸에 걸린 음은 원래 더 길었던 음만 남긴다", () => {
    const notes = quantize([raw(60, 0.0, 0.05), raw(62, 0.04, 0.5)], 120);
    expect(notes).toEqual([
      { pitch: 62, start: 0, duration: 4, velocity: 0.8 },
    ]);
  });

  test("겹치는 앞 음은 다음 음 시작에서 자른다", () => {
    // 앞 음 끝(0.7초)은 6칸, 다음 음 시작(0.45초)은 4칸
    const notes = quantize([raw(60, 0, 0.7), raw(62, 0.45, 1)], 120);
    expect(notes.map((n) => [n.start, n.duration])).toEqual([
      [0, 4],
      [4, 4],
    ]);
  });

  test("결과는 공용 Note 스키마를 통과한다", () => {
    const notes = quantize(
      [raw(59.6, 0.13, 0.4), { ...raw(130, 0.7, 1.2), velocity: 1.3 }],
      97,
    );
    for (const note of notes) {
      expect(NoteSchema.safeParse(note).success).toBe(true);
    }
  });
});

describe("snapNotes", () => {
  const note = (pitch: number, start: number, duration: number) => ({
    pitch,
    start,
    duration,
    velocity: 0.8,
  });

  test("step 단위 멜로디를 더 큰 격자로 다시 맞춘다", () => {
    // 1박(4 step) 격자
    expect(snapNotes([note(60, 1, 3), note(62, 5, 4)], 4)).toEqual([
      note(60, 0, 4),
      note(62, 4, 4),
    ]);
  });

  test("1마디 격자에서는 같은 마디에 걸린 음 중 긴 음만 남는다", () => {
    expect(snapNotes([note(60, 0, 3), note(64, 2, 10)], 16)).toEqual([
      note(64, 0, 16),
    ]);
  });

  test("이미 격자에 맞는 멜로디는 그대로", () => {
    const melody = [note(60, 0, 4), note(62, 4, 2), note(64, 8, 8)];
    expect(snapNotes(melody, 2)).toEqual(melody);
  });
});
