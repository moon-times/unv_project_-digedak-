import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import mascot from "../icon.png";
import { LoginForm, type Notice } from "./LoginForm";

// docs/specs/01_email-login.md §4. 사용자를 읽는 부분은 Cache Components 규칙상 Suspense 안에 둡니다.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid min-h-dvh grid-cols-1 bg-[#F3E6CF] text-[#2B2018] md:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#6E4A30] p-12 text-[#FBF4E8] md:flex">
        <div>
          <h1 className="text-[32px] leading-tight font-bold">
            게스트로 만든 곡도
            <br />
            그대로 이어져요
          </h1>
          <p className="mt-4 opacity-80">
            로그인하면 작업한 곡을 저장하고 WAV로 내려받을 수 있어요.
          </p>
        </div>
        <Image src={mascot} alt="" width={180} height={180} priority />
      </section>
      <section className="flex items-center justify-center p-6">
        <Suspense
          fallback={<p className="text-sm opacity-60">불러오는 중...</p>}
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
