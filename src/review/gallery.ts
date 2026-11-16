import http from 'http';
import fs from 'fs';
import path from 'path';

export interface VisualQAGalleryOptions {
  port?: number;
  reviewDir?: string;
  storyboardPath?: string;
}

export function createGalleryHtml(frames: number[], storyboardMeta?: any): string {
  const cardsHtml = frames
    .map((frameNum) => {
      return `
    <div class="frame-card" data-testid="qa-frame-card-${frameNum}">
      <div class="card-header">
        <h3>Preview Frame ${frameNum}</h3>
        <span class="badge" data-testid="qa-status-frame-${frameNum}">Awaiting Kane Review</span>
      </div>
      <div class="image-wrapper">
        <img src="/frames/frame-${frameNum}.png" alt="Frame ${frameNum}" class="preview-img" data-testid="qa-img-${frameNum}" />
        <div class="safe-area-guide" data-testid="qa-safe-area-overlay" title="90% Action Safe Boundary"></div>
      </div>
      <div class="meta-row">
        <span>Frame: <strong>${frameNum}</strong></span>
        <span>Aspect: <strong>16:9 (1920x1080)</strong></span>
        <span>Resolution: <strong>1080p FHD</strong></span>
      </div>
      <div class="checklist">
        <p><strong>Kane Visual QA Verification Criteria:</strong></p>
        <ul>
          <li>Verify no application interface elements are cut off or clipped at left/right edges.</li>
          <li>Verify the workflow sidebar does not collide with the application window boundary.</li>
          <li>Verify typography and status badges are rendered crisply without artifact tearing.</li>
        </ul>
      </div>
    </div>
    `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Autocast AI - Visual QA Gallery</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      margin: 0;
      padding: 24px;
    }
    header {
      max-width: 1400px;
      margin: 0 auto 32px auto;
      border-bottom: 1px solid #334155;
      padding-bottom: 16px;
    }
    h1 { margin: 0 0 8px 0; font-size: 26px; color: #38bdf8; }
    p.subtitle { margin: 0; color: #94a3b8; font-size: 14px; }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(440px, 1fr));
      gap: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .frame-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      border-bottom: 1px solid #334155;
    }
    .card-header h3 { margin: 0; font-size: 16px; }
    .badge {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 6px;
      background: #3b82f6;
      color: #ffffff;
    }
    .image-wrapper {
      position: relative;
      background: #020617;
      aspect-ratio: 16 / 9;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .safe-area-guide {
      position: absolute;
      top: 5%;
      left: 5%;
      right: 5%;
      bottom: 5%;
      border: 1px dashed rgba(56, 189, 248, 0.4);
      pointer-events: none;
    }
    .meta-row {
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #cbd5e1;
      border-bottom: 1px solid #334155;
    }
    .checklist {
      padding: 14px 18px;
      font-size: 13px;
      color: #94a3b8;
    }
    .checklist ul { margin: 6px 0 0 18px; padding: 0; }
    .checklist li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ Autocast AI Visual QA Review Gallery</h1>
    <p class="subtitle">Loop 3 Autonomous Quality Gate — Machine Inspection by Kane CLI at 1080p</p>
  </header>
  <div class="gallery-grid" data-testid="qa-gallery-container">
    ${cardsHtml}
  </div>
</body>
</html>`;
}

export function startVisualQAGallery(options?: VisualQAGalleryOptions): Promise<{
  server: http.Server;
  url: string;
  port: number;
  stop: () => Promise<void>;
}> {
  const port = options?.port || 8081;
  const reviewDir = options?.reviewDir || path.resolve(process.cwd(), 'out', 'review');

  const server = http.createServer((req, res) => {
    const reqUrl = req.url || '/';

    if (reqUrl === '/qa-gallery' || reqUrl === '/') {
      let frames: number[] = [115, 204, 260];
      try {
        if (fs.existsSync(reviewDir)) {
          const files = fs.readdirSync(reviewDir);
          const found = files
            .filter((f) => f.startsWith('frame-') && f.endsWith('.png'))
            .map((f) => parseInt(f.replace('frame-', '').replace('.png', ''), 10))
            .filter((n) => !isNaN(n));
          if (found.length > 0) {
            frames = Array.from(new Set(found)).sort((a, b) => a - b);
          }
        }
      } catch {}

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(createGalleryHtml(frames));
      return;
    }

    if (reqUrl.startsWith('/frames/')) {
      const fileName = path.basename(reqUrl);
      const filePath = path.join(reviewDir, fileName);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        fs.createReadStream(filePath).pipe(res);
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Frame image not found');
        return;
      }
    }

    if (reqUrl === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', gallery: 'autocast-visual-qa' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return new Promise((resolve, reject) => {
    server.on('error', (err) => reject(err));
    server.listen(port, () => {
      const url = `http://localhost:${port}/qa-gallery`;
      console.log(`[Visual QA Gallery] Server live at ${url}`);
      resolve({
        server,
        url,
        port,
        stop: () =>
          new Promise((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}
