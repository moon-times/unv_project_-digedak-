// 런타임 검증용 Zod 스키마. 쓰는 곳:
// - /api/analyze 요청·LLM 응답 검증
// - Supabase에서 불러온 projects.song(jsonb) 검증
// 이 파일을 바꾸는 PR은 설명에 변경 사항을 적고 팀원 전체를 리뷰어로 지정합니다.
import { z } from "zod";
import {
  STYLES,
  TRACK_IDS,
  type AnalysisResult,
  type Chord,
  type Note,
  type SongState,
  type Track,
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
    })
    .optional(),
  tracks: z.array(TrackSchema),
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

/** POST /api/analyze 요청. analysis는 규칙 엔진 결과, request는 재추천 요청(선택 기능) */
export const AnalyzeRequestSchema = z.object({
  melody: z.array(NoteSchema),
  analysis: AnalysisResultSchema,
  request: z.string().max(200).optional(),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

/** POST /api/analyze 응답. 분석 결과와 같은 형식이고 explanation 또는 chords만 바뀝니다. */
export const AnalyzeResponseSchema = AnalysisResultSchema;
export type AnalyzeResponse = AnalysisResult;
