// Supabase 접속 정보. 브라우저와 서버 모두 publishable 키만 씁니다.
// secret 키(sb_secret_…)는 RLS를 무시하므로 이 앱에서는 쓰지 않습니다.
// NEXT_PUBLIC_ 값은 빌드할 때 코드에 박히므로 process.env.XXX 형태로 직접 읽어야 합니다.

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase 환경변수가 없습니다. .env.example을 참고해 .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 넣어 주세요.",
    );
  }
  return { url, key };
}
