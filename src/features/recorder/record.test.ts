import { describe, expect, test } from "vitest";
import { frequencyToMidi } from "./notes";
import { RecorderError, toFrame, toRecorderError } from "./record";

const SAMPLE_RATE = 44100;

function sine(frequency: number, amplitude = 0.3, length = 2048) {
  return Float32Array.from(
    { length },
    (_, i) => amplitude * Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE),
  );
}

function noise(amplitude = 0.3, length = 2048) {
  // 매번 같은 결과가 나오게 간단한 의사 난수
  let seed = 1;
  return Float32Array.from({ length }, () => {
    seed = (seed * 16807) % 2147483647;
    return amplitude * ((seed / 2147483647) * 2 - 1);
  });
}

describe("toFrame", () => {
  test("440Hz 사인파는 A4(MIDI 69)", () => {
    const frame = toFrame(sine(440), SAMPLE_RATE, 1.5);
    expect(frame.time).toBe(1.5);
    expect(Math.round(frequencyToMidi(frame.frequency!))).toBe(69);
    expect(frame.volume).toBeGreaterThan(0);
  });

  test("허밍 높이(C3 · C5)도 찾는다", () => {
    expect(
      Math.round(
        frequencyToMidi(toFrame(sine(130.81), SAMPLE_RATE, 0).frequency!),
      ),
    ).toBe(48);
    expect(
      Math.round(
        frequencyToMidi(toFrame(sine(523.25), SAMPLE_RATE, 0).frequency!),
      ),
    ).toBe(72);
  });

  test("무음은 frequency null", () => {
    const frame = toFrame(new Float32Array(2048), SAMPLE_RATE, 0);
    expect(frame.frequency).toBeNull();
    expect(frame.volume).toBe(0);
  });

  test("아주 작은 소리는 무음으로 본다", () => {
    expect(toFrame(sine(440, 0.005), SAMPLE_RATE, 0).frequency).toBeNull();
  });

  test("음정이 없는 잡음은 null", () => {
    expect(toFrame(noise(), SAMPLE_RATE, 0).frequency).toBeNull();
  });

  test("허밍 범위 밖(너무 높음)은 null", () => {
    expect(toFrame(sine(2000), SAMPLE_RATE, 0).frequency).toBeNull();
  });

  test("detector의 clarity가 낮으면 null", () => {
    const detector = { findPitch: () => [440, 0.5] as [number, number] };
    expect(toFrame(sine(440), SAMPLE_RATE, 0, detector).frequency).toBeNull();
  });
});

describe("toRecorderError", () => {
  const domError = (name: string) =>
    Object.assign(new Error(name), { name }) as Error;

  test.each([
    ["NotAllowedError", "permission-denied"],
    ["SecurityError", "permission-denied"],
    ["NotFoundError", "no-device"],
    ["OverconstrainedError", "no-device"],
    ["NotSupportedError", "unsupported"],
    ["AbortError", "failed"],
  ])("%s → %s", (name, code) => {
    expect(toRecorderError(domError(name)).code).toBe(code);
  });

  test("이미 RecorderError면 그대로", () => {
    const error = new RecorderError("unsupported");
    expect(toRecorderError(error)).toBe(error);
  });

  test("Error가 아닌 값도 failed", () => {
    expect(toRecorderError("oops").code).toBe("failed");
  });
});
