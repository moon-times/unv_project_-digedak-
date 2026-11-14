// 런타임 검증용 Zod 스키마. 쓰는 곳:
// - /api/analyze 요청·LLM 응답 검증
// - Supabase에서 불러온 projects.song(jsonb) 검증
// 이 파일을 바꾸는 PR은 설명에 변경 사항을 적고 팀원 전체를 리뷰어로 지정합니다.
import { z } from "zod";
import {
  BASS_FEELS,
  DRUM_FEELS,
  GUITAR_FEELS,
  KEYS_FEELS,
  SECTION_ROLES,
  STYLES,
  TRACK_IDS,
  type AnalysisResult,
  type ArrangementPlan,
  type ArrangementSection,
  type Chord,
  type Note,
  type SongState,
  type Track,
  withAllTracks,
} from "@/types/song";

const step = z.number().int().min(0);
const length = z.number().int().min(1);

// 각 스키마에 타입을 붙여 두면 src/types/song.ts와 어긋날 때 타입 검사가 실패합니다.
export const NoteSchema: z.ZodType<Note> = z.object({
  pitch: z.number().int().min(0).max(127),
  start: step,
  duration: length,
  velocity: z.number().min(0).max(1),
});

export const ChordSchema: z.ZodType<Chord> = z.object({
  symbol: z.string().min(1),
  start: step,
  duration: length,
});

export const StyleSchema = z.enum(STYLES);

export const TrackSchema: z.ZodType<Track> = z.object({
  id: z.enum(TRACK_IDS),
  instrument: z.string(),
  volume: z.number(),
  muted: z.boolean(),
  solo: z.boolean(),
  effects: z
    .object({
      reverb: z.number().optional(),
      eqLow: z.number().optional(),
      eqHigh: z.number().optional(),
    })
    .optional(),
});

export const ArrangementSectionSchema: z.ZodType<ArrangementSection> = z.object(
  {
    startBar: step,
    endBar: length,
    role: z.enum(SECTION_ROLES),
    energy: z.literal([1, 2, 3, 4, 5]),
    drums: z.enum(DRUM_FEELS),
    bass: z.enum(BASS_FEELS),
    keys: z.enum(KEYS_FEELS),
    guitar: z.enum(GUITAR_FEELS),
    fillAtEnd: z.boolean(),
    crashAtStart: z.boolean(),
  },
);

/** LLM이 만드는 부분(enabled 제외). /api/retouch가 응답 검증에 씁니다. */
export const ArrangementDraftSchema = z.object({
  sections: z.array(ArrangementSectionSchema).max(64),
  endingHit: z.boolean(),
  summary: z.string().max(400),
});

export const ArrangementPlanSchema: z.ZodType<ArrangementPlan> =
  ArrangementDraftSchema.extend({ enabled: z.boolean() });

export const SongStateSchema: z.ZodType<SongState> = z.object({
  version: z.literal(1),
  title: z.string(),
  bpm: z.number().positive(),
  key: z.string(),
  timeSignature: z.tuple([
    z.number().int().positive(),
    z.number().int().positive(),
  ]),
  style: StyleSchema,
  melody: z.array(NoteSchema),
  chords: z.array(ChordSchema),
  explanation: z.string().optional(),
  accompaniment: z
    .object({
      drums: z.array(NoteSchema),
      bass: z.array(NoteSchema),
      keys: z.array(NoteSchema),
      // 기타 트랙 이전에 저장된 곡에는 없습니다.
      guitar: z.array(NoteSchema).default([]),
    })
    .optional(),
  arrangement: ArrangementPlanSchema.optional(),
  // 트랙이 늘어나기 전에 저장된 곡은 빠진 트랙을 기본값으로 채웁니다.
  tracks: z.array(TrackSchema).transform(withAllTracks),
  recording: z
    .object({
      path: z.string(),
      trimStart: z.number().optional(),
      trimEnd: z.number().optional(),
    })
    .optional(),
});

export const AnalysisResultSchema: z.ZodType<AnalysisResult> = z.object({
  key: z.string().min(1),
  chords: z.array(ChordSchema),
  recommendedStyle: StyleSchema,
  bpmSuggestion: z.number().positive(),
  explanation: z.string(),
});

/** POST /api/analyze 요청. analysis는 규칙 엔진 결과.
 * 서버가 LLM에 그대로 넘기므로 글자 수 · 개수에 상한을 둡니다 (가장 긴 코드 기호 "F#m7b5/A#"가 9자).
 */
export const AnalyzeRequestSchema = z.object({
  analysis: AnalysisResultSchema.refine(
    (a) =>
      a.explanation.length <= 1000 &&
      a.key.length <= 20 &&
      a.chords.length <= 512 &&
      a.chords.every((chord) => chord.symbol.length <= 12),
    "analysis가 너무 큽니다",
  ),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
