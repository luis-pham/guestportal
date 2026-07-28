#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const root = process.cwd();
const reportPath =
  process.env.SECRET_SCAN_REPORT ??
  resolve(root, 'evidence/phase-10/10.1/security/secret-scan.json');

const binaryExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webp',
  '.woff',
  '.woff2',
]);

const skippedPathPatterns = [
  /^apps\/[^/]+\/dist\//,
  /^packages\/[^/]+\/dist\//,
  /^apps\/embedding-service\/\.venv\//,
  /^evidence\/.*\/screenshots\//,
  /^evidence\/.*\/logs\//,
];

const secretPatterns = [
  { id: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/ },
  { id: 'openai-api-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
  { id: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'slack-token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { id: 'database-url-with-password', pattern: /\bpostgres(?:ql)?:\/\/[^/\s:@]+:[^@\s]+@/ },
];

function candidateFiles() {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
  })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function shouldSkip(file) {
  if (binaryExtensions.has(extname(file).toLowerCase())) return true;
  return skippedPathPatterns.some((pattern) => pattern.test(file));
}

const findings = [];
let scannedFiles = 0;

for (const file of candidateFiles()) {
  if (shouldSkip(file)) continue;
  let text;
  try {
    text = readFileSync(resolve(root, file), 'utf8');
  } catch {
    continue;
  }
  scannedFiles += 1;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { id, pattern } of secretPatterns) {
      if (pattern.test(line)) {
        findings.push({
          id,
          file,
          line: index + 1,
        });
      }
    }
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  scannedFiles,
  findingCount: findings.length,
  findings,
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (findings.length > 0) {
  console.error(`Secret scan failed with ${findings.length} finding(s).`);
  console.error(`Report: ${reportPath}`);
  process.exit(1);
}

console.log(`Secret scan passed. Scanned ${scannedFiles} candidate text files.`);
console.log(`Report: ${reportPath}`);
