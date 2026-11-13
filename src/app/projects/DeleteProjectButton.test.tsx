import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteProjectButton } from "./DeleteProjectButton";

const remove = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/projects", () => ({ deleteProject: remove }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

beforeEach(() => {
  // jsdom에는 모달 dialog가 없어 열고 닫기만 흉내 냅니다.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("프로젝트 삭제 확인 창", () => {
  it("실패 문구는 다시 열면 사라짐", async () => {
    remove.mockRejectedValueOnce(new Error("network"));
    render(<DeleteProjectButton id="p1" title="봄날" recordingPath={null} />);

    // [0]은 메뉴의 삭제, [1]은 확인 창 안의 삭제
    const buttons = screen.getAllByRole("button", {
      name: "삭제",
      hidden: true,
    });
    fireEvent.click(buttons[0]);
    await act(async () => fireEvent.click(buttons[1]));
    expect(screen.queryByRole("alert", { hidden: true })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "취소", hidden: true }));
    fireEvent.click(buttons[0]);
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();
  });
});
