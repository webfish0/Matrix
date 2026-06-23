# Smith Requirements

## 1. Purpose

Smith is a terminal-first developer interface for Visual Studio Code workspaces. It gives keyboard-focused developers a Neovim editing experience while preserving access to VS Code workspace context and supported VS Code capabilities.

The initial product is a VS Code extension that starts and controls a real local Neovim process. Standalone Neovim cannot load arbitrary VS Code extensions; integration is provided through documented VS Code extension APIs and explicit adapters.

## 2. Scope and assumptions

### In scope for the MVP

- macOS and Linux developer workstations.
- VS Code with Neovim available on `PATH` or configured explicitly.
- Opening the active VS Code file and workspace context in an embedded terminal session.
- Bidirectional file, cursor, selection, diagnostic, and command synchronization where VS Code APIs permit it.
- Clear recovery when Neovim exits, a file changes externally, or integration is unavailable.
- Automated unit, integration, end-to-end, accessibility, and UX testing.
- Test evidence retained in CI and linked to requirements.

### Out of scope for the MVP

- Running VS Code extensions directly inside standalone Neovim.
- Full Visual Studio IDE integration.
- Remote execution on an untrusted host.
- Windows support, collaborative editing, and mobile clients.

## 3. Users

- **Primary developer:** prefers terminal and Neovim interaction but works in VS Code projects.
- **Extension maintainer:** builds, tests, diagnoses, and releases Smith.
- **Engineering lead:** verifies requirement coverage and release evidence.

## 4. Business requirements

| ID | Requirement | Success measure |
| --- | --- | --- |
| BR-001 | Reduce context switching between terminal editing and VS Code project tooling. | At least 80% of moderated MVP tasks are completed without leaving the Smith workflow. |
| BR-002 | Preserve confidence in files and workspace state. | No data-loss defect is open at release; conflict and recovery tests pass. |
| BR-003 | Make every release auditable. | Every MVP requirement maps to acceptance criteria, tests, and retained evidence. |
| BR-004 | Keep onboarding practical for developers. | A clean supported workstation reaches a working session in 10 minutes or less. |

## 5. User stories and acceptance criteria

### US-001 Start a Smith session

As a developer, I want to start Smith from the VS Code command palette so that I can use Neovim without manually reconstructing workspace context.

Acceptance criteria:

- AC-001.1: `Smith: Start Session` starts Neovim for the active workspace and file.
- AC-001.2: A configured executable path is honored; otherwise `nvim` is resolved from `PATH`.
- AC-001.3: Missing or incompatible Neovim produces an actionable error and does not alter the file.

### US-002 Edit safely

As a developer, I want edits made through Neovim to appear in VS Code so that both views represent the same saved file.

Acceptance criteria:

- AC-002.1: Saving in Neovim updates the VS Code document.
- AC-002.2: Unsaved or conflicting changes require an explicit keep, reload, or compare decision.
- AC-002.3: Normal and abnormal session termination does not silently discard edits.

### US-003 Preserve navigation context

As a developer, I want file, cursor, and selection context synchronized so that navigation remains predictable.

Acceptance criteria:

- AC-003.1: Starting or switching a supported file focuses the corresponding Neovim buffer.
- AC-003.2: Cursor and selection changes are synchronized without feedback loops.
- AC-003.3: Unsupported, binary, deleted, or untitled documents are handled explicitly.

### US-004 Use VS Code capabilities

As a developer, I want supported VS Code commands and diagnostics available from Smith so that I retain project tooling.

Acceptance criteria:

- AC-004.1: Smith exposes a documented command bridge for allow-listed VS Code commands.
- AC-004.2: Current diagnostics can be displayed in Neovim with severity and location.
- AC-004.3: Adapter failures are isolated and reported without ending the editing session.

### US-005 Recover from failure

As a developer, I want clear session status and restart controls so that I can recover without losing work.

Acceptance criteria:

- AC-005.1: Status is visible as stopped, starting, ready, degraded, or failed.
- AC-005.2: `Smith: Restart Session` preserves recoverable workspace state.
- AC-005.3: Logs contain diagnostic context but no source content, credentials, or environment secrets by default.

### US-006 Configure the experience

As a developer, I want workspace-safe settings so that Smith matches my local toolchain.

Acceptance criteria:

