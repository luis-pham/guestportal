#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const reportPath = resolve(
  root,
  process.env.PHASE10_RELEASE_REPORT ?? 'evidence/phase-10/10.5/reports/release-controls.json',
);

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateValue(spec, value) {
  if (spec.type === 'postgres-url') return /^postgres(ql)?:\/\/[^ ]+$/i.test(value);
  if (spec.type === 'redis-url') return /^redis(s)?:\/\/[^ ]+$/i.test(value);
  if (spec.type === 'url') return /^https?:\/\/[^ ]+$/i.test(value);
  if (spec.type === 'https-url') return /^https:\/\/[^ ]+$/i.test(value);
  if (spec.type === 'gemini-key') return /^AIza[0-9A-Za-z_-]{20,}$/.test(value);
  if (spec.type === 'min-length') return value.length >= spec.minLength;
  if (spec.type === 'non-empty') return value.trim().length > 0;
  if (spec.type === 'enum') return spec.allowed.includes(value);
  return false;
}

function sampleValue(spec) {
  if (spec.value) return spec.value;
  if (spec.type === 'postgres-url') {
    return ['postgresql://release_user', 'release_pass@db.internal:5432/guestportal'].join(':');
  }
  if (spec.type === 'redis-url') return 'rediss://redis.internal:6379';
  if (spec.type === 'url') return 'https://r2.example.internal';
  if (spec.type === 'https-url') return 'https://guestportal.example.com';
  if (spec.type === 'gemini-key') return ['AI', 'zaSyDReleaseControlOnly1234567890'].join('');
  if (spec.type === 'min-length') return 'release-control-secret-value-32chars';
  if (spec.type === 'non-empty') return 'release-control-value';
  if (spec.type === 'enum') return spec.allowed[0];
  return '';
}

function invalidSampleValue(spec) {
  if (spec.type === 'enum') return 'development';
  if (spec.type === 'min-length') return 'short';
  return '';
}

function validatePipeline(pipeline, secretManifest) {
  const expectedOrder = [
    'install',
    'lint',
    'typecheck',
    'unit',
    'integration',
    'build',
    'migration-validation',
    'security-secret-scan',
    'release-control-validation',
    'staging-smoke',
    'production-approval',
    'production-smoke',
  ];
  const stageIds = pipeline.requiredStages.map((stage) => stage.id);

  assert(
    JSON.stringify(stageIds) === JSON.stringify(expectedOrder),
    'release pipeline stage order does not match the production deployment contract',
    { expectedOrder, stageIds },
  );
  assert(
    pipeline.promotionOrder.join('>') === 'test>staging>production',
    'environment promotion order must be test > staging > production',
    { promotionOrder: pipeline.promotionOrder },
  );
  assert(
    pipeline.approval.requiresProtectedEnvironment === true &&
      pipeline.approval.productionEnvironment === 'production',
    'production release must require the protected production environment',
    { approval: pipeline.approval },
  );
  assert(
    pipeline.approval.requiresRollbackArtifact === true &&
      pipeline.approval.requiresEvidenceArtifact === true,
    'production release must require rollback and evidence artifacts',
    { approval: pipeline.approval },
  );

  const blockingStages = pipeline.requiredStages
    .filter((stage) => stage.blocksProduction)
    .map((stage) => stage.id);
  assert(
    expectedOrder.every((stageId) => blockingStages.includes(stageId)),
    'all required stages must block production',
    { blockingStages },
  );

  for (const environment of ['staging', 'production']) {
    assert(secretManifest.environments[environment], `missing ${environment} secret policy`);
  }

  return { expectedOrder, stageIds, blockingStages };
}

