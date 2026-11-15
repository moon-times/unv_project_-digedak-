// @vitest-environment node
import {
  AuthApiError,
  AuthPKCECodeVerifierMissingError,
} from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

const { GET } = await import("./route");

const callback = async (query: string) => {
  const response = await GET(
    new NextRequest(`https://app.example/auth/callback${query}`),
  );
  return response.headers.get("location");
};

beforeEach(() => {
  exchangeCodeForSession.mockReset();
});

describe("/auth/callback", () => {
  it("교환에 성공하면 검사한 next로 보낸다", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(await callback("?code=abc&next=/studio/new")).toBe(
      "https://app.example/studio/new",
    );
    expect(await callback("?code=abc&next=//evil.com")).toBe(
      "https://app.example/projects",
    );
  });

  it("code가 없거나 error가 오면 교환하지 않고 링크 오류 안내", async () => {
    expect(await callback("")).toBe(
      "https://app.example/login?notice=link-error",
    );
    expect(await callback("?error=access_denied&code=abc")).toBe(
      "https://app.example/login?notice=link-error",
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("검증값이 없으면(다른 브라우저) 인증 끝남 안내, 그 밖의 실패는 링크 오류", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: new AuthPKCECodeVerifierMissingError(),
    });
    expect(await callback("?code=abc")).toBe(
      "https://app.example/login?notice=confirmed",
    );

    exchangeCodeForSession.mockResolvedValue({
      error: new AuthApiError(
        "invalid flow state",
        400,
        "flow_state_not_found",
      ),
    });
    expect(await callback("?code=garbage")).toBe(
      "https://app.example/login?notice=link-error",
    );
  });
});

describe("/auth/callback (OAuth, 명세 10)", () => {
  it("취소 · code 없음 · 교환 실패는 모두 OAuth 안내", async () => {
    expect(await callback("?via=oauth&error=access_denied")).toBe(
      "https://app.example/login?notice=oauth-error",
    );
    expect(await callback("?via=oauth")).toBe(
      "https://app.example/login?notice=oauth-error",
    );
    exchangeCodeForSession.mockResolvedValue({
      error: new AuthPKCECodeVerifierMissingError(),
    });
    expect(await callback("?via=oauth&code=abc")).toBe(
      "https://app.example/login?notice=oauth-error",
    );
  });

  it("성공하면 검사한 next로", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(
      await callback(
        `?via=oauth&code=abc&next=${encodeURIComponent("/studio/new?export=1")}`,
      ),
    ).toBe("https://app.example/studio/new?export=1");
  });
});
