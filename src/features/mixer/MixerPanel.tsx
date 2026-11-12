"use client";
// ④ 믹싱 패널: 트랙마다 볼륨 · 뮤트 · 솔로. 값은 store의 tracks에 들어가고,
// 재생기는 useSyncPlayerWithSong이 tracks 변경을 받아 게인만 바꿉니다(@/features/player/mix).
// 제목과 한 줄 설명은 스튜디오 틀이 그립니다.
import { Soon } from "@/app/_components/Soon";
import { useSongStore } from "@/store/songStore";
import type { Track, TrackId } from "@/types/song";

export const VOLUME_MIN_DB = -30;
export const VOLUME_MAX_DB = 6;

export const TRACK_LABELS: Record<TrackId, string> = {
  melody: "멜로디",
  drums: "드럼",
  bass: "베이스",
  keys: "건반",
};

// docs/design/README.md "트랙 색"의 믹서 점
const TRACK_DOT_COLORS: Record<TrackId, string> = {
  melody: "#7FD06F",
  drums: "#E99A3C",
  bass: "#4FB3A0",
  keys: "#EE9DA8",
};

/** "+3 dB", "0 dB", "−6 dB" */
export function formatDb(db: number) {
  const rounded = Math.round(db);
  if (rounded > 0) return `+${rounded} dB`;
  if (rounded < 0) return `−${-rounded} dB`;
  return "0 dB";
}

export function MixerPanel() {
  const tracks = useSongStore((s) => s.song.tracks);
  const updateTrack = useSongStore((s) => s.updateTrack);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <ul className="flex flex-col gap-3">
        {tracks.map((track) => (
          <TrackStrip
            key={track.id}
            track={track}
            onChange={(patch) => updateTrack(track.id, patch)}
          />
        ))}
      </ul>
      <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-line-dashed px-4 py-3 text-[14px] text-ink-muted">
        울림 (리버브)
        <Soon />
      </div>
    </div>
  );
}

function TrackStrip({
  track,
  onChange,
}: {
  track: Track;
  onChange: (patch: Partial<Omit<Track, "id">>) => void;
}) {
  const label = TRACK_LABELS[track.id];
  const sliderId = `mixer-volume-${track.id}`;

  return (
    <li className="flex flex-col gap-2 rounded-xl border-2 border-ink bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full border border-ink"
          style={{ backgroundColor: TRACK_DOT_COLORS[track.id] }}
        />
        <label htmlFor={sliderId} className="flex-1 text-[15px] font-semibold">
          {label}
        </label>
        <span className="text-[14px] text-ink-muted tabular-nums">
          {formatDb(track.volume)}
        </span>
      </div>
      <input
        id={sliderId}
        type="range"
        min={VOLUME_MIN_DB}
        max={VOLUME_MAX_DB}
        step={1}
        value={track.volume}
        onChange={(e) => onChange({ volume: Number(e.target.value) })}
        className="w-full accent-primary"
      />
      <div className="flex gap-2">
        <ToggleButton
          pressed={track.muted}
          label={`${label} 뮤트`}
          onClick={() => onChange({ muted: !track.muted })}
        >
          뮤트
        </ToggleButton>
        <ToggleButton
          pressed={track.solo}
          label={`${label} 솔로`}
          onClick={() => onChange({ solo: !track.solo })}
        >
          솔로
        </ToggleButton>
      </div>
    </li>
  );
}

function ToggleButton({
  pressed,
  label,
  onClick,
  children,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-full border-2 border-ink text-[14px] font-semibold ${
        pressed ? "bg-ink text-surface" : "bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
