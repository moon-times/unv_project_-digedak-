import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "../../_components/AppHeader";
import { PasswordForm } from "./PasswordForm";

// 새 비밀번호. 재설정 메일 링크(콜백) 또는 계정 화면에서 옵니다. docs/specs/13_account/design.md §2
export default function PasswordPage() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <AppHeader />
      <div className="mx-auto flex max-w-[400px] flex-col gap-4 px-6 py-10">
        <h1 className="font-display text-[32px]">새 비밀번호</h1>
        <Suspense fallback={<p className="text-ink-muted">불러오는 중...</p>}>
          <Gate />
        </Suspense>
      </div>
    </main>
  );
}

async function Gate() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?mode=reset");
  return <PasswordForm />;
}
