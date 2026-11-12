import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useSongStore } from "@/store/songStore";
import { formatDb, MixerPanel } from "./MixerPanel";

const track = (id: string) =>
  useSongStore.getState().song.tracks.find((t) => t.id === id)!;

beforeEach(() => useSongStore.getState().reset());
afterEach(cleanup);

describe("formatDb", () => {
  test("부호를 붙이고 정수로 반올림한다", () => {
    expect(formatDb(3)).toBe("+3 dB");
    expect(formatDb(0)).toBe("0 dB");
    expect(formatDb(-0.2)).toBe("0 dB");
    expect(formatDb(-6.4)).toBe("−6 dB");
  });
});

describe("MixerPanel", () => {
  test("다섯 트랙을 이름과 dB 값으로 보여 준다", () => {
    render(<MixerPanel />);
    for (const name of ["멜로디", "드럼", "베이스", "건반", "기타"])
      expect(screen.getByLabelText(name)).toBeTruthy();
    expect(screen.getAllByText("0 dB")).toHaveLength(5);
  });

  test("볼륨 슬라이더는 그 트랙의 volume만 바꾼다", () => {
    render(<MixerPanel />);
    fireEvent.change(screen.getByLabelText("드럼"), {
      target: { value: "-12" },
    });
    expect(track("drums").volume).toBe(-12);
    expect(track("bass").volume).toBe(0);
    expect(screen.getByText("−12 dB")).toBeTruthy();
  });

  test("뮤트 · 솔로 버튼은 눌린 상태를 켜고 끈다", () => {
    render(<MixerPanel />);
    const mute = screen.getByRole("button", { name: "베이스 뮤트" });
    fireEvent.click(mute);
    expect(track("bass").muted).toBe(true);
    expect(mute.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(mute);
    expect(track("bass").muted).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "멜로디 솔로" }));
    expect(track("melody").solo).toBe(true);
    expect(track("drums").solo).toBe(false);
  });
});

describe("악기 고르기", () => {
  test("멜로디 · 기타만 악기를 고를 수 있고, 고르면 트랙 악기가 바뀐다", () => {
    render(<MixerPanel />);
    expect(screen.queryByLabelText("드럼 악기")).toBeNull();
    fireEvent.change(screen.getByLabelText("멜로디 악기"), {
      target: { value: "violin" },
    });
    expect(track("melody").instrument).toBe("violin");
    fireEvent.change(screen.getByLabelText("기타 악기"), {
      target: { value: "distortion_guitar" },
    });
    expect(track("guitar").instrument).toBe("distortion_guitar");
  });
});
