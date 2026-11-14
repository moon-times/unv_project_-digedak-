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

  test("검출이 짧게 자주 끊긴 긴 음도 사라지지 않고 한 음이 된다", () => {
    // 0.04초 소리 + 0.02초 무음이 1초 동안 반복 → 조각 하나하나는 minDuration보다 짧음
    const parts: [number | null, number][] = [];
    for (let i = 0; i < 16; i++) parts.push([C4, 0.04], [null, 0.02]);
    const notes = framesToNotes(hum(...parts));
    expect(notes).toHaveLength(1);
    expect(notes[0].pitch).toBe(60);
    expect(notes[0].end - notes[0].start).toBeGreaterThan(0.9);
  });

  test("다른 음 잡음이 끼어 끊긴 같은 음도 다시 잇는다", () => {
    const notes = framesToNotes(hum([C4, 0.4], [E4, 0.03], [C4, 0.4]));
    expect(notes.map((n) => n.pitch)).toEqual([60]);
  });

  test("다음 프레임이 늦게 와도 앞 음이 늘어나지 않는다", () => {
    const frames = hum([C4, 0.3]);
    // 0.29초 다음 프레임이 0.8초에야 도착 (탭 전환 등)
    frames.push({ time: 0.8, frequency: E4 }, { time: 0.81, frequency: E4 });
    const [first] = framesToNotes(frames, { minDuration: 0 });
    expect(first.end).toBeCloseTo(0.31);
  });

  test("음 높이가 한 프레임 튀어도 음표가 쪼개지지 않는다", () => {
    const frames = hum([C4, 0.5]);
    frames[20].frequency = D4;
    expect(framesToNotes(frames).map((n) => n.pitch)).toEqual([60]);
  });

  test("세기는 음마다 음량 평균, 가장 큰 음이 0.9가 되게 같은 비율로 키움 (마이크가 작아도 들리게)", () => {
    // 작은 마이크: C4 평균 0.1, E4 평균 0.05 → 0.9, 0.45 (강약 2:1은 그대로)
    const frames = hum([C4, 0.2], [null, 0.1], [E4, 0.2]).map((f, i) => ({
      ...f,
      volume: f.time < 0.2 ? (i % 2 ? 0.08 : 0.12) : 0.05,
    }));
    const [c, e] = framesToNotes(frames);
    expect(c.velocity).toBeCloseTo(0.9);
    expect(e.velocity).toBeCloseTo(0.45);
  });

  test("음량이 없으면 기본값 0.8", () => {
    expect(framesToNotes(hum([C4, 0.2]))[0].velocity).toBe(0.8);
  });
});
