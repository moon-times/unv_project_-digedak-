// 서버(Server Component, Route Handler, Server Function)에서 쓰는 Supabase 클라이언트.
// 요청마다 새로 만듭니다. 로그인 사용자를 확인할 때는 getUser()나 getClaims()를 씁니다.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

export async function createClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component 렌더링 중에는 쿠키를 쓸 수 없습니다.
          // 세션 갱신은 src/proxy.ts가 맡으므로 무시해도 됩니다.
        }
      },
    },
  });
}
