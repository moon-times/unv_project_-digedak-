import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ claims: null as object | null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: auth.claims } }) },
  }),
}));
// React cache는 서버 요청 단위로만 동작해서, 테스트에서는 그대로 통과시킵니다.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

const { LandingAuthLink } = await import("./LandingAuthLink");
afterEach(cleanup);

describe("LandingAuthLink", () => {
  it("로그인하지 않았으면 로그인으로", async () => {
    auth.claims = null;
    render(await LandingAuthLink({ variant: "header" }));
    expect(
      screen.getByRole("link", { name: "로그인" }).getAttribute("href"),
    ).toBe("/login");
  });

  it("회원이면 내 프로젝트로", async () => {
    auth.claims = { sub: "u1" };
    render(await LandingAuthLink({ variant: "hero" }));
    expect(
      screen.getByRole("link", { name: "내 프로젝트" }).getAttribute("href"),
    ).toBe("/projects");
  });
});
