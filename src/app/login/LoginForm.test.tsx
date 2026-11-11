// 가입 여부를 드러내지 않는 안내 문구를 고정합니다 (docs/specs/01 §3, §5).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  auth.signUp.mockReset();
  auth.signInWithPassword.mockReset();
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
