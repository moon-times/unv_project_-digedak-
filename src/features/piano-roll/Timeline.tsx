"use client";

// 스튜디오 가운데의 고정 타임라인. 보정 단계(editable)에서는 멜로디 줄을 편집합니다(MelodyEditor).
// 위에서부터 마디 번호, 코드, 멜로디 피아노롤, 드럼 · 베이스 · 건반 · 기타 줄입니다.
// 색은 globals.css의 timeline · track 토큰을 씁니다 (docs/design/README.md "타임라인" · "트랙 색").
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { DRUM } from "@/features/arranger";
import { stepsPerBar } from "@/lib/transport";
import { useSongStore } from "@/store/songStore";
import type { Note, Step } from "@/types/song";
import { deleteNote } from "./edit";
import { EditBar, MelodyEditor } from "./MelodyEditor";
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

/** 편집할 때 멜로디 위아래로 더 보여 줄 반음 수. 이 범위 안에서 음을 옮길 수 있습니다 */
const EDIT_PITCH_MARGIN = 2;

/**
 * @param position 재생 위치(step). 재생 중 · 일시정지 · 녹음 중일 때만 넘깁니다.
 * @param recording position이 녹음 중 위치면 true. 재생선을 녹음 색(주황)으로 그립니다
 * @param editable 멜로디 줄 편집 (보정 단계에서만 true)
 * @param grid 편집할 때 맞출 격자(step). 1 = 16분음표
 * @param onSeek 마디 번호 줄을 누르면 그 위치(step)로
 */
