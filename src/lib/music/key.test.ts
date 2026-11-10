import { describe, expect, it } from "vitest";
import { detectKey, pitchClassHistogram } from "./key";
import { keyName } from "./theory";
import { melodyOf, transpose } from "./testUtils";

// 도레미파솔라시도, 으뜸음과 딸림음을 길게
const C_MAJOR_TUNE = melodyOf(
  [60, 4],
  [62, 2],
  [64, 2],
  [65, 2],
  [67, 4],
  [69, 2],
  [71, 2],
  [72, 8],
  [67, 4],
  [64, 4],
  [62, 4],
  [60, 8],
);

// A단조: 라도미 중심, 이끈음 G#
const A_MINOR_TUNE = melodyOf(
  [69, 4],
  [72, 4],
  [76, 4],
  [74, 2],
  [72, 2],
  [71, 4],
  [68, 4],
  [69, 8],
  [64, 4],
  [72, 4],
  [71, 4],
  [69, 8],
);

describe("pitchClassHistogram", () => {
  it("음 길이를 pitch class별로 더한다", () => {
    const histogram = pitchClassHistogram(melodyOf([60, 4], [72, 2], [67, 3]));
    expect(histogram[0]).toBe(6);
    expect(histogram[7]).toBe(3);
  });
});

describe("detectKey", () => {
  it("C장조 멜로디", () => {
    expect(keyName(detectKey(C_MAJOR_TUNE).key)).toBe("C major");
  });

  it("A단조 멜로디", () => {
    expect(keyName(detectKey(A_MINOR_TUNE).key)).toBe("A minor");
  });

  it("조옮김하면 키도 같이 옮겨진다", () => {
    expect(keyName(detectKey(transpose(C_MAJOR_TUNE, 7)).key)).toBe("G major");
    expect(keyName(detectKey(transpose(C_MAJOR_TUNE, 3)).key)).toBe("Eb major");
    expect(keyName(detectKey(transpose(A_MINOR_TUNE, 5)).key)).toBe("D minor");
  });

  it("빈 멜로디는 C장조, 상관계수 0", () => {
    const result = detectKey([]);
    expect(keyName(result.key)).toBe("C major");
    expect(result.correlation).toBe(0);
  });
});
