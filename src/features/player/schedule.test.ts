import { describe, expect, it } from "vitest";
import { createEmptySong, type SongState } from "@/types/song";
import { dbToGain, trackGains } from "./mix";
import { drumSampleName, noteFor, toMidiVelocity } from "./instruments";
import {
  playbackEndStep,
  scheduleSong,
  secondsPerStep,
  STRUM_SECONDS,
  strumDelays,
  trackNotes,
} from "./schedule";

function song(patch: Partial<SongState> = {}): SongState {
  return { ...createEmptySong(), ...patch };
}

const note = (pitch: number, start: number, duration: number) => ({
  pitch,
  start,
  duration,
  velocity: 0.8,
});

describe("schedule", () => {
  it("120BPM에서 1 step은 0.125초", () => {
    expect(secondsPerStep(120)).toBe(0.125);
  });

  it("반주가 없으면 반주 트랙은 빈 배열", () => {
    const notes = trackNotes(song({ melody: [note(60, 0, 4)] }));
    expect(notes.melody).toHaveLength(1);
    expect(notes.drums).toEqual([]);
  });

  it("재생 끝은 마디 단위로 맞춘다", () => {
    expect(playbackEndStep(song({ melody: [note(60, 0, 20)] }))).toBe(32);
    expect(
      playbackEndStep(
        song({ melody: [note(60, 0, 20)], timeSignature: [3, 4] }),
      ),
    ).toBe(24);
    expect(playbackEndStep(song())).toBe(0);
  });

  it("곡 전체를 초 단위로 펼치고 시간순으로 정렬한다", () => {
    const s = song({
      bpm: 120,
      melody: [note(64, 4, 4)],
      accompaniment: {
        drums: [note(36, 0, 1)],
        bass: [note(36, 0, 8)],
        keys: [],
        guitar: [],
      },
    });
    expect(scheduleSong(s)).toEqual([
      { track: "drums", pitch: 36, time: 0, duration: 0.125, velocity: 0.8 },
      { track: "bass", pitch: 36, time: 0, duration: 1, velocity: 0.8 },
      { track: "melody", pitch: 64, time: 0.5, duration: 0.5, velocity: 0.8 },
    ]);
    // 4 step부터: 그 이전 음은 빼고 4 step을 0초로
    expect(scheduleSong(s, 4)).toEqual([
      { track: "melody", pitch: 64, time: 0, duration: 0.5, velocity: 0.8 },
    ]);
  });
});

describe("mix", () => {
  it("0dB는 1, -6dB는 약 0.5", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
  });

  it("뮤트·솔로·볼륨을 게인으로 바꾼다", () => {
    const tracks = createEmptySong().tracks;
    expect(trackGains(tracks)).toEqual({
      melody: 1,
      drums: 1,
      bass: 1,
      keys: 1,
      guitar: 1,
    });

    const muted = tracks.map((t) =>
      t.id === "drums" ? { ...t, muted: true } : t,
    );
    expect(trackGains(muted).drums).toBe(0);

    const solo = tracks.map((t) =>
      t.id === "bass" ? { ...t, solo: true, volume: -6 } : t,
    );
    const gains = trackGains(solo);
    expect(gains.bass).toBeCloseTo(0.501, 3);
    expect([gains.melody, gains.drums, gains.keys, gains.guitar]).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it("솔로한 트랙도 뮤트하면 0", () => {
    const tracks = createEmptySong().tracks.map((t) =>
      t.id === "keys" ? { ...t, solo: true, muted: true } : t,
    );
    expect(Object.values(trackGains(tracks))).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("instruments", () => {
  it("GM 드럼 번호를 샘플 이름으로", () => {
    expect(drumSampleName(36)).toBe("kick");
    expect(drumSampleName(38)).toBe("snare-m");
    expect(drumSampleName(42)).toBe("hhclosed");
    expect(drumSampleName(100)).toBeNull();
    expect(noteFor("drums", 49)).toBe("crash");
    expect(noteFor("keys", 60)).toBe(60);
  });

  it("세기 0~1을 0~127로", () => {
    expect(toMidiVelocity(1)).toBe(127);
    expect(toMidiVelocity(0.5)).toBe(64);
    expect(toMidiVelocity(2)).toBe(127);
  });
});

describe("strumDelays", () => {
  const n = (pitch: number, start: number) => ({
    pitch,
    start,
    duration: 2,
    velocity: 0.7,
  });

  it("기타는 같은 위치의 음을 낮은 줄부터 조금씩 늦게 친다", () => {
    const notes = [n(48, 0), n(55, 0), n(60, 0), n(48, 4)];
    expect(strumDelays("guitar", notes)).toEqual([
      0,
      STRUM_SECONDS,
      2 * STRUM_SECONDS,
      0,
    ]);
  });

  it("다른 트랙은 늦추지 않는다", () => {
    expect(strumDelays("keys", [n(60, 0), n(64, 0)])).toEqual([0, 0]);
  });

  it("scheduleSong에도 반영된다", () => {
    const song: SongState = {
      ...createEmptySong(),
      bpm: 120,
      accompaniment: {
        drums: [],
        bass: [],
        keys: [],
        guitar: [n(48, 4), n(55, 4)],
      },
    };
    expect(scheduleSong(song).map((e) => e.time)).toEqual([
      0.5,
      0.5 + STRUM_SECONDS,
    ]);
  });
});
