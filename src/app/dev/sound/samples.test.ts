import { describe, expect, test } from "vitest";
import { SongStateSchema } from "@/lib/schemas";
import { SAMPLES, sampleSong } from "./samples";

describe("소리 확인 샘플", () => {
  test.each(SAMPLES)("$id: 분석 결과가 채워진 올바른 곡이 된다", (sample) => {
    const song = sampleSong(sample);
    expect(SongStateSchema.safeParse(song).success).toBe(true);
    expect(song.melody.length).toBeGreaterThan(0);
    expect(song.chords.length).toBeGreaterThan(0);
    expect(song.bpm).toBe(sample.bpm);
  });

  test("샘플마다 성격이 달라 추천 장르가 셋 다 나온다", () => {
    const styles = new Set(SAMPLES.map((s) => sampleSong(s).style));
    expect(styles).toEqual(new Set(["pop", "ballad", "rock"]));
  });

  test("키 판별이 의도한 조를 찾는다", () => {
    expect(SAMPLES.map((s) => sampleSong(s).key)).toEqual([
      "C major",
      "A minor",
      "G major",
    ]);
  });
});
