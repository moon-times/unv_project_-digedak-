import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { analyzeSong } from "@/lib/music";
import { getAvailableSteps, useSongStore } from "@/store/songStore";
import type { Note } from "@/types/song";
import { RefinePanel } from "./RefinePanel";

// 도-미-솔 위주의 C장조 멜로디 두 마디
const melody: Note[] = [60, 64, 67, 64, 60, 62, 64, 60].map((pitch, i) => ({
  pitch,
  start: i * 4,
  duration: 4,
  velocity: 0.8,
}));

const song = () => useSongStore.getState().song;

beforeEach(() => {
  useSongStore.getState().reset();
});
afterEach(cleanup);

describe("RefinePanel", () => {
  test("멜로디가 없으면 녹음부터 하라고 한다", () => {
    render(<RefinePanel />);
    expect(screen.getByText(/먼저 ① 녹음에서/)).toBeTruthy();
    expect(song().chords).toEqual([]);
  });

  test("코드가 없으면 열자마자 분석해 키 · 코드 · 설명 · 장르를 넣고 반주 단계를 연다", () => {
    useSongStore.getState().setMelody(melody);
    render(<RefinePanel />);
    const expected = analyzeSong(melody, 100, { stepsPerBar: 16 });
    expect(song().chords).toEqual(expected.chords);
    expect(song().key).toBe(expected.key);
    expect(song().explanation).toBe(expected.explanation);
    expect(song().style).toBe(expected.recommendedStyle);
    expect(getAvailableSteps(song())).toContain("arrange");
    expect(expected.key).toBe("C major");
    expect(screen.getByText("C장조")).toBeTruthy();
    expect(screen.getByText(expected.explanation)).toBeTruthy();
  });

  test("코드가 이미 있으면 열어도 저장할 변경으로 치지 않는다", () => {
    const store = useSongStore.getState();
    store.setMelody(melody);
    store.setChords([{ symbol: "C", start: 0, duration: 32 }]);
    store.markSaved();
    render(<RefinePanel />);
    expect(useSongStore.getState().dirty).toBe(false);
    expect(song().chords).toEqual([{ symbol: "C", start: 0, duration: 32 }]);
  });

  test("다시 분석은 코드를 새로 찾되 고른 장르는 그대로 둔다", () => {
    const store = useSongStore.getState();
    store.setMelody(melody);
    store.setChords([{ symbol: "Am", start: 0, duration: 32 }]);
    store.setStyle("rock");
    render(<RefinePanel />);
    fireEvent.click(screen.getByRole("button", { name: "다시 분석" }));
    expect(song().chords).toEqual(
      analyzeSong(melody, 100, { stepsPerBar: 16 }).chords,
    );
    expect(song().style).toBe("rock");
  });

  test("추천 BPM이 지금과 다르면 적용 버튼으로 바꾼다", () => {
    const store = useSongStore.getState();
    store.setMelody(melody);
    store.setBpm(200);
    render(<RefinePanel />);
    const { bpmSuggestion } = analyzeSong(melody, 200, { stepsPerBar: 16 });
    expect(bpmSuggestion).not.toBe(200);
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    expect(song().bpm).toBe(bpmSuggestion);
    expect(screen.queryByRole("button", { name: "적용" })).toBeNull();
  });

  test("[더 밝게] [더 슬프게]는 아직 꺼져 있다", () => {
    useSongStore.getState().setMelody(melody);
    render(<RefinePanel />);
    expect(screen.getByRole("button", { name: "더 밝게" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "더 슬프게" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
