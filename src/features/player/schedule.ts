// 재생·렌더링이 함께 쓰는 예약 계산. 오디오 API 없이 동작하는 순수 함수만 둡니다.
import { countBars, stepsPerBar } from "@/lib/transport";
import {
  TRACK_IDS,
  type Note,
  type SongState,
  type TrackId,
} from "@/types/song";

/** 1 step = 16분음표 = 4분음표의 1/4 */
export function secondsPerStep(bpm: number): number {
  return 60 / bpm / 4;
}

/** 트랙별 재생할 음표. 반주가 아직 없으면 빈 배열 */
export function trackNotes(song: SongState): Record<TrackId, Note[]> {
  const { drums = [], bass = [], keys = [] } = song.accompaniment ?? {};
  return { melody: song.melody, drums, bass, keys };
}

/** 재생이 끝나는 위치(step). 재생 바의 곡 길이와 같게 마디 단위로 맞춥니다. */
export function playbackEndStep(song: SongState): number {
  return countBars(song) * stepsPerBar(song.timeSignature);
}

export type ScheduledNote = {
  track: TrackId;
  pitch: number;
  /** 곡 시작부터의 시간(초) */
  time: number;
  /** 길이(초) */
  duration: number;
  velocity: number;
};

/**
 * 곡 전체를 초 단위 예약 목록으로 펼칩니다 (BPM 고정).
 * 오프라인 렌더링(WAV)처럼 처음부터 끝까지 한 번에 예약할 때 씁니다.
 * fromStep을 주면 그 위치 이후에 시작하는 음만, 그 위치를 0초로 해서 돌려줍니다.
 */
export function scheduleSong(song: SongState, fromStep = 0): ScheduledNote[] {
  const unit = secondsPerStep(song.bpm);
  const notes = trackNotes(song);
  const scheduled: ScheduledNote[] = [];
  for (const track of TRACK_IDS) {
    for (const note of notes[track]) {
      if (note.start < fromStep) continue;
      scheduled.push({
        track,
        pitch: note.pitch,
        time: (note.start - fromStep) * unit,
        duration: note.duration * unit,
        velocity: note.velocity,
      });
    }
  }
  return scheduled.sort((a, b) => a.time - b.time);
}
