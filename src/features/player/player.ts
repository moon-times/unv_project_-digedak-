// 실시간 재생 엔진. Tone.js Transport로 박자를 맞추고 smplr 샘플 악기로 소리를 냅니다.
// Tone과 smplr는 브라우저에서만 동작하므로 init()에서 동적으로 불러옵니다(서버 렌더링 안전).
//
// 신호 흐름: 악기 → 트랙 게인(볼륨·뮤트·솔로) → 마스터 게인 → 스피커
import type { Part } from "tone";
import {
  TRACK_IDS,
  type SongState,
  type Track,
  type TrackId,
} from "@/types/song";
import {
  createInstrument,
  noteFor,
  toMidiVelocity,
  type Playable,
} from "./instruments";
import { trackGains } from "./mix";
import { playbackEndStep, secondsPerStep, trackNotes } from "./schedule";

type ToneModule = typeof import("tone");
type SmplrModule = typeof import("smplr");

export type PlayerStatus =
  "idle" | "loading" | "ready" | "playing" | "paused" | "error";

export type PlayerState = {
  status: PlayerStatus;
  /** 현재 재생 위치(step). 정수가 아닐 수 있습니다. */
  step: number;
  error?: string;
};

export const INITIAL_PLAYER_STATE: PlayerState = { status: "idle", step: 0 };

/** 볼륨이 바뀔 때 툭 끊기지 않도록 짧게 이어 줍니다(초). */
const GAIN_SMOOTHING = 0.01;

type Audio = {
  tone: ToneModule;
  smplr: SmplrModule;
  context: AudioContext;
  master: GainNode;
  channels: Record<TrackId, GainNode>;
};

export class Player {
  #audio: Audio | null = null;
  #initPromise: Promise<void> | null = null;
  #instruments = new Map<TrackId, { name: string; instrument: Playable }>();
  #parts: Part[] = [];
  #endEventId: number | null = null;
  #song: SongState | null = null;
  #state: PlayerState = INITIAL_PLAYER_STATE;
  #listeners = new Set<() => void>();
  #frame = 0;

  // ── 상태 구독 (useSyncExternalStore용) ──────────────────────────────

