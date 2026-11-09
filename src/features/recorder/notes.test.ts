import { describe, expect, test } from "vitest";
import { framesToNotes, frequencyToMidi, type PitchFrame } from "./notes";

const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;

/** [주파수, 길이(초)] 구간들을 10ms 간격 프레임으로 펼칩니다 */
function hum(...parts: [number | null, number][]): PitchFrame[] {
  const frames: PitchFrame[] = [];
  let time = 0;
  for (const [frequency, seconds] of parts) {
    for (let i = 0; i < Math.round(seconds * 100); i++) {
      frames.push({ time: Number(time.toFixed(2)), frequency });
      time += 0.01;
    }
  }
  return frames;
}

describe("frequencyToMidi", () => {
  test("A4(440Hz)는 69, C4는 60", () => {
    expect(frequencyToMidi(440)).toBe(69);
    expect(Math.round(frequencyToMidi(C4))).toBe(60);
  });
});

describe("framesToNotes", () => {
  test("빈 녹음과 무음만 있는 녹음은 빈 배열", () => {
    expect(framesToNotes([])).toEqual([]);
    expect(framesToNotes(hum([null, 1]))).toEqual([]);
  });

  test("같은 음이 이어지는 프레임을 한 음표로 묶는다", () => {
    const notes = framesToNotes(
      hum([C4, 0.5], [D4, 0.5], [null, 0.2], [E4, 0.3]),
    );
    expect(notes.map((n) => n.pitch)).toEqual([60, 62, 64]);
    expect(notes[0].start).toBe(0);
    expect(notes[0].end).toBeCloseTo(0.5);
    expect(notes[1].end).toBeCloseTo(1.0);
    expect(notes[2].start).toBeCloseTo(1.2);
    expect(notes[2].end).toBeCloseTo(1.5);
  });

  test("짧은 잡음은 버린다", () => {
    const notes = framesToNotes(
      hum([C4, 0.4], [null, 0.2], [E4, 0.03], [null, 0.2]),
    );
    expect(notes.map((n) => n.pitch)).toEqual([60]);
  });

  test("잡음 때문에 잠깐 끊긴 같은 음은 다시 잇는다", () => {
    const notes = framesToNotes(hum([C4, 0.4], [null, 0.03], [C4, 0.4]));
    expect(notes).toHaveLength(1);
    expect(notes[0].end).toBeCloseTo(0.83);
  });

  test("음 높이가 한 프레임 튀어도 음표가 쪼개지지 않는다", () => {
    const frames = hum([C4, 0.5]);
    frames[20].frequency = D4;
    expect(framesToNotes(frames).map((n) => n.pitch)).toEqual([60]);
  });

  test("세기는 프레임 음량의 평균, 음량이 없으면 기본값", () => {
    const frames = hum([C4, 0.2]).map((f, i) => ({
      ...f,
      volume: i % 2 ? 0.4 : 0.6,
    }));
    expect(framesToNotes(frames)[0].velocity).toBeCloseTo(0.5);
    expect(framesToNotes(hum([C4, 0.2]))[0].velocity).toBe(0.8);
  });
});
