const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  if (pathname === '/') pathname = '/index.html';

  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', broken: process.env.BROKEN || null }));
  }

  // Visual QA Review Endpoint for Kane (Loop 3)
  if (pathname === '/review') {
    const frame = parsedUrl.searchParams.get('frame') || '100';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Autocast Visual QA - Frame ${frame}</title>
  <style>
    body { margin: 0; background: #070b14; color: #f8fafc; font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
    .qa-header { width: 100%; max-width: 1400px; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; background: #0f172a; border-radius: 8px 8px 0 0; border: 1px solid rgba(255,255,255,0.1); box-sizing: border-box; }
    .qa-badge { background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #60a5fa; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; }
    .frame-wrapper { width: 100%; max-width: 1400px; background: #000; border: 1px solid rgba(255,255,255,0.1); border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
    img.preview { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <div class="qa-header">
    <div>
      <span class="qa-badge">LOOP 3 VISUAL QA</span>
      <span style="margin-left: 12px; font-weight: 600;">Remotion Render Review — Frame ${frame}</span>
    </div>
    <div style="font-size: 13px; color: #94a3b8;">Inspect for framing, element clipping, and sidebar readability</div>
  </div>
  <div class="frame-wrapper">
    <img class="preview" id="rendered-frame" src="/review-image?frame=${frame}" alt="Review Frame ${frame}" />
  </div>
</body>
</html>`);
  }

  // MP4 Video Review Endpoint with timestamp seeking (Loop 3)
  if (pathname === '/review-video') {
    const t = parsedUrl.searchParams.get('t') || '0';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Autocast MP4 Video QA - Time ${t}s</title>
  <style>
    body { margin: 0; background: #070b14; color: #f8fafc; font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
    .qa-header { width: 100%; max-width: 1400px; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; background: #0f172a; border-radius: 8px 8px 0 0; border: 1px solid rgba(255,255,255,0.1); box-sizing: border-box; }
    .qa-badge { background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #60a5fa; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; }
    .video-wrapper { width: 100%; max-width: 1400px; background: #000; border: 1px solid rgba(255,255,255,0.1); border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
    video { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <div class="qa-header">
    <div>
      <span class="qa-badge">LOOP 3 MP4 VIDEO QA</span>
      <span style="margin-left: 12px; font-weight: 600;">Direct File Review at ${t}s</span>
    </div>
    <div style="font-size: 13px; color: #94a3b8;">Verifying rendered MP4 encoding, transitions, and audio sync</div>
  </div>
  <div class="video-wrapper">
    <video id="mp4-player" controls autoplay muted src="/video-stream#t=${t}"></video>
  </div>
</body>
</html>`);
  }

  if (pathname === '/video-stream') {
    const videoPath = path.join(process.cwd(), 'out', 'demo.mp4');
    if (!fs.existsSync(videoPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Rendered video not found. Run render phase first.');
    }
    const stat = fs.statSync(videoPath);
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      return file.pipe(res);
    } else {
      const head = {
        'Content-Length': stat.size,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      return fs.createReadStream(videoPath).pipe(res);
    }
  }

  if (pathname === '/review-image') {
    const frame = parsedUrl.searchParams.get('frame') || '100';
    const reviewDir = path.join(process.cwd(), 'out', 'review');
    let targetFile = path.join(reviewDir, `frame-${frame}.png`);
    if (!fs.existsSync(targetFile)) {
      targetFile = path.join(reviewDir, 'test-frame.png');
    }
    if (fs.existsSync(targetFile)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return fs.createReadStream(targetFile).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Frame image not found. Ensure remotion still has rendered.');
    }
  }

  const filePath = path.join(PUBLIC_DIR, pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Inject runtime config into index.html so frontend knows if broken mode is active
    if (pathname === '/index.html') {
      fs.readFile(filePath, 'utf8', (readErr, content) => {
        if (readErr) {
          res.writeHead(500);
          return res.end('Server Error');
        }
        const brokenEnv = process.env.BROKEN || '';
        const injected = content.replace(
          '<!-- RUNTIME_CONFIG -->',
          `<script>window.__BROKEN_FLAG__ = "${brokenEnv}";</script>`
        );
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(injected);
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Invoice Demo App running at http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.BROKEN ? 'BROKEN (' + process.env.BROKEN + ')' : 'NORMAL'}`);
});
