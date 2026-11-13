"use client";
// 보정 단계에서 타임라인 멜로디 줄을 편집합니다.
// - 빈 칸 두 번 누르기: 음 넣기 / 음 누르기: 선택 / Delete · Backspace: 지우기 / Esc: 선택 풀기
// - 음 몸통 끌기: 시간 · 높이 이동 / 오른쪽 끝 끌기: 길이
// - 방향키: ←/→ 격자 한 칸, ↑/↓ 반음, Shift+↑/↓ 옥타브
// 끄는 동안에는 이 컴포넌트 안에서만 다시 그리고, 놓을 때 한 번만 setMelody 합니다(자동 저장 · 재생기 재빌드 줄이기).
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { Note, Step } from "@/types/song";
import {
  addNote,
  deleteNote,
  durationLabel,
  movedNote,
  placeNote,
  positionLabel,
  resizedNote,
  RESIZE_HANDLE_PX,
  sameNote,
} from "./edit";
import { noteName } from "./layout";

/** 이만큼(px) 움직이기 전에는 끌기가 아니라 누르기로 봅니다 */
const DRAG_THRESHOLD_PX = 3;
/** 빈 칸에 넣는 음의 길이: 1박(4 step)과 격자 중 긴 쪽 */
const NEW_NOTE_STEPS = 4;

export type MelodySelection = {
  selected: number | null;
  setSelected: (index: number | null) => void;
};

type Drag = {
  index: number;
  mode: "move" | "resize";
  x: number;
  y: number;
  original: Note;
  moved: boolean;
  /** 지금까지 끈 결과 */
  latest?: Note;
};

