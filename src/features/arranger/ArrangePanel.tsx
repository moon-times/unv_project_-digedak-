"use client";
// ③ 반주 패널: 장르 카드, 빠르기 슬라이더, AI 리터치. 고르는 즉시 반주가 다시 만들어집니다.
// 제목과 한 줄 설명은 스튜디오 틀이 그립니다.
import { useState } from "react";
import { analyzeSong, STYLE_BPM_RANGE, STYLE_LABEL } from "@/lib/music";
import { stepsPerBar } from "@/lib/transport";
import { useSongStore } from "@/store/songStore";
import { STYLES, type Style } from "@/types/song";
import { RetouchBox } from "./RetouchBox";
import { useAccompanimentSync } from "./useAccompanimentSync";

export const BPM_MIN = 60;
export const BPM_MAX = 180;

const STYLE_DESCRIPTIONS: Record<Style, string> = {
  pop: "통통 튀는 8비트 드럼과 밝은 건반",
  ballad: "느긋한 드럼과 길게 울리는 건반",
  rock: "힘 있는 드럼과 꽉 찬 베이스",
};

export function ArrangePanel() {
  useAccompanimentSync({ create: true });
  const style = useSongStore((s) => s.song.style);
  const bpm = useSongStore((s) => s.song.bpm);
  const setStyle = useSongStore((s) => s.setStyle);
  const setBpm = useSongStore((s) => s.setBpm);
  // 추천은 패널을 열 때 한 번만 계산합니다. 슬라이더를 움직일 때마다 "AI 추천" 태그가 옮겨 다니지 않게 합니다.
  const [recommended] = useState(() => {
    const { song } = useSongStore.getState();
    return analyzeSong(song.melody, song.bpm, {
      stepsPerBar: stepsPerBar(song.timeSignature),
    }).recommendedStyle;
  });

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-[15px] font-semibold">장르</legend>
        {STYLES.map((id) => (
          <StyleCard
            key={id}
            style={id}
            selected={id === style}
            recommended={id === recommended}
            onSelect={() => setStyle(id)}
          />
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="arrange-bpm" className="text-[15px] font-semibold">
            빠르기
          </label>
          <span className="font-display text-[20px] tabular-nums">
            {bpm} BPM
          </span>
        </div>
        <input
          id="arrange-bpm"
          type="range"
          min={BPM_MIN}
          max={BPM_MAX}
          step={1}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <p className="text-[13px] text-ink-muted">
          {STYLE_LABEL[style]}에는 {STYLE_BPM_RANGE[style][0]}~
          {STYLE_BPM_RANGE[style][1]} BPM이 잘 어울려요.
        </p>
      </div>

      <RetouchBox />
    </div>
  );
}

function StyleCard({
  style,
  selected,
  recommended,
  onSelect,
}: {
  style: Style;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-xl border-2 border-ink px-4 py-3 shadow-[0_3px_0_var(--color-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
        selected ? "bg-primary text-on-primary" : "bg-surface"
      }`}
    >
      <input
        type="radio"
        name="arrange-style"
        value={style}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="font-display text-[20px]">{STYLE_LABEL[style]}</span>
          {recommended && (
            <span
              className={`rounded-[5px] border px-1.5 text-[11px] font-semibold ${
                selected ? "border-on-primary" : "border-primary text-primary"
              }`}
            >
              AI 추천
            </span>
          )}
        </span>
        <span
          className={`text-[13px] ${selected ? "opacity-85" : "text-ink-muted"}`}
        >
          {STYLE_DESCRIPTIONS[style]}
        </span>
      </span>
    </label>
  );
}