  getState = (): PlayerState => this.#state;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  #setState(patch: Partial<PlayerState>) {
    this.#state = { ...this.#state, ...patch };
    this.#listeners.forEach((listener) => listener());
  }

  // ── 초기화 ──────────────────────────────────────────────────────────

  /**
   * 오디오를 켜고 악기를 불러옵니다. 브라우저 정책상 **사용자 클릭 안에서** 처음 불러야 합니다.
   * 여러 번 불러도 한 번만 초기화합니다. play()가 알아서 부르므로 보통 직접 부를 필요는 없습니다.
   */
  init(): Promise<void> {
    if (this.#initPromise) return this.#initPromise;
    // AudioContext 생성과 resume은 await 전에 해야 클릭 안에서 실행된 것으로 인정됩니다.
    const context = new AudioContext();
    void context.resume();
    this.#setState({ status: "loading", error: undefined });
    this.#initPromise = this.#setup(context).catch((error: unknown) => {
      this.#initPromise = null;
      void context.close();
      this.#setState({ status: "error", error: String(error) });
      throw error;
    });
    return this.#initPromise;
  }

  async #setup(context: AudioContext) {
    const [tone, smplr] = await Promise.all([import("tone"), import("smplr")]);
    // Tone과 smplr가 같은 AudioContext를 써야 예약 시각이 맞습니다.
    tone.setContext(new tone.Context(context));

    const master = context.createGain();
    master.connect(context.destination);
    const channels = Object.fromEntries(
      TRACK_IDS.map((id) => {
        const gain = context.createGain();
        gain.connect(master);
        return [id, gain];
      }),
    ) as Record<TrackId, GainNode>;

    this.#audio = { tone, smplr, context, master, channels };
    if (this.#song) await this.#apply(this.#song);
    this.#setState({ status: "ready" });
  }

  // ── 곡 반영 ─────────────────────────────────────────────────────────

  /**
   * 재생할 곡을 넘깁니다. 음표·반주·믹서·BPM이 바뀔 때마다 다시 불러도 됩니다.
   * 초기화 전이면 기억해 두었다가 init()에서 반영합니다.
   */
  async load(song: SongState): Promise<void> {
    this.#song = song;
    if (this.#audio) await this.#apply(song);
  }

  async #apply(song: SongState) {
    this.setBpm(song.bpm);
    this.applyMix(song.tracks);
    await this.#syncInstruments(song.tracks);
    if (this.#song === song) this.#rebuildParts(song);
  }

  /** 트랙의 악기 이름이 바뀐 것만 새로 불러옵니다. */
  async #syncInstruments(tracks: Track[]) {
    const audio = this.#audio!;
    const loading: Promise<void>[] = [];
    for (const track of tracks) {
      const current = this.#instruments.get(track.id);
      if (current?.name === track.instrument) continue;
      current?.instrument.dispose();
      const instrument = createInstrument(
        audio.smplr,
        audio.context,
        track.instrument,
        audio.channels[track.id],
      );
      this.#instruments.set(track.id, { name: track.instrument, instrument });
      loading.push(instrument.ready);
    }
    if (loading.length === 0) return;
    const playing = this.#state.status === "playing";
    if (!playing) this.#setState({ status: "loading" });
    await Promise.all(loading);
    if (!playing)
      this.#setState({ status: this.#state.step > 0 ? "paused" : "ready" });
  }

  #rebuildParts(song: SongState) {
    const { tone } = this.#audio!;
    const transport = tone.getTransport();
    const ticksPerStep = transport.PPQ / 4;

    this.#parts.forEach((part) => part.dispose());
    this.#parts = [];
    const notes = trackNotes(song);
    for (const track of TRACK_IDS) {
      if (notes[track].length === 0) continue;
      const events = notes[track].map((note) => ({
        time: `${note.start * ticksPerStep}i`,
        pitch: note.pitch,
        steps: note.duration,
        velocity: note.velocity,
      }));
      const part = new tone.Part((time, event) => {
        const instrument = this.#instruments.get(track)?.instrument;
        const note = noteFor(track, event.pitch);
        if (!instrument || note === null) return;
        instrument.start({
          note,
          time,
          // 길이는 연주 시점의 BPM으로 계산해 템포를 바꿔도 맞게 합니다.
          duration: event.steps * secondsPerStep(transport.bpm.value),
          velocity: toMidiVelocity(event.velocity),
        });
      }, events);
      part.start(0);
      this.#parts.push(part);
    }

    // 곡 끝에 닿으면 멈추고 처음으로 돌아갑니다. (scheduleOnce는 한 번 쓰면 사라지므로 schedule)
    if (this.#endEventId !== null) transport.clear(this.#endEventId);
    const endTicks = playbackEndStep(song) * ticksPerStep;
    this.#endEventId = transport.schedule((time) => {
      tone.getDraw().schedule(() => this.stop(), time);
    }, `${endTicks}i`);
  }

  // ── 조작 ────────────────────────────────────────────────────────────

  async play(): Promise<void> {
    await this.init();
    const { tone, context } = this.#audio!;
    if (this.#state.status === "playing") return;
    await context.resume();
    const transport = tone.getTransport();
    // 초기화 전에 seek했거나 멈춘 동안 옮긴 위치에서 시작합니다.
    transport.ticks = Math.round(this.#state.step * (transport.PPQ / 4));
    transport.start();
    this.#setState({ status: "playing" });
    this.#tick();
  }

  pause(): void {
    if (!this.#audio || this.#state.status !== "playing") return;
    this.#audio.tone.getTransport().pause();
    this.#stopVoices();
    cancelAnimationFrame(this.#frame);
    this.#setState({ status: "paused", step: this.#currentStep() });
  }

  /** 멈추고 처음으로 돌아갑니다. */
  stop(): void {
    if (!this.#audio) return;
    this.#audio.tone.getTransport().stop();
    this.#stopVoices();
    cancelAnimationFrame(this.#frame);
    this.#setState({ status: "ready", step: 0 });
  }

  /** 재생 위치를 옮깁니다(step). 재생 중이면 그 위치부터 이어서 재생합니다. */
  seek(step: number): void {
    const target = Math.max(0, step);
    if (this.#audio) {
      const transport = this.#audio.tone.getTransport();
      this.#stopVoices();
      transport.ticks = Math.round(target * (transport.PPQ / 4));
    }
    const status = this.#state.status;
    const paused = status === "ready" && target > 0 ? "paused" : status;
    this.#setState({ step: target, status: paused });
  }

  setBpm(bpm: number): void {
    if (!this.#audio || !(bpm > 0)) return;
    this.#audio.tone.getTransport().bpm.value = bpm;
  }

  /** 트랙별 볼륨·뮤트·솔로를 반영합니다. */
  applyMix(tracks: Track[]): void {
    if (!this.#audio) return;
    const { context, channels } = this.#audio;
    const gains = trackGains(tracks);
    for (const id of TRACK_IDS) {
      channels[id].gain.setTargetAtTime(
        gains[id],
        context.currentTime,
        GAIN_SMOOTHING,
      );
    }
  }

  /** 모든 소리를 끄고 오디오를 닫습니다. 다시 쓰려면 init()부터 합니다. */
  async dispose(): Promise<void> {
    cancelAnimationFrame(this.#frame);
    this.#parts.forEach((part) => part.dispose());
    this.#parts = [];
    this.#instruments.forEach(({ instrument }) => instrument.dispose());
    this.#instruments.clear();
    const audio = this.#audio;
    this.#audio = null;
    this.#initPromise = null;
    this.#endEventId = null;
    if (audio) {
      audio.tone.getTransport().stop();
      await audio.context.close();
    }
    this.#setState(INITIAL_PLAYER_STATE);
  }

  // ── 내부 ────────────────────────────────────────────────────────────

  #currentStep(): number {
    const transport = this.#audio!.tone.getTransport();
    return transport.ticks / (transport.PPQ / 4);
  }

  #stopVoices() {
    this.#instruments.forEach(({ instrument }) => instrument.stop());
  }

  /** 재생 중에는 화면 프레임마다 재생 위치를 알립니다. */
  #tick = () => {
    if (this.#state.status !== "playing") return;
    this.#setState({ step: this.#currentStep() });
    this.#frame = requestAnimationFrame(this.#tick);
  };
}

/** 앱 전체가 함께 쓰는 재생기 하나 */
export const player = new Player();