- AC-006.1: Settings cover Neovim path, startup arguments, synchronization, logging, and command allow-list.
- AC-006.2: Invalid settings fail validation with a corrective message.
- AC-006.3: Workspace settings cannot silently execute untrusted commands without confirmation.

### US-007 Verify a release

As a maintainer, I want one repeatable build and test entry point so that local and CI results are comparable.

Acceptance criteria:

- AC-007.1: Documented commands install, build, lint, test, package, and run the extension host.
- AC-007.2: Automated tests produce machine-readable results and UX artifacts.
- AC-007.3: A traceability check fails when an MVP requirement has no test mapping.

## 6. Functional requirements

| ID | Requirement | Stories |
| --- | --- | --- |
| FR-001 | Register start, stop, restart, show-log, and run-bridged-command commands. | US-001, US-004, US-005 |
| FR-002 | Resolve, validate, start, monitor, and terminate the Neovim process. | US-001, US-005 |
| FR-003 | Pass active workspace, file, line, column, and supported startup options to Neovim. | US-001, US-003 |
| FR-004 | Synchronize supported file saves and detect conflicting document versions. | US-002 |
| FR-005 | Synchronize active file, cursor, and selection without recursive update loops. | US-003 |
| FR-006 | Bridge allow-listed VS Code commands through a typed request/response protocol. | US-004, US-006 |
| FR-007 | Publish VS Code diagnostics to Neovim and preserve severity and location. | US-004 |
| FR-008 | Maintain and display a session state machine with recovery actions. | US-005 |
| FR-009 | Validate user/workspace configuration and protect execution of untrusted workspace values. | US-006 |
| FR-010 | Produce structured logs with redaction and correlation identifiers. | US-005, US-007 |
| FR-011 | Provide build, test, package, and development-host scripts usable locally and in CI. | US-007 |
| FR-012 | Generate test reports, screenshots, videos/traces on failure, and a traceability report. | US-007 |

## 7. Non-functional requirements

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-001 | Startup performance | Ready within 2 seconds at p95 on the reference workstation. |
| NFR-002 | Interaction latency | Synchronization completes within 150 ms at p95 for local files. |
| NFR-003 | Reliability | 100 consecutive start/edit/save/stop cycles without data loss. |
| NFR-004 | Accessibility | All Smith-owned VS Code UI passes automated accessibility checks and keyboard-only tasks. |
| NFR-005 | Security | No shell interpolation of workspace input; secrets and source content are redacted from default logs. |
| NFR-006 | Compatibility | Current and previous VS Code stable releases plus the pinned Neovim version are tested. |
| NFR-007 | Maintainability | Type checking, linting, unit coverage threshold, dependency review, and traceability gates pass. |
| NFR-008 | Observability | Failures have state, timestamp, correlation ID, and actionable message. |

## 8. Traceability matrix

| Business requirement | Stories | Functional/quality requirements | Planned tests |
| --- | --- | --- | --- |
| BR-001 | US-001, US-003, US-004, US-006 | FR-001, FR-003, FR-005, FR-006, FR-007, FR-009; NFR-001, NFR-002 | T-001, T-002, T-005, T-006, T-008, T-012 |
| BR-002 | US-002, US-003, US-005 | FR-002, FR-004, FR-005, FR-008, FR-010; NFR-003, NFR-008 | T-003, T-004, T-007, T-009, T-013 |
| BR-003 | US-007 | FR-010, FR-011, FR-012; NFR-005, NFR-007, NFR-008 | T-010, T-011, T-014, T-015 |
| BR-004 | US-001, US-006, US-007 | FR-002, FR-009, FR-011; NFR-004, NFR-006 | T-001, T-008, T-012, T-016 |

Detailed test definitions and evidence rules are in [test.md](test.md). Architecture and delivery decisions are in [design.md](design.md).

## 9. Definition of complete

A story or requirement is complete only when:

1. Its acceptance criteria are implemented and reviewed.
2. Linked automated tests pass in the supported local test environment and CI.
3. Required UX evidence and manual observations are attached.
4. The traceability report shows no missing or orphaned IDs.
5. Security, accessibility, performance, and compatibility gates applicable to the change pass.
6. Documentation and recovery guidance are updated.
7. The GitHub work item links the implementation pull request and evidence artifact or run.
