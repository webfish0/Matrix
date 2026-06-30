# Smith Test Strategy and Plan

Status: Product MVP gate implemented; full release matrix planned
Date: 30 June 2026

## 1. Objective

Testing must prove that Smith is a safe terminal client for a matching Code OSS remote agent, not merely that individual widgets render. The release suite covers upstream compatibility, SSH bootstrap, remote protocols, editor correctness, terminal behavior, extension compatibility, responsive/mouse interaction, recovery, security, performance, licensing, and packaging.

## Product MVP test gate

`npm run verify:product-mvp` is the executable Product MVP gate. It must pass all of these independent evidence layers:

| Layer | Purpose | Current executable evidence |
| --- | --- | --- |
| Component | Pinpoint layout, input-routing, palette, search-navigation, editor, and mouse regressions quickly. | `T-008` through `T-011-*` |
| SSH integration | Prove file and process effects occur through disposable OpenSSH, not an in-memory fake. | `T-002`, `T-003`, `T-004`, `PMVP-001`, `PMVP-002` |
| Simulated user journey | Exercise broad UX states with deterministic screen assertions and remote readback. | `USER-MVP-001` |
| Black-box PTY journey | Launch the real CLI, send raw terminal bytes, resize the OS PTY, and observe only screen output and process state. | `USER-PTY-001` |
| Live user acceptance | Validate the user’s actual terminal emulator, SSH configuration, keyboard, mouse, and workflow. | Deliberately manual and currently pending |

The gate writes `test-evidence/product-mvp-gate/report.json` and `report.md`. Every prioritized MVP story must have passing lower-level evidence and a passing black-box PTY path. Required transcripts, frames, screenshots, and JUnit files are checked for existence.

The black-box PTY journey covers:

- F1, F2, `:`, Ctrl+P, Ctrl+S, Escape, Enter, printable input, and SGR mouse bytes through Node’s real terminal decoder;
- command filtering, shortcuts, execution, and disabled-command explanations;
- SSH workspace browse, edit, save, workspace search, selected-result navigation, and remote command execution;
- permission-denied save, preserved dirty state, permission recovery, retry, dirty-exit cancellation, and final save;
- real PTY resize through narrow, minimum, and recovered layouts;
- alternate-screen, mouse, cursor, raw-input lifecycle, process exit, normal restoration, and SIGHUP/SIGINT/SIGTERM restoration sequences;
- injected startup-output failure, idempotent lifecycle behavior, and conservative versus interactive capability profiles.

### Evidence honesty rules

- A direct method call is component evidence, not terminal evidence.
- A constructed key object is input-routing evidence, not proof of real terminal decoding.
- A disposable OpenSSH fixture is integration evidence, not proof against the user’s production host.
- A PTY transcript is automated black-box evidence, not live acceptance on Kitty, iTerm2, Windows Terminal, tmux, or another real emulator.
- A story is not reported covered when a required artifact or evidence layer is missing.
- Test failures retain partial PTY transcripts and user steps for diagnosis.

## 2. Test layers

- **Static:** TypeScript/Rust checks as applicable, lint, formatting, dependency review, secret scan, patch inventory, API-boundary rules.
- **Unit:** layout, cell diff, event routing, Unicode positions, protocol framing, configuration, state machines, redaction, compatibility classification.
- **Golden:** terminal frames at fixed dimensions and capabilities.
- **Integration:** real Smith agent, SSH, filesystem, PTY, extension host, Code OSS services, terminal parser, reconnect and process lifecycle.
- **End-to-end:** real terminal/PTY drives complete developer workflows against fixture repositories.
- **Compatibility:** Code OSS baselines, terminals, operating systems, SSH configurations and representative extensions.
- **Non-functional:** latency, throughput, memory, backpressure, soak, fault injection, security fuzzing, accessibility and licence compliance.

## 3. Environments

### 3.1 Client matrix

- macOS terminal clients: Terminal, iTerm2, Kitty, WezTerm.
- Linux terminal clients: GNOME Terminal, Kitty, WezTerm.
- Windows terminal clients: Windows Terminal through OpenSSH and WSL where applicable.
- tmux for each supported host family.
- Capability profiles: 16 colour, 256 colour, true colour, legacy keyboard, Kitty keyboard, mouse enabled/disabled, OSC 52 enabled/disabled.

### 3.2 Remote-host matrix

- Current Ubuntu LTS and previous Ubuntu LTS.
- Current supported macOS and previous supported macOS.
- x64 and arm64 where CI or release hardware permits.
- OpenSSH direct, config alias, non-default port, ProxyJump, agent forwarding policy, slow link and intermittent link.

### 3.3 Code OSS and extension matrix

- Pinned production Code OSS commit.
- Candidate next-upstream commit on a scheduled integration branch.
- Representative extensions for language/LSP, debugger, SCM, tasks, tests, tree views, status items, themes, webviews, custom editors and notebooks.

Every matrix entry records `native`, `adapted`, `degraded`, `external`, `unsupported`, or `failed`.

## 4. Hermetic test system

Tests use:

