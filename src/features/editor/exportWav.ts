// WAV 내보내기: B의 renderSong(재생과 같은 악기 · 믹스 · 예약)으로 렌더링해 16비트 WAV로 만듭니다.
// docs/specs/04_export-wav/design.md §3
import { renderSong, type RenderOptions } from "@/features/player";
import type { SongState } from "@/types/song";

export async function exportWav(
  song: SongState,
  onProgress?: RenderOptions["onProgress"],
): Promise<Blob> {
  const buffer = await renderSong(song, { onProgress });
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  const scale = peakScale(channels);
  if (scale < 1)
    for (const data of channels)
      for (let i = 0; i < data.length; i++) data[i] *= scale;
  const { audioBufferToWav16 } = await import("smplr");
  return audioBufferToWav16(buffer);
}

/** 16비트는 1을 넘는 값이 잘려 소리가 깨지므로, 넘을 때만 최대값이 0.99가 되게 줄이는 배율 */
export function peakScale(channels: Float32Array[]): number {
  let peak = 0;
  for (const data of channels)
    for (const value of data) peak = Math.max(peak, Math.abs(value));
  return peak > 1 ? 0.99 / peak : 1;
}

/** 곡 제목 → 파일 이름. 파일 이름에 못 쓰는 글자는 _로, 비면 "딕으닥" */
export function wavFileName(title: string): string {
  const name = title.replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_").trim();
  return `${name || "딕으닥"}.wav`;
}
