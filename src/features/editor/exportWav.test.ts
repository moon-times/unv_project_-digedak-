import { describe, expect, it } from "vitest";
import { peakScale, wavFileName } from "./exportWav";

describe("wavFileName", () => {
  it("제목 그대로 .wav", () => {
    expect(wavFileName("봄날 산책")).toBe("봄날 산책.wav");
  });
  it("파일 이름에 못 쓰는 글자는 _로", () => {
    expect(wavFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j.wav");
  });
  it("비거나 공백뿐이면 딕으닥.wav", () => {
    expect(wavFileName("")).toBe("딕으닥.wav");
    expect(wavFileName("   ")).toBe("딕으닥.wav");
  });
});

describe("peakScale", () => {
  it("최대값이 1 이하면 그대로", () => {
    expect(
      peakScale([new Float32Array([0.5, -1]), new Float32Array([0.2])]),
    ).toBe(1);
  });
  it("넘으면 최대값이 0.99가 되는 배율", () => {
    expect(
      peakScale([new Float32Array([0.5]), new Float32Array([-2])]),
    ).toBeCloseTo(0.495);
  });
});
