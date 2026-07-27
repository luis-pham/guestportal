#!/usr/bin/env node
import { spawnSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, cpSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const evidenceDir = join(root, 'evidence', 'phase-03');
const taskDir = join(evidenceDir, '03.7');
mkdirSync(join(taskDir, 'screenshots'), { recursive: true });
mkdirSync(join(evidenceDir, 'screenshots'), { recursive: true });
mkdirSync(join(evidenceDir, 'logs'), { recursive: true });

function loadEnv() {
  const env = { ...process.env };
  delete env.NODE_ENV;
  const path = join(root, '.env');
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (k === 'NODE_ENV') continue;
    env[k] = v;
  }
  return env;
}

const env = loadEnv();
const startedAt = new Date().toISOString();
const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

const suites = [
  { name: 'migrate', command: 'pnpm db:migrate' },
  { name: 'seed', command: 'pnpm db:seed' },
  { name: 'contracts-unit', command: 'pnpm --filter @guestportal/contracts test' },
  { name: 'integration', command: 'pnpm test:integration' },
  { name: 'r2-staging', command: 'pnpm --filter @guestportal/storage test:r2:staging' },
  { name: 'build-api', command: 'pnpm --filter @guestportal/api build' },
  { name: 'build-admin', command: 'pnpm --filter @guestportal/admin-web build' },
  { name: 'e2e-admin', command: 'node scripts/run-admin-e2e.mjs' },
];

const commandResults = [];
let hardFailure = false;

for (const suite of suites) {
  const start = new Date().toISOString();
  console.log(`\n▶ ${suite.name}: ${suite.command}`);
  const result = spawnSync(suite.command, {
    shell: true,
    cwd: root,
    encoding: 'utf8',
    env,
  });
  const out = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(join(evidenceDir, 'logs', `${suite.name}.log`), out);
  writeFileSync(join(taskDir, `${suite.name}.log`), out);
  const exitCode = result.status ?? 1;
  commandResults.push({
    name: suite.name,
    command: suite.command,
    startedAt: start,
    finishedAt: new Date().toISOString(),
    exitCode,
  });
  if (exitCode !== 0) {
    console.error(`✖ ${suite.name} failed (${exitCode})`);
    hardFailure = true;
    break;
  }
  console.log(`✔ ${suite.name}`);
}

// Collect screenshots from prior task evidence
for (const folder of ['03.4/screenshots', '03.5/screenshots']) {
  const src = join(evidenceDir, folder);
  if (!existsSync(src)) continue;
  for (const file of readdirSync(src)) {
    if (!file.endsWith('.png')) continue;
    cpSync(join(src, file), join(taskDir, 'screenshots', file));
    cpSync(join(src, file), join(evidenceDir, 'screenshots', file));
  }
}

const finishedAt = new Date().toISOString();
const metadata = {
  phase: '03',
  commitSha,
  startedAt,
  finishedAt,
  environment: process.env.CI ? 'ci' : 'local',
  requiredSuites: suites.map((s) => s.name),
  r2IntegrationLevel: 'REAL_STAGING',
};

writeFileSync(join(evidenceDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
writeFileSync(
  join(evidenceDir, 'command-results.json'),
  `${JSON.stringify(commandResults, null, 2)}\n`,
);

const passed = commandResults.every((item) => item.exitCode === 0) && !hardFailure;
const report = `# Phase 03 Gate Result

## Classification

**${passed ? 'PASS' : 'FAIL'}**

## Suites

${commandResults.map((item) => `- ${item.name}: exit ${item.exitCode}`).join('\n')}

## Notes

- R2 provider evidence: REAL_STAGING
- Screenshots collected from 03.4/03.5 builder + preview viewports
- Full admin E2E covers property setup, branding upload, builder, preview, publish/rollback

Generated at ${finishedAt}
`;

writeFileSync(join(evidenceDir, 'PHASE_RESULT.generated.md'), report);
writeFileSync(join(taskDir, 'PHASE_RESULT.generated.md'), report);
writeFileSync(join(taskDir, 'TASK_RESULT.md'), `# Task 03.7 — Phase 03 end-to-end evidence

## Result

**${passed ? 'PASS' : 'FAIL'}**

## Dependency

Task 03.6 \`PASS\`

## Gate summary

See \`evidence/phase-03/PHASE_RESULT.generated.md\` and command logs in this folder.

## Classification

**${passed ? 'PASS' : 'FAIL'}**
`);

console.log(report);
process.exit(passed ? 0 : 1);
