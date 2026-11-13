// 마지막 녹음 원본(Blob)을 보관합니다. store(SongState)에는 넣지 않습니다 (DB · localStorage에 저장되면 안 되므로).
// 업로드와 song.recording 채우기는 저장 담당(C)이 이 값을 가져가서 합니다.
// 새로고침하면 사라집니다. 게스트 녹음은 업로드 전까지 메모리에만 있습니다.

let latest: Blob | null = null;
const listeners = new Set<(blob: Blob | null) => void>();

export function setLatestRecording(blob: Blob | null) {
  latest = blob;
  listeners.forEach((listener) => listener(blob));
}

export function getLatestRecording() {
  return latest;
}

/** 새 녹음이 생길 때마다 불립니다. 해제 함수를 돌려줍니다 */
export function onLatestRecording(listener: (blob: Blob | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
