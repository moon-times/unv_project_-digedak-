import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getAvailableSteps, useSongStore } from "@/store/songStore";
import { getLatestRecording, setLatestRecording } from "./latestRecording";
import { RecorderError, type RecordingResult } from "./record";
import { RecordPanel } from "./RecordPanel";

// 마이크 · Web Audio는 jsdom에 없으므로 엔진을 가짜로 바꿉니다 (실제 녹음은 브라우저에서 확인).
const engine = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("./record", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./record")>()),
  startRecording: engine.start,
}));
const playerStop = vi.hoisted(() => vi.fn());
vi.mock("@/features/player", () => ({ player: { stop: playerStop } }));

const blob = new Blob(["x"], { type: "audio/webm" });
// 100 BPM에서 1 step = 0.15초. 0 ~ 0.6초 C4, 0.6 ~ 1.2초 E4
const result: RecordingResult = {
  notes: [
    { pitch: 60, start: 0, end: 0.6, velocity: 0.8 },
    { pitch: 64, start: 0.6, end: 1.2, velocity: 0.8 },
  ],
  frames: [],
  blob,
  durationSeconds: 1.2,
};

const song = () => useSongStore.getState().song;

beforeEach(() => {
  useSongStore.getState().reset();
  setLatestRecording(null);
  vi.clearAllMocks();
  engine.stop.mockResolvedValue(result);
  engine.start.mockImplementation(async (opts) => {
    opts.onStart?.();
    return { stop: engine.stop, cancel: engine.cancel };
  });
});
afterEach(cleanup);

async function record() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /녹음 시작/ }));
  });
}

describe("RecordPanel", () => {
  test("녹음 시작 → 재생을 멈추고 카운트인 4박 · 지금 BPM으로 엔진을 연다", async () => {
    render(<RecordPanel />);
    await record();
    expect(playerStop).toHaveBeenCalled();
    expect(engine.start).toHaveBeenCalledWith(
      expect.objectContaining({ countInBeats: 4, bpm: 100, maxSeconds: 30 }),
    );
    expect(screen.getByRole("button", { name: /녹음 멈추기/ })).toBeTruthy();
    expect(screen.getByTestId("record-status").textContent).toContain(
      "듣고 있어요",
    );
  });

  test("카운트인을 끄면 0박", async () => {
    render(<RecordPanel />);
    fireEvent.click(screen.getByRole("checkbox", { name: /카운트인/ }));
    await record();
    expect(engine.start).toHaveBeenCalledWith(
      expect.objectContaining({ countInBeats: 0 }),
    );
  });

  test("멈추면 퀀타이즈한 멜로디가 들어가고 보정 단계가 열린다", async () => {
    render(<RecordPanel />);
    await record();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /녹음 멈추기/ }));
    });
    expect(song().melody).toEqual([
      { pitch: 60, start: 0, duration: 4, velocity: 0.8 },
      { pitch: 64, start: 4, duration: 4, velocity: 0.8 },
    ]);
    expect(getAvailableSteps(song())).toContain("refine");
    expect(getLatestRecording()).toBe(blob);
    expect(screen.getByRole("button", { name: /다시 녹음/ })).toBeTruthy();
  });

  test("다시 녹음하면 예전 코드는 비운다", async () => {
    useSongStore
      .getState()
      .setChords([{ symbol: "C", start: 0, duration: 16 }]);
    render(<RecordPanel />);
    await record();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /녹음 멈추기/ }));
    });
    expect(song().chords).toEqual([]);
  });

  test("30초에 스스로 멈춰도 결과가 들어간다", async () => {
    engine.start.mockImplementation(async (opts) => {
      opts.onStart?.();
      setTimeout(() => opts.onAutoStop?.(result));
      return { stop: engine.stop, cancel: engine.cancel };
    });
    render(<RecordPanel />);
    await record();
    await act(() => new Promise((r) => setTimeout(r)));
    expect(song().melody).toHaveLength(2);
  });

  test("소리가 거의 없으면 멜로디를 바꾸지 않고 다시 녹음하라고 한다", async () => {
    engine.stop.mockResolvedValue({ ...result, notes: [] });
    render(<RecordPanel />);
    await record();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /녹음 멈추기/ }));
    });
    expect(song().melody).toEqual([]);
    expect(screen.getByRole("alert").textContent).toContain(
      "소리가 거의 들리지 않았어요",
    );
  });

  test("마이크 권한을 거부하면 허용 방법을 알려 준다", async () => {
    engine.start.mockRejectedValue(new RecorderError("permission-denied"));
    render(<RecordPanel />);
    await record();
    expect(screen.getByRole("alert").textContent).toContain("마이크를 허용");
    expect(screen.getByRole("button", { name: /녹음 시작/ })).toBeTruthy();
  });

  test("마이크가 없으면 연결하라고 한다", async () => {
    engine.start.mockRejectedValue(
      Object.assign(new Error(), { name: "NotFoundError" }),
    );
    render(<RecordPanel />);
    await record();
    expect(screen.getByRole("alert").textContent).toContain("마이크를 찾지");
  });

  test("빠르기 입력은 store BPM을 바꾸고, 범위 밖은 칸을 벗어날 때 맞춘다", () => {
    render(<RecordPanel />);
    const input = screen.getByRole("spinbutton", { name: "빠르기" });
    fireEvent.change(input, { target: { value: "120" } });
    expect(song().bpm).toBe(120);
    fireEvent.change(input, { target: { value: "300" } });
    fireEvent.blur(input);
    expect(song().bpm).toBe(180);
  });

  test("녹음 중 패널이 사라지면 녹음을 버린다", async () => {
    const { unmount } = render(<RecordPanel />);
    await record();
    unmount();
    expect(engine.cancel).toHaveBeenCalled();
  });
});
