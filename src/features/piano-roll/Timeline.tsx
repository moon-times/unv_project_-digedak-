"use client";

// 스튜디오 가운데의 고정 타임라인 (보기 전용).
// 위에서부터 마디 번호, 코드, 멜로디 피아노롤, 드럼 · 베이스 · 건반 줄입니다.
// 색은 공통 디자인 토큰이 생기기 전까지 기본 색(foreground)의 농도로만 구분합니다 (docs/design/README.md).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { stepsPerBar } from "@/app/studio/[id]/_components/transport";
import { useSongStore } from "@/store/songStore";
import type { Note, Step } from "@/types/song";
import {
  LABEL_WIDTH,
  fitStepWidth,
  noteName,
  pitchRange,
  timelineSteps,
  type TimelineSong,
} from "./layout";

const MELODY_ROW_HEIGHT = 10;
const ACCOMPANIMENT_HEIGHT = 48;

/**
 * @param position 재생 위치(step). B의 재생 엔진이 연결되기 전까지는 비워 둡니다.
 */
export function Timeline({ position }: { position?: Step }) {
  // 제목 · 빠르기 등이 바뀔 때는 다시 그리지 않도록 그리는 데 필요한 값만 구독합니다.
  const song: TimelineSong = useSongStore(
    useShallow((s) => ({
      melody: s.song.melody,
      chords: s.song.chords,
      accompaniment: s.song.accompaniment,
      timeSignature: s.song.timeSignature,
    })),
  );
  const [sectionRef, sectionWidth] = useContentWidth<HTMLElement>();
  const totalSteps = timelineSteps(song);
  const stepWidth = fitStepWidth(sectionWidth, totalSteps);
  const barSteps = stepsPerBar(song.timeSignature);
  const beatSteps = 16 / song.timeSignature[1];
  const { drums = [], bass = [], keys = [] } = song.accompaniment ?? {};

  const grid = (
    <Grid
      totalSteps={totalSteps}
      barSteps={barSteps}
      beatSteps={beatSteps}
      stepWidth={stepWidth}
    />
  );
  const [low, high] = pitchRange(song.melody);
  const melodyRows = high - low + 1;

  return (
    <section
      ref={sectionRef}
      aria-label="타임라인"
      className="h-full overflow-auto rounded-lg border-2 border-foreground/15"
    >
      <div
        className="relative"
        style={{ width: LABEL_WIDTH + totalSteps * stepWidth }}
      >
        <Row label="마디" height={24} grid={grid}>
          {Array.from({ length: totalSteps / barSteps }, (_, bar) => (
            <span
              key={bar}
              className="absolute top-1 pl-1 text-xs tabular-nums opacity-60"
              style={{ left: bar * barSteps * stepWidth }}
            >
              {bar + 1}
            </span>
          ))}
        </Row>

        <Row label="코드" height={32} grid={grid} lane="chords">
          {song.chords.length === 0 ? (
            <EmptyLane text="② 분석하면 마디마다 코드가 붙어요" />
          ) : (
            song.chords.map((chord) => (
              <div
                key={chord.start}
                data-chord
                className="absolute top-1 bottom-1 truncate rounded-sm border border-foreground/40 bg-foreground/10 px-1 text-xs leading-[22px] font-semibold"
                style={{
                  left: chord.start * stepWidth,
                  width: chord.duration * stepWidth,
                }}
              >
                {chord.symbol}
              </div>
            ))
          )}
        </Row>

        <Row
          label={<PitchLabels low={low} high={high} />}
          height={melodyRows * MELODY_ROW_HEIGHT}
          grid={grid}
          lane="melody"
        >
          {song.melody.length === 0 ? (
            <EmptyLane text="① 녹음하면 멜로디가 여기에 나타나요" />
          ) : (
            <Notes
              notes={song.melody}
              low={low}
              high={high}
              height={melodyRows * MELODY_ROW_HEIGHT}
              stepWidth={stepWidth}
              className="bg-foreground/70"
              titled
            />
          )}
        </Row>

        {(
          [
            ["드럼", "drums", drums],
            ["베이스", "bass", bass],
            ["건반", "keys", keys],
          ] as const
        ).map(([label, lane, notes]) => (
          <Row
            key={lane}
            label={label}
            height={ACCOMPANIMENT_HEIGHT}
            grid={grid}
            lane={lane}
          >
            {notes.length === 0 ? (
              <EmptyLane text="③ 반주 단계에서 채워져요" />
            ) : (
              <Notes
                notes={notes}
                {...rangeOf(notes)}
                height={ACCOMPANIMENT_HEIGHT}
                stepWidth={stepWidth}
                className="bg-foreground/45"
              />
            )}
          </Row>
        ))}

        {position !== undefined && (
          <div
            data-playhead
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-foreground"
            style={{ left: LABEL_WIDTH + position * stepWidth }}
          />
        )}
      </div>
    </section>
  );
}

