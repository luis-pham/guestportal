#!/usr/bin/env node
import { execSync, spawn, spawnSync } from 'node:child_process';
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
const evidenceDir = join(root, 'evidence', 'phase-07');
const logsDir = join(evidenceDir, 'logs');
const screenshotsDir = join(evidenceDir, 'screenshots');
mkdirSync(logsDir, { recursive: true });
mkdirSync(screenshotsDir, { recursive: true });

function loadEnv() {
  const env = { ...process.env };
  delete env.NODE_ENV;
  const dotenvPath = join(root, '.env');
  if (!existsSync(dotenvPath)) return env;
  for (const line of readFileSync(dotenvPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim().replace(/^export\s+/, '');
    if (key === 'NODE_ENV') continue;
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function hasRealGeminiCredential(env) {
  return Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
}

const env = loadEnv();
const startedAt = new Date().toISOString();
const commitSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

const suites = [
  { name: 'contracts-lint', command: 'pnpm --filter @guestportal/contracts lint' },
  { name: 'contracts-typecheck', command: 'pnpm --filter @guestportal/contracts typecheck' },
  { name: 'contracts-test', command: 'pnpm --filter @guestportal/contracts test' },
  { name: 'contracts-build', command: 'pnpm --filter @guestportal/contracts build' },
  { name: 'ai-tools-lint', command: 'pnpm --filter @guestportal/ai-tools lint' },
  { name: 'ai-tools-typecheck', command: 'pnpm --filter @guestportal/ai-tools typecheck' },
  { name: 'ai-tools-test', command: 'pnpm --filter @guestportal/ai-tools test' },
  { name: 'ai-tools-build', command: 'pnpm --filter @guestportal/ai-tools build' },
  { name: 'api-lint', command: 'pnpm --filter @guestportal/api lint' },
  { name: 'api-typecheck', command: 'pnpm --filter @guestportal/api typecheck' },
  { name: 'api-unit', command: 'pnpm --filter @guestportal/api test' },
  { name: 'api-integration', command: 'pnpm --filter @guestportal/api test:integration' },
  { name: 'api-build', command: 'pnpm --filter @guestportal/api build' },
  { name: 'guest-web-lint', command: 'pnpm --filter @guestportal/guest-web lint' },
  { name: 'guest-web-typecheck', command: 'pnpm --filter @guestportal/guest-web typecheck' },
  { name: 'guest-web-test', command: 'pnpm --filter @guestportal/guest-web test' },
  { name: 'guest-web-build', command: 'pnpm --filter @guestportal/guest-web build' },
  {
    name: 'real-gemini-live',
    command:
      'GEMINI_LIVE_MODEL=models/gemini-3.1-flash-live-preview node tests/phase-07/gemini-live-real.mjs',
    optionalBlocked: true,
  },
];

const e2eSpecs = [
  'e2e/guest-voice.spec.ts',
  'e2e/guest-voice-tool.spec.ts',
  'e2e/guest-voice-reconnect.spec.ts',
];

const commandResults = [];
let hardFailure = false;
let blocked = false;

function runSuite(suite) {
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
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');

  const exitCode = result.status ?? 1;
  const suiteBlocked = Boolean(
    suite.optionalBlocked && exitCode !== 0 && !hasRealGeminiCredential(env),
  );
  commandResults.push({
    name: suite.name,
    command: suite.command,
    startedAt: start,
    finishedAt: new Date().toISOString(),
    exitCode,
    blocked: suiteBlocked,
    logPath: `logs/${suite.name}.log`,
  });

  if (suiteBlocked) {
    blocked = true;
    return;
  }
  if (exitCode !== 0) {
    hardFailure = true;
  }
}

for (const suite of suites) {
  runSuite(suite);
  if (hardFailure) break;
}

async function waitForServer(port) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync('curl', ['-fsS', `http://127.0.0.1:${port}/g/voice-token/chat`], {
      cwd: root,
      encoding: 'utf8',
    });
    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Next dev server did not become ready for Phase 07 E2E.');
}

async function runE2e() {
  if (hardFailure) return;

  const name = 'guest-web-e2e';
  const start = new Date().toISOString();
  const port = 3127;
  const serverLogPath = join(logsDir, 'guest-web-e2e-server.log');
  const logPath = join(logsDir, `${name}.log`);
  console.log(`\n> ${name}: playwright ${e2eSpecs.join(' ')}`);
  const server = spawn('pnpm', ['--filter', '@guestportal/guest-web', 'exec', 'next', 'dev', '--port', String(port)], {
    cwd: root,
    env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const serverChunks = [];
  server.stdout.on('data', (chunk) => serverChunks.push(chunk));
  server.stderr.on('data', (chunk) => serverChunks.push(chunk));

  try {
    await waitForServer(port);
    const result = spawnSync(
      'pnpm',
      ['--filter', '@guestportal/guest-web', 'exec', 'playwright', 'test', ...e2eSpecs],
      {
        cwd: root,
        env: { ...env, GUEST_WEB_URL: `http://127.0.0.1:${port}` },
        encoding: 'utf8',
      },
    );
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    writeFileSync(logPath, output);
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    const exitCode = result.status ?? 1;
    commandResults.push({
      name,
      command: `pnpm --filter @guestportal/guest-web exec playwright test ${e2eSpecs.join(' ')}`,
      startedAt: start,
      finishedAt: new Date().toISOString(),
      exitCode,
      blocked: false,
      logPath: `logs/${name}.log`,
    });
    if (exitCode !== 0) hardFailure = true;
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    writeFileSync(logPath, `${message}\n`);
    commandResults.push({
      name,
      command: `pnpm --filter @guestportal/guest-web exec playwright test ${e2eSpecs.join(' ')}`,
      startedAt: start,
      finishedAt: new Date().toISOString(),
      exitCode: 1,
      blocked: false,
      logPath: `logs/${name}.log`,
    });
    hardFailure = true;
  } finally {
    server.kill('SIGTERM');
    writeFileSync(serverLogPath, Buffer.concat(serverChunks).toString('utf8'));
  }
}

await runE2e();

function copyScreenshots(task, prefix = task) {
  const source = join(evidenceDir, task, 'screenshots');
  if (!existsSync(source)) return;
  for (const file of readdirSync(source)) {
    if (!file.endsWith('.png')) continue;
    cpSync(join(source, file), join(screenshotsDir, `${prefix}-${file}`));
  }
}

for (const task of ['07.2', '07.3', '07.4', '07.5']) {
  copyScreenshots(task);
}

const finishedAt = new Date().toISOString();
const taskIds = ['07.1', '07.2', '07.3', '07.4', '07.5'];
const missingTasks = taskIds.filter((task) => !existsSync(join(evidenceDir, task, 'TASK_RESULT.md')));
const requiredSuites = [
  ...suites.map((suite) => suite.name),
  'guest-web-e2e',
];
const classification =
  missingTasks.length === 0 &&
  !hardFailure &&
  commandResults.length === requiredSuites.length &&
  commandResults.every((item) => item.exitCode === 0 || item.blocked)
    ? blocked
      ? 'BLOCKED'
      : 'PASS'
    : 'FAIL';

writeFileSync(
  join(evidenceDir, 'metadata.json'),
  `${JSON.stringify(
    {
      phase: '07',
      commitSha,
      startedAt,
      finishedAt,
      environment: process.env.CI ? 'ci' : 'local',
      requiredSuites,
      tasks: taskIds,
      missingTasks,
      realProviderCredentialAvailable: hasRealGeminiCredential(env),
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  join(evidenceDir, 'command-results.json'),
  `${JSON.stringify({ generatedAt: finishedAt, classification, results: commandResults }, null, 2)}\n`,
);

const report = `# Phase 07 Gate Result

## Classification

**${classification}**

## Commit

${commitSha}

## Suites

${commandResults.map((item) => `- ${item.name}: exit ${item.exitCode}${item.blocked ? ' (BLOCKED)' : ''}`).join('\n')}

## Required Coverage

- Ephemeral token service and no provider secret leakage: API unit/integration plus client secret scan evidence.
- Browser direct Gemini WebSocket transport: guest-web unit and E2E.
- Audio streaming: guest-web unit and real Gemini Live evidence.
- Tool bridge and guest confirmation: API integration, guest-web E2E, real provider tool call.
- Transcript, interruption and reconnect: guest-web unit/E2E and Phase 07.4 evidence.
- Real Gemini Live KB answer and tool draft: Phase 07.5 REAL_STAGING evidence.
- Mobile screenshots: copied from 07.2, 07.3, 07.4 and 07.5 task evidence.

## Known Issues

${missingTasks.length > 0 ? `- Missing task evidence: ${missingTasks.join(', ')}` : '- None for Phase 07 gate.'}
${blocked ? '- Real Gemini credential unavailable in this environment; Phase 07 remains BLOCKED here.' : ''}

Generated at ${finishedAt}
`;

writeFileSync(join(evidenceDir, 'PHASE_RESULT.generated.md'), report);

console.log(report);
process.exit(classification === 'PASS' ? 0 : classification === 'BLOCKED' ? 3 : 1);
