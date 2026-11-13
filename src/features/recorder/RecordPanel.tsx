"use client";
// ① 녹음 패널: 빠르기 · 카운트인 · 녹음 버튼 · 녹음 시간과 지금 부르는 음.
// 제목과 한 줄 설명은 스튜디오 틀이 그립니다.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Soon } from "@/app/_components/Soon";
import { player } from "@/features/player";
import { noteName } from "@/features/piano-roll/layout";
import { useSongStore } from "@/store/songStore";
import { frequencyToMidi, type PitchFrame } from "./notes";
import { quantize } from "./quantize";
import {
  MAX_RECORD_SECONDS,
  startRecording,
  toRecorderError,
  type RecorderErrorCode,
  type RecordingResult,
  type RecordingSession,
} from "./record";
import { setLatestRecording } from "./latestRecording";
import { setRecordingPosition } from "./recordingPosition";

// 반주 패널의 빠르기 슬라이더와 같은 범위
export const BPM_MIN = 60;
export const BPM_MAX = 180;
const COUNT_IN_BEATS = 4;

type Phase =
  | { kind: "idle" }
  | { kind: "opening" } // 마이크 권한을 묻는 중
  | { kind: "count-in"; beat: number }
  | { kind: "recording" }
  | { kind: "error"; code: RecorderErrorCode | "silent" };

const ERROR_TEXT: Record<RecorderErrorCode | "silent", string> = {
  "permission-denied":
    "마이크를 쓸 수 없어요. 주소창 옆 자물쇠에서 마이크를 허용한 뒤 다시 눌러 주세요.",
  "no-device": "마이크를 찾지 못했어요. 마이크를 연결하고 다시 눌러 주세요.",
  unsupported:
    "이 브라우저에서는 녹음할 수 없어요. 최신 Chrome에서 열어 주세요.",
  failed: "녹음을 시작하지 못했어요. 다시 눌러 주세요.",
  silent: "소리가 거의 들리지 않았어요. 마이크 가까이에서 다시 불러 주세요.",
};