function rangeOf(notes: Note[]) {
  const [low, high] = pitchRange(notes, 1);
  return { low, high };
}

function Row({
  label,
  height,
  grid,
  lane,
  children,
}: {
  label: ReactNode;
  height: number;
  grid: ReactNode;
  lane?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex border-b border-foreground/10" style={{ height }}>
      <div
        className="sticky left-0 z-10 shrink-0 border-r border-foreground/15 bg-background px-2 text-xs font-semibold"
        style={{ width: LABEL_WIDTH }}
      >
        {typeof label === "string" ? (
          <span className="leading-8">{label}</span>
        ) : (
          label
        )}
      </div>
      <div data-lane={lane} className="relative flex-1">
        {grid}
        {children}
      </div>
    </div>
  );
}

/** 마디선은 진하게, 박자선은 흐리게 */
function Grid({
  totalSteps,
  barSteps,
  beatSteps,
  stepWidth,
}: {
  totalSteps: number;
  barSteps: number;
  beatSteps: number;
  stepWidth: number;
}) {
  return Array.from({ length: totalSteps / beatSteps }, (_, beat) => {
    const step = beat * beatSteps;
    return (
      <div
        key={beat}
        aria-hidden
        className={`absolute top-0 bottom-0 border-l ${step % barSteps === 0 ? "border-foreground/20" : "border-foreground/5"}`}
        style={{ left: step * stepWidth }}
      />
    );
  });
}

function Notes({
  notes,
  low,
  high,
  height,
  stepWidth,
  className,
  titled = false,
}: {
  notes: Note[];
  low: number;
  high: number;
  height: number;
  stepWidth: number;
  className: string;
  titled?: boolean;
}) {
  const rowHeight = height / (high - low + 1);
  return notes.map((note) => (
    <div
      // 순서가 아니라 위치 · 높이로 구분해야 편집(삭제 · 이동) 때 다른 음표 요소가 재사용되지 않습니다
      key={`${note.start}:${note.pitch}`}
      data-note
      title={titled ? noteName(note.pitch) : undefined}
      className={`absolute rounded-[2px] ${className}`}
      style={{
        left: note.start * stepWidth,
        width: note.duration * stepWidth - 1,
        top: (high - note.pitch) * rowHeight,
        height: Math.max(2, rowHeight - 1),
        opacity: 0.4 + note.velocity * 0.6,
      }}
    />
  ));
}

/** 멜로디 줄 왼쪽에 C음 위치만 표시 */
function PitchLabels({ low, high }: { low: number; high: number }) {
  const labels = [];
  for (let pitch = low; pitch <= high; pitch++) {
    if (pitch % 12 !== 0) continue;
    labels.push(
      <span
        key={pitch}
        className="absolute right-2 text-[10px] leading-none font-bold opacity-60"
        style={{ top: (high - pitch) * MELODY_ROW_HEIGHT }}
      >
        {noteName(pitch)}
      </span>,
    );
  }
  return (
    <div className="relative h-full">
      <span className="leading-8">멜로디</span>
      {labels}
    </div>
  );
}

function EmptyLane({ text }: { text: string }) {
  return (
    <span className="sticky left-2 flex h-full w-fit items-center text-xs opacity-50">
      {text}
    </span>
  );
}

/** 요소의 안쪽 폭(px). 처음 그릴 때와 ResizeObserver가 없는 환경(테스트)에서는 0 */
function useContentWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
