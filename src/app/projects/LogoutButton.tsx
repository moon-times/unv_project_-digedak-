"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout() {
    setPending(true);
    setFailed(false);
    // 기본 scope는 "global": 모든 기기에서 로그아웃 (명세 01 §3)
    const { error } = await createClient().auth.signOut();
    if (error) {
      // 다른 기기의 세션을 끊지 못했을 수 있으니 로그아웃된 것처럼 넘어가지 않습니다.
      setPending(false);
      setFailed(true);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={logout}
        className="min-h-11 rounded-full border-2 border-[#2B2018] px-4 font-semibold disabled:opacity-50"
      >
        로그아웃
      </button>
      {failed && (
        <p role="alert" className="text-sm text-[#A23B2A]">
          로그아웃하지 못했어요. 다시 시도해 주세요
        </p>
      )}
    </>
  );
}
