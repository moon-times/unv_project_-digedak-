import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useSongStore } from "@/store/songStore";
import type { Note } from "@/types/song";
import { ArrangePanel } from "./ArrangePanel";
import { accompanimentFor } from "./useAccompanimentSync";

// 도-미-솔 위주의 C장조 멜로디 두 마디
const melody: Note[] = [60, 64, 67, 64, 60, 62, 64, 60].map((pitch, i) => ({
  pitch,
  start: i * 4,
  duration: 4,
  velocity: 0.8,
}));
const chords = [
  { symbol: "C", start: 0, duration: 16 },
  { symbol: "G", start: 16, duration: 16 },
];

const song = () => useSongStore.getState().song;

beforeEach(() => {
  const store = useSongStore.getState();
  store.reset();
  store.setMelody(melody);
  store.setChords(chords);
  store.setBpm(100);
  store.setStyle("pop");
  store.markSaved();
});
afterEach(cleanup);

describe("ArrangePanel", () => {
  test("열면 반주가 없던 곡에 반주를 만든다", () => {
    expect(song().accompaniment).toBeUndefined();
    render(<ArrangePanel />);
    expect(song().accompaniment).toEqual(accompanimentFor(song()));
    expect(song().accompaniment!.drums.length).toBeGreaterThan(0);
  });

  test("반주가 이미 맞으면 다시 열어도 저장할 변경으로 치지 않는다", () => {
    useSongStore.getState().setAccompaniment(accompanimentFor(song()));
    useSongStore.getState().markSaved();
    render(<ArrangePanel />);
    expect(useSongStore.getState().dirty).toBe(false);
  });

  test("코드가 바뀌어 낡은 반주는 열 때 새로 만든다", () => {
    useSongStore.getState().setAccompaniment(accompanimentFor(song()));
    useSongStore
      .getState()
      .setChords([{ symbol: "Am", start: 0, duration: 32 }]);
    render(<ArrangePanel />);
    expect(song().accompaniment).toEqual(accompanimentFor(song()));
  });

  test("장르 카드를 고르면 장르와 반주가 함께 바뀐다", () => {
    render(<ArrangePanel />);
    const popAccompaniment = song().accompaniment;
    fireEvent.click(screen.getByRole("radio", { name: /록/ }));
    expect(song().style).toBe("rock");
    expect(
      (screen.getByRole("radio", { name: /록/ }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(song().accompaniment).not.toEqual(popAccompaniment);
    expect(song().accompaniment).toEqual(accompanimentFor(song()));
  });

  test("규칙 엔진이 추천한 장르에 AI 추천 태그를 붙인다", () => {
    render(<ArrangePanel />);
    // 100 BPM · 장조 · 마디당 4음 → 팝
    expect(screen.getByRole("radio", { name: /팝.*AI 추천/ })).toBeTruthy();
    expect(screen.getAllByText("AI 추천")).toHaveLength(1);
  });

  test("빠르기 슬라이더는 BPM을 바꾸고 반주도 그 빠르기로 다시 만든다", () => {
    render(<ArrangePanel />);
    fireEvent.change(screen.getByLabelText("빠르기"), {
      target: { value: "150" },
    });
    expect(song().bpm).toBe(150);
    expect(screen.getByText("150 BPM")).toBeTruthy();
    // 140 BPM 이상에서는 하이햇 간격이 벌어집니다.
    expect(song().accompaniment).toEqual(accompanimentFor(song()));
  });
});
