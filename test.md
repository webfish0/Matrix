# Smith Test Strategy and Plan

## 1. Objective

This document defines how Smith is verified against [requirements.md](requirements.md) and [design.md](design.md). Tests must be reproducible by a developer, run in CI, and retain evidence sufficient to prove what passed, in which environment, against which commit.

## 2. Strategy

Smith uses a risk-based test pyramid:

- **Static checks:** formatting, linting, type checking, dependency and secret scanning.
- **Unit tests:** state machine, configuration, protocol, redaction, conflict decisions, and adapters using fakes.
- **Integration tests:** real Neovim process, RPC protocol, lifecycle, files, diagnostics, timing, and abnormal exits.
- **End-to-end tests:** isolated VS Code extension host plus real Neovim and fixture workspace.
- **UX tests:** automated keyboard and accessibility checks plus task-based developer sessions with recorded evidence.
- **Non-functional tests:** startup/synchronization performance, soak cycles, compatibility matrix, and security misuse cases.

A screenshot alone does not prove behavior. UX evidence combines assertions, accessibility output, task result, screenshot, and trace/video on failure.

## 3. Environments

### Developer environment

Run from a clean checkout using the pinned versions documented in `design.md`:

```bash
npm ci
npm run test:all
```

For visible UX execution:

```bash
SMITH_HEADLESS=0 npm run test:ux
```

The test runner must use temporary VS Code user-data, extension, workspace, and Neovim configuration directories. It must not read or modify the developer's normal configuration.

### Continuous integration

The quality workflow runs on pull requests and the default branch:

1. build, lint, and type check;
2. unit tests with coverage;
3. integration tests with pinned Neovim;
4. end-to-end and UX tests in an isolated extension host;
5. accessibility, security, performance, and traceability checks;
6. package validation;
7. evidence upload, including failure evidence.

Release candidates additionally run the VS Code current/previous and macOS/Linux compatibility matrix plus the reliability soak.

## 4. Evidence model

Every run creates `test-evidence/<run-id>/manifest.json` containing:

- repository and commit SHA;
- branch or pull request;
- UTC start/end time;
- OS, architecture, Node, VS Code, and Neovim versions;
- command and exit status;
- test IDs executed and outcomes;
- paths and SHA-256 hashes for reports and media;
- requirement IDs covered;
- known deviations and approver for manual evidence.

Expected artifacts:

```text
test-evidence/<run-id>/
  manifest.json
  junit/unit.xml
  junit/integration.xml
  junit/e2e.xml
  coverage/coverage-summary.json
  ux/task-results.json
  ux/accessibility.json
  ux/screenshots/
  ux/traces/
  performance/results.json
  security/results.sarif
  traceability/report.json
  logs/smith-redacted.jsonl
```

CI retains pull-request evidence for at least 30 days and release evidence for at least one year. A compact release evidence summary may be committed under `test-evidence/releases/<version>.json`.

## 5. Planned tests

