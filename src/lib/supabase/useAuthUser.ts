"use client";
// 브라우저에서 로그인 사용자를 구독합니다. 화면 표시용이고, 권한은 RLS가 막습니다.
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "./client";

export function useAuthUser(): { user: User | null; loading: boolean } {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    // getSession()은 저장된 값을 그대로 믿으므로 서버에 확인하는 getUser()로 처음 값을 읽습니다.
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setState({ user: data.user, loading: false });
    });
    // 로그인 · 로그아웃(다른 탭 포함) · 토큰 갱신 때마다 갱신
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ user: session?.user ?? null, loading: false });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
