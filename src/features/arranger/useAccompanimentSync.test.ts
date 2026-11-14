import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { useSongStore } from "@/store/songStore";
import { accompanimentFor, useAccompanimentSync } from "./useAccompanimentSync";

const chords = [
  { symbol: "C", start: 0, duration: 16 },
  { symbol: "G", start: 16, duration: 16 },
];
const song = () => useSongStore.getState().song;

beforeEach(() => {
  const store = useSongStore.getState();
  store.reset();
  store.setChords(chords);
});

describe("useAccompanimentSync (#27)", () => {
  test("create: false면 반주가 없는 곡에 반주를 만들지 않는다", () => {
    renderHook(() => useAccompanimentSync({ create: false }));
    expect(song().accompaniment).toBeUndefined();
  });

  test("반주가 있으면 패널 없이도 코드가 바뀔 때 다시 만든다", () => {
    useSongStore.getState().setAccompaniment(accompanimentFor(song()));
    renderHook(() => useAccompanimentSync({ create: false }));
    act(() =>
      useSongStore.getState().setChords([
        { symbol: "Am", start: 0, duration: 16 },
        { symbol: "F", start: 16, duration: 16 },
      ]),
    );
    expect(song().accompaniment).toEqual(accompanimentFor(song()));
    expect(song().accompaniment!.bass[0].pitch % 12).toBe(9); // A
  });

  test("편곡 계획이 바뀌면 다시 만든다", () => {
    useSongStore.getState().setAccompaniment(accompanimentFor(song()));
    renderHook(() => useAccompanimentSync({ create: false }));
    const before = song().accompaniment;
    act(() =>
      useSongStore.getState().setArrangement({
        sections: [
          {
            startBar: 0,
            endBar: 2,
            role: "intro",
            energy: 1,
            drums: "none",
            bass: "long",
            keys: "pad",
            guitar: "rest",
            fillAtEnd: false,
            crashAtStart: false,
          },
        ],
        endingHit: false,
        summary: "",
        enabled: true,
      }),
    );
    expect(song().accompaniment).not.toEqual(before);
    expect(song().accompaniment!.drums).toEqual([]);
  });

  test("코드가 비면(다시 녹음) 반주를 지운다", () => {
    useSongStore.getState().setAccompaniment(accompanimentFor(song()));
    renderHook(() => useAccompanimentSync({ create: false }));
    act(() => useSongStore.getState().setChords([]));
    expect(song().accompaniment).toBeUndefined();
  });

  test("결과가 같으면 store를 건드리지 않는다", () => {
    useSongStore.getState().setAccompaniment(accompanimentFor(song()));
    useSongStore.getState().markSaved();
    renderHook(() => useAccompanimentSync({ create: false }));
    renderHook(() => useAccompanimentSync({ create: true }));
    expect(useSongStore.getState().dirty).toBe(false);
  });
});
