"use client";
// 보정 단계에서 코드 줄의 코드를 누르면 편집 줄 자리에 뜨는 코드 고르기.
// 키 안의 코드를 버튼으로 보여 주고(그 구간 멜로디와 잘 어울리면 표시), 직접 입력도 받습니다.
import { useState } from "react";
import type { Chord, Note } from "@/types/song";
import {
  chordChoices,
  GOOD_FIT_SCORE,
  normalizeChordSymbol,
} from "./chordEdit";
import { positionLabel } from "./edit";

export function ChordEditBar({
  chord,
  keyName,
  melody,
  barSteps,
  onChange,
  onClose,
}: {
  chord: Chord;
  keyName: string;
  melody: Note[];
  barSteps: number;
  onChange: (symbol: string) => void;
  onClose: () => void;
}) {
  const choices = chordChoices(keyName, melody, chord);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit() {
    const symbol = normalizeChordSymbol(text);
    if (!symbol) {
      setInvalid(true);
      return;
    }
    onChange(symbol);
    setText("");
    setInvalid(false);
  }

  return (
    <div
      role="group"
      aria-label="코드 고치기"
      className="flex flex-col gap-2 rounded-xl border-2 border-ink bg-surface px-4 py-2.5 text-[14px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex items-center gap-3">
        <span className="font-display text-[18px]">{chord.symbol}</span>
        <span className="text-ink-muted">
          {positionLabel(chord.start, barSteps)}부터 · 다른 코드를 고르거나 직접
          써 보세요
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto min-h-9 rounded-full border-2 border-ink px-3 font-semibold"
        >
          닫기
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {choices.map((choice) => {
          const current = choice.symbol === chord.symbol;
          const good = choice.score !== null && choice.score >= GOOD_FIT_SCORE;
          return (
            <button
              key={choice.symbol}
              type="button"
              aria-pressed={current}
              title={good ? "이 마디 멜로디와 잘 어울려요" : undefined}
              onClick={() => onChange(choice.symbol)}
              className={`flex min-h-9 items-baseline gap-1 rounded-full border-2 border-ink px-3 font-semibold ${current ? "bg-ink text-surface" : "bg-surface"}`}
            >
              {choice.symbol}
              <span className="text-[11px] font-normal opacity-70">
                {choice.roman}
              </span>
              {good && (
                <span aria-label="잘 어울려요" className="text-[11px]">
                  ★
                </span>
              )}
            </button>
          );
        })}
        <form
          className="ml-auto flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            aria-label="코드 직접 쓰기"
            aria-invalid={invalid}
            placeholder="예: Cmaj7, F#m, G/B"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setInvalid(false);
            }}
            className="min-h-9 w-36 rounded-lg border-2 border-ink bg-paper px-2"
          />
          <button
            type="submit"
            disabled={text.trim() === ""}
            className="min-h-9 rounded-full border-2 border-ink px-3 font-semibold disabled:opacity-40"
          >
            바꾸기
          </button>
        </form>
      </div>
      {invalid && (
        <p role="alert" className="text-[13px] text-danger">
          읽을 수 없는 코드예요. C, Am, G7, Fmaj7, Bm7b5, C/E 처럼 써 주세요.
        </p>
      )}
    </div>
  );
}
