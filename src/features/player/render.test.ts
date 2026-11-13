// jsdom에는 OfflineAudioContext가 없으므로 가짜 컨텍스트로 예약 방식과 진행 알림 순서만 확인합니다.
import * as smplr from "smplr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptySong, type SongState } from "@/types/song";
import { renderSong, type RenderProgress } from "./render";

vi.mock("smplr", () => {
  const instrument = () => ({
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  });
  return {
    SplendidGrandPiano: vi.fn(instrument),
    DrumMachine: vi.fn(instrument),
    Soundfont: vi.fn(instrument),
    Scheduler: vi.fn(() => ({ schedule: vi.fn(), stop: vi.fn() })),
  };
});

class FakeOfflineAudioContext {
  /** renderSong이 마지막으로 만든 컨텍스트 */
  static last: FakeOfflineAudioContext;
  destination = {};
  suspends: number[] = [];
  #waiting: { time: number; resolve: () => void }[] = [];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    FakeOfflineAudioContext.last = this;
  }
  createGain() {
    return { gain: { value: 1 }, connect: vi.fn() };
  }
  suspend(time: number) {
    this.suspends.push(time);
    return new Promise<void>((resolve) =>
      this.#waiting.push({ time, resolve }),
    );
  }
  resume = vi.fn(async () => {});
  async startRendering() {
    for (const { resolve } of this.#waiting.sort((a, b) => a.time - b.time)) {
      resolve();
      await Promise.resolve();
    }
    return { length: this.length } as unknown as AudioBuffer;
  }
}

beforeEach(() => vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext));
afterEach(() => vi.unstubAllGlobals());

function songWithMelody(): SongState {
  const song = createEmptySong();
  return {
    ...song,
    melody: [{ pitch: 60, start: 0, duration: 16, velocity: 0.8 }],
  };
}

describe("renderSong 예약", () => {
  it("모든 악기가 앞보기 무한 스케줄러를 씀 (0.2초 뒤 음이 빠지지 않게)", async () => {
    await renderSong(songWithMelody());

    expect(smplr.Scheduler).toHaveBeenCalledWith(expect.anything(), {
      lookaheadMs: Infinity,
    });
    const scheduler = vi.mocked(smplr.Scheduler).mock.results[0].value;
    expect(vi.mocked(smplr.Soundfont).mock.calls[0][1]).toMatchObject({
      scheduler,
    });
  });
});

describe("renderSong 진행 알림", () => {
  it("loading → 0 → 10%씩 → 1 순서로 알림", async () => {
    const progress: RenderProgress[] = [];
    await renderSong(songWithMelody(), {
      onProgress: (p) => progress.push(p),
    });

    expect(progress[0]).toEqual({ phase: "loading" });
    const ratios = progress.slice(1).map((p) => {
      if (p.phase !== "rendering") throw new Error("순서가 틀림");
      return p.ratio;
    });
    expect(ratios).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });

  it("멈출 시각은 128샘플 단위", async () => {
    await renderSong(songWithMelody(), { onProgress: () => {} });

    for (const time of FakeOfflineAudioContext.last.suspends) {
      const samples = time * 44100;
      expect(Math.abs(samples / 128 - Math.round(samples / 128))).toBeLessThan(
        1e-6,
      );
    }
  });

  it("onProgress가 없으면 멈추지 않음 (기존 동작 그대로)", async () => {
    await renderSong(songWithMelody());
    expect(FakeOfflineAudioContext.last.suspends).toEqual([]);
  });
});
