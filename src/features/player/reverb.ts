// 울림(리버브) 버스. 모든 트랙이 Convolver 하나를 같이 쓰고, 트랙마다 보내는 양(Track.effects.reverb)만 다릅니다.
// 재생(player.ts)과 WAV 렌더링(render.ts)이 같은 함수를 써서 두 소리가 같습니다. docs/specs/12_reverb/design.md §2
import { TRACK_IDS, type Track, type TrackId } from "@/types/song";

/** 울림 길이(초). WAV 끝 여유(render.ts tailSeconds)는 이보다 길어야 꼬리가 안 잘립니다. */
export const REVERB_SECONDS = 1.8;
/** 울림 출력 크기. Convolver 정규화로 울림이 원음보다 약 18dB 작아서, 보내는 양 100%일 때 원음과 비슷하게(약 -2.5dB) 키웁니다. */
const RETURN_GAIN = 3;

/** 곡에 값이 없을 때의 보내는 양 (2026-11-15 사용자 결정). 곡에 써 넣지 않아 예전 곡을 열어도 저장이 돌지 않습니다. */
export const DEFAULT_REVERB: Record<TrackId, number> = {
  melody: 0.3,
  drums: 0.15,
  bass: 0,
  keys: 0.3,
  guitar: 0.2,
};

/** 트랙별 보내는 양 0 ~ 1. 곡에 값이 있으면 그 값, 없으면 기본값 */
export function reverbSends(tracks: Track[]): Record<TrackId, number> {
  const sends = { ...DEFAULT_REVERB };
  for (const track of tracks) {
    const amount = track.effects?.reverb;
    if (amount !== undefined && Number.isFinite(amount))
      sends[track.id] = Math.min(1, Math.max(0, amount));
  }
  return sends;
}

/** 고정 시드 난수(mulberry32). 같은 시드면 늘 같은 값이라 재생 · WAV · 두 번 받은 WAV가 같은 울림입니다. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 스테레오 잡음에 감쇠를 곱한 임펄스 응답. 샘플 파일을 받지 않고 코드로 만듭니다. */
export function impulseResponse(context: BaseAudioContext): AudioBuffer {
  const length = Math.round(REVERB_SECONDS * context.sampleRate);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const random = seededRandom(channel + 1);
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++)
      data[i] = (random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  return buffer;
}

/**
 * 트랙 게인 뒤에서 울림으로 보내는 길을 만들고, 트랙별 보내기 게인을 돌려줍니다.
 * 트랙 게인(볼륨 · 뮤트 · 솔로) 뒤에서 보내므로 뮤트 · 솔로가 울림에도 그대로 걸립니다.
 */
export function connectReverb(
  context: BaseAudioContext,
  channels: Record<TrackId, GainNode>,
  destination: AudioNode,
  sends: Record<TrackId, number>,
): Record<TrackId, GainNode> {
  const convolver = context.createConvolver();
  convolver.buffer = impulseResponse(context);
  const output = context.createGain();
  output.gain.value = RETURN_GAIN;
  convolver.connect(output);
  output.connect(destination);
  return Object.fromEntries(
    TRACK_IDS.map((id) => {
      const send = context.createGain();
      send.gain.value = sends[id];
      channels[id].connect(send);
      send.connect(convolver);
      return [id, send];
    }),
  ) as Record<TrackId, GainNode>;
}
