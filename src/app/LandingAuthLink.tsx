// 랜딩의 [로그인] / [내 프로젝트] 자리. 요청마다 쿠키를 읽으므로 <Suspense> 안에서만 씁니다.
// docs/specs/03_landing/design.md §3
import Link from "next/link";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// 한 요청 안에서 두 자리가 로그인 여부를 한 번만 확인합니다.
const getMember = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
});

export const AUTH_LINK_CLASS = {
  header:
    "flex min-h-11 items-center rounded-full border-2 border-ink bg-surface px-4 text-[15px] font-semibold shadow-[0_3px_0_var(--color-ink)]",
  hero: "flex min-h-[52px] items-center rounded-full border-2 border-ink bg-surface px-6 text-[17px] font-bold shadow-[0_4px_0_var(--color-ink)]",
} as const;

export async function LandingAuthLink({
  variant,
}: {
  variant: keyof typeof AUTH_LINK_CLASS;
}) {
  const member = await getMember();
  return (
    <Link
      href={member ? "/projects" : "/login"}
      className={AUTH_LINK_CLASS[variant]}
    >
      {member ? "내 프로젝트" : "로그인"}
    </Link>
  );
}
