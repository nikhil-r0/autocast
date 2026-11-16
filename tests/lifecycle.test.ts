import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { LedgerlyLifecycleAdapter } from '../src/app/lifecycle.js';

test('TEST-16: Candidate server returns HTTP 200 but serves old commit hash -> Rejected', async () => {
  // Mock an HTTP server serving old commit
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', commit: 'old-commit-123' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(8091, resolve));

  const adapter = new LedgerlyLifecycleAdapter({ port: 8091 });
  const isHealthy = await adapter.healthCheck('candidate-commit-456');

  assert.equal(isHealthy, false, 'Health check must return false when commit does not match candidate commit');

  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('TEST-08: Server fails /api/health with non-200 OK -> Healthcheck returns false', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal error' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(8092, resolve));

  const adapter = new LedgerlyLifecycleAdapter({ port: 8092 });
  const isHealthy = await adapter.healthCheck();

  assert.equal(isHealthy, false, 'Health check must return false on HTTP 500');

  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('TEST-08b: Server connection refused (offline server) -> Healthcheck returns false', async () => {
  const adapter = new LedgerlyLifecycleAdapter({ port: 8099 });
  const isHealthy = await adapter.healthCheck();
  assert.equal(isHealthy, false, 'Health check must return false when server is completely down');
});

