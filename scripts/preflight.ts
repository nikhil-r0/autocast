import { runPreflightAudit } from '../src/preflight.js';

try {
  const allowDirty = process.argv.includes('--allow-dirty') || process.env.ALLOW_DIRTY === 'true';
  runPreflightAudit({ allowDirty, runTests: true });
} catch (err: any) {
  console.error(`\n❌ PREFLIGHT AUDIT FAILED: ${err.message}`);
  process.exit(1);
}
