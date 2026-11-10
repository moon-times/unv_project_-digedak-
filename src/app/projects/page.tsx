import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

// 최소 화면 (docs/specs/01_email-login.md §4). 프로젝트 목록은 다음 명세.
export default function ProjectsPage() {
  return (
    <main className="min-h-dvh bg-[#F3E6CF] p-8 text-[#2B2018]">
      <h1 className="text-[28px] font-bold">내 프로젝트</h1>
      <Suspense fallback={<p className="mt-4 opacity-60">불러오는 중...</p>}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/projects");

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="opacity-70">{data.claims.email}</span>
      <LogoutButton />
      <Link
        href="/studio/new"
        className="flex min-h-11 items-center rounded-full border-2 border-[#2B2018] bg-[#2C6E62] px-5 font-bold text-[#FBF4E8]"
      >
        새 곡 만들기
      </Link>
    </div>
  );
}
