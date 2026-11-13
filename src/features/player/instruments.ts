// smplr 샘플 악기 구성. Track.instrument 이름으로 악기를 고릅니다.
// 실시간 재생(AudioContext)과 WAV 렌더링(OfflineAudioContext)이 같은 코드를 씁니다.
import type { NoteEvent, Scheduler } from "smplr";
import type { TrackId } from "@/types/song";

type SmplrModule = typeof import("smplr");

/** 재생에 필요한 smplr 악기의 최소 기능 */
export type Playable = {
  readonly ready: Promise<void>;
  start(event: NoteEvent): unknown;
  stop(): void;
  dispose(): void;
};

/** 드럼 샘플 세트. LM-2는 어쿠스틱에 가까운 소리라 세 장르에 무난합니다. */
const DRUM_MACHINE = "LM-2";

/** GM 드럼 번호(반주 엔진이 쓰는 음높이) → LM-2 샘플 이름 */
const GM_TO_DRUM_SAMPLE: Record<number, string> = {
  35: "kick-alt",
  36: "kick",
  37: "stick-m",
  38: "snare-m",
  39: "clap",
  40: "snare-h",
  41: "tom-ll",
  42: "hhclosed",
  43: "tom-l",
  44: "hhclosed-short",
  45: "tom-m",
  46: "hhopen",
  47: "tom-m",
  48: "tom-h",
  49: "crash",
  50: "tom-hh",
  51: "ride",
  54: "tambourine",
  56: "cowbell",
  57: "crash",
  59: "ride",
};

/** 드럼 트랙의 음높이를 샘플 이름으로. 없는 번호면 null (재생하지 않음) */
export function drumSampleName(pitch: number): string | null {
  return GM_TO_DRUM_SAMPLE[pitch] ?? null;
}

/** smplr에 넘길 음: 드럼은 샘플 이름, 나머지는 MIDI 번호 */
export function noteFor(track: TrackId, pitch: number): string | number | null {
  return track === "drums" ? drumSampleName(pitch) : pitch;
}

/** 0~1 세기를 smplr의 0~127로 */
export function toMidiVelocity(velocity: number): number {
  return Math.round(Math.min(1, Math.max(0, velocity)) * 127);
}

/** 트랙별로 고를 수 있는 악기 (이름 → 화면 표시). 첫 항목이 아닌 기본값은 src/types/song.ts에 있습니다. */
export const INSTRUMENT_CHOICES: Partial<
  Record<TrackId, Record<string, string>>
> = {
  melody: {
    flute: "플루트",
    piano: "그랜드 피아노",
    electric_piano_1: "일렉트릭 피아노",
    vibraphone: "비브라폰",
    clarinet: "클라리넷",
    alto_sax: "알토 색소폰",
    violin: "바이올린",
    ocarina: "오카리나",
    whistle: "휘파람",
  },
  guitar: {
    acoustic_guitar_steel: "통기타",
    acoustic_guitar_nylon: "클래식 기타",
    electric_guitar_clean: "일렉 기타 (맑은 소리)",
    electric_guitar_jazz: "재즈 기타",
    overdriven_guitar: "오버드라이브 기타",
    distortion_guitar: "디스토션 기타",
  },
};

/**
 * 악기 이름으로 smplr 악기를 만듭니다.
 * - "piano": Splendid Grand Piano
 * - "drums": 드럼 머신(LM-2)
 * - "bass": GM 사운드폰트 핑거 일렉 베이스
 * - 그 밖의 이름: 같은 이름의 GM 사운드폰트 (예: "flute", "acoustic_guitar_nylon")
 */
export function createInstrument(
  smplr: SmplrModule,
  context: BaseAudioContext,
  name: string,
  destination: AudioNode,
  /** 오프라인 렌더링용. 없으면 smplr 기본 스케줄러(0.2초 앞까지만 바로 예약) */
  scheduler?: Scheduler,
): Playable {
  switch (name) {
    case "piano":
      return smplr.SplendidGrandPiano(context, { destination, scheduler });
    case "drums":
      return smplr.DrumMachine(context, {
        instrument: DRUM_MACHINE,
        destination,
        scheduler,
      });
    case "bass":
      return smplr.Soundfont(context, {
        instrument: "electric_bass_finger",
        destination,
        scheduler,
      });
    default:
      return smplr.Soundfont(context, {
        instrument: name,
        destination,
        scheduler,
      });
  }
}
