import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

// 로그인 여부 자리는 LandingAuthLink.test.tsx에서 따로 확인합니다.
vi.mock("./LandingAuthLink", () => ({
  AUTH_LINK_CLASS: { header: "", hero: "" },
  LandingAuthLink: () => null,
}));
afterEach(cleanup);

describe("랜딩", () => {
  it("바로 만들어보기는 누구에게나 게스트 스튜디오로", () => {
    render(<Home />);
    expect(
      screen
        .getByRole("link", { name: "바로 만들어보기" })
        .getAttribute("href"),
    ).toBe("/studio/new");
  });

  it("제목(h1)은 하나, 3단계 카드는 세 개", () => {
    render(<Home />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});
