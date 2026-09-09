#!/usr/bin/env node
/**
 * Nexara portable acceptance runner.
 *
 * Single cross-platform replacement for the former POSIX-only bash gates
 * (run-full-acceptance-audit.sh, run-all-acceptance-audit.sh,
 * run-p14-master-gate.sh, run-p15-real-catalog-gate.sh), so CI and every
 * developer machine execute the IDENTICAL gate definitions.
 *
 * Scopes:
 *   node scripts/run-acceptance.mjs        -> full P0-P17 + UI acceptance audit
 *   node scripts/run-acceptance.mjs p14    -> P14 testing master gate (fail-fast)
 *   node scripts/run-acceptance.mjs p15    -> P15 real initial catalog gate (fail-fast)
 *
 * Behavior preserved from the bash originals:
 *   - evidence logs under artifacts/audit/ (uploaded by CI),
 *   - accumulating pass/fail matrix for P0-P10,
 *   - fail-fast semantics for the scoped gates,
 *   - non-zero exit code when any mandatory step fails.
 */
import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const scope = process.argv[2] || 'all';
const stamp = () => new Date().toISOString();

class GateLog {
  constructor(relativePath) {
    this.path = join(ROOT, relativePath);
    mkdirSync(dirname(this.path), { recursive: true });
  }

  write(line) {
    process.stdout.write(line + '\n');
    const fd = openSync(this.path, 'a');
    try {
      writeSync(fd, line + '\n');
    } finally {
      closeSync(fd);
    }
  }
}

/** Streams one shell command's output into the evidence log; returns success. */
function run(command, log) {
  log.write('');
  log.write(`===== START: ${command} =====`);
  const fd = openSync(log.path, 'a');
  let result;
  try {
    result = spawnSync(command, { shell: true, cwd: ROOT, stdio: ['ignore', fd, fd] });
  } finally {
    closeSync(fd);
  }
  if (result.status === 0) {
    log.write(`===== PASS: ${command} =====`);
    return true;
  }
  const code = result.status === null ? `signal:${result.signal}` : result.status;
  log.write(`===== FAIL(${code}): ${command} =====`);
  return false;
}

/** P0-P10 matrix: every step runs even after a failure; the scope fails if any step failed. */
const P0_P10_MATRIX = [
  'npm run lint',
  'npm run test:p0',
  'npm run test:p1',
  'npm run test:p1:services',
  'npm run test:p1:runtime-data',
  'npm run test:p1:runtime-api',
  'npm run test:p1:mongo',
  'npm run test:p2',
  'npm run test:p2:mongodb',
  'npm run test:p2:seed',
  'npm run test:p3',
  'npm run test:p3:ingestion',
  'npm run test:p3:live',
  'npm run test:p4',
  'npm run test:p4:files',
  'npx tsx tests/p4.book-files-api.test.ts',
  'npx tsx tests/p4.catalog-files-isolation.test.ts',
  'npx tsx tests/p4.mongodb-migration.test.ts',
  'npm run test:p5',
  'npm run test:p5:reader',
  'npm run test:p5:performance',
  'npx tsx tests/p5.monotonic-server.test.ts',
  'npm run test:p6:security',
  'npm run test:p6:downloads',
  'npm run test:p7',
  'npm run test:p8',
  'npx tsx tests/p8.mongodb-auth-migration.test.ts',
  'npm run test:p9',
  'npm run test:p10',
  'npm run build',
  'pnpm audit --prod --audit-level high',
];

function runMatrix() {
  const log = new GateLog('artifacts/audit/p0-p10-execution.log');
  log.write('Nexara full acceptance audit');
  log.write(`Started: ${stamp()}`);
  let pass = 0;
  let fail = 0;
  for (const command of P0_P10_MATRIX) {
    if (run(command, log)) pass += 1;
    else fail += 1;
  }
  log.write('');
  log.write(`Summary: pass=${pass} fail=${fail}`);
  log.write(`Finished: ${stamp()}`);
  return fail === 0;
}

/** Fail-fast gate: stops at the first failing step, like `set -euo pipefail`. */
function runGate(title, logPath, steps) {
  const log = new GateLog(logPath);
  log.write(title);
  log.write(`Started: ${stamp()}`);
  for (const step of steps) {
    if (!run(step, log)) {
      log.write('');
      log.write(`Summary: FAIL ${title}`);
      log.write(`Finished: ${stamp()}`);
      return false;
    }
  }
  log.write('');
  log.write(`Summary: PASS ${title}`);
  log.write(`Finished: ${stamp()}`);
  return true;
}

function gateP14() {
  return runGate('Nexara P14 Testing Master Gate', 'artifacts/audit/p14-master-gate.log', [
    'npm run lint',
    'npm run build',
    'npm run test:p14:unit',
    'npm run test:p14:integration',
    'npm run test:p14:e2e',
  ]);
}

function gateP15() {
  return runGate('Nexara P15 Real Initial Catalog Gate', 'artifacts/audit/p15-real-catalog-gate.log', [
    'npm run lint',
    'npm run build',
    'npm run test:p15',
    'npm run test:p15:live',
  ]);
}

function gateAll() {
  if (!runMatrix()) {
    console.error('P0-P10 matrix failed; aborting before P11+ stages.');
    return false;
  }
  return runGate('Nexara full acceptance audit P0-P17 + UI', 'artifacts/audit/p0-p17-execution.log', [
    'npm run test:p11',
    'npm run test:p12',
    'npm run test:p13',
    'npx tsx scripts/audit-runtime-smoke.ts',
    'npm run test:p14:unit',
    'npm run test:p14:integration',
    'npm run test:p14:e2e',
    'npm run test:p15',
    'npm run test:p15:live',
    'npm run test:p16',
    'npm run test:p17',
    'npm run test:ui',
  ]);
}

const ok = scope === 'p14' ? gateP14() : scope === 'p15' ? gateP15() : gateAll();
process.exit(ok ? 0 : 1);