import { describe, expect, it, vi } from "vitest";
import { uploadRecording } from "./recordings";

function fakeClient(uid: string | null = "user-1", error: unknown = null) {
  const upload = vi.fn<(...args: unknown[]) => Promise<{ error: unknown }>>(
    async () => ({ error }),
  );
  const client = {
    auth: {
      getClaims: async () => ({
        data: uid ? { claims: { sub: uid } } : null,
      }),
    },
    storage: { from: vi.fn(() => ({ upload })) },
  };
  return { client: client as never, upload };
}

describe("uploadRecording", () => {
  it("내 폴더의 곡 id 파일에 덮어쓰고, Content-Type은 코덱 표시를 뗀 기본 형식", async () => {
    const { client, upload } = fakeClient();
    const blob = new Blob(["x"], { type: "audio/webm;codecs=opus" });

    expect(await uploadRecording(client, "p1", blob)).toBe("user-1/p1.webm");
    expect(upload).toHaveBeenCalledWith("user-1/p1.webm", blob, {
      contentType: "audio/webm",
      upsert: true,
    });
  });

  it("mp4 녹음은 .m4a, 형식이 비어 있으면 webm으로", async () => {
    const { client, upload } = fakeClient();
    await uploadRecording(client, "p1", new Blob(["x"], { type: "audio/mp4" }));
    await uploadRecording(client, "p2", new Blob(["x"]));
    expect(upload.mock.calls.map((call) => call[0])).toEqual([
      "user-1/p1.m4a",
      "user-1/p2.webm",
    ]);
  });

  it("로그인하지 않았거나 올리기에 실패하면 오류", async () => {
    await expect(
      uploadRecording(fakeClient(null).client, "p1", new Blob()),
    ).rejects.toThrow("not-signed-in");
    await expect(
      uploadRecording(
        fakeClient("user-1", { message: "mime" }).client,
        "p1",
        new Blob(),
      ),
    ).rejects.toMatchObject({ message: "mime" });
  });
});