export function Timeline({
  position,
  recording = false,
  editable = false,
  grid: snapGrid = 1,
  onSeek,
}: {
  position?: Step;
  recording?: boolean;
  editable?: boolean;
  grid?: Step;
  onSeek?: (step: Step) => void;
}) {
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
  const barSteps = stepsPerBar(song.timeSignature);
  // 녹음 중에는 곡의 음보다 길게 부를 수 있으므로, 주황 재생선이 있는 마디까지 타임라인을 늘립니다.
  const totalSteps = Math.max(
    timelineSteps(song),
    recording && position !== undefined
      ? (Math.floor(position / barSteps) + 1) * barSteps
      : 0,
  );
  const stepWidth = fitStepWidth(sectionWidth, totalSteps);
  // 늘어난 타임라인이 칸보다 넓어지면(가로 스크롤) 녹음 재생선이 보이도록 따라갑니다.
  useFollowPlayhead(
    sectionRef,
    recording && position !== undefined
      ? LABEL_WIDTH + position * stepWidth
      : null,
  );
  const beatSteps = 16 / song.timeSignature[1];
  const {
    drums = [],
    bass = [],
    keys = [],
    guitar = [],
  } = song.accompaniment ?? {};

  const grid = (
    <Grid
      totalSteps={totalSteps}
      barSteps={barSteps}
      beatSteps={beatSteps}
      stepWidth={stepWidth}
    />
  );
  const [low, high] = editable
    ? widen(pitchRange(song.melody, 24), EDIT_PITCH_MARGIN)
    : pitchRange(song.melody);
  const melodyRows = high - low + 1;

  // 선택한 음(멜로디 안 위치). 편집이 꺼지거나 음이 지워져 범위를 벗어나면 선택 없음으로 봅니다.
  const [selectedIndex, setSelected] = useState<number | null>(null);
  const selected =
    editable && selectedIndex !== null && selectedIndex < song.melody.length
      ? selectedIndex
      : null;
  const setMelody = useSongStore((s) => s.setMelody);

  const timeline = (
    <section
      ref={sectionRef}
      aria-label="타임라인"
      className={`overflow-auto rounded-[20px] border-2 border-ink bg-timeline text-timeline-text ${editable ? "min-h-0 flex-1" : "h-full"}`}
    >
      <div
        className="relative"
        style={{ width: LABEL_WIDTH + totalSteps * stepWidth }}
      >
        <Row label="마디" height={24} grid={grid} ruler>
          {Array.from({ length: totalSteps / barSteps }, (_, bar) => (
            <span
              key={bar}
              className="pointer-events-none absolute top-1 pl-1 text-xs font-semibold tabular-nums"
              style={{ left: bar * barSteps * stepWidth }}
            >
              {bar + 1}
            </span>
          ))}
          {onSeek && (
            <div
              data-seek
              aria-hidden
              title="여기부터 재생"
              className="absolute inset-0 cursor-pointer"
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onSeek(
                  Math.min(
                    totalSteps - 1,
                    Math.max(
                      0,
                      Math.floor((e.clientX - rect.left) / stepWidth),
                    ),
                  ),
                );
              }}
            />
          )}
        </Row>

        <Row
          label="코드"
          dot="bg-track-chord-from"
          height={32}
          grid={grid}
          lane="chords"
          empty={song.chords.length === 0}
        >
          {song.chords.length === 0 ? (
            <EmptyLane text="② 분석하면 마디마다 코드가 붙어요" />
          ) : (
            song.chords.map((chord) => (
              <div
                key={chord.start}
                data-chord
                className="absolute top-1 bottom-1 truncate rounded-[3px] border border-ink bg-linear-to-b from-track-chord-from to-track-chord-to px-1 text-xs leading-[22px] font-semibold text-ink"
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
          empty={song.melody.length === 0}
        >
          {editable ? (
            <MelodyEditor
              melody={song.melody}
              low={low}
              high={high}
              rowHeight={MELODY_ROW_HEIGHT}
              stepWidth={stepWidth}
              grid={snapGrid}
              barSteps={barSteps}
              look={`${MELODY_NOTE.fill} ${MELODY_NOTE.edge}`}
              selection={{ selected, setSelected }}
            />
          ) : song.melody.length === 0 ? (
            <EmptyLane text="① 녹음하면 멜로디가 여기에 나타나요" />
          ) : (
            <Notes
              notes={song.melody}
              low={low}
              high={high}
              height={melodyRows * MELODY_ROW_HEIGHT}
              stepWidth={stepWidth}
              look={MELODY_NOTE}
              titled
            />
          )}
        </Row>

        {(
          [
            ["드럼", "drums", drums, "bg-track-drum", DRUM_NOTE],
            ["베이스", "bass", bass, "bg-track-bass-to", BASS_NOTE],
            ["건반", "keys", keys, "bg-track-keys-to", KEYS_NOTE],
            ["기타", "guitar", guitar, "bg-track-guitar-to", GUITAR_NOTE],
          ] as const
        ).map(([label, lane, notes, dot, noteLook]) => (
          <Row
            key={lane}
            label={label}
            dot={dot}
            height={ACCOMPANIMENT_HEIGHT}
            grid={grid}
            lane={lane}
            empty={notes.length === 0}
          >
            {notes.length === 0 ? (
              <EmptyLane text="③ 반주 단계에서 채워져요" />
            ) : (
              <Notes
                notes={notes}
                {...rangeOf(notes)}
                height={ACCOMPANIMENT_HEIGHT}
                stepWidth={stepWidth}
                look={noteLook}
              />
            )}
          </Row>
        ))}

        {position !== undefined && (
          <div
            data-playhead={recording ? "recording" : "playing"}
            aria-hidden
            className={`pointer-events-none absolute top-0 bottom-0 ${recording ? "z-20 w-[3px] bg-record" : "w-0.5 bg-timeline-text"}`}
            style={{ left: LABEL_WIDTH + position * stepWidth }}
          />
        )}
      </div>
    </section>
  );

  if (!editable) return timeline;
  return (
    <div className="flex h-full flex-col gap-2">
      <EditBar
        note={selected === null ? null : song.melody[selected]}
        barSteps={barSteps}
        onDelete={() => {
          if (selected === null) return;
          setMelody(deleteNote(song.melody, selected));
          setSelected(null);
        }}
      />
      {timeline}
    </div>
  );
}

function widen([low, high]: [number, number], margin: number) {
  return [Math.max(0, low - margin), Math.min(127, high + margin)] as const;
}

// 음표 블록: 위 밝은 색 → 아래 진한 색(fill) + 같은 계열 테두리(edge) (docs/design/README.md "트랙 색")
const MELODY_NOTE = {
  fill: "bg-linear-to-b from-track-melody-from to-track-melody-to",
  edge: "border border-track-melody-border",
};
const BASS_NOTE = {
  fill: "bg-linear-to-b from-track-bass-from to-track-bass-to",
  edge: "border border-track-bass-border",
};
const KEYS_NOTE = {
  fill: "bg-linear-to-b from-track-keys-from to-track-keys-to",
  edge: "border border-track-keys-border",
};
const GUITAR_NOTE = {
  fill: "bg-linear-to-b from-track-guitar-from to-track-guitar-to",
  edge: "border border-track-guitar-border",
};
const DRUM_NOTE = { fill: drumNoteClass };

/** 음표 높이가 이보다 낮으면 위아래 1px 테두리가 색을 다 덮으므로 테두리를 뺍니다 */
const MIN_EDGE_ROW_HEIGHT = 4;
/** 트랙 이름 줄 높이(px). 멜로디 줄의 음 이름이 이 높이 안에 오면 이름과 겹칩니다 */
const LABEL_LINE_HEIGHT = 32;

/** 드럼은 악기별 색: 킥 진하게, 하이햇 · 크래시 밝게, 나머지(스네어 등) 기본 */
function drumNoteClass(note: Note) {
  if (note.pitch === DRUM.kick) return "bg-track-drum-low";
  if (
    note.pitch === DRUM.closedHat ||
    note.pitch === DRUM.openHat ||
    note.pitch === DRUM.crash
  )
    return "bg-track-drum-high";
  return "bg-track-drum";
}

function rangeOf(notes: Note[]) {
  const [low, high] = pitchRange(notes, 1);
  return { low, high };
}

/** 트랙 이름 (앞에 트랙 색 점) */
function RowLabel({ dot, children }: { dot?: string; children: ReactNode }) {
  return (
    <span
      className="flex items-center gap-1.5 whitespace-nowrap"
      style={{ lineHeight: `${LABEL_LINE_HEIGHT}px` }}
    >
      {dot && (
        <span
          aria-hidden
          className={`inline-block size-2.5 shrink-0 rounded-[3px] ${dot}`}
        />
      )}
      {children}
    </span>
  );
}

function Row({
  label,
  dot,
  height,
  grid,
  lane,
  ruler = false,
  empty = false,
  children,
}: {
  label: ReactNode;
  dot?: string;
  height: number;
  grid: ReactNode;
  lane?: string;
  /** 맨 위 마디 번호 줄 (그라데이션 바탕) */
  ruler?: boolean;
  /** 아직 음표가 없는 줄 (밝은 바탕 + 안내 문구) */
  empty?: boolean;
  children: ReactNode;
}) {
  const ground = ruler
    ? "bg-linear-to-b from-timeline-ruler-from to-timeline-ruler-to"
    : "bg-timeline";
  return (
    <div
      className={`flex border-b border-timeline-grid ${ruler ? ground : ""}`}
      style={{ height }}
    >
      <div
        className={`sticky left-0 z-10 shrink-0 border-r border-timeline-grid px-2 text-xs font-semibold ${ground}`}
        style={{ width: LABEL_WIDTH }}
      >
        {typeof label === "string" ? (
          <RowLabel dot={dot}>{label}</RowLabel>
        ) : (
          label
        )}
      </div>
      <div
        data-lane={lane}
        className={`relative flex-1 ${empty ? "bg-timeline-row" : ""}`}
      >
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
        className={`absolute top-0 bottom-0 border-l ${step % barSteps === 0 ? "border-timeline-text/20" : "border-timeline-grid"}`}
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
  look,
  titled = false,
}: {
  notes: Note[];
  low: number;
  high: number;
  height: number;
  stepWidth: number;
  look: { fill: string | ((note: Note) => string); edge?: string };
  titled?: boolean;
}) {
  const rowHeight = height / (high - low + 1);
  const { fill, edge } = look;
  const fillOf = typeof fill === "string" ? () => fill : fill;
  const edgeClass = edge && rowHeight >= MIN_EDGE_ROW_HEIGHT ? edge : "";
  return notes.map((note) => (
    <div
      // 순서가 아니라 위치 · 높이로 구분해야 편집(삭제 · 이동) 때 다른 음표 요소가 재사용되지 않습니다
      key={`${note.start}:${note.pitch}`}
      data-note
      title={titled ? noteName(note.pitch) : undefined}
      className={`absolute rounded-[2px] ${fillOf(note)} ${edgeClass}`}
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
    // 맨 위 "멜로디" 이름과 겹치는 높이는 건너뜁니다.
    if ((high - pitch) * MELODY_ROW_HEIGHT < LABEL_LINE_HEIGHT) continue;
    labels.push(
      <span
        key={pitch}
        className="absolute right-2 text-[10px] leading-none font-bold text-timeline-text/60"
        style={{ top: (high - pitch) * MELODY_ROW_HEIGHT }}
      >
        {noteName(pitch)}
      </span>,
    );
  }
  return (
    <div className="relative h-full">
      <RowLabel dot="bg-track-melody-to">멜로디</RowLabel>
      {labels}
    </div>
  );
}

function EmptyLane({ text }: { text: string }) {
  return (
    <span className="sticky left-2 flex h-full w-fit items-center text-xs text-timeline-text/70">
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

/**
 * x(px, 타임라인 안 좌표)가 보이는 영역 밖으로 나가면 가로 스크롤을 옮깁니다.
 * 왼쪽 줄 이름 칸(sticky)에 가리지 않게 그만큼 비우고, 오른쪽 끝에 닿기 전에 미리 넘깁니다.
 */
function useFollowPlayhead(
  ref: RefObject<HTMLElement | null>,
  x: number | null,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || x === null) return;
    const left = element.scrollLeft + LABEL_WIDTH;
    const right = element.scrollLeft + element.clientWidth;
    const margin = element.clientWidth * FOLLOW_MARGIN;
    if (x < left || x > right - margin)
      element.scrollLeft = Math.max(0, x - LABEL_WIDTH - margin);
  }, [ref, x]);
}

/** 재생선이 보이는 폭의 이 비율만큼 오른쪽 끝에 가까워지면 스크롤 */
const FOLLOW_MARGIN = 0.15;