export function MelodyEditor({
  melody,
  low,
  high,
  rowHeight,
  stepWidth,
  grid,
  barSteps,
  look,
  selection: { selected, setSelected },
  onChange,
}: {
  melody: Note[];
  low: number;
  high: number;
  rowHeight: number;
  stepWidth: number;
  grid: Step;
  barSteps: number;
  look: string;
  selection: MelodySelection;
  /** 편집 결과. 되돌리기 기록을 쌓는 쪽(useMelodyHistory)이 store에 넣습니다 */
  onChange: (melody: Note[]) => void;
}) {
  const setMelody = onChange;
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ index: number; note: Note } | null>(
    null,
  );
  const container = useRef<HTMLDivElement>(null);

  // 고친 뒤 음 요소가 새로 만들어져도 선택한 음에 키보드 초점을 둡니다.
  useEffect(() => {
    if (selected === null) return;
    const element =
      container.current?.querySelector<HTMLElement>("[data-selected]");
    if (element && document.activeElement !== element) element.focus();
  }, [selected, melody]);

  function commit(index: number | null, note: Note) {
    const result = placeNote(melody, index, note);
    setMelody(result.melody);
    setSelected(result.index);
  }

  function remove(index: number) {
    setMelody(deleteNote(melody, index));
    setSelected(null);
  }

  function onNoteDown(e: PointerEvent<HTMLDivElement>, index: number) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    // 아주 짧은 음은 오른쪽 끝을 잡기 어려우므로 이동만 합니다.
    const canResize = rect.width >= RESIZE_HANDLE_PX * 3;
    drag.current = {
      index,
      mode:
        canResize && rect.right - e.clientX <= RESIZE_HANDLE_PX
          ? "resize"
          : "move",
      x: e.clientX,
      y: e.clientY,
      original: melody[index],
      moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSelected(index);
  }

  function onNoteMove(e: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current) return;
    const dx = e.clientX - current.x;
    const dy = current.y - e.clientY;
    if (
      !current.moved &&
      Math.abs(dx) < DRAG_THRESHOLD_PX &&
      Math.abs(dy) < DRAG_THRESHOLD_PX
    )
      return;
    current.moved = true;
    let note =
      current.mode === "move"
        ? movedNote(current.original, dx / stepWidth, dy / rowHeight, grid)
        : resizedNote(current.original, dx / stepWidth, grid);
    // 끄는 동안에는 보이는 높이 범위 안에서만. 놓은 뒤 범위가 넓어지면 더 옮길 수 있습니다.
    note = { ...note, pitch: Math.min(high, Math.max(low, note.pitch)) };
    // 빠르게 끌면 다시 그리기 전에 놓을 수 있으므로, 놓을 때 쓸 값은 state가 아니라 ref에 둡니다.
    current.latest = note;
    setPreview({ index: current.index, note });
  }

  function onNoteUp() {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    const { latest } = current;
    if (current.moved && latest && !sameNote(latest, current.original))
      commit(current.index, latest);
    setPreview(null);
  }

  function onNoteKey(e: React.KeyboardEvent, index: number) {
    const note = melody[index];
    const nudge = (deltaSteps: number, deltaPitch: number) => {
      e.preventDefault();
      const next = movedNote(note, deltaSteps, deltaPitch, grid);
      if (!sameNote(next, note)) commit(index, next);
    };
    switch (e.key) {
      case "Delete":
      case "Backspace":
        e.preventDefault();
        remove(index);
        break;
      case "Escape":
        setSelected(null);
        (e.currentTarget as HTMLElement).blur();
        break;
      case "ArrowLeft":
        return nudge(-grid, 0);
      case "ArrowRight":
        return nudge(grid, 0);
      case "ArrowUp":
        return nudge(0, e.shiftKey ? 12 : 1);
      case "ArrowDown":
        return nudge(0, e.shiftKey ? -12 : -1);
    }
  }

  function onLaneDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const step = Math.max(0, Math.floor((e.clientX - rect.left) / stepWidth));
    const pitch = high - Math.floor((e.clientY - rect.top) / rowHeight);
    const result = addNote(
      melody,
      step,
      Math.min(high, Math.max(low, pitch)),
      NEW_NOTE_STEPS,
      grid,
    );
    setMelody(result.melody);
    setSelected(result.index);
  }

  return (
    <div
      ref={container}
      data-melody-editor
      className="absolute inset-0 cursor-crosshair"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}
      onDoubleClick={onLaneDoubleClick}
    >
      {melody.map((original, index) => {
        const note = preview?.index === index ? preview.note : original;
        const isSelected = selected === index;
        return (
          <div
            key={`${original.start}:${original.pitch}`}
            data-note
            data-selected={isSelected || undefined}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${noteName(note.pitch)}, ${positionLabel(note.start, barSteps)}, ${durationLabel(note.duration)}`}
            title={noteName(note.pitch)}
            onPointerDown={(e) => onNoteDown(e, index)}
            onPointerMove={onNoteMove}
            onPointerUp={onNoteUp}
            // 브라우저에 따라 pointerup 없이 캡처만 풀리는 경우가 있어 같은 처리로 끝냅니다(두 번 와도 한 번만 처리).
            onLostPointerCapture={onNoteUp}
            onPointerCancel={() => {
              drag.current = null;
              setPreview(null);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => onNoteKey(e, index)}
            onFocus={() => {
              if (!isSelected) setSelected(index);
            }}
            className={`group absolute cursor-grab touch-none rounded-[2px] outline-none active:cursor-grabbing ${look} ${
              isSelected
                ? "z-10 ring-2 ring-timeline-text ring-offset-1 ring-offset-timeline"
                : ""
            }`}
            style={{
              left: note.start * stepWidth,
              width: Math.max(2, note.duration * stepWidth - 1),
              top: (high - note.pitch) * rowHeight,
              height: Math.max(2, rowHeight - 1),
              opacity: 0.4 + note.velocity * 0.6,
            }}
          >
            {/* 길이 조절 손잡이 자리. 마우스를 올리면 커서가 바뀝니다 */}
            <span
              aria-hidden
              className="absolute top-0 right-0 bottom-0 cursor-ew-resize"
              style={{ width: RESIZE_HANDLE_PX }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** 타임라인 위 한 줄: 선택한 음 정보와 [삭제], 아무것도 없으면 사용법 */
export function EditBar({
  note,
  barSteps,
  onDelete,
}: {
  note: Note | null;
  barSteps: number;
  onDelete: () => void;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-xl border-2 border-ink bg-surface px-4 text-[14px]">
      {note ? (
        <>
          <span className="font-display text-[18px]">
            {noteName(note.pitch)}
          </span>
          <span className="text-ink-muted">
            {positionLabel(note.start, barSteps)} · 길이{" "}
            {durationLabel(note.duration)}
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto min-h-9 rounded-full border-2 border-ink px-3 font-semibold text-danger"
          >
            삭제
          </button>
        </>
      ) : (
        <span className="text-ink-muted">
          빈 칸을 두 번 누르면 음이 생겨요. 음을 끌어 옮기고, 오른쪽 끝을 끌면
          길이가 바뀌어요.
        </span>
      )}
    </div>
  );
}

/** 편집 도구 줄: 스냅 단위, [박자 맞추기], 되돌리기 · 다시하기, (스튜디오가 넣는) [멜로디만 듣기] */
export function EditTools({
  snapGrid,
  barSteps,
  onSnapGrid,
  onAlign,
  alignDisabled,
  history,
  children,
}: {
  snapGrid: Step;
  barSteps: number;
  onSnapGrid: (grid: Step) => void;
  onAlign: () => void;
  alignDisabled: boolean;
  history: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  };
  children?: ReactNode;
}) {
  const choices: [string, Step][] = [
    ["1/16", 1],
    ["1/8", 2],
    ["1박", 4],
    ["1마디", barSteps],
  ];
  const button =
    "min-h-9 rounded-full border-2 border-ink bg-surface px-3 text-[14px] font-semibold disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="스냅"
        className="flex items-center gap-1 rounded-full border-2 border-ink bg-surface p-0.5"
      >
        <span className="px-2 text-[13px] font-semibold text-ink-muted">
          스냅
        </span>
        {choices.map(([label, grid]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={snapGrid === grid}
            onClick={() => onSnapGrid(grid)}
            className={`min-h-8 rounded-full px-2.5 text-[13px] font-semibold tabular-nums ${
              snapGrid === grid ? "bg-primary text-on-primary" : ""
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onAlign}
        disabled={alignDisabled}
        title="모든 음을 고른 스냅 칸에 맞춰요"
        className={button}
      >
        박자 맞추기
      </button>
      {children}
      <div className="ml-auto flex gap-1.5">
        <button
          type="button"
          onClick={history.undo}
          disabled={!history.canUndo}
          aria-keyshortcuts="Control+Z"
          className={button}
        >
          되돌리기
        </button>
        <button
          type="button"
          onClick={history.redo}
          disabled={!history.canRedo}
          aria-keyshortcuts="Control+Shift+Z"
          className={button}
        >
          다시하기
        </button>
      </div>
    </div>
  );
}

/** 이보다 작게는 내리지 않습니다 (세기 0이면 소리가 안 나서 음이 사라진 것처럼 들림) */
const MIN_VELOCITY = 0.05;

/** 0 ~ 1. 줄 위쪽이 1 */
export function velocityAt(y: number, height: number) {
  const value = 1 - y / height;
  return Math.round(Math.min(1, Math.max(MIN_VELOCITY, value)) * 100) / 100;
}

/** x(px) 위치의 음. 음 안이 아니면 null */
export function noteIndexAt(melody: Note[], step: number) {
  const index = melody.findIndex(
    (note) => step >= note.start && step < note.start + note.duration,
  );
  return index === -1 ? null : index;
}

/**
 * 멜로디 아래 세기 줄. 음마다 막대가 있고, 막대 위를 누르거나 위아래로 끌면 그 음의 세기가 바뀝니다.
 * 끄는 동안에는 이 줄만 다시 그리고 놓을 때 한 번만 반영합니다.
 */
export function VelocityLane({
  melody,
  height,
  stepWidth,
  selected,
  onChange,
}: {
  melody: Note[];
  height: number;
  stepWidth: number;
  selected: number | null;
  onChange: (melody: Note[]) => void;
}) {
  const drag = useRef<{ index: number; top: number; value: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<{
    index: number;
    value: number;
  } | null>(null);

  function update(e: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current) return;
    current.value = velocityAt(e.clientY - current.top, height);
    setPreview({ index: current.index, value: current.value });
  }

  function finish() {
    const current = drag.current;
    drag.current = null;
    setPreview(null);
    if (!current) return;
    const note = melody[current.index];
    if (!note || note.velocity === current.value) return;
    onChange(
      melody.map((n, i) =>
        i === current.index ? { ...n, velocity: current.value } : n,
      ),
    );
  }

  return (
    <div
      data-velocity-lane
      className="absolute inset-0 cursor-ns-resize touch-none"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const index = noteIndexAt(
          melody,
          Math.floor((e.clientX - rect.left) / stepWidth),
        );
        if (index === null) return;
        drag.current = { index, top: rect.top, value: melody[index].velocity };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        update(e);
      }}
      onPointerMove={update}
      onPointerUp={finish}
      onLostPointerCapture={finish}
      onPointerCancel={() => {
        drag.current = null;
        setPreview(null);
      }}
    >
      {melody.map((note, index) => {
        const value = preview?.index === index ? preview.value : note.velocity;
        return (
          <div
            key={`${note.start}:${note.pitch}`}
            data-velocity
            title={`세기 ${Math.round(value * 100)}`}
            className={`pointer-events-none absolute bottom-0 rounded-t-[2px] ${
              selected === index
                ? "bg-timeline-text"
                : "bg-track-melody-to opacity-80"
            }`}
            style={{
              left: note.start * stepWidth + 1,
              width: Math.max(2, Math.min(note.duration * stepWidth - 3, 10)),
              height: Math.max(2, value * (height - 4)),
            }}
          />
        );
      })}
    </div>
  );
}