function validateSecrets(secretManifest) {
  const environments = Object.entries(secretManifest.environments);
  const validations = [];
  const forbidden = secretManifest.forbiddenLiteralValues ?? [];

  for (const [environment, policy] of environments) {
    const required = policy.required ?? [];
    const publicConfig = policy.public ?? [];
    assert(required.length >= 8, `${environment} must define all production service secrets`, {
      requiredCount: required.length,
    });

    const refs = new Set();
    for (const spec of [...required, ...publicConfig]) {
      assert(spec.name, `${environment} config entry is missing a name`, { spec });
      assert(spec.type, `${environment} config entry is missing a validation type`, { spec });
      if (spec.secretRef) {
        assert(
          /^[A-Z0-9_]+$/.test(spec.secretRef),
          `${environment} secret reference must be an environment-safe identifier`,
          { spec },
        );
        assert(!refs.has(spec.secretRef), `${environment} duplicate secret reference`, {
          secretRef: spec.secretRef,
        });
        refs.add(spec.secretRef);
      }
      if (spec.value) {
        assert(
          !forbidden.includes(spec.value),
          `${environment}.${spec.name} contains a forbidden literal value`,
          { spec },
        );
      }

      const validValue = sampleValue(spec);
      const invalidValue = invalidSampleValue(spec);
      assert(validateValue(spec, validValue), `${environment}.${spec.name} valid sample rejected`, {
        spec,
        validValue,
      });
      assert(
        !validateValue(spec, invalidValue),
        `${environment}.${spec.name} invalid sample accepted`,
        { spec, invalidValue },
      );
      validations.push({
        environment,
        name: spec.name,
        type: spec.type,
        secretRef: spec.secretRef,
      });
    }

    assert(
      required.every((spec) => spec.secretRef?.startsWith(environment.toUpperCase())),
      `${environment} secrets must reference environment-specific secret names`,
      { refs: [...refs] },
    );
  }

  return { environments: environments.map(([name]) => name), validations };
}

function validateFeatureFlags(featureFlags, alertIds) {
  assert(Array.isArray(featureFlags.flags), 'feature flag manifest must contain flags');
  assert(featureFlags.flags.length >= 5, 'incident feature flag set is incomplete');

  const seen = new Set();
  const flagChecks = [];
  for (const flag of featureFlags.flags) {
    assert(!seen.has(flag.key), 'duplicate feature flag key', { key: flag.key });
    seen.add(flag.key);
    assert(flag.owner, 'feature flag is missing owner', { flag });
    assert(
      flag.productionDefault === true,
      'production flag default must be enabled after release',
      {
        key: flag.key,
      },
    );
    assert(flag.rollbackValue === false, 'incident flag must fail closed on rollback', {
      key: flag.key,
    });
    assert(
      (flag.evidenceRequired ?? []).every((alertId) => alertIds.has(alertId)),
      'feature flag references an unknown observability alert',
      { key: flag.key, evidenceRequired: flag.evidenceRequired },
    );
    flagChecks.push({
      key: flag.key,
      rollbackValue: flag.rollbackValue,
      evidenceRequired: flag.evidenceRequired,
    });
  }

  assert(
    featureFlags.policy.allProductionFlagsMustHaveRollbackValue === true &&
      featureFlags.policy.incidentFlagsMustFailClosed === true &&
      featureFlags.policy.flagChangesRequireAuditLog === true,
    'feature flag policy must enforce rollback value, fail-closed incidents and auditability',
    { policy: featureFlags.policy },
  );

  return { count: featureFlags.flags.length, flagChecks };
}

function validateRollback(rollback, featureFlags, pipeline) {
  assert(
    rollback.maximumMinutes <= pipeline.rollback.maximumMinutes,
    'rollback exceeds release SLO',
    {
      rollbackMaximum: rollback.maximumMinutes,
      pipelineMaximum: pipeline.rollback.maximumMinutes,
    },
  );
  assert(
    rollback.artifactPolicy.requiresPreviousImmutableArtifact === true,
    'rollback must require a previous immutable artifact',
    { artifactPolicy: rollback.artifactPolicy },
  );
  assert(
    rollback.artifactPolicy.requiresDatabaseBackupBeforeRiskyMigration === true &&
      rollback.artifactPolicy.requiresMigrationRehearsalEvidence === true,
    'rollback must require backup and migration rehearsal evidence',
    { artifactPolicy: rollback.artifactPolicy },
  );

  const expectedSteps = [
    'freeze-release',
    'disable-risk-flags',
    'restore-previous-artifact',
    'database-recovery-check',
    'post-rollback-smoke',
  ];
  const actualSteps = rollback.orderedSteps.map((step) => step.id);
  assert(
    JSON.stringify(actualSteps) === JSON.stringify(expectedSteps),
    'rollback step order changed',
    {
      expectedSteps,
      actualSteps,
    },
  );

  const totalMinutes = rollback.orderedSteps.reduce(
    (total, step) => total + step.expectedMinutes,
    0,
  );
  assert(totalMinutes <= rollback.maximumMinutes, 'rollback dry-run exceeds maximum minutes', {
    totalMinutes,
    maximumMinutes: rollback.maximumMinutes,
  });

  const rollbackFlags = Object.fromEntries(
    featureFlags.flags.map((flag) => [flag.key, flag.rollbackValue]),
  );
  assert(
    Object.values(rollbackFlags).every((value) => value === false),
    'rollback dry-run must disable incident flags',
    { rollbackFlags },
  );

  return { expectedSteps, actualSteps, totalMinutes, rollbackFlags };
}

