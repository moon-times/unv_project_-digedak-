import { afterEach, describe, expect, test } from "vitest";
import {
  getRecordingPosition,
  setRecordingPosition,
} from "./recordingPosition";

afterEach(() => setRecordingPosition(null));

describe("recordingPosition", () => {
  test("녹음 중이 아니면 null", () => {
    expect(getRecordingPosition()).toBeNull();
  });

  test("반 칸(0.5 step) 단위로 내림", () => {
    setRecordingPosition(3.7);
    expect(getRecordingPosition()).toBe(3.5);
    setRecordingPosition(4.2);
    expect(getRecordingPosition()).toBe(4);
  });

  test("0 아래는 0, null로 끝", () => {
    setRecordingPosition(-1);
    expect(getRecordingPosition()).toBe(0);
    setRecordingPosition(null);
    expect(getRecordingPosition()).toBeNull();
  });
});
