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
  /** 진행 단계. 샘플을 받는 동안 "loading", 렌더링 중 0~1 (WAV 내보내기 진행 표시용) */
  onProgress?: (progress: RenderProgress) => void;
};

export type RenderProgress =
  { phase: "loading" } | { phase: "rendering"; ratio: number };

/** 진행 알림 간격 (곡 길이의 10%마다) */
const PROGRESS_STEPS = 10;
/** OfflineAudioContext는 128샘플 단위로 렌더링하므로 멈출 시각도 이 단위에 맞춥니다. */
const RENDER_QUANTUM = 128;

/**
 * 곡을 스테레오 AudioBuffer로 렌더링합니다. 브라우저에서만 동작합니다.
 * WAV 파일이 필요하면 smplr의 `audioBufferToWav(buffer)`로 Blob을 만들 수 있습니다.
 */
export async function renderSong(
  song: SongState,
  { sampleRate = 44100, tailSeconds = 2, onProgress }: RenderOptions = {},
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

  // smplr 기본 스케줄러는 0.2초 뒤의 음을 큐에 넣고 실시간 타이머로 보내는데, 오프라인 렌더링은
  // 실시간보다 빨리 끝나서 큐에 남은 음이 빠집니다. 모든 음을 미리 예약하도록 앞보기를 무한으로 둡니다.
  const scheduler = smplr.Scheduler(context, { lookaheadMs: Infinity });
  const instruments = new Map(
    song.tracks
      .filter((track) => gains[track.id] > 0) // 들리지 않는 트랙은 샘플을 받지 않음
      .map((track) => [
        track.id,
        createInstrument(
          smplr,
          context,
          track.instrument,
          channels[track.id],
          scheduler,
        ),
      ]),
  );
  onProgress?.({ phase: "loading" });
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
  if (onProgress) reportProgress(context, onProgress);
  const buffer = await context.startRendering();
  onProgress?.({ phase: "rendering", ratio: 1 });
  return buffer;
}

/** 렌더링을 10%마다 잠깐 멈춰 진행률을 알리고 이어 갑니다. startRendering() 전에 불러야 합니다. */
function reportProgress(
  context: OfflineAudioContext,
  onProgress: (progress: RenderProgress) => void,
) {
  onProgress({ phase: "rendering", ratio: 0 });
  const quantum = RENDER_QUANTUM / context.sampleRate;
  const duration = context.length / context.sampleRate;
  const seen = new Set<number>();
  for (let i = 1; i < PROGRESS_STEPS; i++) {
    const ratio = i / PROGRESS_STEPS;
    const time = Math.ceil((duration * ratio) / quantum) * quantum;
    if (seen.has(time) || time >= duration) continue;
    seen.add(time);
    void context.suspend(time).then(() => {
      onProgress({ phase: "rendering", ratio });
      void context.resume();
    });
  }
}
