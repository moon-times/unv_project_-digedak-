// 녹음 원본(A의 latestRecording)을 녹음한 그 곡에 붙여 Storage에 올립니다.
// docs/specs/05_recording-upload/design.md §3, 곡 id가 없는 원본의 IndexedDB 보관은 06_guest-continue/design.md §3
import { useEffect } from "react";
import { onLatestRecording } from "@/features/recorder/latestRecording";
import {
  clearRecordingDraft,
  loadRecordingDraft,
  saveRecordingDraft,
} from "@/lib/recordingDraft";
import { createClient } from "@/lib/supabase/client";
import { uploadRecording } from "@/lib/supabase/recordings";
import { useSongStore } from "@/store/songStore";

/** 실패하면 이만큼 뒤에 한 번 더 올립니다 (ms) */
export const UPLOAD_RETRY_DELAY = 5000;

/** 올릴 원본과 녹음한 곡의 id. 새 곡 · 게스트 녹음은 처음 저장될 때까지 null */
type Pending = { blob: Blob; owner: string | null };

// 게스트 → /login → 스튜디오로 돌아오면 다시 마운트되므로 컴포넌트 밖에 둡니다.
let pending: Pending | null = null;
let uploading = false;

/** 테스트용 */
export function resetRecordingUpload() {
  pending = null;
  uploading = false;
}

/** 기다리는 원본이 곡 id 없는 것이 아니면 IndexedDB 보관본은 더 필요 없습니다. */
function forgetDraft() {
  if (pending?.owner !== null) void clearRecordingDraft();
}

async function upload(job: Pending & { owner: string }): Promise<string> {
  const supabase = createClient();
  try {
    return await uploadRecording(supabase, job.owner, job.blob);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, UPLOAD_RETRY_DELAY));
    return uploadRecording(supabase, job.owner, job.blob);
  }
}

async function tryUpload(isMember: boolean): Promise<void> {
  const job = pending;
  if (!isMember || uploading || !job || job.owner === null) return;
  uploading = true;
  try {
    const path = await upload(job as Pending & { owner: string });
    const store = useSongStore.getState();
    // 그 사이 다른 곡으로 옮겼으면 경로를 남기지 않습니다 (명세 05 §6 한계).
    if (store.projectId === job.owner) store.setRecording({ path });
  } catch (error) {
    // 원본은 부가 데이터라 화면에는 알리지 않습니다 (사용자 결정).
    console.error("녹음 원본을 올리지 못했어요", error);
  } finally {
    uploading = false;
    if (pending === job) pending = null;
    forgetDraft();
  }
  // 올리는 동안 새 녹음이 왔으면 이어서 올립니다.
  if (pending) await tryUpload(isMember);
}

/** 스튜디오에서 한 번 부릅니다. 회원일 때만 올리고, 게스트 녹음은 로그인 뒤 처음 저장될 때 올립니다. */
export function useRecordingUpload(isMember: boolean): void {
  useEffect(() => {
    void tryUpload(isMember);
    // 새 탭 · 새로고침이면 메모리에 없으니 IndexedDB에서 꺼냅니다 (게스트 · 새 곡일 때만).
    if (pending === null && useSongStore.getState().projectId === null) {
      void loadRecordingDraft().then((blob) => {
        if (!blob || pending !== null) return;
        // 그새 다른 곡이 열렸으면 이 원본은 그 곡 것이 아닙니다.
        if (useSongStore.getState().projectId !== null) {
          void clearRecordingDraft();
          return;
        }
        pending = { blob, owner: null };
      });
    }

    const offRecording = onLatestRecording((blob) => {
      if (!blob) return;
      pending = { blob, owner: useSongStore.getState().projectId };
      if (pending.owner === null) void saveRecordingDraft(blob);
      else forgetDraft();
      void tryUpload(isMember);
    });

    const offStore = useSongStore.subscribe((state, prev) => {
      if (state.projectId === prev.projectId || !pending) return;
      // 처음 저장(setProjectId)은 song을 그대로 두고, 다른 곡 열기 · 비우기(loadSong · reset)는 song을 바꿉니다.
      const created = prev.projectId === null && state.song === prev.song;
      if (created && pending.owner === null) {
        pending.owner = state.projectId;
        void tryUpload(isMember);
      } else if (pending.owner !== state.projectId) {
        pending = null;
        forgetDraft();
      }
    });

    return () => {
      offRecording();
      offStore();
    };
  }, [isMember]);
}
