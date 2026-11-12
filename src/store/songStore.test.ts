import { beforeEach, describe, expect, test } from "vitest";
import { SongStateSchema } from "@/lib/schemas";
import { createEmptySong } from "@/types/song";
import {
  getAvailableSteps,
  GUEST_DRAFT_KEY,
  guestDraft,
  useSongStore,
} from "./songStore";

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

    song.accompaniment = { drums: [], bass: [], keys: [], guitar: [] };
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
    expect(useSongStore.getState().lastSavedAt).toBeTypeOf("number");
  });

  test("loadSong은 화면 상태를 초기화하고 dirty를 끈다", () => {
    useSongStore.getState().setStep("mix");
    const loaded = { ...createEmptySong(), title: "불러온 곡" };
    useSongStore.getState().loadSong(loaded, "p1");
    expect(useSongStore.getState()).toMatchObject({
      song: loaded,
      projectId: "p1",
      step: "record",
      dirty: false,
    });
  });
});

describe("게스트 보관 (localStorage)", () => {
  test("프로젝트에 연결되기 전의 곡만 보관하고, 연결되면 비운다", () => {
    useSongStore.getState().setTitle("게스트 곡");
    expect(guestDraft(useSongStore.getState())).toMatchObject({
      song: { title: "게스트 곡" },
      dirty: true,
    });
    const saved = JSON.parse(localStorage.getItem(GUEST_DRAFT_KEY)!);
    expect(saved.state.song.title).toBe("게스트 곡");

    useSongStore.getState().setProjectId("p1");
    expect(guestDraft(useSongStore.getState())).toEqual({});
    expect(JSON.parse(localStorage.getItem(GUEST_DRAFT_KEY)!).state).toEqual(
      {},
    );
  });

  test("새로고침 뒤 rehydrate하면 게스트 작업이 돌아온다", async () => {
    // 새로고침 전 브라우저에 남아 있던 보관본
    localStorage.setItem(
      GUEST_DRAFT_KEY,
      JSON.stringify({
        state: {
          song: { ...createEmptySong(), title: "남겨 둔 곡" },
          dirty: true,
        },
        version: 1,
      }),
    );
    await useSongStore.persist.rehydrate();
    expect(useSongStore.getState()).toMatchObject({
      song: { title: "남겨 둔 곡" },
      dirty: true,
      projectId: null,
    });
  });
});
