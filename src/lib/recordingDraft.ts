// 아직 곡 id가 없는(게스트 · 새 곡) 녹음 원본 하나를 IndexedDB에 둡니다.
// 새 탭 · 새로고침 · 로그인 리다이렉트 뒤에도 그 곡이 처음 저장될 때 올릴 수 있게 하려는 것입니다.
// IndexedDB를 못 쓰면(사생활 보호 모드 등) 조용히 넘어가고 메모리만 씁니다.
// docs/specs/06_guest-continue/design.md §2

const DB_NAME = "digedak";
const STORE = "recording-draft";
const KEY = "guest";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  try {
    if (typeof indexedDB === "undefined") return null;
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    const db = await request(open);
    try {
      return await request(run(db.transaction(STORE, mode).objectStore(STORE)));
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn("녹음 원본을 브라우저에 보관하지 못했어요", error);
    return null;
  }
}

export async function saveRecordingDraft(blob: Blob): Promise<void> {
  await withStore("readwrite", (store) => store.put(blob, KEY));
}

export async function loadRecordingDraft(): Promise<Blob | null> {
  const value = await withStore("readonly", (store) => store.get(KEY));
  return value instanceof Blob ? value : null;
}

export async function clearRecordingDraft(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(KEY));
}
