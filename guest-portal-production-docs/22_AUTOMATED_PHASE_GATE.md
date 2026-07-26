# Automated Phase Gate

## 1. Goal

Không để AI tự gõ “PASS”. PASS được sinh bởi script từ artifacts thực tế.

## 2. Required outputs

```text
evidence/phase-XX/
  metadata.json
  command-results.json
  junit/
  playwright-report/
  traces/
  screenshots/
  accessibility/
  visual/
  security/
  build/
  PHASE_RESULT.generated.md
```

## 3. Machine-readable metadata

```json
{
  "phase": "05",
  "commitSha": "HEAD",
  "startedAt": "...",
  "finishedAt": "...",
  "environment": "test",
  "requiredSuites": [
    "lint",
    "typecheck",
    "unit",
    "integration",
    "e2e",
    "accessibility",
    "visual",
    "build"
  ]
}
```

## 4. `verify-phase` responsibilities

The verification script must:

- Confirm current HEAD equals evidence SHA.
- Confirm required commands ran.
- Confirm exit codes are zero.
- Parse JUnit, not prose.
- Reject forbidden skipped tests.
- Confirm screenshot files.
- Confirm Playwright report and traces for failures/retries.
- Confirm accessibility thresholds.
- Confirm build artifacts.
- Confirm migration checks where required.
- Confirm no unresolved S0/S1 issues.
- Generate result; agent cannot hand-edit generated result.

## 5. Example commands

```text
pnpm phase:run 05
pnpm phase:verify 05
```

`phase:run` captures:

- command
- start/end
- exit code
- stdout/stderr path
- environment
- commit SHA

## 6. Status logic

- PASS: all mandatory checks pass.
- FAIL: any mandatory check fails.
- BLOCKED: external prerequisite absent and phase explicitly permits blocking.
- NOT_STARTED: no run.

No conditional pass.

## 7. CI enforcement

- PR label/branch for next phase requires current phase PASS artifact.
- Generated artifact uploaded to CI.
- CI summary links evidence.
- Baseline screenshots require explicit approval.
- Test retry count visible; flaky tests not silently accepted.

## 8. Anti-tampering

- Evidence generated in CI where possible.
- Hash critical reports.
- Store manifest of artifact hashes.
- Generated result includes tool versions.
- Manual edits invalidate verification.