| ID | Test | Level | Requirements | Pass condition | Evidence |
| --- | --- | --- | --- | --- | --- |
| T-001 | Start with PATH and configured Neovim | Integration/E2E | US-001, FR-001, FR-002, FR-003, NFR-001 | Ready state reached; active file/position correct; p95 target met | JUnit, state log, performance JSON |
| T-002 | Missing/incompatible Neovim | Unit/E2E | AC-001.3, FR-002 | Actionable error; file unchanged; recovery action works | JUnit, screenshot, log |
| T-003 | Save propagation | Integration/E2E | US-002, FR-004 | Saved bytes and VS Code version agree | JUnit, fixture hashes |
| T-004 | Concurrent edit conflict | E2E/UX | AC-002.2, FR-004, BR-002 | No silent overwrite; all decisions behave correctly | JUnit, screenshots, task result |
| T-005 | File/cursor/selection synchronization | Integration/E2E | US-003, FR-005, NFR-002 | Correct context; no feedback loop; latency target met | JUnit, event trace, performance JSON |
| T-006 | Command bridge allow-list and adapter isolation | Unit/Integration | US-004, FR-006 | Allowed command succeeds; denied/failed command is contained | JUnit, protocol log |
| T-007 | Diagnostic bridge | Integration/E2E | US-004, FR-007 | Severity, URI, line, column, and message mapping are correct | JUnit, screenshot |
| T-008 | Configuration validation and onboarding | Unit/UX | US-006, BR-004, FR-009 | Invalid values are blocked; clean setup completes within 10 minutes | JUnit, task timing, notes |
| T-009 | Crash, stop, and restart recovery | Integration/E2E | US-005, FR-002, FR-008, NFR-003 | Correct state transitions; recoverable edits retained | JUnit, state log, fixture hashes |
| T-010 | Log redaction | Unit/Security | FR-010, NFR-005, NFR-008 | Seeded source, tokens, and environment secrets absent | JUnit, redaction scan |
| T-011 | Command injection and workspace trust | Unit/Security/E2E | FR-002, FR-006, FR-009, NFR-005 | Payload is never shell-executed; untrusted values require approval | JUnit, SARIF, screenshot |
| T-012 | Keyboard-only core journey and accessibility | UX | BR-001, NFR-004 | Tasks complete without pointer; no serious/critical automated violations | Task JSON, accessibility JSON, screenshots |
| T-013 | Reliability soak | System | BR-002, NFR-003 | 100 cycles, zero data loss, no leaked child process | JUnit, hashes, resource metrics |
| T-014 | Evidence completeness | Build | BR-003, FR-012, NFR-007 | Manifest validates; referenced files and hashes exist | validation report |
| T-015 | Requirement traceability | Build | BR-003, US-007, FR-011, FR-012 | Every MVP BR/US/FR/NFR maps to a test and no test references an unknown ID | traceability JSON |
| T-016 | Supported version matrix | CI/System | NFR-006, BR-004 | Current/previous VS Code and pinned Neovim matrix passes | matrix JUnit and manifest |

## 6. UX test method

### Automated developer workflow

Launch an isolated visible extension host and execute these keyboard-first tasks:

1. Open a fixture workspace and run `Smith: Start Session`.
2. Edit and save a fixture file in Neovim; verify VS Code reflects it.
3. Navigate between files and selections.
4. Inspect diagnostics and execute an allow-listed VS Code command.
5. Create a concurrent edit and resolve the conflict using Compare.
6. Terminate Neovim, inspect degraded/failed status, and restart.
7. Open Smith Health and locate the corrective action for a seeded fault.

Assertions inspect VS Code APIs, fixture bytes, Neovim state, focus order, accessible names, and status transitions. Capture screenshots at stable checkpoints and a trace/video on retry or failure.

### Moderated MVP usability session

At least five developers representative of the primary user perform the same core tasks from a clean setup. Record:

- task success and time;
- errors and recoveries;
- points requiring external help;
- System Usability Scale or agreed lightweight score;
- observations linked to `US-*` and resulting issues.

BR-001 requires at least 80% core-task completion without leaving the Smith workflow. BR-004 requires median clean onboarding within 10 minutes.

## 7. Entry and exit criteria

### Test entry

- Acceptance criteria and requirement IDs are present.
- Implementation builds and unit tests pass.
- Test data and expected outcomes are reviewed.
- Relevant feature flags and supported versions are identified.

### Release exit

- All T-001 through T-016 required for the release scope pass.
- No open critical/high security issue or data-loss defect.
- No serious/critical accessibility violation in Smith-owned UI.
- Coverage threshold configured by the team is met with no unexplained regression.
- Performance and reliability targets pass.
- Evidence manifest and traceability report validate.
- UX task results satisfy BR-001 and BR-004, or an explicitly approved deviation is recorded.
- Release work item links the immutable CI run and evidence summary.

## 8. Defect and completion policy

A failing test creates or updates a GitHub issue containing test ID, requirement IDs, environment, reproduction command, expected/actual result, and evidence link. A flaky test remains a failure until its cause is fixed or it is quarantined with an owner, expiry date, and linked risk approval.

A GitHub item may be marked complete only when its acceptance criteria are checked, implementation is merged, required tests pass, and evidence links are present. Closing an issue without evidence does not satisfy the requirement.

## 9. Traceability maintenance

- Requirement IDs are stable and never reused.
- Test names include their `T-*` identifier.
- Source tests declare covered requirement IDs in metadata.
- `npm run test:traceability` parses all three documents and test metadata.
- CI fails for missing mappings, unknown IDs, duplicate IDs, or completion claims without evidence.
- Changes to requirements must update design decisions, tests, work items, and the traceability report in the same pull request.