- disposable local HOME, SSH config, known_hosts, agent directory, workspace, settings, storage and extension directories;
- container or VM SSH targets with deterministic fixture repositories;
- generated host keys and ephemeral ports;
- matching signed/hash-verified Smith client and agent artifacts;
- stub remote channels and extension hosts for fault injection;
- real Code OSS extension host and selected real extensions for compatibility;
- pseudo-terminal drivers that record input events and output cell frames;
- network shaping for latency, jitter, bandwidth reduction, packet loss and disconnect.

Tests must not read or modify the developer’s normal SSH, VS Code, terminal, Git or extension state.

## 5. Evidence

Delivery slices and issue completion must follow the evidence gates in [delivery-plan.md](delivery-plan.md).

Each run writes `test-evidence/<run-id>/manifest.json` containing:

- Smith version, repository commit and Code OSS upstream commit;
- client and agent hashes, source provenance and SBOM hashes;
- OS, architecture, terminal, terminal capabilities and dimensions;
- SSH topology and network-shaping profile;
- extension IDs and versions;
- test IDs, requirement IDs, result, duration and retries;
- paths and hashes for frames, logs, traces, crash dumps and reports;
- known deviations and approval.

Expected outputs:

```text
test-evidence/<run-id>/
  manifest.json
  junit/
  coverage/
  golden/
  terminal-events/
  protocol-traces/
  screenshots/
  performance/
  compatibility/
  security/
  licences/
  logs/
```

Source content, credentials, connection tokens, private keys and environment secrets must not appear in evidence.

### 5.1 User-perspective evidence

Product MVP user-facing tests must be written as user journeys, not internal command scripts. Each operation should record:

- the user's goal;
- the visible terminal cue or feedback the user observes before acting;
- the terminal action taken, such as key press, typed text, mouse click, or resize;
- the visible result the user sees after the action;
- any remote readback needed to prove the visible action changed the SSH workspace safely.

The manual Product MVP journey writes:

```text
test-evidence/manual-product-mvp/user-journey.json
test-evidence/manual-product-mvp/transcript.txt
test-evidence/manual-product-mvp/frames/
test-evidence/manual-product-mvp/screenshots/frames/
```

Tests should fail if a required action depends on hidden knowledge. Missing labels, missing recovery hints, hidden mode exits, or output that is not visible to the user are UX defects.

Keyboard evidence must include actual terminal keypress objects or sequences for advertised bindings. Logical action labels alone are insufficient because terminal modifiers such as `Ctrl+Shift` may be unavailable or indistinguishable from other chords.

## 6. Planned verification

| ID | Test | Requirements | Pass condition |
| --- | --- | --- | --- |
| T-001 | Build matched client and agent | FR-017, FR-018, AC-010.2 | Artifacts identify the same approved Code OSS commit and pass hash/provenance checks |
| T-002 | SSH host resolution and bootstrap | FR-001, FR-002, AC-001.1–4 | Direct/config/port/ProxyJump targets install and start correctly; failures are actionable |
| T-003 | Remote handshake and connection types | FR-003, FR-004 | Authentication, management, extension-host and tunnel connections pass valid/invalid/version cases |
| T-004 | Remote filesystem and watching | FR-004, US-002 | Read/write/rename/delete/watch/save-conflict semantics match expected Code OSS behavior |
| T-005 | Terminal startup and restoration | FR-005, AC-008.4 | Modes restore after normal exit, exception, signal, failed startup and forced disconnect |
| T-006 | Unicode editor correctness | FR-008, FR-009, AC-002.2 | Property tests cover UTF-8/UTF-16, graphemes, combining marks, wide cells, tabs and wrapping |
| T-007 | Editing and save safety | US-002, NFR-005 | Undo/redo, multi-cursor, diff, external change and conflict cases cause no silent overwrite/data loss |
| T-008 | Golden workbench rendering | FR-006, FR-009, FR-010 | Approved cell frames match across dimensions, colour profiles and representative states |
| T-009 | Responsive resize | US-004, NFR-003 | Layout, focus, cursor, selection, scroll and hit regions remain correct through resize bursts |
| T-010 | Keyboard commands and collisions | FR-007, FR-014, NFR-008 | All core commands keyboard reachable; terminal collisions are reported and remappable |
| T-011 | Mouse interaction | FR-007, AC-003.3 | Click, drag, wheel, selection, splitters, tabs, trees and menus route to current topmost hit targets |
| T-012 | Integrated terminal compatibility | FR-011, US-005 | Shells and representative child TUIs handle input, alternate screen, paste, mouse, resize and exit |
| T-013 | Workbench view journeys | FR-010, US-003 | Explorer, Search, Problems, Output, SCM, Debug, Tests, Extensions and terminals complete scripted journeys |
| T-014 | Extension host and contribution mapping | FR-012, US-006 | Supported contribution types activate, render and execute through the matching extension host |
| T-015 | Unsupported extension surfaces | FR-013, AC-006.3 | Webview/custom-editor/notebook/browser-only fixtures are classified and fail/degrade explicitly |
| T-016 | Configuration, keybindings and workspace files | FR-014, US-007 | Settings precedence, context keys, commands, profiles, storage, tasks and launch files remain compatible |
| T-017 | Debug lifecycle | US-007 | Breakpoints, stepping, stack, variables, watches, console, restart and stop work with a real adapter |
| T-018 | Test-controller lifecycle | US-007 | Discovery, hierarchy, run/debug, output, status and source navigation work with a real controller |
| T-019 | Reconnect and recovery | FR-015, US-008 | Injected disconnects restore services in order and classify every buffer/PTY/task/debug/test resource |
| T-020 | Queue and backpressure limits | NFR-006 | PTY/search/watch/diagnostic/log floods remain bounded and input remains responsive |
| T-021 | Performance budgets | NFR-001–4 | Input, resize, idle CPU, startup, frame size and remote-overhead budgets pass |
| T-022 | Reliability soak | NFR-005 | 1,000 edits/saves and 100 connection cycles complete without corruption, leak or stuck terminal mode |
| T-023 | Workspace trust and execution policy | US-009, NFR-007 | Untrusted project executables/extensions/tasks/adapters/hooks cannot run without approval |
| T-024 | Protocol and contribution fuzzing | FR-003, FR-012, FR-013, NFR-007 | Malformed/oversized/deep/rate-abusive input is rejected without crash or unbounded allocation |
| T-025 | Log and evidence redaction | FR-016, AC-009.2 | Seeded secrets, tokens, source and private-key material are absent from default outputs |
| T-026 | Licence, branding and SBOM gate | BR-003, NFR-011 | Approved Code OSS provenance; no Microsoft-packaged server/branding/service dependency |
| T-027 | Upstream rebase rehearsal | BR-005, NFR-010 | Candidate upstream builds and tests; conflicts and effort are measured against budget |
| T-028 | Install, update, rollback and uninstall | AC-001.2, AC-010.2 | Side-by-side agent versions, rollback, cleanup and interrupted update are safe and repeatable |

