// 트랙별 볼륨·뮤트·솔로를 실제 게인 값으로 바꿉니다.
import { TRACK_IDS, type Track, type TrackId } from "@/types/song";

/** 슬라이더 0dB일 때의 기본 크기. 멜로디가 반주에 묻혀 +16dB로 둡니다(2026-11-16 사용자 청취, +6dB로도 부족). */
const BASE_GAIN: Partial<Record<TrackId, number>> = {
  melody: dbToGain(16),
};

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * 트랙별 선형 게인.
 * - 뮤트한 트랙은 0 (솔로보다 뮤트가 우선)
 * - 솔로가 하나라도 있으면 솔로가 아닌 트랙은 0
 * - 그 밖에는 volume(dB)을 게인으로 바꾼 값 × 트랙 기본 크기(BASE_GAIN). 목록에 없는 트랙은 0dB로 봄
 */
export function trackGains(tracks: Track[]): Record<TrackId, number> {
  const anySolo = tracks.some((track) => track.solo);
  const gains = Object.fromEntries(
    TRACK_IDS.map((id) => [id, anySolo ? 0 : (BASE_GAIN[id] ?? 1)]),
  ) as Record<TrackId, number>;
  for (const track of tracks) {
    const audible = !track.muted && (!anySolo || track.solo);
    gains[track.id] = audible
      ? dbToGain(track.volume) * (BASE_GAIN[track.id] ?? 1)
      : 0;
  }
  return gains;
}
