import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runtimeRoots = [join(root, 'src'), join(root, 'server'), join(root, 'server.ts')];
const extension = /\.(ts|tsx)$/;
// Browser preference storage and LocalStorageProvider are real infrastructure, not test data. This gate targets only runtime fixtures or fabricated identities/data.
const forbidden = /mockDatabase|INITIAL_|\bmock\b|\bdemo\b|\bfake\b|\bdummy\b|sample records|sample users|sample reviews|test-reader|test\.local|Guest Reader|قارئ ضيف|saveLocalBackup|saveLocalUserDataBackup/i;

function collect(path: string): string[] {
  const metadata = statSync(path);
  if (metadata.isFile()) return extension.test(path) ? [path] : [];
  return readdirSync(path).flatMap((name) => collect(join(path, name)));
}

const violations = runtimeRoots.flatMap(collect).flatMap((path) => {
  const source = readFileSync(path, 'utf8');
  return source.split('\n').flatMap((line, index) => forbidden.test(line) ? [`${path.replace(root + '/', '')}:${index + 1}: ${line.trim()}`] : []);
});

assert.deepEqual(violations, [], `P1 runtime-data gate found forbidden production-path markers:\n${violations.join('\n')}`);
console.log('P1 runtime-data gate passed.');
