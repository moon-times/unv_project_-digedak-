"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        // 기본 scope는 "global": 모든 기기에서 로그아웃 (명세 §3)
        await createClient().auth.signOut();
        router.replace("/");
        router.refresh();
      }}
      className="min-h-11 rounded-full border-2 border-[#2B2018] px-4 font-semibold disabled:opacity-50"
    >
      로그아웃
    </button>
  );
}
