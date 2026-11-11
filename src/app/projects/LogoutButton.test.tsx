import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "./LogoutButton";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: mocks.signOut } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: vi.fn() }),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("LogoutButton", () => {
  it("로그아웃에 성공하면 처음 화면으로 간다", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
  });

  it("실패하면 이동하지 않고 안내한 뒤 다시 누를 수 있다", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("network") });
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "로그아웃하지 못했어요",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "로그아웃" })).toHaveProperty(
      "disabled",
      false,
    );
  });
});
