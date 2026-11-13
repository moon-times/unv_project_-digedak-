import { describe, expect, test } from "vitest";
import type { Note } from "@/types/song";
import {
  addNote,
  deleteNote,
  durationLabel,
  movedNote,
  placeNote,
  positionLabel,
  resizedNote,
  snap,
} from "./edit";

const n = (
  pitch: number,
  start: number,
  duration = 4,
  velocity = 0.8,
): Note => ({
  pitch,
  start,
  duration,
  velocity,
});

describe("placeNote", () => {
  test("겹치지 않으면 그대로 넣고 시작 순으로 정리한다", () => {
    const { melody, index } = placeNote([n(60, 0), n(64, 8)], null, n(62, 4));
    expect(melody).toEqual([n(60, 0), n(62, 4), n(64, 8)]);
    expect(index).toBe(1);
  });

  test("앞 음과 겹치면 앞 음을 새 음 시작에서 자른다", () => {
    const { melody } = placeNote([n(60, 0, 8)], null, n(62, 4));
    expect(melody).toEqual([n(60, 0, 4), n(62, 4)]);
  });

  test("새 음 안에서 다음 음이 시작하면 다음 음은 두고 새 음을 거기서 자른다", () => {
    const { melody } = placeNote(
      [n(60, 0), n(64, 6), n(67, 12)],
      null,
      n(62, 4, 8),
    );
    expect(melody).toEqual([n(60, 0), n(62, 4, 2), n(64, 6), n(67, 12)]);
  });

  test("같은 칸에서 시작하는 음은 새 음으로 바뀐다", () => {
    const { melody, index } = placeNote([n(60, 0), n(64, 4)], 0, n(67, 4));
    expect(melody).toEqual([n(67, 4)]);
    expect(index).toBe(0);
  });

  test("기존 음을 고치면 원래 자리는 빠진다", () => {
    const { melody, index } = placeNote([n(60, 0), n(64, 4)], 0, n(65, 8));
    expect(melody).toEqual([n(64, 4), n(65, 8)]);
    expect(index).toBe(1);
  });

  test("음 높이 0 ~ 127, 시작 0 이상, 길이 1 이상", () => {
    expect(placeNote([], null, n(200, -3, 0)).melody).toEqual([n(127, 0, 1)]);
    expect(placeNote([], null, n(-5, 0)).melody[0].pitch).toBe(0);
  });
});

describe("addNote", () => {
  test("격자 칸으로 내림한 위치에 기본 세기로 넣는다", () => {
    const { melody } = addNote([], 7, 60, 4, 2);
    expect(melody).toEqual([n(60, 6, 4, 0.8)]);
  });
  test("길이는 최소 격자 한 칸", () => {
    expect(addNote([], 0, 60, 1, 4).melody[0].duration).toBe(4);
  });
});

test("deleteNote는 그 음만 지운다", () => {
  expect(deleteNote([n(60, 0), n(62, 4), n(64, 8)], 1)).toEqual([
    n(60, 0),
    n(64, 8),
  ]);
});

describe("movedNote", () => {
  test("시작은 격자에 맞추고 음 높이는 반음 단위", () => {
    expect(movedNote(n(60, 4), 2.6, 2.2, 1)).toEqual(n(62, 7));
    expect(movedNote(n(60, 4), 3, 0, 4)).toEqual(n(60, 8));
  });
  test("0 앞, 0 ~ 127 밖으로 나가지 않는다", () => {
    expect(movedNote(n(60, 4), -20, 100, 1)).toEqual(n(127, 0));
    expect(movedNote(n(1, 0), 0, -10, 1).pitch).toBe(0);
  });
});

describe("resizedNote", () => {
  test("끝을 격자에 맞춘다", () => {
    expect(resizedNote(n(60, 0, 4), 2.4, 1)).toEqual(n(60, 0, 6));
    expect(resizedNote(n(60, 0, 4), 3, 4)).toEqual(n(60, 0, 8));
  });
  test("최소 격자 한 칸", () => {
    expect(resizedNote(n(60, 4, 4), -10, 2)).toEqual(n(60, 4, 2));
  });
});

test("snap은 가까운 칸, 0 미만은 0", () => {
  expect(snap(5, 4)).toBe(4);
  expect(snap(6, 4)).toBe(8);
  expect(snap(-3, 4)).toBe(0);
});

describe("라벨", () => {
  test("positionLabel", () => {
    expect(positionLabel(0, 16)).toBe("1마디 1박");
    expect(positionLabel(24, 16)).toBe("2마디 3박");
    expect(positionLabel(25, 16)).toBe("2마디 3박 +1");
  });
  test("durationLabel", () => {
    expect(durationLabel(4)).toBe("1박");
    expect(durationLabel(8)).toBe("2박");
    expect(durationLabel(2)).toBe("반 박");
    expect(durationLabel(6)).toBe("1박 반");
    expect(durationLabel(1)).toBe("16분음표 1개");
  });
});
