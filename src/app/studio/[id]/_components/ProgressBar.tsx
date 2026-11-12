import { STUDIO_STEPS, type StudioStep } from "@/store/songStore";
import { CheckIcon } from "./icons";

export const STEP_LABELS: Record<StudioStep, string> = {
  record: "녹음",
  refine: "보정 · AI 분석",
  arrange: "반주",
  mix: "믹싱",
};

type Props = {
  current: StudioStep;
  available: StudioStep[];
  onSelect: (step: StudioStep) => void;
};

// 번호 원과 이름을 선으로 이은 4단계 진행 바 (docs/design/README.md "스튜디오 공통 틀")
// 끝난 단계 = 다음 단계가 열린 단계. 그 뒤 연결선도 채워집니다.
export function ProgressBar({ current, available, onSelect }: Props) {
  return (
    <nav
      aria-label="작업 단계"
      className="shrink-0 border-b-2 border-ink px-5 py-2"
    >
      <ol className="flex items-center gap-2.5">
        {STUDIO_STEPS.map((step, i) => {
          const isCurrent = step === current;
          const isLast = i === STUDIO_STEPS.length - 1;
          const isDone = !isLast && available.includes(STUDIO_STEPS[i + 1]);

          return (
            <li
              key={step}
              className={`flex items-center gap-2.5 ${isLast ? "" : "flex-1"}`}
            >
              <button
                type="button"
                disabled={!available.includes(step)}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(step)}
                // 잠긴 단계는 투명도 대신 글자색으로만 구분합니다 (번호 원은 그대로).
                className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-full border-2 py-1 pr-4 pl-1.5 disabled:text-ink-muted ${
                  isCurrent
                    ? "border-ink bg-surface font-bold"
                    : "border-transparent font-semibold enabled:hover:bg-ink/5"
                }`}
              >
                <span
                  className={`flex size-[30px] items-center justify-center rounded-full border-2 border-ink font-display text-[16px] ${
                    isCurrent
                      ? "bg-ink text-surface"
                      : isDone
                        ? "bg-primary text-on-primary"
                        : "bg-surface text-ink"
                  }`}
                >
                  {isDone && !isCurrent ? (
                    <CheckIcon size={16} />
                  ) : (
                    <span className="tabular-nums">{i + 1}</span>
                  )}
                  {isDone && !isCurrent && (
                    <span className="sr-only">완료</span>
                  )}
                </span>
                {STEP_LABELS[step]}
              </button>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`h-[3px] flex-1 rounded-sm ${
                    isDone ? "bg-primary" : "bg-line"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
