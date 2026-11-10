// 오프라인 렌더링: 곡 전체를 실시간보다 빠르게 AudioBuffer로 만듭니다 (WAV 내보내기용).
// 실시간 재생과 같은 악기·믹스·예약 계산을 써서 들리는 소리와 결과 파일이 같습니다.
import { TRACK_IDS, type SongState, type TrackId } from "@/types/song";
import { createInstrument, noteFor, toMidiVelocity } from "./instruments";
import { trackGains } from "./mix";
import { playbackEndStep, scheduleSong, secondsPerStep } from "./schedule";

export type RenderOptions = {
  sampleRate?: number;
  /** 마지막 음이 자연스럽게 사라지도록 곡 끝 뒤에 붙이는 여유(초) */
  tailSeconds?: number;
};

/**
 * 곡을 스테레오 AudioBuffer로 렌더링합니다. 브라우저에서만 동작합니다.
 * WAV 파일이 필요하면 smplr의 `audioBufferToWav(buffer)`로 Blob을 만들 수 있습니다.
 */
export async function renderSong(
  song: SongState,
  { sampleRate = 44100, tailSeconds = 2 }: RenderOptions = {},
): Promise<AudioBuffer> {
  const smplr = await import("smplr");
  const seconds =
    playbackEndStep(song) * secondsPerStep(song.bpm) + tailSeconds;
  const context = new OfflineAudioContext(
    2,
    Math.ceil(seconds * sampleRate),
    sampleRate,
  );

  const gains = trackGains(song.tracks);
  const channels = {} as Record<TrackId, GainNode>;
  for (const id of TRACK_IDS) {
    channels[id] = context.createGain();
    channels[id].gain.value = gains[id];
    channels[id].connect(context.destination);
  }

  const instruments = new Map(
    song.tracks
      .filter((track) => gains[track.id] > 0) // 들리지 않는 트랙은 샘플을 받지 않음
      .map((track) => [
        track.id,
        createInstrument(smplr, context, track.instrument, channels[track.id]),
      ]),
  );
  await Promise.all(
    [...instruments.values()].map((instrument) => instrument.ready),
  );

  for (const event of scheduleSong(song)) {
    const instrument = instruments.get(event.track);
    const note = noteFor(event.track, event.pitch);
    if (!instrument || note === null) continue;
    instrument.start({
      note,
      time: event.time,
      duration: event.duration,
      velocity: toMidiVelocity(event.velocity),
    });
  }
  return context.startRendering();
}
