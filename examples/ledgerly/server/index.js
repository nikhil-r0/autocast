import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { SEED_INVOICES, INITIAL_METRICS, DEMO_CLOCK, SEED_VENDORS } from './seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
let DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORT = process.env.PORT || 8080;

// Ensure build exists before serving; if in a worktree, fall back to main repo dist
if (!fs.existsSync(DIST_DIR) || !fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  const mainDist = path.resolve(process.cwd(), 'examples/ledgerly/dist');
  if (fs.existsSync(mainDist) && fs.existsSync(path.join(mainDist, 'index.html'))) {
    DIST_DIR = mainDist;
  } else {
    console.log('[Server] Built assets not found in dist/. Running initial build...');
    execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// In-memory state
let currentInvoices = JSON.parse(JSON.stringify(SEED_INVOICES));
let currentMetrics = JSON.parse(JSON.stringify(INITIAL_METRICS));

function getSimulatedDelay(baseMs) {
  if (process.env.APP_BUG === 'slow-network') {
    return 4000;
  }
  return baseMs;
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'ledgerly',
    clock: DEMO_CLOCK,
    commit: process.env.APP_COMMIT || 'development',
    bug: process.env.APP_BUG || null,
    invoicesCount: currentInvoices.length,
    pendingCount: currentMetrics.pendingApprovals,
  });
});

// 2. Reset database state
app.post(['/api/reset', '//api/reset'], (req, res) => {
  currentInvoices = JSON.parse(JSON.stringify(SEED_INVOICES));
  currentMetrics = JSON.parse(JSON.stringify(INITIAL_METRICS));
  res.json({ success: true, message: 'Ledgerly seed state restored', clock: DEMO_CLOCK });
});

// 3. Get metrics
app.get('/api/metrics', async (req, res) => {
  const delay = getSimulatedDelay(600);
  await new Promise((r) => setTimeout(r, delay));
  res.json(currentMetrics);
});

// 4. Get vendors list
app.get('/api/vendors', async (req, res) => {
  const delay = getSimulatedDelay(400);
  await new Promise((r) => setTimeout(r, delay));
  res.json(SEED_VENDORS);
});

// 5. Get invoices with filter & search
app.get('/api/invoices', async (req, res) => {
  const delay = getSimulatedDelay(750);
  await new Promise((r) => setTimeout(r, delay));

  const { status, vendor, search } = req.query;
  let filtered = [...currentInvoices];

  if (status && status !== 'All') {
    filtered = filtered.filter((inv) => inv.status.toLowerCase() === String(status).toLowerCase());
  }

  if (vendor && vendor !== 'All') {
    filtered = filtered.filter((inv) => inv.vendor === vendor);
  }

  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter((inv) =>
      inv.id.toLowerCase().includes(q) ||
      inv.vendor.toLowerCase().includes(q) ||
      inv.vendorCategory.toLowerCase().includes(q) ||
      inv.department.toLowerCase().includes(q)
    );
  }

  // Handle layout-overflow bug injection: inflate vendor name without truncation
  if (process.env.APP_BUG === 'layout-overflow') {
    filtered = filtered.map((inv) => {
      if (inv.id === 'INV-1042') {
        return {
          ...inv,
          vendor: 'Apex-Cloud-Global-Enterprise-High-Throughput-Distributed-Infrastructure-Systems-Corporation-Limited',
        };
      }
      return inv;
    });
  }

  res.json(filtered);
});

