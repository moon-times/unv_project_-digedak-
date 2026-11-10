// 트랙별 볼륨·뮤트·솔로를 실제 게인 값으로 바꿉니다.
import { TRACK_IDS, type Track, type TrackId } from "@/types/song";

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * 트랙별 선형 게인.
 * - 뮤트한 트랙은 0 (솔로보다 뮤트가 우선)
 * - 솔로가 하나라도 있으면 솔로가 아닌 트랙은 0
 * - 그 밖에는 volume(dB)을 게인으로 바꾼 값. 목록에 없는 트랙은 1
 */
export function trackGains(tracks: Track[]): Record<TrackId, number> {
  const anySolo = tracks.some((track) => track.solo);
  const gains = Object.fromEntries(
    TRACK_IDS.map((id) => [id, anySolo ? 0 : 1]),
  ) as Record<TrackId, number>;
  for (const track of tracks) {
    const audible = !track.muted && (!anySolo || track.solo);
    gains[track.id] = audible ? dbToGain(track.volume) : 0;
  }
  return gains;
}
