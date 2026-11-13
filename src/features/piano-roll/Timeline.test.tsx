import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useSongStore } from "@/store/songStore";
import { LABEL_WIDTH, STEP_WIDTH } from "./layout";
import { Timeline } from "./Timeline";

const note = (pitch: number, start: number) => ({
  pitch,
  start,
  duration: 4,
  velocity: 0.8,
});

beforeEach(() => useSongStore.getState().reset());
afterEach(cleanup);

const lane = (container: HTMLElement, name: string) =>
  container.querySelector(`[data-lane="${name}"]`)!;

describe("Timeline", () => {
  test("빈 곡은 줄마다 안내 문구를 보여 준다", () => {
    render(<Timeline />);
    expect(
      screen.getByText("① 녹음하면 멜로디가 여기에 나타나요"),
    ).toBeTruthy();
    expect(screen.getByText("② 분석하면 마디마다 코드가 붙어요")).toBeTruthy();
    expect(screen.getAllByText("③ 반주 단계에서 채워져요")).toHaveLength(4);
    expect(screen.getByText("마디")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
  });

  test("멜로디 · 코드 · 반주를 각 줄에 그린다", () => {
    const store = useSongStore.getState();
    store.setMelody([note(60, 0), note(64, 4), note(67, 8)]);
    store.setChords([
      { symbol: "C", start: 0, duration: 16 },
      { symbol: "Am", start: 16, duration: 16 },
    ]);
    store.setAccompaniment({
      drums: [note(36, 0)],
      bass: [note(36, 0), note(43, 8)],
      keys: [],
      guitar: [],
    });
    const { container } = render(<Timeline />);

    expect(
      lane(container, "melody").querySelectorAll("[data-note]"),
    ).toHaveLength(3);
    expect(screen.getByText("Am")).toBeTruthy();
    expect(
      lane(container, "drums").querySelectorAll("[data-note]"),
    ).toHaveLength(1);
    expect(
      lane(container, "bass").querySelectorAll("[data-note]"),
    ).toHaveLength(2);
    expect(lane(container, "keys").textContent).toContain("반주 단계에서");
  });

  test("음표 위치와 길이는 step에 맞춰 놓인다", () => {
    useSongStore.getState().setMelody([note(60, 0), note(64, 8)]);
    const { container } = render(<Timeline />);
    const [first, second] = lane(
      container,
      "melody",
    ).querySelectorAll<HTMLElement>("[data-note]");
    expect(first.style.left).toBe("0px");
    expect(second.style.left).toBe("96px");
    // 높은 음이 더 위에 있다
    expect(parseFloat(second.style.top)).toBeLessThan(
      parseFloat(first.style.top),
    );
    expect(first.title).toBe("C4");
  });

  test("재생 위치가 주어질 때만 재생선을 그린다", () => {
    const { container, rerender } = render(<Timeline />);
    expect(container.querySelector("[data-playhead]")).toBeNull();

    rerender(<Timeline position={16} />);
    const playhead = container.querySelector<HTMLElement>("[data-playhead]");
    expect(playhead?.style.left).toBe(`${LABEL_WIDTH + 16 * STEP_WIDTH}px`);
  });

  test("음표가 낮게 그려지는 줄은 테두리를 빼서 색이 보이게 한다", () => {
    useSongStore.getState().setAccompaniment({
      drums: [],
      bass: [note(40, 0), note(43, 8)], // 음역 좁음 → 음표가 충분히 높음
      keys: [note(48, 0), note(84, 8)], // 3옥타브 → 음표 1px대
      guitar: [],
    });
    const { container } = render(<Timeline />);
    const [bass] = lane(container, "bass").querySelectorAll("[data-note]");
    const [keys] = lane(container, "keys").querySelectorAll("[data-note]");
    expect(bass.className).toContain("border-track-bass-border");
    expect(keys.className).not.toContain("border-track-keys-border");
  });
});
