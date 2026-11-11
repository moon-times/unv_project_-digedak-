import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_LOGIN, safeNext } from "./redirect";

describe("safeNext", () => {
  it("앱 안의 경로는 그대로", () => {
    expect(safeNext("/studio/new")).toBe("/studio/new");
    expect(safeNext("/projects?x=1")).toBe("/projects?x=1");
    // 인코딩된 문자는 경로 글자로 남아 다른 사이트로 가지 않음
    expect(safeNext("/%0A/evil.com")).toBe("/%0A/evil.com");
  });

  it.each([null, undefined, "", "projects"])(
    "비었거나 상대 경로가 아니면 기본값: %j",
    (next) => {
      expect(safeNext(next)).toBe(DEFAULT_AFTER_LOGIN);
    },
  );

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\\/evil.com",
  ])("다른 사이트로 갈 수 있는 값은 기본값: %j", (next) => {
    expect(safeNext(next)).toBe(DEFAULT_AFTER_LOGIN);
  });

  it.each(["/login", "/login?next=/x", "/auth/callback"])(
    "로그인 화면으로 되돌아가는 경로는 기본값: %j",
    (next) => {
      expect(safeNext(next)).toBe(DEFAULT_AFTER_LOGIN);
    },
  );
});
