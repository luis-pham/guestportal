#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const evidenceDir = join(root, 'evidence', 'phase-06');
const taskDir = join(evidenceDir, '06.5');
const logsDir = join(taskDir, 'logs');
const screenshotsDir = join(taskDir, 'screenshots');
mkdirSync(logsDir, { recursive: true });
mkdirSync(screenshotsDir, { recursive: true });
mkdirSync(join(evidenceDir, 'logs'), { recursive: true });
mkdirSync(join(evidenceDir, 'screenshots'), { recursive: true });

function loadEnv() {
  const env = { ...process.env };
  delete env.NODE_ENV;
  const path = join(root, '.env');
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === 'NODE_ENV') continue;
    env[key] = value;
  }
  return env;
}

const env = loadEnv();
const startedAt = new Date().toISOString();
const commitSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

const suites = [
  { name: 'contracts-test', command: 'pnpm --filter @guestportal/contracts test' },
  { name: 'ai-tools-test', command: 'pnpm --filter @guestportal/ai-tools test' },
  { name: 'api-lint', command: 'pnpm --filter @guestportal/api lint' },
  { name: 'api-typecheck', command: 'pnpm --filter @guestportal/api typecheck' },
  { name: 'api-build', command: 'pnpm --filter @guestportal/api build' },
  { name: 'api-unit', command: 'pnpm --filter @guestportal/api test' },
  { name: 'api-integration', command: 'pnpm --filter @guestportal/api test:integration' },
  { name: 'ui-lint', command: 'pnpm --filter @guestportal/ui lint' },
  { name: 'ui-typecheck', command: 'pnpm --filter @guestportal/ui typecheck' },
  { name: 'ui-build', command: 'pnpm --filter @guestportal/ui build' },
  { name: 'ui-test', command: 'pnpm --filter @guestportal/ui test' },
  { name: 'ui-visual', command: 'pnpm --filter @guestportal/ui test:guest-chat-visual' },
];

const commandResults = [];
let hardFailure = false;

for (const suite of suites) {
  const start = new Date().toISOString();
  console.log(`\n> ${suite.name}: ${suite.command}`);
  const result = spawnSync(suite.command, {
    shell: true,
    cwd: root,
    encoding: 'utf8',
    env,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  writeFileSync(join(logsDir, `${suite.name}.log`), output);
  writeFileSync(join(evidenceDir, 'logs', `06.5-${suite.name}.log`), output);
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');

  const exitCode = result.status ?? 1;
  commandResults.push({
    name: suite.name,
    command: suite.command,
    startedAt: start,
    finishedAt: new Date().toISOString(),
    exitCode,
  });
  if (exitCode !== 0) {
    hardFailure = true;
    break;
  }
}

const sourceScreenshots = join(evidenceDir, '06.4', 'screenshots');
if (existsSync(sourceScreenshots)) {
  for (const file of readdirSync(sourceScreenshots)) {
    if (!file.endsWith('.png')) continue;
    cpSync(join(sourceScreenshots, file), join(screenshotsDir, file));
    cpSync(join(sourceScreenshots, file), join(evidenceDir, 'screenshots', `06.4-${file}`));
  }
}

const finishedAt = new Date().toISOString();
const requiredSuites = suites.map((suite) => suite.name);
const classification =
  !hardFailure && commandResults.length === suites.length && commandResults.every((item) => item.exitCode === 0)
    ? 'PASS'
    : 'FAIL';

writeFileSync(
  join(evidenceDir, 'metadata.json'),
  `${JSON.stringify(
    {
      phase: '06',
      commitSha,
      startedAt,
      finishedAt,
      environment: process.env.CI ? 'ci' : 'local',
      requiredSuites,
      tasks: ['06.1', '06.2', '06.3', '06.4', '06.5'],
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  join(evidenceDir, 'command-results.json'),
  `${JSON.stringify({ generatedAt: finishedAt, classification, results: commandResults }, null, 2)}\n`,
);

const report = `# Phase 06 Gate Result

## Classification

**${classification}**

## Commit

${commitSha}

## Suites

${commandResults.map((item) => `- ${item.name}: exit ${item.exitCode}`).join('\n')}

## Required Coverage

- Prompt injection: API integration
- Duplicate confirm: API integration
- RAG correctness: API integration
- Conversation isolation: API integration
- Full chat/tool/draft/handoff regression: API integration plus UI visual/unit suites
- Mobile screenshots: copied from 06.4 visual evidence into 06.5

Generated at ${finishedAt}
`;

writeFileSync(join(evidenceDir, 'PHASE_RESULT.generated.md'), report);
writeFileSync(join(taskDir, 'PHASE_RESULT.generated.md'), report);
writeFileSync(
  join(taskDir, 'TASK_RESULT.md'),
  `# Task 06.5 — Handoff shell and Phase 06 evidence

## Result

**${classification}**

## Dependency

Task 06.4 \`PASS\`

## Scope

- Human handoff shell for guest conversations.
- Phase 06 regression gate and evidence aggregation.

## Gate Summary

See \`evidence/phase-06/PHASE_RESULT.generated.md\`, \`metadata.json\`, \`command-results.json\`, logs in \`evidence/phase-06/06.5/logs/\`, and screenshots in \`evidence/phase-06/06.5/screenshots/\`.

## Classification

**${classification}**
`,
);

console.log(report);
process.exit(classification === 'PASS' ? 0 : 1);
