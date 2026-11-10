// 테스트 환경(jsdom)에는 오디오가 없으므로 Tone·smplr·AudioContext를 가짜로 바꿔
// 재생기의 상태 흐름과 예약 내용만 확인합니다. 실제 소리는 브라우저에서 확인합니다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptySong, type SongState } from "@/types/song";

type FakeInstrument = {
  name: string;
  ready: Promise<void>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};
type PartCallback = (
  time: number,
  event: { pitch: number; steps: number; velocity: number },
) => void;

const fake = vi.hoisted(() => {
  const state = {
    instruments: [] as FakeInstrument[],
    parts: [] as {
      callback: PartCallback;
      events: { time: string }[];
      disposed: boolean;
    }[],
    scheduled: [] as { callback: (time: number) => void; time: string }[],
    gains: [] as { setTargetAtTime: ReturnType<typeof vi.fn> }[],
  };
  const transport = {
    PPQ: 192,
    ticks: 0,
    bpm: { value: 120 },
    start: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(() => {
      transport.ticks = 0;
    }),
    schedule: vi.fn((callback: (time: number) => void, time: string) => {
      state.scheduled.push({ callback, time });
      return state.scheduled.length;
    }),
    clear: vi.fn(),
  };
  const makeInstrument = (name: string) => () => {
    const instrument = {
      name,
      ready: Promise.resolve(),
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    };
    state.instruments.push(instrument);
    return instrument;
  };
  return { state, transport, makeInstrument };
});

vi.mock("tone", () => ({
  getTransport: () => fake.transport,
  getDraw: () => ({ schedule: (callback: () => void) => callback() }),
  setContext: vi.fn(),
  Context: class {},
  Part: class {
    disposed = false;
    constructor(
      public callback: PartCallback,
      public events: { time: string }[],
    ) {
      fake.state.parts.push(this);
    }
    start() {
      return this;
    }
    dispose() {
      this.disposed = true;
    }
  },
}));

vi.mock("smplr", () => ({
  SplendidGrandPiano: vi.fn(fake.makeInstrument("piano")),
  DrumMachine: vi.fn(fake.makeInstrument("drums")),
  Soundfont: vi.fn((_ctx: unknown, options: { instrument: string }) =>
    fake.makeInstrument(options.instrument)(),
  ),
}));

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  createGain() {
    const gain = {
      gain: { value: 1, setTargetAtTime: vi.fn() },
      connect: vi.fn(),
    };
    fake.state.gains.push(gain.gain);
    return gain;
  }
}

const { Player } = await import("./player");

const SONG: SongState = {
  ...createEmptySong(),
  bpm: 120,
  melody: [{ pitch: 64, start: 0, duration: 4, velocity: 1 }],
  accompaniment: {
    drums: [{ pitch: 38, start: 4, duration: 1, velocity: 0.5 }],
    bass: [{ pitch: 36, start: 0, duration: 8, velocity: 0.8 }],
    keys: [],
  },
};

const instrumentNamed = (name: string) =>
  fake.state.instruments.find((i) => i.name === name)!;
const livePart = (index: number) =>
  fake.state.parts.filter((p) => !p.disposed)[index];

