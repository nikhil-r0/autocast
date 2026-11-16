import * as fs from 'fs';
import * as path from 'path';
import { StoryboardSchema, Storyboard } from '../types.js';

export interface LintResult {
  valid: boolean;
  errors: string[];
}

export function lintStoryboard(storyboardOrPath?: Storyboard | string): LintResult {
  let data: any;

  if (typeof storyboardOrPath === 'string' || !storyboardOrPath) {
    const filePath = storyboardOrPath || path.join(process.cwd(), 'storyboard.json');
    if (!fs.existsSync(filePath)) {
      return { valid: false, errors: [`Storyboard file not found: ${filePath}`] };
    }
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e: any) {
      return { valid: false, errors: [`JSON Parse error in storyboard: ${e.message}`] };
    }
  } else {
    data = storyboardOrPath;
  }

  const errors: string[] = [];

  // 1. Zod Schema validation
  const parsed = StoryboardSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`[Schema] ${issue.path.join('.')}: ${issue.message}`);
    }
    return { valid: false, errors };
  }

  const storyboard: Storyboard = parsed.data;

  // 2. Business constraints check
  if (storyboard.scenes.length === 0) {
    errors.push('[Constraint] Storyboard has 0 scenes. Video must have at least 1 scene.');
  }

  const { width, height } = storyboard.meta;

  for (let idx = 0; idx < storyboard.scenes.length; idx++) {
    const s = storyboard.scenes[idx];
    const prefix = `[Scene ${idx + 1} (${s.id})]`;

    // Target bounds
    if (s.target.x < 0 || s.target.x + s.target.w > width) {
      errors.push(`${prefix} target rect x/width out of bounds: (${s.target.x}, ${s.target.w}) max ${width}`);
    }
    if (s.target.y < 0 || s.target.y + s.target.h > height) {
      errors.push(`${prefix} target rect y/height out of bounds: (${s.target.y}, ${s.target.h}) max ${height}`);
    }

    // Zoom cap
    if (s.camera.zoom > 2.0) {
      errors.push(`${prefix} zoom level ${s.camera.zoom} exceeds max safe cap 2.0 (causes soft footage).`);
    }

    // Scene duration
    if (s.audio_sec < 1.0) {
      errors.push(`${prefix} audio_sec ${s.audio_sec} is shorter than 1.0s.`);
    }

    // Cursor path bounds
    if (s.cursor.to[0] < 0 || s.cursor.to[0] > width || s.cursor.to[1] < 0 || s.cursor.to[1] > height) {
      errors.push(`${prefix} cursor target (${s.cursor.to[0]}, ${s.cursor.to[1]}) is out of screen.`);
    }
  }

  const valid = errors.length === 0;
  if (!valid) {
    console.error(`[Lint Loop] ❌ Storyboard lint failed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log(`[Lint Loop] ✓ Storyboard passed all lint checks.`);
  }

  return { valid, errors };
}

// Standalone CLI runner: npm run lint:storyboard
if (process.argv[1] && process.argv[1].endsWith('lint.ts')) {
  const result = lintStoryboard();
  if (!result.valid) {
    process.exit(1);
  }
}

