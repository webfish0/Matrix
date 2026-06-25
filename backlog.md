# Smith Implementation Backlog

Status: Proposed
Date: 23 June 2026

This backlog is the source for GitHub issues and the **Smith** GitHub Project. All new items start in `Todo`. Each issue must link its pull request and test evidence before moving to `Done`.

## Epic A — Code OSS baseline and product boundaries

### SMITH-001 Pin and build the Code OSS baseline

**Outcome:** A reproducible build produces a Smith client development artifact and Smith remote-agent artifact from one pinned Code OSS commit.

**Work:**

- Record upstream repository, commit and update cadence.
- Add reproducible fetch/build scripts and source verification.
- Define Smith product metadata without Microsoft branding or services.
- Record artifact commit/version/hash metadata.
- Document local build prerequisites and commands.

**Acceptance:** T-001 passes and a clean checkout can reproduce both development artifacts.

### SMITH-002 Inventory reusable Code OSS modules and presentation dependencies

**Outcome:** The team knows which remote, platform, workbench and editor modules can be reused directly and which depend on DOM/Electron presentation.

**Work:**

- Classify remote agent, remote client, extension host, text model, commands, configuration, SCM, debug, task, test and UI modules.
- Capture required service interfaces and composition roots.
- Identify unavoidable downstream patches.
- Produce a machine-readable ownership/adaptation inventory.

**Acceptance:** Architecture review approves the initial reuse boundary and every selected module has an owner and test strategy.

### SMITH-003 Establish downstream patch and upstream-update workflow

**Outcome:** Smith can track routine Code OSS updates without uncontrolled divergence.

**Work:**

- Define upstream remote, patch layout and rebase/update scripts.
- Add patch metadata: owner, rationale, upstream path and conflict test.
- Build a scheduled candidate-upstream branch.
- Measure conflicts and elapsed engineering effort.

**Acceptance:** T-027 passes against one newer Code OSS baseline and produces an update report.

### SMITH-004 Define licensing, branding, marketplace and distribution policy

**Outcome:** Distribution uses approved Code OSS-derived components and services.

**Work:**

- Confirm exclusion of Microsoft-packaged VS Code Server.
- Inventory licences and notices.
- Define branding/product-name constraints.
- Decide extension registry/marketplace policy.
- Add SBOM and prohibited-dependency gates.

**Acceptance:** T-026 passes and release documentation identifies all external legal dependencies requiring review.

## Epic B — SSH bootstrap and remote compatibility

### SMITH-005 Implement SSH target resolution and connection bootstrap

**Outcome:** `smith host /workspace` uses OpenSSH configuration and opens a managed connection.

**Work:**

- Support aliases, keys, agents, non-default ports and ProxyJump.
- Preserve normal host-key verification.
- Avoid shell interpolation for host/workspace input.
- Model connection states and actionable failures.

**Acceptance:** T-002 passes across the supported SSH topology matrix.

### SMITH-006 Implement remote agent discovery, install, update and rollback

**Outcome:** Smith safely installs and selects a matching user-scoped agent.

**Work:**

- Probe OS/architecture/runtime directory.
- Upload versioned artifacts and verify hashes/permissions.
- Start on a private Unix socket or loopback endpoint.
- Support side-by-side versions, interrupted installs, rollback and uninstall.

**Acceptance:** T-002 and T-028 pass; no partial installation can be selected as active.

### SMITH-007 Reuse Code OSS remote handshake and channel transport

**Outcome:** The client establishes authenticated management, extension-host and tunnel connections to the matching agent.

**Work:**

- Integrate connection-token validation and version checks.
- Reuse multiplexing, persistent transport and URI transformation.
- Reject incompatible client/agent commits with corrective guidance.
- Add size, timeout, cancellation and rate limits.

**Acceptance:** T-003 and relevant T-024 cases pass.

### SMITH-008 Integrate remote filesystem, watching and environment services

**Outcome:** Client workbench services operate on the remote workspace through Code OSS channels.

**Work:**

- Wire filesystem operations and errors.
- Wire recursive/non-recursive watch behavior and overflow recovery.
- Resolve remote environment and paths.
- Implement atomic save/conflict policy and remote acknowledgement.

**Acceptance:** T-004 and T-007 pass against fixture repositories.

### SMITH-009 Implement connection supervision and resource recovery

**Outcome:** Transient disconnects recover predictably.

**Work:**

- Implement degraded/reconnecting/disconnected states and bounded backoff.
- Restore services in dependency order.
- Classify buffers, PTYs, tasks, debug sessions and tests as restored/restarted/lost/action-required.
- Preserve unsaved local buffers without falsely acknowledging saves.

**Acceptance:** T-019 passes for every injected disconnect point.

