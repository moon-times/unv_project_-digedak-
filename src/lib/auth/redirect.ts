// 로그인 뒤 돌아갈 경로 검사. 외부 사이트로 보내는 open redirect를 막습니다 (docs/specs/01 §6).
export const DEFAULT_AFTER_LOGIN = "/projects";

// 경로만 떼어 내기 위한 가짜 origin. 실제로 요청하지 않습니다.
const BASE = "http://internal.invalid";

/** 로그인 뒤 이동할 경로. 앱 안의 상대 경로만 통과시키고 나머지는 기본값 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return DEFAULT_AFTER_LOGIN;
  }
  // 브라우저는 URL의 탭 · 줄바꿈을 지우고 \를 /로 읽어서 "/\t/evil.com"이 "//evil.com"이 됩니다.
  if (/[\u0000-\u001F\u007F\\]/.test(next)) return DEFAULT_AFTER_LOGIN;

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
  if (url.origin !== BASE) return DEFAULT_AFTER_LOGIN;
  // 로그인 화면으로 다시 돌아가는 반복 방지
  if (url.pathname === "/login" || url.pathname.startsWith("/auth/")) {
    return DEFAULT_AFTER_LOGIN;
  }
  return url.pathname + url.search + url.hash;
}
