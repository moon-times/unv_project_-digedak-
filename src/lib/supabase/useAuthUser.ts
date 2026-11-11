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
    // 구독하자마자 현재 세션(INITIAL_SESSION)을 한 번 알려 주고, 그 뒤 로그인 · 로그아웃(다른 탭 포함)마다 갱신됩니다.
    // 따로 getUser()를 부르면 그 응답이 로그아웃 이벤트보다 늦게 와서 덮어쓸 수 있어 쓰지 않습니다.
    const { data } = createClient().auth.onAuthStateChange(
      (_event, session) => {
        setState({ user: session?.user ?? null, loading: false });
      },
    );
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}
