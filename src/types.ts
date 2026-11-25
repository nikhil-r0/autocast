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
  layout: z.enum(['split', 'hud', 'auto']).default('auto').optional(),
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

export interface CompiledScene {
  sceneId: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  camera: { zoom: number; panX: number; panY: number };
  targetRect: { x: number; y: number; w: number; h: number };
}

export interface AuthoritativeTimeline {
  fps: number;
  totalDurationFrames: number;
  scenes: CompiledScene[];
}

export interface StoryboardPatch {
  sceneId: string;
  issue: 'clipping' | 'sidebar_overlap' | 'excessive_zoom' | 'cursor' | 'other';
  adjustments: {
    zoom?: number;
    panX?: number;
    panY?: number;
    target?: { x: number; y: number; w: number; h: number };
    cursorTo?: [number, number];
    caption?: string;
  };
  reason: string;
}

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

export interface KaneVerdict {
  confirmed: boolean;
  family: string;
  category: string;
  severity: string;
  oneLiner: string;
  confidence: number;
}

export interface OutcomeSpec {
  id: string;
  verification:
    | { type: 'dom_text'; selector: string; expected: string }
    | { type: 'visible'; selector: string }
    | { type: 'url'; expected: string }
    | { type: 'api_state'; endpoint: string; jsonPath: string; expected: unknown };
}

export interface AcceptanceSpec {
  version: 1;
  title: string;
  objective: string;
  outcome_specs: OutcomeSpec[];
  target: {
    url: string;
    seed_id: string;
  };
  parties?: {
    client: string;
    contractor: string;
  };
  contract_id?: string;
  escrow_address?: string;
  milestone_id?: string;
}

export type OracleVerdict = 'release' | 'hold';

export type OracleHoldReason =
  | 'kane_failed'
  | 'state_mismatch'
  | 'commit_mismatch'
  | 'spec_mismatch'
  | 'timeout';

export interface OracleManifestSection {
  spec_sha256: string;
  seed_id: string;
  expected_commit: string;
  runner_id: string;
  verdict: OracleVerdict;
  hold_reason?: OracleHoldReason;
}

export interface ManifestSignature {
  alg: 'ed25519';
  key_id: string;
  sig: string;
}

export type FailureCategory =
  | 'pass'
  | 'confirmed_product_bug'
  | 'unconfirmed_failure'
  | 'cli_configuration_error'
  | 'timeout'
  | 'cancelled';

export interface KaneRunResult {
  passed: boolean;
  category: FailureCategory;
  isProductDefect: boolean;
  exitCode: number;
  resultCode?: number;
  reasonCode?: string;
  summary: string;
  verdict?: KaneVerdict;
  claims?: Array<{ id: string; claim: string; passed: boolean }>;
  sessionDir?: string;
  runDir?: string;
  evidencePack?: string;
  steps: KaneStep[];
  creditsConsumed?: number;
  testUrl?: string;
  errorMessage?: string;
  rawEvents?: any[];
}

export interface AgentRepairRequest {
  worktreeDir: string;
  appRelativePath: string; // e.g. "examples/ledgerly"
  objective: string;
  verdict?: { family: string; category: string; oneLiner: string; severity: string };
  failingStep?: string;
  evidence: {
    sessionDir: string;
    evidencePackPath?: string;
    failureScreenshot?: string;
    consoleLogs?: string[];
    networkErrors?: string[];
  };
  constraints: {
    allowedDirectories: string[];
    protectedPaths: string[];
    maxRepairAttempts: number; // max 2
  };
}

export interface AgentRepairResult {
  success: boolean;
  candidateCommit?: string;
  worktreeDir?: string;
  repairBranch?: string;
  diffSummary?: string;
  error?: string;
}

export interface AppLifecycleAdapter {
  name: string;
  appDir: string;
  start: (opts?: { env?: Record<string, string>; commit?: string }) => Promise<{ pid: number; port: number; commit?: string }>;
  stop: () => Promise<void>;
  healthCheck: (expectedCommit?: string) => Promise<boolean>;
  getHealthInfo?: () => Promise<{ ok: boolean; commit?: string; bug?: string | null } | null>;
  resetSeedData: (seedId?: string) => Promise<void>;
  verifyUnderlyingState: (expected?: Record<string, any> | OutcomeSpec[]) => Promise<boolean>;
}

export interface RunManifest {
  autocast_version: string;
  run_id?: string;
  generated_at: string;
  mode?: 'demo' | 'oracle';
  status: 'verified' | 'unverified_draft' | 'quarantined' | 'failed';
  application: {
    url: string;
    baseline_commit?: string;
    tested_commit?: string;
    integration_commit?: string;
    state_verified: boolean;
  };
  kane_verification?: {
    run_id: string;
    session_id?: string;
    evidence_pack?: string;
    result_code?: number;
    credits_consumed?: number;
    share_url?: string;
    test_url?: string;
    claims?: Array<{ id: string; claim: string; passed: boolean }>;
    initial_failure?: {
      result_code: number;
      share_url?: string;
      session_id?: string;
    };
    post_repair?: {
      result_code: number;
      share_url?: string;
      session_id?: string;
    };
  };
  closed_loop_repair?: {
    occurred: boolean;
    initial_failure?: string;
    initial_share_url?: string;
    agent?: string;
    candidate_commit?: string;
    integration_commit?: string;
    repair_branch?: string;
    patch_file?: string;
    re_verification_run_id?: string;
    re_verification_share_url?: string;
  };
  visual_qa?: {
    status: 'passed' | 'flagged';
    attempts: number;
    patch?: StoryboardPatch;
    rechecked_frames?: number[];
    flagged_frames?: number[];
  };
  security_scan?: {
    status: 'clean' | 'secrets_detected';
    ocr_frames_scanned: number;
    quarantined?: boolean;
  };
  oracle?: OracleManifestSection;
  artifacts: {
    video?: {
      path: string;
      sha256: string;
      size_bytes: number;
    };
    poster?: {
      path: string;
      sha256: string;
    };
  };
  signature?: ManifestSignature;
}


