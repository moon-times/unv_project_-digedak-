import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSongStore } from "@/store/songStore";
import type { Note } from "@/types/song";
import { STEP_WIDTH } from "./layout";
import { Timeline } from "./Timeline";

// jsdom은 배치를 하지 않아 getBoundingClientRect가 모두 0이므로, clientX · clientY가 곧 줄 안 좌표입니다.
// 폭을 재기 전이라 1 step = STEP_WIDTH(12px), 음 한 줄 = 10px.
const ROW = 10;

const melody: Note[] = [
  { pitch: 60, start: 0, duration: 4, velocity: 0.8 },
  { pitch: 64, start: 4, duration: 4, velocity: 0.8 },
];

const song = () => useSongStore.getState().song;
const notes = () => screen.getAllByRole("button", { name: /마디/ });

beforeEach(() => {
  useSongStore.getState().reset();
  useSongStore.getState().setMelody(melody);
});
afterEach(cleanup);

describe("보기 전용", () => {
  test("editable이 아니면 음을 누를 수 없고 편집 줄도 없다", () => {
    render(<Timeline />);
    expect(screen.queryAllByRole("button", { name: /마디/ })).toEqual([]);
    expect(screen.queryByText(/두 번 누르면/)).toBeNull();
  });
});

describe("멜로디 편집", () => {
  test("음마다 이름 · 위치 · 길이를 읽어 준다", () => {
    render(<Timeline editable />);
    expect(notes().map((n) => n.getAttribute("aria-label"))).toEqual([
      "C4, 1마디 1박, 1박",
      "E4, 1마디 2박, 1박",
    ]);
  });

  test("음을 누르면 선택되고 위 줄에 정보와 [삭제]가 나온다", () => {
    render(<Timeline editable />);
    fireEvent.pointerDown(notes()[1], { button: 0, pointerId: 1 });
    fireEvent.pointerUp(notes()[1], { pointerId: 1 });
    expect(notes()[1].getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/1마디 2박 · 길이 1박/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(song().melody).toEqual([melody[0]]);
  });

  test("누르기만 하면 멜로디는 바뀌지 않는다", () => {
    useSongStore.getState().markSaved();
    render(<Timeline editable />);
    fireEvent.pointerDown(notes()[0], { button: 0, pointerId: 1 });
    fireEvent.pointerUp(notes()[0], { pointerId: 1 });
    expect(useSongStore.getState().dirty).toBe(false);
  });

  test("Delete 키로 지운다", () => {
    render(<Timeline editable />);
    fireEvent.focus(notes()[0]);
    fireEvent.keyDown(notes()[0], { key: "Delete" });
    expect(song().melody).toEqual([melody[1]]);
  });

  test("방향키: ↑ 반음, Shift+↓ 옥타브, → 격자 한 칸", () => {
    render(<Timeline editable />);
    fireEvent.focus(notes()[0]);
    fireEvent.keyDown(notes()[0], { key: "ArrowUp" });
    expect(song().melody[0].pitch).toBe(61);
    fireEvent.keyDown(notes()[0], { key: "ArrowDown", shiftKey: true });
    expect(song().melody[0].pitch).toBe(49);
    // 뒤 음(4 step)과 겹치지 않게 두 번째 음을 오른쪽으로
    fireEvent.keyDown(notes()[1], { key: "ArrowRight" });
    expect(song().melody[1].start).toBe(5);
  });

  test("끌면 놓을 때 한 번만 옮긴다 (오른쪽 2칸, 위로 3반음)", () => {
    const setMelody = vi.spyOn(useSongStore.getState(), "setMelody");
    render(<Timeline editable />);
    const note = notes()[1];
    fireEvent.pointerDown(note, {
      button: 0,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(note, {
      pointerId: 1,
      clientX: STEP_WIDTH,
      clientY: -ROW,
    });
    fireEvent.pointerMove(note, {
      pointerId: 1,
      clientX: STEP_WIDTH * 2,
      clientY: -ROW * 3,
    });
    expect(song().melody[1]).toEqual(melody[1]);
    fireEvent.pointerUp(note, { pointerId: 1 });
    expect(song().melody[1]).toEqual({ ...melody[1], start: 6, pitch: 67 });
    setMelody.mockRestore();
  });

  test("빈 칸을 두 번 누르면 그 자리에 1박 음이 생기고 선택된다", () => {
    render(<Timeline editable />);
    const lane = document.querySelector("[data-melody-editor]")!;
    // 위에서 3번째 줄(high - 2), 9번째 step
    fireEvent.doubleClick(lane, {
      clientX: STEP_WIDTH * 9 + 1,
      clientY: ROW * 2 + 1,
    });
    const added = song().melody[2];
    expect(added.start).toBe(9);
    expect(added.duration).toBe(4);
    expect(notes()[2].getAttribute("aria-pressed")).toBe("true");
  });

  test("빈 곳을 누르면 선택이 풀린다", () => {
    render(<Timeline editable />);
    fireEvent.pointerDown(notes()[0], { button: 0, pointerId: 1 });
    fireEvent.pointerUp(notes()[0], { pointerId: 1 });
    fireEvent.pointerDown(document.querySelector("[data-melody-editor]")!);
    expect(screen.getByText(/두 번 누르면/)).toBeTruthy();
  });
});

test("마디 번호 줄을 누르면 그 step으로 onSeek", () => {
  const onSeek = vi.fn();
  render(<Timeline onSeek={onSeek} />);
  fireEvent.pointerDown(document.querySelector("[data-seek]")!, {
    clientX: STEP_WIDTH * 16 + 3,
  });
  expect(onSeek).toHaveBeenCalledWith(16);
});
