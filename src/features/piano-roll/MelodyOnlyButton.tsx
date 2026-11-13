"use client";
// [멜로디만 듣기]: 멜로디 트랙만 들리게 재생하고, 멈추면 원래 믹스로 돌립니다.
// store의 트랙(solo)은 바꾸지 않고 재생기 소리(applyMix)만 바꿔서, 자동 저장이 일어나지 않게 합니다.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { INITIAL_PLAYER_STATE, player } from "@/features/player";
import { useSongStore } from "@/store/songStore";
import type { Track } from "@/types/song";

/** 멜로디만 들리는 믹스. 멜로디가 뮤트돼 있어도 들리게 합니다 */
export function melodyOnlyMix(tracks: Track[]): Track[] {
  return tracks.map((track) =>
    track.id === "melody"
      ? { ...track, solo: true, muted: false }
      : { ...track, solo: false },
  );
}

const restoreMix = () => player.applyMix(useSongStore.getState().song.tracks);

export function MelodyOnlyButton() {
  const hasMelody = useSongStore((s) => s.song.melody.length > 0);
  const status = useSyncExternalStore(
    player.subscribe,
    () => player.getState().status,
    () => INITIAL_PLAYER_STATE.status,
  );
  const [active, setActive] = useState(false);
  // 멜로디만 듣는 중인지는 "켰고, 아직 재생 중"인 동안만입니다.
  const playing = active && (status === "playing" || status === "loading");

  // 재생이 멈추면(정지 · 일시정지 · 곡 끝) 원래 믹스로 돌립니다.
  useEffect(() => {
    if (!active || status === "playing" || status === "loading") return;
    restoreMix();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 재생기(외부) 상태를 따라 끕니다
    setActive(false);
  }, [active, status]);

  // 멜로디만 듣는 중에 다른 단계로 가면 원래 믹스로
  const activeRef = useRef(false);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(
    () => () => {
      if (activeRef.current) restoreMix();
    },
    [],
  );

  async function toggle() {
    if (playing) {
      player.pause();
      return;
    }
    try {
      // 재생기가 켜지기 전에는 믹스를 바꿀 수 없어서 먼저 켭니다.
      await player.init();
      player.applyMix(melodyOnlyMix(useSongStore.getState().song.tracks));
      setActive(true);
      await player.play();
    } catch {
      restoreMix();
      setActive(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!hasMelody}
      aria-pressed={playing}
      className={`min-h-9 rounded-full border-2 border-ink px-3 text-[14px] font-semibold disabled:opacity-40 ${
        playing ? "bg-primary text-on-primary" : "bg-surface"
      }`}
    >
      {playing ? "멈추기" : "멜로디만 듣기"}
    </button>
  );
}
