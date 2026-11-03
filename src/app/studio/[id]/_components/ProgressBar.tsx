import { STUDIO_STEPS, type StudioStep } from "@/store/songStore";

const STEP_LABELS: Record<StudioStep, string> = {
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

export function ProgressBar({ current, available, onSelect }: Props) {
  return (
    <nav
      aria-label="작업 단계"
      className="shrink-0 border-b border-foreground/10 px-4 py-2"
    >
      <ol className="flex gap-2">
        {STUDIO_STEPS.map((step, i) => {
          const isCurrent = step === current;
          return (
            <li key={step}>
              <button
                type="button"
                disabled={!available.includes(step)}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(step)}
                className={`rounded-full px-3 py-1 text-sm disabled:opacity-30 ${
                  isCurrent
                    ? "bg-foreground text-background"
                    : "hover:bg-foreground/10"
                }`}
              >
                {i + 1}. {STEP_LABELS[step]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
