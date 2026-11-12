import { describe, expect, it } from "vitest";
import { parseChordSymbol } from "@/lib/music";
import {
  bassPitch,
  chooseVoicing,
  guitarVoicing,
  voiceAt,
  voicingCandidates,
} from "./voicing";

const chord = (symbol: string) => parseChordSymbol(symbol)!;

describe("bassPitch", () => {
  it("근음은 E1~D#2 안에 둔다", () => {
    expect(bassPitch(chord("C"), "root")).toBe(36); // C2
    expect(bassPitch(chord("E"), "root")).toBe(28); // E1
    expect(bassPitch(chord("D#"), "root")).toBe(39); // D#2
  });

  it("5도와 옥타브", () => {
    expect(bassPitch(chord("C"), "fifth")).toBe(43);
    expect(bassPitch(chord("C"), "octave")).toBe(48);
  });

  it("슬래시 코드는 지정된 베이스음", () => {
    expect(bassPitch(chord("C/E"), "root")).toBe(28);
    // 5도 자리는 베이스음 E 위 5도(B)가 아니라 코드음 G
    expect(bassPitch(chord("C/E"), "fifth")).toBe(31);
  });

  it("dim·aug 코드의 5도는 코드에 맞게 반음 내리거나 올린다", () => {
    expect(bassPitch(chord("Bdim"), "fifth")).toBe(41); // B1(35) 위 F2
    expect(bassPitch(chord("Caug"), "fifth")).toBe(44); // C2(36) 위 G#2
  });
});

describe("voicing", () => {
  it("전위마다 아래에서 위로 쌓고, 가장 낮은 음은 G3~F#4", () => {
    for (const voicing of voicingCandidates(chord("Am"))) {
      expect(voicing[0]).toBeGreaterThanOrEqual(55);
      expect(voicing[0]).toBeLessThanOrEqual(66);
      for (let i = 1; i < voicing.length; i++) {
        expect(voicing[i]).toBeGreaterThan(voicing[i - 1]);
      }
    }
    expect(voicingCandidates(chord("Cmaj7"))).toHaveLength(4);
  });

  it("다음 코드는 가장 적게 움직이는 보이싱", () => {
    const c = chooseVoicing(chord("C"), null);
    expect(c).toEqual([60, 64, 67]);
    // C(60 64 67) → F는 2전위(60 65 69)가 가장 가깝다
    expect(chooseVoicing(chord("F"), c)).toEqual([60, 65, 69]);
    // C → G는 1전위(59 62 67)
    expect(chooseVoicing(chord("G"), c)).toEqual([59, 62, 67]);
  });

  it("voiceAt은 보이싱을 넘으면 옥타브 위로 잇는다", () => {
    expect(voiceAt([60, 64, 67], 3)).toBe(72);
    expect(voiceAt([60, 64, 67], 4)).toBe(76);
  });
});

describe("guitarVoicing", () => {
  it("근음을 E2~D#3에 두고 6줄 바레 코드처럼 쌓는다", () => {
    expect(guitarVoicing(chord("C"))).toEqual([48, 55, 60, 64, 67, 72]);
    expect(guitarVoicing(chord("Am"))).toEqual([45, 52, 57, 60, 64, 69]);
    expect(guitarVoicing(chord("E"))).toEqual([40, 47, 52, 56, 59, 64]);
  });

  it("7화음은 맨 위 줄에 7도를 넣는다", () => {
    expect(guitarVoicing(chord("G7"))).toEqual([43, 50, 55, 59, 62, 65]);
  });

  it("슬래시 코드는 지정된 베이스음을 가장 낮은 줄에 둔다", () => {
    expect(guitarVoicing(chord("C/E"))[0]).toBe(40);
  });
});
