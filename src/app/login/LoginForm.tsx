"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type SubmitEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export type Notice = "confirmed" | "link-error";
type Mode = "login" | "signup";

const NOTICE_TEXT: Record<Notice, string> = {
  // 검증값이 없는 브라우저에서는 진짜 메일 링크와 아무 code를 구분할 수 없어서 단정하지 않습니다.
  confirmed: "메일 인증을 마쳤다면 로그인해 주세요",
  "link-error": "링크가 만료됐거나 잘못됐어요. 다시 시도해 주세요",
};
const MIN_PASSWORD = 8;
const noSubscribe = () => () => {};

export function LoginForm({
  initialMode,
  next,
  notice: initialNotice,
}: {
  initialMode: Mode;
  /** safeNext()를 거친 경로 */
  next: string;
  notice: Notice | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // 만료 링크 오류가 쿼리 대신 해시(#error=…)로 오는 경우 (서버에서는 해시를 볼 수 없음)
  const hashError = useSyncExternalStore(
    noSubscribe,
    () => window.location.hash.includes("error="),
    () => false,
  );
  const notice: Notice | null = hashError ? "link-error" : initialNotice;

  const switchMode = (value: Mode) => {
    setMode(value);
    setError(null);
    setSentTo(null);
  };

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      setError(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요`);
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) {
        router.replace(next);
        router.refresh();
        return;
      }
      setPending(false);
      setError(
        error.code === "invalid_credentials"
          ? "이메일 또는 비밀번호가 맞지 않아요"
          : error.code === "email_not_confirmed"
            ? "메일 인증을 먼저 해 주세요"
            : "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요",
      );
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setPending(false);
    // 가입 여부를 드러내지 않도록 이미 가입된 이메일도 같은 안내 (명세 §3)
    if (!error || error.code === "user_already_exists") setSentTo(email);
    else setError("지금은 메일을 보낼 수 없어요. 잠시 뒤 다시 시도해 주세요");
  }

  return (
    <div className="w-full max-w-[400px]">
      <div
        role="tablist"
        className="mb-6 flex rounded-full border-2 border-[#2B2018] p-1"
      >
        {(["login", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => switchMode(value)}
            className="min-h-11 flex-1 rounded-full text-[15px] font-semibold aria-selected:bg-[#2B2018] aria-selected:text-[#FBF4E8]"
          >
            {value === "login" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      <h2 className="mb-4 text-[24px] font-bold">
        {mode === "login" ? "다시 오셨네요" : "처음 오셨네요"}
      </h2>

      {notice && (
        <p role="status" className="mb-4 rounded-xl bg-[#FBF4E8] p-3 text-sm">
          {NOTICE_TEXT[notice]}
        </p>
      )}

      {sentTo ? (
        <p role="status" className="rounded-xl bg-[#FBF4E8] p-4">
          확인 메일을 {sentTo}로 보냈어요. 메일의 링크를 누르면 로그인돼요. 이미
          가입했다면 로그인해 주세요.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            이메일
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 rounded-xl border-2 border-[#2B2018] bg-[#FBF4E8] px-3 text-base font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            비밀번호
            <input
              type="password"
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "signup" ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? "login-error" : undefined}
              className="min-h-11 rounded-xl border-2 border-[#2B2018] bg-[#FBF4E8] px-3 text-base font-normal"
            />
          </label>
          {error && (
            <p id="login-error" role="alert" className="text-sm text-[#A23B2A]">
              {error}
            </p>
          )}
          {mode === "login" && (
            // 비밀번호 재설정은 다음 명세
            <span className="text-sm opacity-50">
              비밀번호를 잊었나요? (구현중)
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 min-h-[52px] rounded-full border-2 border-[#2B2018] bg-[#2C6E62] text-[17px] font-bold text-[#FBF4E8] shadow-[0_4px_0_#2B2018] disabled:opacity-50"
          >
            {pending ? "잠시만요..." : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>
      )}

      <p className="my-5 text-center text-sm opacity-60">또는</p>
      <div className="flex flex-col gap-2">
        {/* GitHub · Google 로그인은 다음 명세 (원격에서 아직 꺼져 있음) */}
        {["GitHub", "Google"].map((name) => (
          <button
            key={name}
            type="button"
            disabled
            className="min-h-11 rounded-full border-2 border-[#2B2018] font-semibold disabled:opacity-40"
          >
            {name}로 계속하기
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-sm">
        로그인 없이 먼저 해 보고 싶다면{" "}
        <Link href="/studio/new" className="font-semibold underline">
          게스트로 만들어보기
        </Link>
      </p>
    </div>
  );
}
