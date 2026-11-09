// 피치 검출 결과(프레임)를 음표로 묶습니다. 위치·길이 단위는 아직 초이고, step 변환은 quantize가 합니다.
// RawNote는 녹음 기능 안에서만 쓰는 타입이라 공용 타입(src/types/song.ts)에 두지 않습니다.

/** 피치 검출 한 번의 결과. recordAndDetect가 일정 간격으로 쌓습니다. */
export type PitchFrame = {
  time: number; // 녹음 시작부터 초
  frequency: number | null; // Hz. 소리가 없거나 음정이 불분명하면 null
  volume?: number; // 0 ~ 1. 음표 세기(velocity)로 씁니다
};

/** 퀀타이즈 전 음표 */
export type RawNote = {
  pitch: number; // MIDI 번호 (정수)
  start: number; // 초
  end: number; // 초
  velocity: number; // 0 ~ 1
};

export type GroupOptions = {
  /** 이보다 짧은 음은 잡음으로 보고 버립니다 (초) */
  minDuration?: number;
  /** 같은 음 사이 틈이 이보다 짧으면 한 음으로 잇습니다 (초) */
  maxGap?: number;
  /** 음 높이를 고를 때 앞뒤로 함께 보는 프레임 수 (흔들림 줄이기) */
  smoothing?: number;
};

const DEFAULT_VELOCITY = 0.8;

export function frequencyToMidi(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function framesToNotes(
  frames: PitchFrame[],
  { minDuration = 0.08, maxGap = 0.06, smoothing = 2 }: GroupOptions = {},
): RawNote[] {
  if (frames.length === 0) return [];

  const pitches = smoothPitches(
    frames.map((f) =>
      f.frequency && f.frequency > 0
        ? Math.round(frequencyToMidi(f.frequency))
        : null,
    ),
    smoothing,
  );
  const interval = frameInterval(frames);

  // 1. 같은 음이 이어지는 프레임끼리 묶기. 무음 프레임에서 끊습니다.
  const segments: (RawNote & { volumes: number[] })[] = [];
  let current: (RawNote & { volumes: number[] }) | null = null;
  frames.forEach((frame, i) => {
    const pitch = pitches[i];
    const end = frames[i + 1]?.time ?? frame.time + interval;
    if (pitch === null) {
      current = null;
      return;
    }
    if (current && current.pitch === pitch) {
      current.end = end;
    } else {
      current = { pitch, start: frame.time, end, velocity: 0, volumes: [] };
      segments.push(current);
    }
    if (frame.volume !== undefined) current.volumes.push(frame.volume);
  });

  // 2. 짧은 잡음을 버리고, 3. 잡음 때문에 끊긴 같은 음을 다시 잇기
  const notes: (RawNote & { volumes: number[] })[] = [];
  for (const segment of segments) {
    if (segment.end - segment.start < minDuration) continue;
    const last = notes.at(-1);
    if (
      last &&
      last.pitch === segment.pitch &&
      segment.start - last.end <= maxGap
    ) {
      last.end = segment.end;
      last.volumes.push(...segment.volumes);
    } else {
      notes.push(segment);
    }
  }

  return notes.map(({ pitch, start, end, volumes }) => ({
    pitch,
    start,
    end,
    velocity: volumes.length
      ? Math.min(1, volumes.reduce((a, b) => a + b, 0) / volumes.length)
      : DEFAULT_VELOCITY,
  }));
}

/** 소리가 있는 프레임마다 앞뒤 radius개 프레임의 중앙값으로 음 높이를 바꿉니다 */
function smoothPitches(pitches: (number | null)[], radius: number) {
  if (radius <= 0) return pitches;
  return pitches.map((pitch, i) => {
    if (pitch === null) return null;
    const window = pitches
      .slice(Math.max(0, i - radius), i + radius + 1)
      .filter((p): p is number => p !== null)
      .sort((a, b) => a - b);
    return window[Math.floor(window.length / 2)];
  });
}

/** 프레임 간격(초). 마지막 프레임의 끝 위치를 정할 때 씁니다 */
function frameInterval(frames: PitchFrame[]) {
  if (frames.length < 2) return 0;
  const gaps = frames
    .slice(1)
    .map((f, i) => f.time - frames[i].time)
    .sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}
