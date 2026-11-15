import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountButton } from "./DeleteAccountButton";

const deleteAccount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/account", () => ({
  deleteAccount,
  SESSION_EXPIRED: "session-expired",
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom에는 showModal이 없습니다.
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});
afterEach(cleanup);

const submitButton = () =>
  screen.getByRole("button", {
    name: /탈퇴하기|탈퇴하는 중/,
    hidden: true,
  }) as HTMLButtonElement;
const type = (value: string) =>
  fireEvent.change(screen.getByLabelText(/탈퇴라고 입력/), {
    target: { value },
  });

describe("DeleteAccountButton (명세 13 D1 · D2)", () => {
  it("지워질 곡 개수를 보여 주고, '탈퇴'를 입력해야 켜진다", () => {
    render(<DeleteAccountButton projectCount={3} />);
    expect(screen.getByText(/곡 3개와 녹음/)).toBeTruthy();
    expect(submitButton().disabled).toBe(true);
    type("탈퇴 ");
    expect(submitButton().disabled).toBe(false);
    type("탈");
    expect(submitButton().disabled).toBe(true);
  });

  it("실패하면 안내하고 다시 누를 수 있다", async () => {
    deleteAccount.mockRejectedValue(new Error("fail"));
    render(<DeleteAccountButton projectCount={0} />);
    type("탈퇴");
    fireEvent.click(submitButton());
    expect(
      (await screen.findByRole("alert", { hidden: true })).textContent,
    ).toContain("탈퇴하지 못했어요");
    expect(submitButton().disabled).toBe(false);
  });

  it("진행 중에는 다시 누를 수 없다", () => {
    deleteAccount.mockReturnValue(new Promise(() => {}));
    render(<DeleteAccountButton projectCount={0} />);
    type("탈퇴");
    fireEvent.click(submitButton());
    expect(submitButton().textContent).toBe("탈퇴하는 중...");
    expect(submitButton().disabled).toBe(true);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("세션이 끊겼으면 다시 로그인하라고 안내", async () => {
    deleteAccount.mockRejectedValue(new Error("session-expired"));
    render(<DeleteAccountButton projectCount={0} />);
    type("탈퇴");
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert", { hidden: true });
    expect(alert.textContent).toContain("로그인이 풀렸어요");
    expect(alert.querySelector("a")?.getAttribute("href")).toBe(
      "/login?next=/account",
    );
  });
});
