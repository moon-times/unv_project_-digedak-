import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderProgress } from "@/features/player";
import { useSongStore } from "@/store/songStore";
import { createEmptySong } from "@/types/song";
import { ExportDialog } from "./ExportDialog";

// 렌더링은 브라우저 오디오가 필요하므로, 진행 알림과 결과를 테스트에서 직접 넘깁니다.
let progress: (p: RenderProgress) => void = () => {};
let finish: (blob: Blob) => void = () => {};
let fail: (error: Error) => void = () => {};
vi.mock("@/features/editor/exportWav", async (original) => ({
  ...(await original<typeof import("@/features/editor/exportWav")>()),
  exportWav: vi.fn(
    (_song: unknown, onProgress: (p: RenderProgress) => void) =>
      new Promise<Blob>((resolve, reject) => {
        progress = onProgress;
        finish = resolve;
        fail = reject;
      }),
  ),
}));

const createObjectURL = vi.fn(() => "blob:wav");
beforeEach(() => {
  // jsdom에는 모달 dialog가 없어 열고 닫기만 흉내 냅니다.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  useSongStore.setState({
    song: { ...createEmptySong(), title: "봄날" },
    projectId: "p1",
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("회원 내보내기", () => {
  it("받기 → 악기 불러오는 중 → N% → 다운로드", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<ExportDialog member open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "WAV 다운로드" }));

    act(() => progress({ phase: "loading" }));
    expect(screen.getByRole("status").textContent).toBe("악기 불러오는 중...");
    expect(
      (
        screen.getByRole("button", {
          name: "WAV 다운로드",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    act(() => progress({ phase: "rendering", ratio: 0.6 }));
    expect(screen.getByRole("status").textContent).toBe("WAV로 만드는 중 60%");

    await act(async () => finish(new Blob()));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe("다운로드했어요");
  });

  it("실패하면 안내하고 다시 누를 수 있음", async () => {
    render(<ExportDialog member open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "WAV 다운로드" }));
    await act(async () => fail(new Error("network")));

    expect(screen.getByRole("status").textContent).toContain(
      "WAV를 만들지 못했어요",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "WAV 다운로드",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    // [다시 시도]를 누르면 처음부터 다시 만듭니다.
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(screen.getByRole("status").textContent).toBe("악기 불러오는 중...");
  });

  it("만드는 중에 닫으면 파일을 받지 않음", async () => {
    const view = render(<ExportDialog member open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "WAV 다운로드" }));
    view.rerender(<ExportDialog member open={false} onClose={() => {}} />);
    await act(async () => finish(new Blob()));

    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe("게스트 내보내기", () => {
  it("받기 버튼 없이 로그인 안내, 돌아올 곳은 지금 곡", () => {
    render(<ExportDialog member={false} open onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "WAV 다운로드" })).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "로그인하고 저장하기" })
        .getAttribute("href"),
    ).toBe("/login?next=/studio/p1");
  });
});