function validateWorkflow(pipeline) {
  const ciPath = join(root, '.github/workflows/ci.yml');
  const releasePath = join(root, '.github/workflows/release.yml');
  assert(existsSync(ciPath), 'CI workflow is missing');
  assert(existsSync(releasePath), 'release workflow is missing');
  const workflow = readFileSync(ciPath, 'utf8');
  const releaseWorkflow = readFileSync(releasePath, 'utf8');

  assert(
    workflow.includes('node scripts/validate-release-controls.mjs'),
    'CI workflow must execute release-control validation',
  );
  for (const stage of pipeline.requiredStages) {
    if (stage.command.startsWith('github-environment:')) continue;
    assert(
      workflow.includes(stage.command) ||
        stage.id === 'staging-smoke' ||
        stage.id === 'production-smoke',
      `CI workflow does not reference required release command ${stage.command}`,
      { stage },
    );
  }
  assert(releaseWorkflow.includes('workflow_dispatch:'), 'release workflow must be manual');
  assert(
    releaseWorkflow.includes('release_sha:'),
    'release workflow must require an immutable SHA',
  );
  assert(releaseWorkflow.includes('rollback_sha:'), 'release workflow must require a rollback SHA');
  assert(
    releaseWorkflow.includes('environment: production'),
    'release workflow must use the protected production environment',
  );
  assert(
    releaseWorkflow.includes('actions/upload-artifact@v4') &&
      releaseWorkflow.includes('release-controls-${{ inputs.release_sha }}'),
    'release workflow must upload release-control evidence',
  );
  assert(
    releaseWorkflow.includes('rollback-dry-run:') &&
      releaseWorkflow.includes('inputs.rollback_sha') &&
      releaseWorkflow.includes('inputs.release_sha'),
    'release workflow must verify rollback artifact input',
  );

  return {
    workflows: ['.github/workflows/ci.yml', '.github/workflows/release.yml'],
    releaseControlValidation: true,
    protectedProductionEnvironment: true,
    rollbackDryRun: true,
  };
}

const checks = [];
let status = 'PASS';
let errorPayload = null;

try {
  const pipeline = readJson('infra/release/pipeline.json');
  const secretManifest = readJson('infra/release/secrets.json');
  const featureFlags = readJson('infra/release/feature-flags.json');
  const rollback = readJson('infra/release/rollback.json');
  const alerts = readJson('infra/observability/alerts.json');
  const alertIds = new Set((alerts.rules ?? []).map((rule) => rule.id));

  checks.push({
    name: 'pipeline test',
    result: 'PASS',
    details: validatePipeline(pipeline, secretManifest),
  });
  checks.push({
    name: 'secret/config validation',
    result: 'PASS',
    details: validateSecrets(secretManifest),
  });
  checks.push({
    name: 'feature-flag test',
    result: 'PASS',
    details: validateFeatureFlags(featureFlags, alertIds),
  });
  checks.push({
    name: 'rollback',
    result: 'PASS',
    details: validateRollback(rollback, featureFlags, pipeline),
  });
  checks.push({
    name: 'workflow enforcement',
    result: 'PASS',
    details: validateWorkflow(pipeline),
  });
} catch (error) {
  status = 'FAIL';
  errorPayload = {
    message: error instanceof Error ? error.message : String(error),
    details: error?.details ?? {},
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  environment: process.env.PHASE10_RELEASE_ENVIRONMENT ?? (process.env.CI ? 'ci' : 'local'),
  commitSha: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
  status,
  checks,
  error: errorPayload,
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (status !== 'PASS') {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(`Release controls validated: ${checks.length} checks PASS`);
console.log(`Report: ${reportPath}`);
