#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const phase = process.argv[2];
if (!phase) {
  console.error('Usage: pnpm phase:verify <phase>');
  process.exit(1);
}

const phaseId = phase.padStart(2, '0');
const root = process.cwd();
const evidenceDir = join(root, 'evidence', `phase-${phaseId}`);
const metadataPath = join(evidenceDir, 'metadata.json');
const resultsPath = join(evidenceDir, 'command-results.json');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(metadataPath) || !existsSync(resultsPath)) {
  fail(`Missing evidence for phase ${phaseId}. Run: pnpm phase:run ${phaseId}`);
}

const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
const headSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

if (metadata.commitSha !== headSha) {
  fail(`Evidence SHA ${metadata.commitSha} does not match HEAD ${headSha}`);
}

const required = new Set(metadata.requiredSuites ?? []);
const byName = new Map(results.map((item) => [item.name, item]));

let blocked = false;
const failures = [];

for (const name of required) {
  const item = byName.get(name);
  if (!item) {
    failures.push(`missing suite result: ${name}`);
    continue;
  }
  if (item.blocked) {
    blocked = true;
    continue;
  }
  if (item.exitCode !== 0) {
    failures.push(`${name} exited ${item.exitCode}`);
  }
  if (!existsSync(join(evidenceDir, item.logPath))) {
    failures.push(`${name} log missing`);
  }
}

// Phase 00 docker-health may be blocked without Docker; that does not fail the whole phase,
// but must be reported as BLOCKED for the Docker acceptance criterion.
const docker = byName.get('docker-health');
const dockerBlocked = Boolean(docker?.blocked || (docker && docker.exitCode === 2));
const dockerFailed = Boolean(docker && docker.exitCode !== 0 && docker.exitCode !== 2);

if (dockerFailed) {
  failures.push('docker-health failed (containers unhealthy)');
}

let status = 'PASS';
if (failures.length > 0) {
  status = 'FAIL';
} else if (blocked || dockerBlocked) {
  // For phase 00, core pipeline can PASS while docker is BLOCKED if Docker is unavailable.
  // Spec: missing external prerequisite => BLOCKED for that integration; phase can complete
  // internal parts but not claim full PASS if docker is an acceptance criterion.
  // Phase 00 acceptance requires docker local — so overall status is BLOCKED when docker missing.
  status = dockerBlocked ? 'BLOCKED' : 'PASS';
}

const knownIssues = [];
if (dockerBlocked) {
  knownIssues.push(
    'Docker unavailable or not running; local Postgres/Redis/MinIO health not verified.',
  );
}
if (failures.length > 0) {
  knownIssues.push(...failures);
}

const generated = `# Phase ${phaseId} Result

Status: ${status}
Commit: ${metadata.commitSha}
Environment: ${metadata.environment}

## Completed
- Monorepo foundation commands captured by phase:run

## Commands executed
${results
  .map(
    (item) =>
      `- ${item.name}: exit ${item.exitCode}${item.blocked ? ' (BLOCKED)' : ''} — ${item.command}`,
  )
  .join('\n')}

## Test results
Parsed from command-results.json (JUnit not required for Phase 00 unit smoke).

## Known issues
${knownIssues.length > 0 ? knownIssues.map((issue) => `- ${issue}`).join('\n') : '- None'}

## Honest conclusion
${
  status === 'PASS'
    ? 'All mandatory Phase 00 checks passed.'
    : status === 'BLOCKED'
      ? 'Core toolchain checks passed, but a required local infrastructure prerequisite is missing.'
      : 'One or more mandatory checks failed.'
}
`;

writeFileSync(join(evidenceDir, 'PHASE_RESULT.generated.md'), generated);

console.log(generated);

if (status === 'FAIL') {
  process.exit(1);
}

if (status === 'BLOCKED') {
  process.exit(3);
}
