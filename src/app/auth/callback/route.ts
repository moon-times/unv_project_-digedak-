// 메일 확인 링크(앞으로 OAuth도)가 돌아오는 곳. PKCE code를 세션으로 바꾸고 원래 화면으로 보냅니다.
// docs/specs/01_email-login.md §4
import { isAuthPKCECodeVerifierMissingError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // Host 헤더를 조합하지 않고 Next가 파싱한 origin만 씁니다.
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (searchParams.has("error") || !code) {
    return to("/login?notice=link-error");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) return to(safeNext(searchParams.get("next")));

  // 다른 브라우저에서 링크를 열면 이 브라우저에 PKCE 검증값이 없습니다. 메일 인증 자체는 끝난 상태입니다.
  return to(
    isAuthPKCECodeVerifierMissingError(error)
      ? "/login?notice=confirmed"
      : "/login?notice=link-error",
  );
}
