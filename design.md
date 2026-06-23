# Smith Design

## 1. Design intent

Smith is a VS Code extension that provides a terminal-first Neovim workflow without claiming binary compatibility with the VS Code extension runtime. VS Code remains the workspace and tooling host; Neovim remains the editing engine. Smith owns the narrow, testable bridge between them.

Requirement identifiers are defined in [requirements.md](requirements.md). Verification identifiers and evidence rules are defined in [test.md](test.md).

## 2. System context

```text
Developer
   |
   v
VS Code Extension Host
   |-- Command and configuration UI
   |-- Workspace/document/diagnostic adapters
   |-- Session state and conflict coordinator
   |-- Structured logging and evidence hooks
   |
   +---- typed local bridge ---- Neovim process
                                  |-- Smith Lua client
                                  |-- buffers/cursor/selections
                                  |-- diagnostics and command requests
```

The bridge is local-only by default. It uses Neovim RPC or a generated local IPC endpoint, never a publicly listening socket.

## 3. Components

### 3.1 Extension activation and commands

Registers the commands required by FR-001 and activates only on explicit Smith commands or configured workspace use. It owns user-visible notifications and status-bar state.

### 3.2 Process manager

Implements FR-002 and FR-003. It resolves the executable, validates the supported version, starts Neovim with argument arrays rather than a shell string, observes exit/error events, and guarantees bounded termination.

### 3.3 Session state machine

Implements FR-008.

```text
stopped -> starting -> ready -> stopped
                  \-> degraded -> ready
                  \-> failed -> starting
ready -> degraded | failed | stopped
```

Transitions are explicit, logged, and unit tested. Commands reject invalid transitions with actionable messages.

### 3.4 Document synchronizer

Implements FR-004 and FR-005. Each update carries document URI, version, source, and correlation ID. Version checks and source markers prevent recursive loops. Conflicts never use last-writer-wins silently; the user chooses keep, reload, or compare.

### 3.5 VS Code capability adapters

Implements FR-006 and FR-007. Adapters expose a small protocol rather than the full extension host:

- execute an allow-listed command;
- read diagnostics for a URI;
- open/reveal a supported document;
- report cursor and selection;
- return typed success or error responses.

Each adapter can degrade independently.

### 3.6 Neovim client

A versioned Lua module connects to the bridge, maps buffers and diagnostics, and exposes Smith commands. Protocol negotiation rejects incompatible major versions and reports upgrade guidance.

### 3.7 Configuration and trust

Implements FR-009. User-level configuration may select an executable and arguments. Workspace-level executable or command changes require VS Code Workspace Trust and explicit confirmation. Values are validated against a schema before use.

### 3.8 Logging and evidence

Implements FR-010 and FR-012. Logs are JSON Lines with timestamp, level, event, state, and correlation ID. Source content, tokens, full environment values, and credentials are excluded by default. Tests write reports beneath `test-evidence/<run-id>/`; CI uploads that directory as a retained artifact.

## 4. Protocol principles

- Version every message envelope.
- Use typed JSON payloads over local RPC/IPC.
- Set request timeouts and cancellation behavior.
- Include correlation IDs and document versions.
- Cap payload size and reject unknown methods.
- Never interpolate workspace input into shell commands.
- Return actionable error codes suitable for UI and logs.

## 5. UX design

Smith is command-driven and intentionally quiet.

- Commands: Start, Stop, Restart, Show Log, Open Health, Run Bridged Command.
- Status-bar indicator: stopped, starting, ready, degraded, or failed.
- Notifications: only for actions requiring user attention; failures include a recovery action.
- Health view: executable/version, bridge status, active file, adapters, last error, and evidence-safe diagnostics.
- Conflict flow: Keep Neovim, Keep VS Code, Compare, Cancel.
- All actions are keyboard reachable and exposed through standard VS Code command and quick-pick controls.

UX validation uses extension-host automation plus task-based developer testing described in `test.md`. Screenshots are evidence, not the sole assertion mechanism.

## 6. Repository design

Planned structure:

```text
.github/workflows/quality.yml
src/extension/          VS Code activation, commands, state and adapters
src/protocol/           shared message schemas and validation
nvim/lua/smith/         Neovim client
scripts/                build, test and evidence entry points
tests/unit/             isolated TypeScript and Lua tests
tests/integration/      process, RPC and synchronization tests
tests/e2e/              VS Code extension-host workflows
tests/ux/               task scripts, accessibility and visual checks
test-evidence/          evidence schema and checked-in release summaries
requirements.md
design.md
test.md
```

## 7. Build environment

Reference developer environment:

- macOS latest supported release or Ubuntu latest LTS.
- Current Node.js LTS, pinned in `.nvmrc`.
- `npm ci` using a committed lock file.
- Current and previous VS Code stable releases for compatibility testing.
- A pinned supported Neovim release, initially `0.12.x`.
- TypeScript, ESLint, a unit-test runner, VS Code extension test tooling, Playwright for browser-visible surfaces where applicable, and an accessibility scanner.

Canonical commands to implement under FR-011:

```bash
npm ci
npm run build
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:ux
npm run test:traceability
npm run package
npm run test:all
```

`npm run test:all` is the developer-equivalent release gate. It must create a unique evidence directory and return non-zero on any required failure.

## 8. Test environment

The automated test environment starts an isolated VS Code extension host with:

- a generated temporary workspace and fixture files;
- a real pinned Neovim binary for integration/E2E tests;
- fake process and RPC adapters for deterministic unit tests;
- isolated user data and extension directories;
- no dependency on the developer's normal VS Code or Neovim configuration;
- screenshots, logs, JUnit, coverage, accessibility, performance, and traceability outputs.

A developer can reproduce CI with `npm run test:all`. UX tests run in a visible extension host when `SMITH_HEADLESS=0`; CI may use a virtual display while retaining screenshots/video/trace on failure.

## 9. Delivery increments

1. **Foundation:** repository, protocol, commands, process lifecycle, CI, evidence schema.
2. **Safe editing:** file/save/version synchronization and conflict handling.
3. **Navigation:** active file, cursor, and selection synchronization.
4. **Tooling bridge:** diagnostics and allow-listed command adapters.
5. **Product quality:** health UX, accessibility, performance, compatibility, packaging.

Each increment must satisfy the relevant completion rules in `requirements.md` and test gates in `test.md` before its work items are marked complete.

## 10. Key risks and controls

| Risk | Control | Verification |
| --- | --- | --- |
| File loss or overwrite | Versioned updates and explicit conflict UI | T-003, T-004, T-013 |
| Recursive synchronization | Source markers and idempotent updates | T-005 |
| Arbitrary command execution | Typed spawn arguments, allow-list, Workspace Trust | T-010, T-011 |
| Extension/API incompatibility | Version matrix and adapter isolation | T-006, T-016 |
| Flaky UI tests | Isolated profiles, deterministic fixtures, trace-on-retry | T-012, T-014 |
| Misleading release status | Automated traceability and evidence manifest | T-014, T-015 |
