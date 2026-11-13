// 마이크로 녹음하면서 음 높이를 찾습니다. 결과는 초 단위 음표(RawNote)와 녹음 원본(Blob)입니다.
// BPM은 패널이 알고 있으므로 step 변환(quantize)은 패널이 합니다.
//
// 시계: 카운트인 클릭과 프레임 시각은 모두 같은 AudioContext의 currentTime을 씁니다.
// 카운트인이 끝나는 순간이 0초 = 첫 박이고, quantize도 이 가정을 씁니다.
import { PitchDetector } from "pitchy";
import { framesToNotes, type PitchFrame, type RawNote } from "./notes";

export const MAX_RECORD_SECONDS = 30;

/** 한 번에 분석하는 샘플 수. 44.1kHz에서 약 46ms */
const WINDOW_SIZE = 2048;
/** 프레임을 읽는 간격(ms). 탭이 뒤로 가도 멈추지 않게 requestAnimationFrame 대신 setInterval을 씁니다 */
const FRAME_INTERVAL_MS = 20;
/** 이보다 음정이 흐린 프레임은 무음으로 봅니다 (pitchy clarity 0 ~ 1) */
const MIN_CLARITY = 0.9;
/** 이보다 작은 소리(RMS)는 무음으로 봅니다 */
const MIN_RMS = 0.01;
/** 허밍으로 낼 수 있는 높이 범위(Hz). 밖은 잡음으로 봅니다 */
const MIN_FREQUENCY = 70;
const MAX_FREQUENCY = 1100;
/** RMS를 세기(0 ~ 1)로 바꿀 때 곱하는 값. 보통 크기 허밍(RMS 0.1 안팎)이 0.6 ~ 0.8쯤 되게 */
const VOLUME_GAIN = 6;

export type RecorderErrorCode =
  "permission-denied" | "no-device" | "unsupported" | "failed";

export class RecorderError extends Error {
  constructor(
    readonly code: RecorderErrorCode,
    options?: { cause?: unknown },
  ) {
    super(`recorder: ${code}`, options);
    this.name = "RecorderError";
  }
}

/** getUserMedia · MediaRecorder가 던진 오류를 패널 문구용 코드로 바꿉니다 */
export function toRecorderError(error: unknown): RecorderError {
  if (error instanceof RecorderError) return error;
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return new RecorderError("permission-denied", { cause: error });
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return new RecorderError("no-device", { cause: error });
  if (name === "NotSupportedError")
    return new RecorderError("unsupported", { cause: error });
  return new RecorderError("failed", { cause: error });
}

export function isRecordingSupported() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined" &&
    typeof AudioContext !== "undefined"
  );
}

type Detector = Pick<PitchDetector<Float32Array>, "findPitch">;

export function createDetector(): Detector {
  return PitchDetector.forFloat32Array(WINDOW_SIZE);
}

/**
 * 샘플 한 덩어리를 프레임 하나로 바꿉니다. 소리가 작거나, 음정이 흐리거나, 허밍 범위 밖이면 frequency는 null.
 * @param time 녹음 시작(카운트인 끝)부터 초
 */
export function toFrame(
  samples: Float32Array,
  sampleRate: number,
  time: number,
  detector: Detector = createDetector(),
): PitchFrame {
  const rms = Math.sqrt(
    samples.reduce((sum, s) => sum + s * s, 0) / samples.length,
  );
  const volume = Math.min(1, rms * VOLUME_GAIN);
  if (rms < MIN_RMS) return { time, frequency: null, volume };
  const [frequency, clarity] = detector.findPitch(samples, sampleRate);
  const audible =
    clarity >= MIN_CLARITY &&
    frequency >= MIN_FREQUENCY &&
    frequency <= MAX_FREQUENCY;
  return { time, frequency: audible ? frequency : null, volume };
}

export type RecordingResult = {
  notes: RawNote[];
  frames: PitchFrame[];
  blob: Blob;
  /** 카운트인을 뺀 녹음 길이(초) */
  durationSeconds: number;
};

export type RecordOptions = {
  maxSeconds?: number;
  /** 녹음 전에 들려줄 박 수. 0이면 바로 녹음 */
  countInBeats?: number;
  /** 카운트인 빠르기 */
  bpm?: number;
  /** 카운트인 박마다 (1부터). 화면에 "1 · 2 · 3 · 4"를 보여 줄 때 */
  onCountIn?: (beat: number) => void;
  /** 카운트인이 끝나고 실제 녹음(0초)이 시작될 때 */
  onStart?: () => void;
  /** 녹음 중 프레임마다. 지금 부르는 음 표시용 */
  onFrame?: (frame: PitchFrame) => void;
  /** maxSeconds에 닿아 스스로 멈췄을 때 결과 */
  onAutoStop?: (result: RecordingResult) => void;
};