// 6. Get single invoice
app.get('/api/invoices/:id', async (req, res) => {
  const delay = getSimulatedDelay(500);
  await new Promise((r) => setTimeout(r, delay));

  const invoice = currentInvoices.find((inv) => inv.id === req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  res.json(invoice);
});

// 7. Approve single invoice
app.post('/api/invoices/:id/approve', async (req, res) => {
  const delay = getSimulatedDelay(850);
  await new Promise((r) => setTimeout(r, delay));

  const { id } = req.params;
  const { note } = req.body;
  const invoice = currentInvoices.find((inv) => inv.id === id);

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  // Bug Injection: approve-noop (returns success toast payload, but leaves status Pending)
  if (process.env.APP_BUG === 'approve-noop') {
    return res.json({
      success: true,
      id,
      status: invoice.status, // stays Pending!
      message: `Invoice ${id} approved`,
    });
  }

  const prevStatus = invoice.status;
  invoice.status = 'Approved';
  invoice.approvalNote = note || 'Approved via standard executive authorization';
  invoice.approvedAt = `${DEMO_CLOCK}T10:30:00Z`;

  // Bug Injection: stale-kpi (does not decrement pendingApprovals)
  if (process.env.APP_BUG !== 'stale-kpi') {
    if (prevStatus === 'Pending') {
      currentMetrics.pendingApprovals = Math.max(0, currentMetrics.pendingApprovals - 1);
      currentMetrics.pendingAmount = Math.max(0, currentMetrics.pendingAmount - invoice.amount);
      currentMetrics.approvedThisMonth += invoice.amount;
    }
  }

  res.json({
    success: true,
    id,
    status: invoice.status,
    invoice,
    metrics: currentMetrics,
    message: `Invoice ${id} approved`,
  });
});

// 8. Bulk approve
app.post('/api/invoices/bulk-approve', async (req, res) => {
  const delay = getSimulatedDelay(1100);
  await new Promise((r) => setTimeout(r, delay));

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  let approvedCount = 0;
  for (const id of ids) {
    const inv = currentInvoices.find((i) => i.id === id);
    if (inv && inv.status === 'Pending') {
      inv.status = 'Approved';
      inv.approvalNote = 'Bulk approved';
      inv.approvedAt = `${DEMO_CLOCK}T10:35:00Z`;
      currentMetrics.pendingApprovals = Math.max(0, currentMetrics.pendingApprovals - 1);
      currentMetrics.pendingAmount = Math.max(0, currentMetrics.pendingAmount - inv.amount);
      currentMetrics.approvedThisMonth += inv.amount;
      approvedCount++;
    }
  }

  res.json({
    success: true,
    approvedCount,
    metrics: currentMetrics,
    message: `Successfully approved ${approvedCount} invoice(s)`,
  });
});

// 9. Retry failed payment (Flow 5)
app.post('/api/invoices/:id/retry-payment', async (req, res) => {
  const delay = getSimulatedDelay(900);
  await new Promise((r) => setTimeout(r, delay));

  const invoice = currentInvoices.find((inv) => inv.id === req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  delete invoice.paymentError;
  invoice.status = 'Approved';
  invoice.approvedAt = `${DEMO_CLOCK}T10:40:00Z`;
  invoice.approvalNote = 'Payment re-authorized via secondary bank transit route';

  res.json({
    success: true,
    invoice,
    message: `Payment re-authorized successfully for ${invoice.id}`,
  });
});

// 10. Export CSV report (Flow 4)
app.post('/api/export', async (req, res) => {
  const delay = getSimulatedDelay(1000);
  await new Promise((r) => setTimeout(r, delay));

  const { dateRange = 'Nov 1 - Nov 16, 2026' } = req.body;

  res.json({
    success: true,
    fileName: `ledgerly-export-${DEMO_CLOCK}.csv`,
    fileSize: '142.8 KB',
    rowCount: currentInvoices.length,
    generatedAt: `${DEMO_CLOCK}T10:45:00Z`,
    range: dateRange,
    message: 'Export CSV generation complete',
  });
});

// 11. Loop 3 Visual QA Frame Inspection Endpoint
app.get('/review', (req, res) => {
  const frame = req.query.frame || '100';
  res.type('html').send(`<!DOCTYPE html>
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
});

// 12. Serve rendered still frame image
app.get('/review-image', (req, res) => {
  const frame = req.query.frame || '100';
  const reviewDir = path.join(process.cwd(), 'out', 'review');
  let targetFile = path.join(reviewDir, `frame-${frame}.png`);
  if (!fs.existsSync(targetFile)) {
    targetFile = path.join(reviewDir, 'test-frame.png');
  }
  if (fs.existsSync(targetFile)) {
    res.type('png');
    return fs.createReadStream(targetFile).pipe(res);
  } else {
    return res.status(404).type('text').send('Frame image not found. Ensure Remotion still has rendered.');
  }
});

// 13. Loop 3 MP4 Video Review Endpoint
app.get('/review-video', (req, res) => {
  const t = req.query.t || '0';
  res.type('html').send(`<!DOCTYPE html>
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
});

// 14. MP4 Video Stream with Range Requests
app.get('/video-stream', (req, res) => {
  const videoPath = path.join(process.cwd(), 'out', 'demo.mp4');
  if (!fs.existsSync(videoPath)) {
    return res.status(404).type('text').send('Rendered video not found. Run render phase first.');
  }
  const stat = fs.statSync(videoPath);
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    return file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'video/mp4',
    });
    return fs.createReadStream(videoPath).pipe(res);
  }
});

// Serve frontend assets
app.use(express.static(DIST_DIR));

app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`⚡ LEDGERLY INVOICE APPROVAL SAAS IS LIVE`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   Demo Clock: ${DEMO_CLOCK}`);
  console.log(`   Active Bug Injection: ${process.env.APP_BUG || 'none (clean)'}`);
  console.log(`================================================================`);
});
