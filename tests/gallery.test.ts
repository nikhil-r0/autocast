import test from 'node:test';
import assert from 'node:assert/strict';
import { startVisualQAGallery } from '../src/review/gallery.js';

test('startVisualQAGallery serves HTML gallery and health check on port 8089', async () => {
  const gallery = await startVisualQAGallery({ port: 8089 });

  try {
    const healthRes = await fetch('http://localhost:8089/health');
    assert.equal(healthRes.ok, true);
    const healthBody: any = await healthRes.json();
    assert.equal(healthBody.gallery, 'autocast-visual-qa');

    const htmlRes = await fetch('http://localhost:8089/qa-gallery');
    assert.equal(htmlRes.ok, true);
    const htmlText = await htmlRes.text();
    assert.match(htmlText, /Autocast AI Visual QA Review Gallery/);
    assert.match(htmlText, /data-testid="qa-gallery-container"/);
  } finally {
    await gallery.stop();
  }
});
