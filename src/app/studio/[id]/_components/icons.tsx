// 스튜디오 틀에서 쓰는 작은 선 아이콘. 글자색(currentColor)을 따라갑니다.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export const CloudIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 15V3" />
    <path d="m7 10 5 5 5-5" />
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon strokeWidth={3} {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const PlayIcon = (props: IconProps) => (
  <Icon fill="currentColor" {...props}>
    <path d="M7 4.5v15l12-7.5Z" />
  </Icon>
);

export const StopIcon = (props: IconProps) => (
  <Icon fill="currentColor" stroke="none" {...props}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </Icon>
);
