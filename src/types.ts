import { z } from 'zod';

export const TargetRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const CursorPathSchema = z.object({
  from: z.tuple([z.number(), z.number()]),
  to: z.tuple([z.number(), z.number()]),
  click: z.boolean(),
});

export const VideoSegmentSchema = z.object({
  kind: z.enum(['idle', 'action']),
  src_start: z.number(),
  src_end: z.number(),
  speed: z.number().default(1),
});

export const SceneSchema = z.object({
  id: z.string(),
  step_ref: z.string().optional(),
  caption: z.string(),
  narration: z.string(),
  audio: z.string().nullable().optional(),
  audio_sec: z.number().default(2.5),
  segments: z.array(VideoSegmentSchema),
  target: TargetRectSchema,
  camera: z.object({
    zoom: z.number().min(1.0).max(2.2).default(1.6),
  }),
  cursor: CursorPathSchema,
  hold_sec: z.number().default(0.4),
});

export const StoryboardMetaSchema = z.object({
  title: z.string(),
  fps: z.number().default(30),
  width: z.number().default(1920),
  height: z.number().default(1080),
  source: z.object({
    video: z.string(),
    width: z.number().default(1920),
    height: z.number().default(1080),
  }),
  music: z.string().nullable().optional(),
});

export const StoryboardSchema = z.object({
  meta: StoryboardMetaSchema,
  scenes: z.array(SceneSchema),
});

export type TargetRect = z.infer<typeof TargetRectSchema>;
export type CursorPath = z.infer<typeof CursorPathSchema>;
export type VideoSegment = z.infer<typeof VideoSegmentSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type StoryboardMeta = z.infer<typeof StoryboardMetaSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;

export interface KaneStep {
  stepNumber: number;
  kind: string;
  summary: string;
  durationMs: number;
  url?: string;
  elementRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  clickCoordinates?: {
    x: number;
    y: number;
  };
  selector?: string;
  timestamp?: string;
}

export interface KaneRunResult {
  passed: boolean;
  isProductDefect: boolean;
  resultCode: number;
  reasonCode: string;
  summary: string;
  sessionDir?: string;
  runDir?: string;
  evidencePack?: string;
  steps: KaneStep[];
  creditsConsumed?: number;
  testUrl?: string;
  errorMessage?: string;
}