export type RecordingSession = {
  /** 녹음을 멈추고 결과를 돌려줍니다. 카운트인 중이면 녹음한 것이 없으므로 빈 결과 */
  stop: () => Promise<RecordingResult>;
  /** 결과 없이 정리만 합니다 */
  cancel: () => void;
};

/**
 * 마이크를 열고 (카운트인 뒤) 녹음을 시작합니다. 클릭 이벤트 안에서 불러야 오디오가 켜집니다.
 * 마이크를 못 열면 RecorderError로 거절됩니다.
 */
export async function startRecording({
  maxSeconds = MAX_RECORD_SECONDS,
  countInBeats = 0,
  bpm = 100,
  onCountIn,
  onStart,
  onFrame,
  onAutoStop,
}: RecordOptions = {}): Promise<RecordingSession> {
  if (!isRecordingSupported()) throw new RecorderError("unsupported");

  // 사용자 클릭 안에서 바로 만들어야 브라우저가 소리를 막지 않습니다 (getUserMedia를 기다리기 전에).
  const context = new AudioContext();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // 허밍 음정이 흔들리지 않게 브라우저의 음성 처리를 끕니다.
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (error) {
    void context.close();
    throw toRecorderError(error);
  }

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, pickMimeType());
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    void context.close();
    throw toRecorderError(error);
  }
  await context.resume();

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = WINDOW_SIZE;
  source.connect(analyser);

  // 카운트인: 다음 박부터 countInBeats번 클릭, 그다음 박이 녹음 0초입니다.
  const beat = 60 / bpm;
  const firstClick = context.currentTime + 0.1;
  const startAt = firstClick + countInBeats * beat;
  const countInTimers: ReturnType<typeof setTimeout>[] = [];
  for (let i = 0; i < countInBeats; i++) {
    const at = firstClick + i * beat;
    scheduleClick(context, at, i === 0);
    countInTimers.push(
      setTimeout(() => onCountIn?.(i + 1), (at - context.currentTime) * 1000),
    );
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  // 원본에는 카운트인이 들어가도 괜찮습니다(음표 시각은 AudioContext 시계로 따로 잽니다).
  recorder.start();

  const frames: PitchFrame[] = [];
  const samples = new Float32Array(WINDOW_SIZE);
  const detector = createDetector();
  // 분석 창의 가운데가 그 프레임의 시각입니다.
  const windowCenter = WINDOW_SIZE / 2 / context.sampleRate;
  let started = false;
  let finished: Promise<RecordingResult> | null = null;

  const timer = setInterval(() => {
    const time = context.currentTime - startAt - windowCenter;
    if (time < 0) return;
    if (!started) {
      started = true;
      onStart?.();
    }
    if (time >= maxSeconds) {
      void finish().then((result) => onAutoStop?.(result));
      return;
    }
    analyser.getFloatTimeDomainData(samples);
    const frame = toFrame(samples, context.sampleRate, time, detector);
    frames.push(frame);
    onFrame?.(frame);
  }, FRAME_INTERVAL_MS);

  const cleanup = () => {
    clearInterval(timer);
    countInTimers.forEach(clearTimeout);
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void context.close();
  };

  function finish(): Promise<RecordingResult> {
    finished ??= new Promise<RecordingResult>((resolve) => {
      const durationSeconds = Math.min(
        maxSeconds,
        Math.max(0, context.currentTime - startAt),
      );
      clearInterval(timer);
      const done = () => {
        cleanup();
        resolve({
          notes: framesToNotes(frames),
          frames,
          blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
          durationSeconds,
        });
      };
      if (recorder.state === "inactive") done();
      else {
        recorder.onstop = done;
        recorder.stop();
      }
    });
    return finished;
  }

  return {
    stop: finish,
    cancel: () => {
      if (finished) return;
      finished = Promise.resolve({
        notes: [],
        frames: [],
        blob: new Blob(),
        durationSeconds: 0,
      });
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      cleanup();
    },
  };
}

/** 스토리지가 받는 형식(webm · ogg · mp4) 중 브라우저가 되는 것. 없으면 브라우저 기본 */
function pickMimeType(): MediaRecorderOptions {
  const mimeType = ["audio/webm", "audio/ogg", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  return mimeType ? { mimeType } : {};
}

/** 짧은 메트로놈 클릭. 첫 박은 높게 */
function scheduleClick(context: AudioContext, at: number, accent: boolean) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.frequency.value = accent ? 1760 : 1320;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  osc.connect(gain).connect(context.destination);
  osc.start(at);
  osc.stop(at + 0.07);
}
