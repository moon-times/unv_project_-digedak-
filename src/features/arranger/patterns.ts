// 장르별 반주 패턴. 4/4박자 한 마디(16 step, 1 step = 16분음표) 기준입니다.
// 다른 박자에서는 마디 길이 안에 들어가는 이벤트만 씁니다 (generate.ts).
import type { Style } from "@/types/song";

/** GM 드럼 음 번호. 타임라인 드럼 줄은 이 음높이로 위아래가 나뉩니다. */
export const DRUM = {
  kick: 36,
  sideStick: 37,
  snare: 38,
  closedHat: 42,
  openHat: 46,
  crash: 49,
} as const;

export type DrumHit = { step: number; pitch: number; velocity: number };

/** 베이스가 칠 음: 근음, 5도, 한 옥타브 위 근음 */
export type BassTone = "root" | "fifth" | "octave";
export type BassHit = {
  step: number;
  duration: number;
  tone: BassTone;
  velocity: number;
};

/**
 * 건반 이벤트. voices가 "chord"면 화음 전체를, 숫자 배열이면 보이싱의 해당 음만 칩니다
 * (0 = 가장 낮은 음, 보이싱 길이를 넘으면 한 옥타브 위로 이어짐 → 아르페지오).
 */
export type KeysHit = {
  step: number;
  duration: number;
  voices: "chord" | number[];
  velocity: number;
};

/**
 * 기타 이벤트. 보이싱은 기타 코드 모양(guitarVoicing)이고 0번이 가장 낮은 줄입니다.
 * - "down": 모든 줄을 위로 긁기(낮은 줄 → 높은 줄)
 * - "up": 높은 세 줄만 가볍게 (업스트로크)
 * - "power": 근음 · 5도 · 옥타브만 (록 파워코드)
 * - 숫자 배열: 그 줄만 뜯기 (아르페지오)
 */
export type GuitarHit = {
  step: number;
  duration: number;
  strum: "down" | "up" | "power" | number[];
  velocity: number;
};

export type StylePattern = {
  drums: DrumHit[];
  /** 마디 첫 박에 크래시를 칠 간격(마디 수). 0이면 곡 처음에만 */
  crashEveryBars: number;
  /** 하이햇 간격(step). 빠른 곡에서는 generate.ts가 두 배로 늘립니다. */
  hatInterval: number;
  hatVelocity: [strong: number, weak: number];
  bass: BassHit[];
  keys: KeysHit[];
  guitar: GuitarHit[];
};

const strum = (
  step: number,
  duration: number,
  kind: GuitarHit["strum"],
  velocity: number,
): GuitarHit => ({ step, duration, strum: kind, velocity });

const hit = (step: number, pitch: number, velocity: number): DrumHit => ({
  step,
  pitch,
  velocity,
});

export const STYLE_PATTERNS: Record<Style, StylePattern> = {
  // 팝: 8비트, 킥이 3박 뒤에 한 번 더, 건반은 당김음 컴핑
  pop: {
    drums: [
      hit(0, DRUM.kick, 0.9),
      hit(4, DRUM.snare, 0.8),
      hit(8, DRUM.kick, 0.85),
      hit(10, DRUM.kick, 0.7),
      hit(12, DRUM.snare, 0.8),
    ],
    crashEveryBars: 4,
    hatInterval: 2,
    hatVelocity: [0.6, 0.4],
    bass: [
      { step: 0, duration: 6, tone: "root", velocity: 0.85 },
      { step: 6, duration: 2, tone: "root", velocity: 0.7 },
      { step: 8, duration: 4, tone: "root", velocity: 0.8 },
      { step: 12, duration: 4, tone: "fifth", velocity: 0.75 },
    ],
    keys: [
      { step: 0, duration: 6, voices: "chord", velocity: 0.65 },
      { step: 6, duration: 2, voices: "chord", velocity: 0.5 },
      { step: 8, duration: 6, voices: "chord", velocity: 0.6 },
      { step: 14, duration: 2, voices: "chord", velocity: 0.5 },
    ],
    // 다운 · 다운업 · 업다운업 스트로크
    guitar: [
      strum(0, 4, "down", 0.7),
      strum(4, 2, "down", 0.6),
      strum(6, 4, "up", 0.45),
      strum(10, 2, "up", 0.45),
      strum(12, 2, "down", 0.6),
      strum(14, 2, "up", 0.45),
    ],
  },

  // 발라드: 사이드스틱으로 부드러운 백비트, 긴 베이스, 8분음표 아르페지오
  ballad: {
    drums: [
      hit(0, DRUM.kick, 0.7),
      hit(4, DRUM.sideStick, 0.55),
      hit(10, DRUM.kick, 0.55),
      hit(12, DRUM.sideStick, 0.55),
    ],
    crashEveryBars: 0,
    hatInterval: 4,
    hatVelocity: [0.4, 0.3],
    bass: [
      { step: 0, duration: 8, tone: "root", velocity: 0.75 },
      { step: 8, duration: 8, tone: "fifth", velocity: 0.65 },
    ],
    keys: [0, 1, 2, 3, 2, 1, 2, 3].map((voice, i) => ({
      step: i * 2,
      duration: 2,
      voices: [voice],
      velocity: i % 4 === 0 ? 0.6 : 0.45,
    })),
    // 4분음표 핑거피킹: 근음 줄을 짚고 높은 줄을 오르내림 (건반 8분 아르페지오와 엇갈리게)
    guitar: [
      strum(0, 4, [0, 3], 0.5),
      strum(4, 4, [4], 0.4),
      strum(8, 4, [1, 5], 0.45),
      strum(12, 4, [4], 0.4),
    ],
  },

  // 록: 강한 백비트, 8분음표 근음 베이스, 길게 누르는 건반
  rock: {
    drums: [
      hit(0, DRUM.kick, 1),
      hit(4, DRUM.snare, 0.95),
      hit(6, DRUM.kick, 0.8),
      hit(8, DRUM.kick, 0.95),
      hit(12, DRUM.snare, 0.95),
    ],
    crashEveryBars: 4,
    hatInterval: 2,
    hatVelocity: [0.75, 0.6],
    bass: Array.from({ length: 8 }, (_, i) => ({
      step: i * 2,
      duration: 2,
      tone: (i === 7 ? "octave" : "root") as BassTone,
      velocity: i % 2 === 0 ? 0.9 : 0.75,
    })),
    keys: [
      { step: 0, duration: 8, voices: "chord", velocity: 0.7 },
      { step: 8, duration: 8, voices: "chord", velocity: 0.65 },
    ],
    // 8분음표 파워코드, 박마다 강세
    guitar: Array.from({ length: 8 }, (_, i) =>
      strum(i * 2, 2, "power", i % 2 === 0 ? 0.85 : 0.65),
    ),
  },
};
