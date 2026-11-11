import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import mascot from "../icon.png";
import { LoginForm, type Notice } from "./LoginForm";

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex w-fit items-center gap-2 font-display text-[22px] ${className}`}
    >
      <Image src={mascot} alt="" width={40} height={40} />
      딕으닥
    </Link>
  );
}

// docs/specs/01_email-login.md §4. 사용자를 읽는 부분은 Cache Components 규칙상 Suspense 안에 둡니다.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid min-h-dvh grid-cols-1 bg-paper text-ink md:grid-cols-2">
      <section className="hidden grid-rows-[auto_1fr_auto] bg-earth px-12 pt-10 text-surface md:grid">
        <Logo />
        <div className="self-center">
          <h1 className="font-display text-[44px] leading-tight">
            게스트로 만든 곡도
            <br />
            그대로 이어져요
          </h1>
          <p className="mt-5 max-w-[440px] text-[15px] leading-relaxed text-surface/80">
            로그인하면 스튜디오로 돌아가 하던 작업을 이어서 하고, 만든 곡을 내
            프로젝트에 저장하고 WAV로 내려받을 수 있어요.
          </p>
        </div>
        <Image
          src={mascot}
          alt=""
          width={260}
          height={260}
          priority
          className="justify-self-end"
        />
      </section>
      <section className="flex flex-col items-center justify-center gap-8 p-6">
        <Logo className="md:hidden" />
        <Suspense
          fallback={<p className="text-sm text-ink-muted">불러오는 중...</p>}
        >
          {searchParams.then((params) => (
            <LoginGate params={params} />
          ))}
        </Suspense>
      </section>
    </main>
  );
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

async function LoginGate({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const next = safeNext(first(params.next));
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(next);

  const notice = first(params.notice);
  return (
    <LoginForm
      initialMode={first(params.mode) === "signup" ? "signup" : "login"}
      next={next}
      notice={
        notice === "confirmed" || notice === "link-error"
          ? (notice as Notice)
          : null
      }
    />
  );
}
