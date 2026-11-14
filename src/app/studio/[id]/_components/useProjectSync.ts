"use client";
// 스튜디오와 DB를 맞춥니다: 들어올 때 불러오기, 새 곡 첫 저장, 자동 저장, 떠날 때 경고.
// docs/specs/02_save-list/design.md §4
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createProject,
  loadProject,
  PROJECT_CONFLICT,
  saveProject,
} from "@/lib/supabase/projects";
import { useSongStore } from "@/store/songStore";

/** 입력이 멈추고 이만큼 지나면 저장합니다 (ms) */
export const AUTOSAVE_DELAY = 2000;
/** 저장에 실패하면 이만큼 뒤에 한 번 다시 시도합니다 (ms) */
export const RETRY_DELAY = 5000;

// 내가 마지막으로 불러오거나 저장한 시각(updated_at). 저장할 때 DB 값과 같은지 봐서 다른 탭의 저장을 덮어쓰지 않습니다.
// 스튜디오를 나갔다 같은 곡으로 돌아오면 다시 불러오지 않으므로(store에 있음) 컴포넌트 밖에 둡니다.
let seen: { id: string; updatedAt: string } | null = null;

/** 테스트용 */
export function resetProjectSync() {
  seen = null;
}

/** error: 네트워크 등으로 불러오지 못함 */
export type SyncPhase = "loading" | "ready" | "not-found" | "invalid" | "error";

/**
 * @param routeId 주소의 프로젝트 id. `/studio/new`면 null
 * @param isMember 로그인 사용자인지. 회원일 때만 DB에 저장합니다
 */
export function useProjectSync(
  routeId: string | null,
  isMember: boolean,
): SyncPhase {
  const projectId = useSongStore((s) => s.projectId);
  const [settled, setSettled] = useState<{
    routeId: string | null;
    phase: SyncPhase;
  } | null>(null);

  let phase: SyncPhase =
    settled?.routeId === routeId ? settled.phase : "loading";
  // 방금 만든 곡처럼 이미 store에 있는 프로젝트면 다시 불러오지 않습니다.
  if (routeId !== null && projectId === routeId) phase = "ready";

  // 들어올 때
  useEffect(() => {
    let cancelled = false;
    const settle = (next: SyncPhase) => {
      if (!cancelled) setSettled({ routeId, phase: next });
    };
    const store = useSongStore.getState();

    if (routeId === null) {
      // 다른 곡을 보다 왔으면 비우고, 게스트 보관본이 있으면 이어 갑니다.
      if (store.projectId !== null) store.reset();
      void Promise.resolve(useSongStore.persist.rehydrate()).then(() =>
        settle("ready"),
      );
    } else if (store.projectId !== routeId) {
      loadProject(createClient(), routeId)
        .then((result) => {
          if (cancelled) return;
          if (result.status === "ok") {
            seen = { id: routeId, updatedAt: result.updatedAt };
            useSongStore.getState().loadSong(result.song, routeId);
            settle("ready");
          } else {
            settle(result.status);
          }
        })
        .catch(() => settle("error"));
    }
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  // 새 곡 첫 저장과 자동 저장 (불러오기가 끝난 회원만, 형식이 깨진 곡은 절대 저장하지 않음)
  const saving = useRef(false);
  useEffect(() => {
    if (!isMember || phase !== "ready") return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retried = false;

    const schedule = (delay = AUTOSAVE_DELAY) => {
      clearTimeout(timer);
      timer = setTimeout(save, delay);
    };

    async function save() {
      timer = undefined;
      const store = useSongStore.getState();
      // 저장이 진행 중이면, 끝난 뒤 바뀐 곡을 보고 다시 예약합니다.
      // 다른 탭이 먼저 저장했으면(conflict) 새로고침 전까지 덮어쓰지 않습니다.
      if (saving.current || !store.dirty || store.saveStatus === "conflict")
        return;
      saving.current = true;
      const song = store.song;
      store.setSaveStatus("saving");
      try {
        if (store.projectId === null) {
          const { id, updatedAt } = await createProject(supabase, song);
          seen = { id, updatedAt };
          // 연결되는 순간 게스트 보관본도 비워집니다 (persist partialize)
          useSongStore.getState().setProjectId(id);
          // 서버 왕복 없이 주소만 바꿉니다 (Next의 native history 지원).
          // 떠나면서 보낸 저장이면 이미 다른 화면이므로 주소를 건드리지 않습니다.
          if (window.location.pathname === "/studio/new") {
            window.history.replaceState(null, "", `/studio/${id}`);
          }
        } else {
          const id = store.projectId;
          const updatedAt = await saveProject(
            supabase,
            id,
            song,
            seen?.id === id ? seen.updatedAt : undefined,
          );
          seen = { id, updatedAt };
        }
        retried = false;
        const now = useSongStore.getState();
        if (now.song === song) {
          now.markSaved();
        } else {
          now.setSaveStatus("idle");
          schedule();
        }
      } catch (error) {
        if (error instanceof Error && error.message === PROJECT_CONFLICT) {
          useSongStore.getState().setSaveStatus("conflict");
          return;
        }
        // 응답만 못 받고 DB에는 저장됐을 수 있어, 다음 저장은 시각을 비교하지 않습니다 (내 저장을 충돌로 잘못 보지 않게).
        seen = null;
        useSongStore.getState().setSaveStatus("error");
        if (!retried) {
          retried = true;
          schedule(RETRY_DELAY);
        }
      } finally {
        saving.current = false;
      }
    }

    // 로그인 직후처럼 이미 바뀐 내용이 있으면 바로 예약합니다.
    if (useSongStore.getState().dirty) schedule();
    const unsubscribe = useSongStore.subscribe((state, previous) => {
      if (state.song !== previous.song && state.dirty) schedule();
    });
    // 다시 시도까지 실패한 뒤에는 예약이 없으므로, 네트워크가 돌아오면 바로 저장합니다.
    const onOnline = () => {
      if (useSongStore.getState().dirty) schedule(0);
    };
    window.addEventListener("online", onOnline);
    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      // 스튜디오를 떠날 때 저장 안 된 변경이 있으면 바로 보냅니다 (예약이 없어도: 두 번 실패한 뒤).
      if (timer !== undefined || useSongStore.getState().dirty) {
        clearTimeout(timer);
        void save();
      }
    };
  }, [isMember, phase]);

  // 저장 안 된 변경이 있으면 탭을 닫거나 새로고침할 때 브라우저 경고
  useEffect(() => {
    if (!isMember) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const { dirty, saveStatus } = useSongStore.getState();
      // 충돌이면 새로고침하라고 안내했으므로 막지 않습니다.
      if (saveStatus === "conflict") return;
      if (dirty || saveStatus === "saving") event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isMember]);

  return phase;
}