## Epic C — Terminal platform and responsive UI

### SMITH-010 Build terminal capability and safe-lifecycle layer

**Outcome:** Smith enters and always restores terminal modes safely.

**Work:**

- Raw mode, alternate screen, cursor, bracketed paste, focus and SGR mouse.
- UTF-8, colour, underline, keyboard protocol, hyperlink and clipboard detection.
- Normal exit, exception, panic, signal and failed-start restoration.
- Capability diagnostics and conservative fallback profile.

**Acceptance:** T-005 passes on the terminal matrix.

### SMITH-011 Build cell renderer, diff output and invalidation scheduler

**Outcome:** Workbench components render efficiently without a polling loop.

**Work:**

- Styled cell grid and z-ordered overlays.
- Previous-frame diff and minimal terminal output.
- Event-driven invalidation and bounded animation rate.
- Cursor/state output and forced full repaint path.
- Frame instrumentation and queue bounds.

**Acceptance:** T-008, T-020 and T-021 rendering budgets pass.

### SMITH-012 Implement responsive constraint layout

**Outcome:** Wide, medium, narrow, short and minimum layouts remain usable.

**Work:**

- Component min/preferred/max sizing and collapse priorities.
- Overlay conversion and state preservation.
- Resize coalescing, real-size reread and complete rectangle recomputation.
- Focus/cursor/selection/scroll preservation and popup repositioning.

**Acceptance:** T-009 passes through deterministic and randomized resize sequences.

### SMITH-013 Implement command, keyboard and mouse input routing

**Outcome:** Smith is keyboard complete and mouse capable.

**Work:**

- Code OSS command IDs, context keys, chords and keybinding resolution.
- Terminal key collision detection and remapping.
- Per-frame semantic hit regions with z-order.
- Click, multi-click, drag, wheel, splitter, tab, tree and context-menu behavior.
- Bracketed paste and focus events.

**Acceptance:** T-010 and T-011 pass; every mouse-only test has a keyboard equivalent.

## Epic D — Editor and core workbench

### SMITH-014 Reuse Code OSS text models and implement terminal editor rendering

**Outcome:** A remote text document can be edited safely with VS Code-class model behavior.

**Work:**

- Integrate text models, selections, edits, undo/redo and decorations.
- Render lines, line numbers, glyphs, cursors, selections, folds and wrapping.
- Implement grapheme/display-cell/UTF-16 conversions with distinct types.
- Support multi-cursor, rectangular selection, find/replace and save conflicts.

**Acceptance:** T-006 and T-007 pass, including randomized Unicode edits.

### SMITH-015 Implement language-feature and editor-overlay presentation

**Outcome:** Language extensions can provide normal coding assistance in the terminal.

**Work:**

- Syntax/semantic tokens and diagnostics.
- Completion, snippets, hover, signature help, rename and code actions.
- Definition/reference navigation and peek alternative.
- Inlay hints and decorations with terminal-safe degradation.

**Acceptance:** Representative language-extension journeys pass T-014 with approved golden frames.

### SMITH-016 Implement editor groups, tabs, diff and merge foundations

**Outcome:** Developers can manage multiple files and compare changes.

**Work:**

- Groups, splits, tabs, preview/pinned state and history.
- Side-by-side and inline diff presentation.
- Dirty/conflict indicators and close confirmation.
- Initial textual merge workflow and follow-up compatibility boundary.

**Acceptance:** Workbench golden and E2E tests cover split, resize, diff, conflict and close flows.

### SMITH-017 Implement command palette, quick input, menus, dialogs and notifications

**Outcome:** Code OSS commands and user decisions have reusable terminal interaction surfaces.

**Work:**

- Quick pick/input with filtering, multi-select and validation.
- Command palette and context-aware commands.
- Menus/context menus, progress, notifications and modal/non-modal dialogs.
- Workspace trust and authentication prompt presentation.

**Acceptance:** Keyboard/mouse/accessibility journeys pass across all responsive modes.

### SMITH-018 Implement Explorer, Search, Problems and Output

**Outcome:** Core workspace navigation and diagnostics are complete.

**Work:**

- Lazy Explorer/outline trees and file operations.
- Streaming search/replace with cancellation.
- Problems grouping/filter/navigation.
- Output channels, follow mode, bounded history and redaction-aware copy.

**Acceptance:** T-013 passes for these four views under normal, empty, loading, error and reconnect states.

## Epic E — Development lifecycle and extensions

### SMITH-019 Implement integrated remote terminals

**Outcome:** Remote shells and child TUIs run inside Smith.

**Work:**

