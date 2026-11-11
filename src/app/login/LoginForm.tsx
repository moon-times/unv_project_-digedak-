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
        className="mb-6 flex rounded-full border-2 border-ink bg-surface p-1"
      >
        {(["login", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => switchMode(value)}
            className="min-h-11 flex-1 rounded-full text-[15px] font-semibold aria-selected:bg-ink aria-selected:text-surface"
          >
            {value === "login" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      <h2 className="mb-4 font-display text-[28px]">
        {mode === "login" ? "다시 오셨네요" : "처음 오셨네요"}
      </h2>

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl border-2 border-ink bg-surface p-3 text-sm"
        >
          {NOTICE_TEXT[notice]}
        </p>
      )}

      {sentTo ? (
        <p
          role="status"
          className="rounded-xl border-2 border-ink bg-surface p-4"
        >
          확인 메일을 {sentTo}로 보냈어요. 메일의 링크를 누르면 로그인돼요. 이미
          가입했다면 로그인해 주세요.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="login-email" className="text-sm font-semibold">
              이메일
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="login-password" className="text-sm font-semibold">
                비밀번호
              </label>
              {mode === "login" && (
                // 비밀번호 재설정은 다음 명세
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  비밀번호를 잊었나요?
                  <Soon />
                </span>
              )}
            </div>
            <input
              id="login-password"
              type="password"
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "signup" ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? "login-error" : undefined}
              className={inputClass}
            />
          </div>
          {error && (
            <p id="login-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 min-h-[52px] rounded-full border-2 border-ink bg-primary text-[17px] font-bold text-on-primary shadow-[0_4px_0_var(--color-ink)] disabled:opacity-50"
          >
            {pending ? "잠시만요..." : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>
      )}

      <p className="my-5 flex items-center gap-3 text-sm text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        또는
      </p>
      <div className="flex flex-col gap-2">
        {/* GitHub · Google 로그인은 다음 명세 (원격에서 아직 꺼져 있음) */}
        {SOCIAL.map(({ name, icon }) => (
          <button
            key={name}
            type="button"
            disabled
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-ink bg-surface font-semibold text-ink-muted"
          >
            {icon}
            {name}로 계속하기
            <Soon />
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        로그인 없이 먼저 해 보고 싶다면{" "}
        <Link href="/studio/new" className="font-semibold text-ink underline">
          게스트로 만들어보기
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "min-h-11 rounded-xl border-2 border-ink bg-surface px-3 text-base placeholder:text-ink-muted";

/** 아직 없는 기능 표시. 목업의 "확장" 태그 모양 */
function Soon() {
  return (
    <span className="rounded-[5px] border border-dashed border-line-dashed px-1.5 text-[11px] font-semibold text-ink-muted">
      준비 중
    </span>
  );
}

const SOCIAL = [
  {
    name: "GitHub",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
    ),
  },
  {
    name: "Google",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.19-1.79 4.13-1.15 1.15-2.93 2.4-6.05 2.4-4.83 0-8.6-3.89-8.6-8.72s3.77-8.72 8.6-8.72c2.6 0 4.51 1.03 5.91 2.35l2.31-2.31C18.75 1.44 16.13 0 12.48 0 5.87 0 .31 5.39.31 12s5.56 12 12.17 12c3.57 0 6.27-1.17 8.37-3.36 2.16-2.16 2.84-5.21 2.84-7.67 0-.76-.05-1.47-.17-2.05H12.48z" />
      </svg>
    ),
  },
];
