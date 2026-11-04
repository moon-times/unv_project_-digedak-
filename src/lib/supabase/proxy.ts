// 요청마다 만료된 세션을 갱신하고, 갱신된 쿠키를 응답에 실어 보냅니다.
// src/proxy.ts에서 호출합니다. 로그인 여부로 페이지를 막는 일은 여기서 하지 않습니다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // 이번 요청을 처리할 서버 코드도 갱신된 쿠키를 보도록 요청 쪽에도 넣습니다.
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // 세션 쿠키가 담긴 응답이 CDN에 캐시되지 않도록 하는 헤더
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  // 토큰이 만료됐으면 여기서 갱신됩니다. 이 호출과 응답 반환 사이에 다른 코드를 넣지 마세요.
  await supabase.auth.getClaims();

  return response;
}