- Wire Code OSS remote PTY channels.
- Integrate a terminal parser and normal/alternate screen model.
- Implement modes, styles, cursor, hyperlinks, scrollback, search and selection.
- Route focused input, escape chord, paste, mouse and resize.
- Apply output backpressure and memory limits.

**Acceptance:** T-012 and terminal portions of T-020/T-022 pass.

### SMITH-020 Implement Source Control and task presentations

**Outcome:** Developers can inspect changes and run build workflows.

**Work:**

- Reuse SCM models for repositories, groups, resources, staging and commit input.
- Diff navigation and SCM status decorations.
- Task selection, dependencies, lifecycle, output, cancellation and problem matchers.
- Workspace-trust gating.

**Acceptance:** T-013, T-016 and T-023 pass for SCM/task fixtures.

### SMITH-021 Implement debugging presentation

**Outcome:** DAP-backed debugging works through terminal views.

**Work:**

- Debug configuration/start flow.
- Breakpoints, call stack, threads, variables, watches and debug console.
- Continue/pause/step/restart/stop controls and editor instruction markers.
- Reconnect/lost-session behavior.

**Acceptance:** T-017 and debug cases in T-019 pass with a real adapter.

### SMITH-022 Implement test-controller presentation

**Outcome:** Extensions can expose and run tests.

**Work:**

- Discovery hierarchy and incremental updates.
- Run/debug profiles, status, duration, output and source navigation.
- Failure messages and terminal-safe diffs.
- Reconnect and cancellation behavior.

**Acceptance:** T-018 and test cases in T-019 pass with a real controller.

### SMITH-023 Integrate extension management and contribution mapping

**Outcome:** Compatible Code OSS extensions install, activate and contribute terminal UI.

**Work:**

- Reuse extension scanning, install, enable/disable and host placement.
- Map commands, configuration, keybindings, tree views, status items, SCM, tasks, tests, debug, diagnostics and themes.
- Isolate extension-host crashes and activation hangs.
- Gate project-local extension execution with workspace trust.

**Acceptance:** T-014 and T-023 pass for the representative extension set.

### SMITH-024 Build extension compatibility registry and unsupported-surface UX

**Outcome:** Users know whether and how an extension works before relying on it.

**Work:**

- Static manifest/contribution inspection.
- Activation observation and evidence capture.
- Native/adapted/degraded/external/unsupported classification.
- Explicit handling for webviews, custom editors, notebooks, browser-only APIs and graphical contributions.
- Extensions view compatibility filters and explanations.

**Acceptance:** T-015 passes and the release compatibility manifest distinguishes unsupported from untested.

## Epic F — Product hardening and release

### SMITH-025 Implement workspace trust and protocol hardening

**Outcome:** Opening an untrusted repository cannot silently execute code or exhaust resources.

**Work:**

- Gate extensions, tasks, debug adapters, shell hooks and project executables.
- Validate protocol frames and contribution payloads.
- Enforce message, recursion, collection, rate and queue limits.
- Add fuzzing corpora and security response guidance.

**Acceptance:** T-023 and T-024 pass with no high-severity finding.

### SMITH-026 Implement observability, health and redacted evidence

**Outcome:** Failures are diagnosable without leaking user data.

**Work:**

- Structured logs and correlation IDs across SSH, agent, channels, extensions and UI.
- Health view for versions, capabilities, services, queues and last failures.
- Configurable redaction and safe protocol traces.
- Crash diagnostics and evidence manifest generation.

**Acceptance:** T-025 passes and injected failures identify the failed component and recovery action.

### SMITH-027 Build CI matrices, soak tests and release packaging

**Outcome:** Every release is reproducible and supported by immutable evidence.

**Work:**

- Client/host/terminal/SSH/extension matrices.
- Golden, E2E, performance, fault, fuzz and soak jobs.
- Client and multi-platform agent packaging.
- SBOM, licences, hashes, provenance, update metadata and retained evidence.

**Acceptance:** T-001 through T-028 required for the release scope pass from a clean release candidate.

## Project conventions

Recommended Smith Project fields:

- **Status:** Todo, In Progress, Done.
- **Epic:** Baseline, Remote, Terminal UI, Editor, Lifecycle, Hardening.
- **Priority:** P0, P1, P2.
- **Slice:** Spike, Vertical Editor, Workbench, Lifecycle, Release.
- **Risk:** High, Medium, Low.
- **Upstream area:** Remote, Platform, Workbench, Editor, Extension Host, Product.

Recommended initial priorities:

- P0: SMITH-001 through SMITH-014, SMITH-019, SMITH-023, SMITH-025.
- P1: SMITH-015 through SMITH-018, SMITH-020 through SMITH-022, SMITH-024, SMITH-026.
- P2: SMITH-027 after the vertical slice has stabilised, while CI foundations begin under SMITH-001.