beforeEach(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  fake.state.instruments = [];
  fake.state.parts = [];
  fake.state.scheduled = [];
  fake.state.gains = [];
  fake.transport.ticks = 0;
  fake.transport.bpm.value = 120;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Player", () => {
  it("초기화 전에는 idle, 곡을 받아 두었다가 play에서 불러와 재생한다", async () => {
    const player = new Player();
    expect(player.getState().status).toBe("idle");
    await player.load(SONG);
    expect(fake.state.instruments).toHaveLength(0); // 아직 오디오를 켜지 않음

    await player.play();
    expect(player.getState().status).toBe("playing");
    expect(fake.transport.start).toHaveBeenCalled();
    // 트랙 4개(멜로디·드럼·베이스·건반) 악기, 음표가 있는 3개 트랙만 Part
    expect(fake.state.instruments.map((i) => i.name).sort()).toEqual([
      "drums",
      "electric_bass_finger",
      "piano",
      "piano",
    ]);
    expect(fake.state.parts).toHaveLength(3);
    player.pause();
  });

  it("Part는 step을 Tone tick으로 예약하고, 연주 시 악기에 음을 넘긴다", async () => {
    const player = new Player();
    await player.load(SONG);
    await player.init();

    // PPQ 192 → 1 step = 48 tick
    const drumPart = livePart(1);
    expect(drumPart.events[0].time).toBe("192i");
    drumPart.callback(1.5, { pitch: 38, steps: 1, velocity: 0.5 });
    expect(instrumentNamed("drums").start).toHaveBeenCalledWith({
      note: "snare-m",
      time: 1.5,
      duration: 0.125,
      velocity: 64,
    });

    // 연주 시점의 BPM으로 길이 계산
    fake.transport.bpm.value = 60;
    livePart(2).callback(0, { pitch: 36, steps: 8, velocity: 0.8 });
    expect(instrumentNamed("electric_bass_finger").start).toHaveBeenCalledWith(
      expect.objectContaining({ note: 36, duration: 2 }),
    );
  });

  it("pause·seek·stop", async () => {
    const player = new Player();
    await player.load(SONG);
    await player.play();

    fake.transport.ticks = 96;
    player.pause();
    expect(player.getState()).toMatchObject({ status: "paused", step: 2 });
    expect(instrumentNamed("piano").stop).toHaveBeenCalled();

    player.seek(16);
    expect(fake.transport.ticks).toBe(768);
    expect(player.getState().step).toBe(16);

    await player.play();
    expect(fake.transport.ticks).toBe(768); // 옮긴 위치에서 시작

    player.stop();
    expect(player.getState()).toMatchObject({ status: "ready", step: 0 });
  });

  it("초기화 전에 seek한 위치에서 재생을 시작한다", async () => {
    const player = new Player();
    await player.load(SONG);
    player.seek(8);
    await player.play();
    expect(fake.transport.ticks).toBe(384);
    player.pause();
  });

  it("곡 끝(마디 단위)에 닿으면 멈추고 처음으로", async () => {
    const player = new Player();
    await player.load(SONG);
    await player.play();
    const end = fake.state.scheduled.at(-1)!;
    expect(end.time).toBe("768i"); // 1마디 = 16 step = 768 tick
    end.callback(0);
    expect(player.getState()).toMatchObject({ status: "ready", step: 0 });
  });

  it("믹서 값을 트랙 게인에 반영한다", async () => {
    const player = new Player();
    await player.load(SONG);
    await player.init();
    // gains[0]은 마스터, 1~4가 melody·drums·bass·keys
    const tracks = SONG.tracks.map((t) =>
      t.id === "drums" ? { ...t, muted: true } : t,
    );
    player.applyMix(tracks);
    expect(fake.state.gains[2].setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      0,
      0.01,
    );
    expect(fake.state.gains[1].setTargetAtTime).toHaveBeenLastCalledWith(
      1,
      0,
      0.01,
    );
  });

  it("악기 이름이 바뀐 트랙만 다시 불러오고, 곡을 다시 받으면 Part를 새로 만든다", async () => {
    const player = new Player();
    await player.load(SONG);
    await player.init();
    const before = fake.state.instruments.length;
    const oldMelody = fake.state.instruments[0];

    const tracks = SONG.tracks.map((t) =>
      t.id === "melody" ? { ...t, instrument: "flute" } : t,
    );
    await player.load({ ...SONG, tracks });
    expect(fake.state.instruments).toHaveLength(before + 1);
    expect(fake.state.instruments.at(-1)!.name).toBe("flute");
    expect(oldMelody.dispose).toHaveBeenCalled();
    expect(fake.state.parts.filter((p) => !p.disposed)).toHaveLength(3);
  });

  it("상태가 바뀌면 구독자에게 알린다", async () => {
    const player = new Player();
    const listener = vi.fn();
    const unsubscribe = player.subscribe(listener);
    await player.init();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    player.seek(4);
    expect(listener).not.toHaveBeenCalled();
  });
});
