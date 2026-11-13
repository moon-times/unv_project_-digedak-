import { describe, expect, it, vi } from "vitest";
import { createEmptySong } from "@/types/song";
import {
  deleteProject,
  LIST_LIMIT,
  listProjects,
  loadProject,
  saveProject,
} from "./projects";

/** supabase-js 쿼리 빌더 흉내: 어떤 메서드를 이어 불러도 마지막에 result로 끝납니다. */
function fakeClient(
  result: { data: unknown; error: unknown; count?: number },
  uid = "user-1",
) {
  const query: Record<string, unknown> = {};
  for (const name of [
    "insert",
    "update",
    "delete",
    "select",
    "eq",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ]) {
    query[name] = vi.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown) => resolve(result);
  const remove = vi.fn(async () => ({ error: null }));
  const client = {
    from: vi.fn(() => query),
    auth: { getClaims: async () => ({ data: { claims: { sub: uid } } }) },
    storage: { from: () => ({ remove }) },
  };
  // 테스트에서는 필요한 부분만 흉내 냅니다.
  return { client: client as never, query, remove };
}

describe("saveProject", () => {
  it("바뀐 행이 없으면(없거나 남의 프로젝트) 실패로 본다", async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(saveProject(client, "p1", createEmptySong())).rejects.toThrow(
      "project-not-found",
    );
  });

  it("제목과 곡을 함께 저장한다", async () => {
    const { client, query } = fakeClient({ data: [{ id: "p1" }], error: null });
    const song = { ...createEmptySong(), title: "새 곡" };
    await saveProject(client, "p1", song);
    expect(query.update).toHaveBeenCalledWith({ title: "새 곡", song });
  });
});

describe("loadProject", () => {
  it("없으면 not-found", async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await loadProject(client, "p1")).toEqual({ status: "not-found" });
  });

  it("UUID 형식이 아닌 id · 로그인 안 한 요청도 not-found, 그 밖의 오류는 그대로 던진다", async () => {
    const badId = fakeClient({ data: null, error: { code: "22P02" } });
    expect(await loadProject(badId.client, "abc")).toEqual({
      status: "not-found",
    });
    const guest = fakeClient({ data: null, error: { code: "42501" } });
    expect(await loadProject(guest.client, "p1")).toEqual({
      status: "not-found",
    });
    const network = fakeClient({ data: null, error: { code: "PGRST000" } });
    await expect(loadProject(network.client, "p1")).rejects.toMatchObject({
      code: "PGRST000",
    });
  });

  it("형식이 맞으면 ok, 깨졌으면 invalid", async () => {
    const song = createEmptySong();
    expect(
      await loadProject(
        fakeClient({ data: { song }, error: null }).client,
        "p1",
      ),
    ).toEqual({ status: "ok", song });
    expect(
      await loadProject(
        fakeClient({ data: { song: { title: "깨진 곡" } }, error: null })
          .client,
        "p1",
      ),
    ).toEqual({ status: "invalid" });
  });
});

describe("listProjects", () => {
  it("카드에 필요한 값만 꺼내고, 형식이 다른 값은 null", async () => {
    const { client, query } = fakeClient({
      data: [
        {
          id: "p1",
          title: "곡",
          updated_at: "2026-11-11T01:00:00Z",
          key: "C major",
          style: "pop",
          bpm: 100,
        },
        {
          id: "p2",
          title: "",
          updated_at: "2026-11-10T01:00:00Z",
          key: 3,
          style: null,
          bpm: "빠름",
        },
      ],
      error: null,
    });
    const {
      projects: [first, second],
      total,
    } = await listProjects(client, "user-1");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    // count를 안 주면 받은 개수
    expect(total).toBe(2);
    expect(first).toMatchObject({ key: "C major", style: "pop", bpm: 100 });
    expect(second).toMatchObject({ key: null, bpm: null });
  });

  it("최근 수정 순 50개만 읽고 전체 개수를 함께 돌려준다", async () => {
    const { client, query } = fakeClient({ data: [], error: null, count: 73 });
    const { total } = await listProjects(client, "user-1");
    expect(query.select).toHaveBeenCalledWith(expect.any(String), {
      count: "exact",
    });
    expect(query.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
    expect(query.limit).toHaveBeenCalledWith(LIST_LIMIT);
    expect(total).toBe(73);
  });
});

describe("deleteProject", () => {
  it("곡에 경로가 없어도 내 폴더의 그 곡 녹음을 확장자마다 지운다", async () => {
    const { client, remove } = fakeClient({
      data: [{ id: "p1" }],
      error: null,
    });
    await deleteProject(client, "p1");
    expect(remove).toHaveBeenCalledWith([
      "user-1/p1.webm",
      "user-1/p1.ogg",
      "user-1/p1.m4a",
    ]);
  });

  it("행을 지우지 못하면 녹음 파일은 건드리지 않는다", async () => {
    const { client, remove } = fakeClient({ data: [], error: null });
    await expect(deleteProject(client, "p1")).rejects.toThrow(
      "project-not-found",
    );
    expect(remove).not.toHaveBeenCalled();
  });
});