## 7. Golden rendering coverage

Golden cases include:

- empty, loading, populated, error and disconnected states for every workbench view;
- editor with ASCII, emoji, CJK, combining marks, right-to-left text limitations, tabs, control characters and long lines;
- multiple cursors, selections, diagnostics, breakpoints, folds, inlays, completion, hover and diff;
- wide/medium/narrow/short/minimum layouts;
- 16/256/true-colour themes and no-colour mode;
- overlays near all screen edges;
- mouse hit-region visualisation in a test-only frame;
- child terminal normal/alternate screens and scrollback.

Golden updates require a reviewed semantic explanation. Bulk regeneration without review fails the release process.

## 8. Extension compatibility suite

For each selected extension:

1. statically inspect `extensionKind`, activation events, contribution points, browser/main entry points and declared capabilities;
2. install into an isolated Smith profile;
3. activate against a fixture workspace;
4. exercise contributed commands and views;
5. record extension-host placement and protocol errors;
6. verify terminal presentation or explicit limitation;
7. assign a compatibility level with evidence.

The release manifest must distinguish “not tested” from “unsupported.”

## 9. Fault injection

Inject failure at:

- SSH authentication, host-key check, ProxyJump and forwarding;
- agent upload, hash verification, permissions, startup and version negotiation;
- management and extension-host channel framing;
- remote filesystem latency, permission, disk-full and watch overflow;
- extension-host crash and activation hang;
- PTY flood, malformed escape sequence and child process hang;
- client exception during render and terminal-mode transition;
- disconnect during save, task, debug step, terminal output and extension installation.

No failure may leave the outer terminal in raw mode without cursor restoration after process exit.

## 10. Performance method

- Measure terminal event receipt, state transition, layout, component render, cell diff, bytes emitted and frame submission separately.
- Report warm and cold startup.
- Use fixed repositories and extension sets.
- Test local loopback and shaped 20/80/200 ms RTT links.
- Record p50, p95, p99, maximum, allocation and queue depth.
- Fail on statistically significant regression beyond the agreed tolerance, not only absolute thresholds.

## 11. Entry and exit gates

### Change entry

- requirement/task IDs and compatibility impact identified;
- upstream modules and adaptation boundary named;
- expected terminal, SSH, extension and security effects documented;
- tests planned before implementation.

### Release exit

- T-001 through T-028 required for the release scope pass;
- no open data-loss, terminal-restoration, authentication, trust-bypass or licence defect;
- no unbounded queue or known crash from untrusted protocol/extension input;
- compatibility manifest and unsupported-feature documentation are current;
- upstream rebase rehearsal is within the maintenance budget or has an approved remediation plan;
- evidence manifest validates and all referenced artifacts exist.

## 12. Traceability

- Stable IDs are never reused.
- Test names include `T-*` IDs and metadata declares covered `BR/US/AC/FR/NFR` IDs.
- Backlog items declare requirements and tests.
- CI fails for unknown, duplicate, missing or orphaned identifiers.
- Requirement changes update design, tests, backlog and compatibility policy in the same pull request.
