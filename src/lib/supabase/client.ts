// 브라우저(Client Component)에서 쓰는 Supabase 클라이언트.
// 세션은 쿠키에 저장되어 서버 클라이언트와 공유됩니다. 브라우저에서는 같은 인스턴스를 재사용합니다.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient<Database>(url, key);
}
