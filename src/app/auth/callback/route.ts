// 메일 확인 링크와 GitHub · Google 로그인이 돌아오는 곳. PKCE code를 세션으로 바꾸고 원래 화면으로 보냅니다.
// docs/specs/01_email-login.md §4, docs/specs/10_social-login/design.md §4
import { isAuthPKCECodeVerifierMissingError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // Host 헤더를 조합하지 않고 Next가 파싱한 origin만 씁니다.
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));
  // OAuth(LoginForm이 via=oauth를 붙임)는 취소 · 실패를 메일 링크 오류와 다르게 안내합니다.
  const oauth = searchParams.get("via") === "oauth";
  const next = safeNext(searchParams.get("next"));
  // 실패해도 돌아갈 곳을 넘겨, 다시 로그인하면 원래 화면(게스트 곡 등)으로 가게 합니다.
  const notice = (kind: string) =>
    `/login?notice=${kind}&next=${encodeURIComponent(next)}`;
  const failed = notice(oauth ? "oauth-error" : "link-error");

  if (searchParams.has("error") || !code) return to(failed);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) return to(next);

  // 다른 브라우저에서 링크를 열면 이 브라우저에 PKCE 검증값이 없습니다. 메일 인증 자체는 끝난 상태입니다.
  return to(
    !oauth && isAuthPKCECodeVerifierMissingError(error)
      ? notice("confirmed")
      : failed,
  );
}
