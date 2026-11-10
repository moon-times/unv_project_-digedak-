// 재생 바에 보여 줄 곡 길이 계산. 음표 위치·길이 단위는 16분음표 step입니다.
import type { SongState } from "@/types/song";

/** 한 마디에 들어가는 step 수. 4/4박자 = 16, 3/4박자 = 12, 6/8박자 = 12 */
export function stepsPerBar([beats, beatUnit]: SongState["timeSignature"]) {
  return (beats * 16) / beatUnit;
}

/** 멜로디·코드·반주 중 가장 늦게 끝나는 음의 끝 위치(step) */
export function songEndStep(song: SongState) {
  const { drums = [], bass = [], keys = [] } = song.accompaniment ?? {};
  let end = 0;
  for (const item of [
    ...song.melody,
    ...song.chords,
    ...drums,
    ...bass,
    ...keys,
  ]) {
    end = Math.max(end, item.start + item.duration);
  }
  return end;
}

/** 곡이 차지하는 마디 수 (마지막 마디는 덜 채워져도 한 마디로 셉니다) */
export function countBars(song: SongState) {
  return Math.ceil(songEndStep(song) / stepsPerBar(song.timeSignature));
}

/** 마디 단위로 맞춘 곡 길이(초). 1 step = 16분음표 = 4분음표의 1/4 */
export function songDurationSeconds(song: SongState) {
  const steps = countBars(song) * stepsPerBar(song.timeSignature);
  return (steps * 60) / song.bpm / 4;
}

/** 초를 "0:23" 형식으로 */
export function formatTime(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
