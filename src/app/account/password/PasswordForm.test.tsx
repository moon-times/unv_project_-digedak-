import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordForm } from "./PasswordForm";

const mocks = vi.hoisted(() => ({ updateUser: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser: mocks.updateUser } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: vi.fn() }),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function submit(password: string, confirm = password) {
  const { container } = render(<PasswordForm />);
  fireEvent.change(screen.getByLabelText("새 비밀번호 (8자 이상)"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), {
    target: { value: confirm },
  });
  fireEvent.submit(container.querySelector("form")!);
}

describe("PasswordForm (명세 13 P4 · P6)", () => {
  it("8자 미만이나 두 칸이 다르면 요청하지 않는다", () => {
    submit("short");
    expect(screen.getByRole("alert").textContent).toContain("8자 이상");
    cleanup();
    submit("password1", "password2");
    expect(screen.getByRole("alert").textContent).toBe(
      "두 비밀번호가 같지 않아요",
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("바꾸면 내 프로젝트로", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    submit("password1");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "password1" });
    await vi.waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/projects"),
    );
  });

  it.each([
    ["same_password", "지금 비밀번호와 달라야 해요"],
    ["reauthentication_needed", "재설정 메일을 받아 주세요"],
    ["unexpected_failure", "바꾸지 못했어요"],
  ])("%s 오류 안내", async (code, text) => {
    mocks.updateUser.mockResolvedValue({ error: { code } });
    submit("password1");
    expect((await screen.findByRole("alert")).textContent).toContain(text);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
