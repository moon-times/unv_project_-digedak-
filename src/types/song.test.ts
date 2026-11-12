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
