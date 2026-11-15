// 가입 여부를 드러내지 않는 안내 문구를 고정합니다 (docs/specs/01 §3, §5).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  auth.signUp.mockReset();
  auth.signInWithPassword.mockReset();
  auth.signInWithOAuth.mockReset();
});
afterEach(cleanup);

function submit(mode: "login" | "signup", email: string, password: string) {
  const { container } = render(
    <LoginForm initialMode={mode} next="/projects" notice={null} />,
  );
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: password },
  });
  fireEvent.submit(container.querySelector("form")!);
}

describe("LoginForm", () => {
  it("새 이메일과 이미 가입된 이메일이 같은 안내를 받는다", async () => {
    auth.signUp.mockResolvedValue({ error: null });
    submit("signup", "new@example.com", "password1");
    const fresh = (await screen.findByRole("status")).textContent;
    cleanup();

    auth.signUp.mockResolvedValue({ error: { code: "user_already_exists" } });
    submit("signup", "new@example.com", "password1");
    expect((await screen.findByRole("status")).textContent).toBe(fresh);
  });

  it("틀린 비밀번호는 이메일과 비밀번호 중 어느 쪽인지 말하지 않는다", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials" },
    });
    submit("login", "who@example.com", "wrong-pass");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "이메일 또는 비밀번호가 맞지 않아요",
    );
  });

  it("8자 미만 비밀번호는 가입 요청을 보내지 않는다", () => {
    submit("signup", "new@example.com", "short");
    expect(screen.getByRole("alert").textContent).toContain("8자 이상");
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe("GitHub · Google 로그인 (명세 10)", () => {
  const next = "/studio/new?export=1";
  const button = (name: RegExp) =>
    screen.getByRole("button", { name }) as HTMLButtonElement;

  it("누르면 돌아올 곳(next)과 via=oauth를 담아 제공자로 보내고, 두 버튼을 잠근다", () => {
    auth.signInWithOAuth.mockReturnValue(new Promise(() => {}));
    render(<LoginForm initialMode="login" next={next} notice={null} />);
    fireEvent.click(button(/Google로 계속하기/));

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&via=oauth`,
      },
    });
    expect(button(/이동 중/).disabled).toBe(true);
    expect(button(/GitHub로 계속하기/).disabled).toBe(true);
  });

  it("시작하지 못하면 안내하고 다시 누를 수 있다", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      error: { message: "provider is not enabled" },
    });
    render(<LoginForm initialMode="login" next="/projects" notice={null} />);
    fireEvent.click(button(/GitHub로 계속하기/));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "지금은 GitHub 로그인을 쓸 수 없어요",
    );
    expect(button(/GitHub로 계속하기/).disabled).toBe(false);
  });

  it("OAuth 실패 안내는 메일 링크 안내와 다르고, 해시 오류가 있어도 그대로", () => {
    window.location.hash = "#error=access_denied";
    render(
      <LoginForm initialMode="login" next="/projects" notice="oauth-error" />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "GitHub · Google 로그인을 마치지 못했어요",
    );
    window.location.hash = "";
  });

  it("미리보기 배포에서는 버튼을 끄고 안내", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    vi.resetModules();
    const { LoginForm: PreviewForm } = await import("./LoginForm");
    render(<PreviewForm initialMode="login" next="/projects" notice={null} />);
    expect(button(/GitHub로 계속하기/).disabled).toBe(true);
    expect(button(/Google로 계속하기/).disabled).toBe(true);
    expect(
      screen.getByText("미리보기에서는 이메일 로그인만 돼요"),
    ).toBeTruthy();
    vi.unstubAllEnvs();
  });
});