export function RecordPanel() {
  const bpm = useSongStore((s) => s.song.bpm);
  const hasMelody = useSongStore((s) => s.song.melody.length > 0);
  const setBpm = useSongStore((s) => s.setBpm);
  const [countIn, setCountIn] = useState(true);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [live] = useState(createLiveStore);
  const session = useRef<RecordingSession | null>(null);
  // 녹음을 시작할 때의 BPM. 카운트인과 퀀타이즈가 같은 빠르기를 써야 합니다.
  const bpmRef = useRef(bpm);

  const busy = phase.kind !== "idle" && phase.kind !== "error";

  // 마이크 권한을 묻는 동안 패널이 사라졌는지 알기 위해 씁니다.
  const mounted = useRef(false);

  // 다른 단계로 가거나 스튜디오를 나가면 녹음을 버리고 마이크를 끕니다.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      session.current?.cancel();
      session.current = null;
      setRecordingPosition(null);
    };
  }, []);

  function finish(result: RecordingResult) {
    session.current = null;
    setRecordingPosition(null);
    if (result.notes.length === 0) {
      setPhase({ kind: "error", code: "silent" });
      return;
    }
    const store = useSongStore.getState();
    store.setMelody(quantize(result.notes, bpmRef.current, 1));
    // 코드 · 설명은 예전 멜로디로 만든 것이라 비웁니다. 보정 단계에서 다시 분석합니다.
    store.setChords([]);
    setLatestRecording(result.blob);
    setPhase({ kind: "idle" });
  }

  async function start() {
    // 재생과 녹음이 동시에 소리를 내지 않게 먼저 멈춥니다.
    player.stop();
    live.reset();
    const recordBpm = clampBpm(bpm);
    bpmRef.current = recordBpm;
    if (recordBpm !== bpm) setBpm(recordBpm);
    setPhase({ kind: "opening" });
    try {
      const started = await startRecording({
        maxSeconds: MAX_RECORD_SECONDS,
        countInBeats: countIn ? COUNT_IN_BEATS : 0,
        bpm: recordBpm,
        onCountIn: (beat) => setPhase({ kind: "count-in", beat }),
        onStart: () => {
          setRecordingPosition(0);
          setPhase({ kind: "recording" });
        },
        onFrame: (frame) => {
          live.push(frame);
          // 타임라인 주황 재생선. 1 step = 16분음표
          setRecordingPosition((frame.time * recordBpm) / 15);
        },
        onAutoStop: finish,
      });
      // 권한을 묻는 사이 다른 단계로 갔으면, 화면에 없는 녹음이 마이크를 켠 채 남지 않게 바로 버립니다.
      if (!mounted.current) {
        started.cancel();
        return;
      }
      session.current = started;
      if (!countIn) setPhase({ kind: "recording" });
    } catch (error) {
      session.current = null;
      setRecordingPosition(null);
      if (mounted.current)
        setPhase({ kind: "error", code: toRecorderError(error).code });
    }
  }

  async function stop() {
    const current = session.current;
    if (!current) return;
    finish(await current.stop());
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto">
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="record-bpm" className="text-[15px] font-semibold">
            빠르기
          </label>
          <div className="flex items-center gap-2">
            <input
              id="record-bpm"
              type="number"
              inputMode="numeric"
              min={BPM_MIN}
              max={BPM_MAX}
              value={bpm}
              disabled={busy}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && value > 0) setBpm(value);
              }}
              onBlur={() => setBpm(clampBpm(bpm))}
              className="h-11 w-20 rounded-xl border-2 border-ink bg-surface px-3 text-center font-display text-[20px] tabular-nums disabled:opacity-50"
            />
            <span className="text-[15px] text-ink-muted">BPM</span>
          </div>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] font-semibold has-disabled:opacity-50">
          <input
            type="checkbox"
            checked={countIn}
            disabled={busy}
            onChange={(e) => setCountIn(e.target.checked)}
            className="size-5 accent-primary"
          />
          카운트인 4박
        </label>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-ink bg-paper px-4 py-5">
        {busy ? (
          <button
            type="button"
            onClick={stop}
            disabled={phase.kind === "opening"}
            className="flex size-[104px] flex-col items-center justify-center gap-1 rounded-full border-2 border-ink bg-surface text-[15px] font-bold shadow-[0_4px_0_var(--color-ink)] disabled:opacity-50"
          >
            <span aria-hidden className="size-6 rounded-[4px] bg-record" />
            녹음 멈추기
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="flex size-[104px] flex-col items-center justify-center gap-1 rounded-full border-2 border-ink bg-record text-[15px] font-bold text-on-primary shadow-[0_4px_0_var(--color-ink)]"
          >
            <span aria-hidden className="size-6 rounded-full bg-on-primary" />
            {hasMelody ? "다시 녹음" : "녹음 시작"}
          </button>
        )}

        <p
          aria-live="polite"
          data-testid="record-status"
          className="min-h-6 text-[15px] font-semibold"
        >
          {phase.kind === "opening" && "마이크를 여는 중..."}
          {phase.kind === "count-in" &&
            `${phase.beat} · 박자에 맞춰 준비하세요`}
          {phase.kind === "recording" && "듣고 있어요. 흥얼거려 주세요"}
        </p>

        <LiveDisplay live={live} active={phase.kind === "recording"} />
      </div>

      {phase.kind === "error" && (
        <p role="alert" className="text-[14px] text-danger">
          {ERROR_TEXT[phase.code]}
        </p>
      )}
      {hasMelody && !busy && (
        <p className="text-[13px] text-ink-muted">
          다시 녹음하면 지금 멜로디와 코드가 새 녹음으로 바뀌어요.
        </p>
      )}
      {countIn && (
        <p className="text-[13px] text-ink-muted">
          카운트인 클릭이 끝난 다음 박부터 녹음돼요.
        </p>
      )}

      <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-line-dashed px-4 py-3 text-[14px] text-ink-muted">
        원본 파형 보기와 구간 자르기
        <Soon />
      </div>
    </div>
  );
}

export function clampBpm(bpm: number) {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

/** 녹음 시간과 지금 부르는 음. 프레임마다 바뀌므로 이 부분만 다시 그립니다 */
function LiveDisplay({ live, active }: { live: LiveStore; active: boolean }) {
  const { elapsed, pitch } = useSyncExternalStore(
    live.subscribe,
    live.get,
    live.get,
  );
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="text-[19px] font-bold tabular-nums">
        {formatSeconds(active ? elapsed : 0)} /{" "}
        {formatSeconds(MAX_RECORD_SECONDS)}
      </span>
      <span
        aria-label="지금 부르는 음"
        className="flex h-11 min-w-16 items-center justify-center rounded-xl border-2 border-ink bg-surface px-3 font-display text-[22px]"
      >
        {active && pitch !== null ? noteName(pitch) : "–"}
      </span>
    </div>
  );
}

function formatSeconds(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type LiveValue = { elapsed: number; pitch: number | null };
type LiveStore = ReturnType<typeof createLiveStore>;

/** 녹음 중 화면 값. 초 · 음 이름이 바뀔 때만 알립니다 */
function createLiveStore() {
  let value: LiveValue = { elapsed: 0, pitch: null };
  const listeners = new Set<() => void>();
  const set = (next: LiveValue) => {
    if (
      Math.floor(next.elapsed) === Math.floor(value.elapsed) &&
      next.pitch === value.pitch
    )
      return;
    value = next;
    listeners.forEach((l) => l());
  };
  return {
    get: () => value,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push: (frame: PitchFrame) =>
      set({
        elapsed: frame.time,
        pitch: frame.frequency
          ? Math.round(frequencyToMidi(frame.frequency))
          : null,
      }),
    reset: () => set({ elapsed: 0, pitch: null }),
  };
}
