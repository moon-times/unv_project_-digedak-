// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GUEST_DRAFT_KEY } from "@/store/songStore";
import type { Database } from "@/types/database";
import { deleteAccount } from "./account";

const clearRecordingDraft = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/recordingDraft", () => ({ clearRecordingDraft }));

const calls: string[] = [];
const mock = {
  getUser: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
};
const supabase = {
  auth: {
    getUser: () => (calls.push("getUser"), mock.getUser()),
    signOut: (o: unknown) => (calls.push("signOut"), mock.signOut(o)),
  },
  storage: {
    from: () => ({
      list: (...a: unknown[]) => (calls.push("list"), mock.list(...a)),
      remove: (p: string[]) => (calls.push("remove"), mock.remove(p)),
    }),
  },
  rpc: (name: string) => (calls.push(name), mock.rpc(name)),
} as unknown as SupabaseClient<Database>;

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  mock.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  mock.list.mockResolvedValue({
    data: [{ name: "p1.webm" }, { name: "p2.wav" }],
    error: null,
  });
  mock.remove.mockResolvedValue({ data: [], error: null });
  mock.rpc.mockResolvedValue({ error: null });
  mock.signOut.mockResolvedValue({ error: null });
  localStorage.setItem(GUEST_DRAFT_KEY, "{}");
});

describe("deleteAccount (명세 13 D3 · D6 · D7)", () => {
  it("파일 → 계정 → 로그아웃 → 보관본 순서로 지운다", async () => {
    await deleteAccount(supabase);
    expect(calls).toEqual([
      "getUser",
      "list",
      "remove",
      "delete_my_account",
      "signOut",
    ]);
    expect(mock.list).toHaveBeenCalledWith("u1", { limit: 1000 });
    expect(mock.remove).toHaveBeenCalledWith(["u1/p1.webm", "u1/p2.wav"]);
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(localStorage.getItem(GUEST_DRAFT_KEY)).toBeNull();
    expect(clearRecordingDraft).toHaveBeenCalled();
  });

  it("파일이 없으면 remove 없이 계정을 지운다", async () => {
    mock.list.mockResolvedValue({ data: [], error: null });
    await deleteAccount(supabase);
    expect(calls).not.toContain("remove");
    expect(calls).toContain("delete_my_account");
  });

  it("파일 삭제가 실패하면 계정을 지우지 않는다", async () => {
    mock.remove.mockResolvedValue({ data: null, error: new Error("403") });
    await expect(deleteAccount(supabase)).rejects.toThrow();
    expect(calls).not.toContain("delete_my_account");
  });

  it("계정 삭제가 실패하면 로그아웃 · 보관본 삭제를 하지 않는다", async () => {
    mock.rpc.mockResolvedValue({ error: new Error("no active session") });
    await expect(deleteAccount(supabase)).rejects.toThrow();
    expect(calls).not.toContain("signOut");
    expect(localStorage.getItem(GUEST_DRAFT_KEY)).toBe("{}");
  });

  it("세션이 유효하지 않으면 아무것도 지우지 않는다", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(deleteAccount(supabase)).rejects.toThrow();
    expect(calls).toEqual(["getUser"]);
  });
});
