import { describe, expect, it, vi } from "vitest";
import { TRACK_IDS, createEmptySong, type TrackId } from "@/types/song";
import {
  connectReverb,
  DEFAULT_REVERB,
  impulseResponse,
  REVERB_SECONDS,
  reverbSends,
} from "./reverb";

/** 오디오 노드 연결만 기록하는 가짜 컨텍스트 */
function fakeContext() {
  const node = () => ({
    gain: { value: 1 },
    connect: vi.fn(),
    buffer: null as unknown,
  });
  return {
    sampleRate: 8000,
    createGain: vi.fn(node),
    createConvolver: vi.fn(node),
    createBuffer: (channels: number, length: number) => {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(length),
      );
      return { length, getChannelData: (c: number) => data[c] };
    },
  };
}

describe("reverbSends (명세 12)", () => {
  it("곡에 값이 없으면 기본값, 있으면 그 값(0 ~ 1로 자름)", () => {
    const tracks = createEmptySong().tracks;
    expect(reverbSends(tracks)).toEqual(DEFAULT_REVERB);
    const custom = tracks.map((t) =>
      t.id === "melody"
        ? { ...t, effects: { reverb: 0.4 } }
        : t.id === "bass"
          ? { ...t, effects: { reverb: 3 } }
          : t.id === "drums"
            ? { ...t, effects: { reverb: -1 } }
            : t,
    );
    expect(reverbSends(custom)).toMatchObject({
      melody: 0.4,
      bass: 1,
      drums: 0,
    });
  });
});

describe("impulseResponse", () => {
  it("길이가 울림 길이이고, 매번 같은 값이며, 끝으로 갈수록 작아진다", () => {
    const context = fakeContext() as unknown as BaseAudioContext;
    const a = impulseResponse(context);
    const b = impulseResponse(context);
    expect(a.length).toBe(Math.round(REVERB_SECONDS * 8000));
    expect(Array.from(a.getChannelData(0))).toEqual(
      Array.from(b.getChannelData(0)),
    );
    expect(a.getChannelData(0)).not.toEqual(a.getChannelData(1));
    const energy = (from: number, to: number) =>
      a
        .getChannelData(0)
        .slice(from, to)
        .reduce((sum, v) => sum + v * v, 0);
    expect(energy(0, 1000)).toBeGreaterThan(
      energy(a.length - 1000, a.length) * 10,
    );
  });
});

describe("connectReverb", () => {
  it("트랙 게인 뒤에서 보내기 게인 → Convolver → 출력(0.5) → destination", () => {
    const context = fakeContext();
    const channels = Object.fromEntries(
      TRACK_IDS.map((id) => [id, { connect: vi.fn() }]),
    ) as unknown as Record<TrackId, GainNode>;
    const destination = {} as AudioNode;
    const sends = connectReverb(
      context as unknown as BaseAudioContext,
      channels,
      destination,
      DEFAULT_REVERB,
    );
    const convolver = context.createConvolver.mock.results[0].value;
    const output = context.createGain.mock.results[0].value;
    expect(convolver.buffer).not.toBeNull();
    expect(convolver.connect).toHaveBeenCalledWith(output);
    expect(output.gain.value).toBe(0.5);
    expect(output.connect).toHaveBeenCalledWith(destination);
    for (const id of TRACK_IDS) {
      expect(channels[id].connect).toHaveBeenCalledWith(sends[id]);
      expect(sends[id].gain.value).toBe(DEFAULT_REVERB[id]);
      expect(sends[id].connect).toHaveBeenCalledWith(convolver);
    }
  });
});
