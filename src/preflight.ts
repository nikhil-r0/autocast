import { execSync } from 'child_process';

export interface PreflightOptions {
  allowDirty?: boolean;
  runTests?: boolean;
}

export function runPreflightAudit(options: PreflightOptions = {}) {
  console.log('================================================================');
  console.log('🔍 AUTOCAST PREFLIGHT & INTEGRITY AUDITOR');
  console.log('   "Verifying environment, git state, type safety, and test suite"');
  console.log('================================================================\n');

  // 1. Git Branch Check
  let branch = '';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (err: any) {
    throw new Error(`Failed to inspect current git branch: ${err.message}`);
  }

  console.log(`✓ Check 1: Git Branch -> '${branch}'`);
  if (branch !== 'main' && !options.allowDirty) {
    throw new Error(`Active branch is '${branch}'. Expected 'main'. AutoCast demo must start from clean 'main'.`);
  }

  // 2. Git Working Directory Cleanliness
  let porcelain = '';
  try {
    porcelain = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  } catch (err: any) {
    throw new Error(`Failed to inspect git status: ${err.message}`);
  }

  console.log(`✓ Check 2: Git Working Directory -> ${porcelain ? 'DIRTY' : 'CLEAN'}`);
  if (porcelain && !options.allowDirty) {
    throw new Error(`Git working tree is dirty:\n${porcelain}\nPlease commit or stash all changes before demo execution.`);
  }

  // 3. Remote Sync Check - Explicitly fetch origin/main
  console.log('[Preflight] Fetching latest origin/main...');
  try {
    execSync('git fetch origin main', { stdio: 'ignore' });
  } catch (err: any) {
    if (!options.allowDirty) {
      throw new Error(`Failed to fetch latest remote reference via 'git fetch origin main': ${err.message}`);
    } else {
      console.warn(`[Preflight] Warning: git fetch origin main failed: ${err.message}`);
    }
  }

  let localCommit = '';
  let remoteCommit = '';
  try {
    localCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    remoteCommit = execSync('git rev-parse origin/main', { encoding: 'utf-8' }).trim();
  } catch (err: any) {
    if (!options.allowDirty) {
      throw new Error(`Failed to resolve local HEAD or origin/main commit: ${err.message}`);
    }
  }

  console.log(`✓ Check 3: Local Commit -> ${localCommit.slice(0, 10)}`);
  console.log(`✓ Check 4: Remote Commit -> ${remoteCommit.slice(0, 10)}`);
  if (localCommit !== remoteCommit && !options.allowDirty) {
    throw new Error(
      `Local commit (${localCommit}) differs from origin/main (${remoteCommit}). Please synchronize with remote repository.`
    );
  }

  // 4. Typecheck
  console.log('\n[Preflight] Running TypeScript typecheck...');
  try {
    execSync('npm run typecheck', { stdio: 'inherit' });
    console.log('✓ Check 5: TypeScript Compilation -> 0 errors');
  } catch {
    throw new Error('TypeScript compilation failed.');
  }

  // 5. Test Suite
  if (options.runTests !== false) {
    console.log('\n[Preflight] Running unit test regression suite...');
    try {
      const testOut = execSync('npm test 2>&1', { encoding: 'utf-8' });
      const passMatch = testOut.match(/ℹ pass (\d+)/);
      const failMatch = testOut.match(/ℹ fail (\d+)/);
      const totalMatch = testOut.match(/ℹ tests (\d+)/);
      const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
      const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
      const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

      if (failed > 0 || passed !== total || passed === 0) {
        throw new Error(`Tests failed: ${passed}/${total} passed, ${failed} failed.`);
      }
      console.log(`✓ Check 6: Test Suite -> ${passed}/${total} tests passed (0 failures)`);
    } catch (err: any) {
      throw new Error(`Test suite execution failed: ${err.message}`);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 ALL PREFLIGHT AUDITS PASSED: READY FOR SELF-DEMO RUN');
  console.log('================================================================');
}
