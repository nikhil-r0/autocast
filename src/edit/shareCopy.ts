import * as fs from 'fs';
import * as path from 'path';

export function shareCopyText(title: string): string {
  return [
    `Title: ${title} — Demos that can't lie`,
    '',
    'Post:',
    'One prompt in. Kane proves the flow in a real browser. If the check fails, Autocast renders no video.',
    '',
    'YouTube description:',
    `${title}. Autocast renders a demo only after Kane CLI passes. Stop-on-bug means a failed check produces a bug report and no MP4.`,
    '',
  ].join('\n');
}

export function writeShareCopy(outDir: string, title: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'share-copy.txt');
  fs.writeFileSync(file, shareCopyText(title));
  return file;
}
