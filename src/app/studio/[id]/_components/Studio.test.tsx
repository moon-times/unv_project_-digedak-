import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSongStore } from "@/store/songStore";
import { Studio } from "./Studio";

const auth = vi.hoisted(() => ({
  state: { user: null as { id: string } | null, loading: false },
}));
vi.mock("@/lib/supabase/useAuthUser", () => ({
  useAuthUser: () => auth.state,
}));

const note = { pitch: 60, start: 0, duration: 4, velocity: 0.8 };
const chord = { symbol: "C", start: 0, duration: 16 };

beforeEach(() => {
  useSongStore.getState().reset();
  auth.state = { user: null, loading: false };
});
afterEach(cleanup);

const stepButton = (name: RegExp) => screen.getByRole("button", { name });

describe("스튜디오 진행 바", () => {
  test("녹음 전에는 녹음만 열리고 다음 단계 버튼은 꺼져 있다", () => {
    render(<Studio projectId={null} />);
    expect(stepButton(/녹음$/)).toHaveProperty("disabled", false);
    expect(stepButton(/보정 · AI 분석/)).toHaveProperty("disabled", true);
    expect(stepButton(/녹음 끝내고 다음 단계로/)).toHaveProperty(
      "disabled",
      true,
    );
  });

  test("멜로디가 생기면 녹음이 완료로 표시되고 다음 단계로 넘어갈 수 있다", () => {
    useSongStore.getState().setMelody([note]);
    render(<Studio projectId={null} />);

    fireEvent.click(stepButton(/녹음 끝내고 다음 단계로/));

    expect(useSongStore.getState().step).toBe("refine");
    expect(stepButton(/완료.*녹음/)).toBeTruthy();
    expect(stepButton(/보정 · AI 분석/).getAttribute("aria-current")).toBe(
      "step",
    );
    // 코드가 아직 없어서 반주로는 못 넘어감
    expect(stepButton(/다음 단계: 반주 고르기/)).toHaveProperty(
      "disabled",
      true,
    );
  });

  test("믹싱 단계의 큰 버튼은 내보내기다", () => {
    const store = useSongStore.getState();
    store.setMelody([note]);
    store.setChords([chord]);
    store.setAccompaniment({ drums: [], bass: [], keys: [] });
    store.setStep("mix");
    render(<Studio projectId={null} />);

    expect(screen.getAllByRole("button", { name: /내보내기/ })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /다음 단계/ })).toBeNull();
  });
});

describe("재생 바와 헤더", () => {
  test("BPM · 박자 · 마디와 곡 길이를 보여 주기만 한다", () => {
    const store = useSongStore.getState();
    store.setBpm(84);
    store.setMelody([{ ...note, duration: 128 }]);
    render(<Studio projectId={null} />);

    expect(screen.getByText("0:00 / 0:23")).toBeTruthy();
    expect(screen.getByText("84 BPM, 4/4박자, 8마디")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  test("게스트는 로그인 안내를, 회원은 마지막 자동 저장 시각을 본다", () => {
    const { unmount } = render(<Studio projectId={null} />);
    expect(screen.getByText(/게스트로 작업 중이에요/)).toBeTruthy();
    // 로그인 뒤 이 스튜디오로 돌아오도록 next를 붙인다
    expect(
      screen.getByRole("link", { name: /^로그인$/ }).getAttribute("href"),
    ).toBe("/login?next=/studio/new");
    unmount();

    auth.state = { user: { id: "u1" }, loading: false };
    useSongStore.getState().markSaved();
    render(<Studio projectId="p1" />);
    expect(screen.getByText(/^\d{2}:\d{2}에 자동 저장됨$/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^로그인$/ })).toBeNull();
    // 회원은 뒤로 가기가 내 프로젝트로
    expect(
      screen
        .getByRole("link", { name: "내 프로젝트로 돌아가기" })
        .getAttribute("href"),
    ).toBe("/projects");
  });

  test("로그인 상태를 확인하는 동안에는 회원 · 게스트 어느 쪽 화면도 보이지 않는다", () => {
    auth.state = { user: null, loading: true };
    render(<Studio projectId={null} />);
    expect(screen.queryByRole("link", { name: /돌아가기$/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^로그인$/ })).toBeNull();
    expect(screen.queryByText(/게스트로 작업 중이에요|자동 저장/)).toBeNull();
  });
});
