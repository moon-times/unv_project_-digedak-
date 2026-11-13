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
/** 녹음 한 번에서 가장 큰 음의 세기. 마이크마다 입력 크기가 달라 그대로 쓰면 멜로디가 반주보다 훨씬 작게 들립니다. */
const PEAK_VELOCITY = 0.9;

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
  const segments: Segment[] = [];
  let current: Segment | null = null;
  frames.forEach((frame, i) => {
    const pitch = pitches[i];
    // 다음 프레임이 늦게 와도(탭 전환, 메인 스레드 멈춤) 음이 늘어나지 않게 프레임 간격 2배까지만
    const end = Math.min(
      frames[i + 1]?.time ?? frame.time + interval,
      frame.time + interval * 2,
    );
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

  // 2. 무음 프레임 때문에 잘게 끊긴 같은 음을 먼저 잇고(짧은 조각끼리 모여 한 음이 됨),
  // 3. 그래도 짧은 조각은 잡음으로 버린 뒤, 4. 잡음이 빠지며 붙게 된 같은 음을 다시 잇습니다.
  const notes = mergeSamePitch(
    mergeSamePitch(segments, maxGap).filter(
      (s) => s.end - s.start >= minDuration,
    ),
    maxGap,
  );

  // 음마다 음량 평균을 내고, 가장 큰 음이 PEAK_VELOCITY가 되게 모두 같은 비율로 맞춥니다 (음끼리 강약은 그대로).
  const loudness = notes.map(({ volumes }) =>
    volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null,
  );
  const peak = Math.max(0, ...loudness.map((v) => v ?? 0));
  return notes.map(({ pitch, start, end }, i) => {
    const v = loudness[i];
    return {
      pitch,
      start,
      end,
      velocity:
        v === null || peak === 0
          ? DEFAULT_VELOCITY
          : (v / peak) * PEAK_VELOCITY,
    };
  });
}

type Segment = RawNote & { volumes: number[] };

/** 바로 앞 음과 높이가 같고 틈이 maxGap 이하면 한 음으로 잇습니다 */
function mergeSamePitch(segments: Segment[], maxGap: number) {
  const merged: Segment[] = [];
  for (const segment of segments) {
    const last = merged.at(-1);
    if (
      last &&
      last.pitch === segment.pitch &&
      segment.start - last.end <= maxGap
    ) {
      merged[merged.length - 1] = {
        ...last,
        end: segment.end,
        volumes: [...last.volumes, ...segment.volumes],
      };
    } else {
      merged.push(segment);
    }
  }
  return merged;
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
