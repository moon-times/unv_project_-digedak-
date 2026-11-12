// 랜딩 3단계 카드용 선 아이콘. 스튜디오 아이콘(studio/[id]/_components/icons.tsx)과 같은 선 규칙입니다.
import type { ReactNode } from "react";

function LineIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const MicIcon = () => (
  <LineIcon>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </LineIcon>
);

export const NoteIcon = () => (
  <LineIcon>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </LineIcon>
);

export const DrumIcon = () => (
  <LineIcon>
    <ellipse cx="12" cy="9" rx="8" ry="3" />
    <path d="M4 9v7c0 1.7 3.6 3 8 3s8-1.3 8-3V9" />
    <path d="m7 3 4 5M17 3l-4 5" />
  </LineIcon>
);
