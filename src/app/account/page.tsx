import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AccountLink, AppHeader } from "../_components/AppHeader";
import { LogoutButton } from "../projects/LogoutButton";
import { DeleteAccountButton } from "./DeleteAccountButton";

// 계정 화면. 사용자 확인은 Suspense 안에서 (Cache Components). docs/specs/13_account/design.md §3
export default function AccountPage() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <Suspense
        fallback={
          <>
            <AppHeader />
            <p className="px-8 py-8 text-ink-muted">불러오는 중...</p>
          </>
        }
      >
        <Account />
      </Suspense>
    </main>
  );
}

const PROVIDER_NAME: Record<string, string> = {
  email: "이메일",
  github: "GitHub",
  google: "Google",
};

async function Account() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/account");
  const email = data.claims.email ?? "";
  const providers: string[] = data.claims.app_metadata?.providers ?? [];
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true });

  return (
    <>
      <AppHeader
        account={
          <>
            <AccountLink email={email} />
            <LogoutButton />
          </>
        }
      />
      <div className="mx-auto flex max-w-[560px] flex-col gap-6 px-6 py-10">
        <h1 className="font-display text-[40px] leading-tight">계정</h1>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl border-2 border-ink bg-surface p-5">
          <dt className="text-ink-muted">이메일</dt>
          <dd className="break-all">{email}</dd>
          <dt className="text-ink-muted">로그인 방식</dt>
          <dd>
            {providers.map((p) => PROVIDER_NAME[p] ?? p).join(" · ") || "-"}
          </dd>
        </dl>

        <section className="flex flex-col gap-2">
          <h2 className="text-[18px] font-bold">비밀번호</h2>
          <Link
            href="/account/password"
            className="flex min-h-11 w-fit items-center rounded-full border-2 border-ink bg-surface px-5 font-semibold shadow-[0_3px_0_var(--color-ink)]"
          >
            {providers.includes("email")
              ? "비밀번호 바꾸기"
              : "비밀번호 만들기"}
          </Link>
        </section>

        <section className="flex flex-col gap-2 rounded-2xl border-2 border-danger p-5">
          <h2 className="text-[18px] font-bold text-danger">회원탈퇴</h2>
          <p className="text-[14px] text-ink-muted">
            만든 곡과 녹음, AI 사용 기록이 모두 지워지고 되돌릴 수 없어요.
          </p>
          <DeleteAccountButton projectCount={count ?? 0} />
        </section>
      </div>
    </>
  );
}
