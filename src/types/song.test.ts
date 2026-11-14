import { describe, expect, test } from "vitest";
import { SongStateSchema } from "@/lib/schemas";
import { createEmptySong, TRACK_IDS, upgradeSong, withAllTracks } from "./song";

/** 기타 트랙을 넣기 전에 저장된 곡 모양 */
function oldSong() {
  const song = createEmptySong();
  return {
    ...song,
    tracks: song.tracks
      .filter((t) => t.id !== "guitar")
      .map((t) => (t.id === "bass" ? { ...t, volume: -6 } : t)),
    accompaniment: { drums: [], bass: [], keys: [] },
  };
}

describe("기타 트랙 이전에 저장된 곡", () => {
  test("withAllTracks는 빠진 트랙을 기본값으로 채우고 순서를 맞춘다", () => {
    const tracks = withAllTracks(oldSong().tracks.slice().reverse());
    expect(tracks.map((t) => t.id)).toEqual([...TRACK_IDS]);
    expect(tracks.find((t) => t.id === "bass")!.volume).toBe(-6);
    expect(tracks.find((t) => t.id === "guitar")!.instrument).toBe(
      "acoustic_guitar_steel",
    );
  });

  test("DB에서 불러올 때(스키마) 기타 반주와 트랙이 채워진다", () => {
    const parsed = SongStateSchema.parse(oldSong());
    expect(parsed.accompaniment!.guitar).toEqual([]);
    expect(parsed.tracks.map((t) => t.id)).toEqual([...TRACK_IDS]);
  });

  test("upgradeSong은 브라우저에 보관된 게스트 곡도 같은 모양으로 맞춘다", () => {
    const upgraded = upgradeSong(oldSong() as never);
    expect(upgraded.accompaniment!.guitar).toEqual([]);
    expect(upgraded.tracks).toHaveLength(TRACK_IDS.length);
  });

  test("반주가 없던 곡에는 반주를 만들지 않는다", () => {
    const noAccompaniment = { ...oldSong(), accompaniment: undefined };
    expect(upgradeSong(noAccompaniment as never).accompaniment).toBeUndefined();
  });
});

describe("편곡 계획 (명세 08)", () => {
  const section = {
    startBar: 0,
    endBar: 4,
    role: "intro",
    energy: 2,
    drums: "half",
    bass: "long",
    keys: "pad",
    guitar: "rest",
    fillAtEnd: true,
    crashAtStart: false,
  };
  const plan = {
    sections: [section],
    endingHit: true,
    summary: "조용히 시작해요.",
    enabled: true,
  };

  test("계획이 없는 예전 곡도 그대로 통과한다", () => {
    expect(
      SongStateSchema.parse(createEmptySong()).arrangement,
    ).toBeUndefined();
  });

  test("계획이 있는 곡은 계획을 그대로 읽는다", () => {
    const parsed = SongStateSchema.parse({
      ...createEmptySong(),
      arrangement: plan,
    });
    expect(parsed.arrangement).toEqual(plan);
  });

  test("세기 · 설정 값이 범위 밖이면 거절한다", () => {
    const bad = (patch: object) =>
      SongStateSchema.safeParse({
        ...createEmptySong(),
        arrangement: { ...plan, sections: [{ ...section, ...patch }] },
      }).success;
    expect(bad({ energy: 6 })).toBe(false);
    expect(bad({ drums: "loud" })).toBe(false);
    expect(bad({ endBar: 0 })).toBe(false);
  });
});
