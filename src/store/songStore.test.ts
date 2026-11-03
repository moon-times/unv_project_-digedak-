import { beforeEach, describe, expect, test } from "vitest";
import { SongStateSchema } from "@/lib/schemas";
import { createEmptySong } from "@/types/song";
import { getAvailableSteps, useSongStore } from "./songStore";

const note = { pitch: 60, start: 0, duration: 4, velocity: 0.8 };
const chord = { symbol: "C", start: 0, duration: 16 };

beforeEach(() => {
  useSongStore.getState().reset();
});

describe("createEmptySong", () => {
  test("스키마 검증을 통과한다", () => {
    expect(SongStateSchema.safeParse(createEmptySong()).success).toBe(true);
  });
});

describe("getAvailableSteps", () => {
  test("녹음 전에는 녹음 단계만 열린다", () => {
    expect(getAvailableSteps(createEmptySong())).toEqual(["record"]);
  });

  test("앞 단계 결과가 생길 때마다 다음 단계가 열린다", () => {
    const song = { ...createEmptySong(), melody: [note] };
    expect(getAvailableSteps(song)).toEqual(["record", "refine"]);

    song.chords = [chord];
    expect(getAvailableSteps(song)).toEqual(["record", "refine", "arrange"]);

    song.accompaniment = { drums: [], bass: [], keys: [] };
    expect(getAvailableSteps(song)).toEqual([
      "record",
      "refine",
      "arrange",
      "mix",
    ]);
  });
});

describe("useSongStore", () => {
  test("곡을 바꾸는 액션은 dirty를 켠다", () => {
    useSongStore.getState().setMelody([note]);
    const { song, dirty } = useSongStore.getState();
    expect(song.melody).toEqual([note]);
    expect(dirty).toBe(true);
  });

  test("updateTrack은 해당 트랙만 바꾼다", () => {
    useSongStore.getState().updateTrack("bass", { muted: true, volume: -6 });
    const tracks = useSongStore.getState().song.tracks;
    expect(tracks.find((t) => t.id === "bass")).toMatchObject({
      muted: true,
      volume: -6,
    });
    expect(tracks.filter((t) => t.muted)).toHaveLength(1);
  });

  test("markSaved는 dirty를 끄고 저장됨으로 표시한다", () => {
    useSongStore.getState().setTitle("새 제목");
    useSongStore.getState().markSaved();
    expect(useSongStore.getState()).toMatchObject({
      dirty: false,
      saveStatus: "saved",
    });
  });

  test("loadSong은 화면 상태를 초기화하고 dirty를 끈다", () => {
    useSongStore.getState().setStep("mix");
    const loaded = { ...createEmptySong(), title: "불러온 곡" };
    useSongStore.getState().loadSong(loaded);
    expect(useSongStore.getState()).toMatchObject({
      song: loaded,
      step: "record",
      dirty: false,
    });
  });
});
