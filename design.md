# Smith Architecture and Design

Status: Proposed
Date: 23 June 2026

## 1. Decision summary

Smith will be a terminal presentation for a thin Code OSS downstream.

It will reuse the existing Code OSS remote-agent and extension-host interfaces, but it will not assume that the server sends rendered UI. The client still owns workbench models, commands, layouts, editor presentation, contribution rendering, keyboard/mouse routing, and most user interaction.

The distributable product will use a Smith-built remote agent from MIT-licensed Code OSS source. It will not require Microsoft’s packaged VS Code Server, whose separate licence limits use and combination with other applications.

## 2. Why a downstream is required

The remote-agent protocol is usable source code but not a stable public SDK:

- it is internal, version-coupled, and may change with each Code OSS commit;
- the handshake, management connection, extension-host connection, tunnels, channels, URI transforms, reconnection, and serialization are implemented in internal modules;
- reusable client services are not published as supported standalone packages;
- workbench services depend on Code OSS dependency injection, lifecycle, configuration, context keys, storage, and product metadata.

A clean independent client could reproduce these interfaces, but that would duplicate a large, changing compatibility layer. Smith therefore tracks Code OSS upstream and keeps terminal-specific changes behind narrow adapters.

“Fork” means a controlled downstream branch, not wholesale divergence:

```text
Code OSS upstream
       |
       v
Smith downstream
├── pinned upstream commit
├── mostly unchanged remote agent
├── reused client/workbench services
├── terminal-specific service implementations
└── Smith product, build, tests, packaging, and compatibility policy
```

## 3. System context

```text
┌─────────────────────────────────────────────────────────────────┐
│ Local terminal                                                   │
│                                                                  │
│ Smith client                                                     │
│ ├─ Code OSS compatibility/workbench core                         │
│ │  ├─ lifecycle, configuration, storage, context keys             │
│ │  ├─ text models, commands, keybindings, language features       │
│ │  ├─ SCM, debug, task, test, extension and workspace services    │
│ │  └─ remote-agent and extension-host clients                     │
│ ├─ terminal presentation                                         │
│ │  ├─ responsive layout and component tree                       │
│ │  ├─ editor, lists, trees, panels, overlays and status           │
│ │  └─ keyboard, mouse, paste, focus and hit testing               │
│ └─ terminal backend                                              │
│    ├─ capability detection and event decoding                     │
│    └─ off-screen cell buffer and diff output                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │ internal Code OSS IPC streams
                             │ through SSH forwarding
┌────────────────────────────▼─────────────────────────────────────┐
│ Remote development host                                          │
│ Smith remote agent built from matching Code OSS source            │
│ ├─ management connection and authentication                       │
│ ├─ remote filesystem and file watching                            │
│ ├─ PTYs, processes and remote environment                         │
│ ├─ remote extension host                                          │
│ ├─ extension management                                           │
│ └─ tunnels and port forwarding                                    │
└──────────────────────────────────────────────────────────────────┘
```

SSH is the bootstrap, authentication, encryption, and forwarding mechanism. The Smith protocol begins only after SSH establishes a private path to the agent.

## 4. Process architecture

### 4.1 Recommended first implementation

Use one TypeScript/Node.js client process for the first vertical slice:

- consume Code OSS internal TypeScript modules directly;
- implement a terminal backend and terminal UI in TypeScript;
- use a mature terminal I/O library or a small native module where necessary;
- avoid an additional cross-process protocol until architectural seams are proven.

This minimises integration risk while the correct Code OSS service boundary is discovered.

### 4.2 Optional later split

If profiling or platform constraints justify it, split rendering into a Rust process:

```text
TypeScript compatibility core ⇄ versioned local IPC ⇄ Rust Ratatui renderer
```

The local protocol would carry semantic view models, commands, input events, rectangles, styles, and accessibility metadata. It must not carry Code OSS remote-agent or extension-host RPC directly. Rust would remain a renderer/input engine, not a second implementation of VS Code internals.

### 4.3 Remote agent lifecycle

1. Parse `smith [ssh options] host [workspace]`.
2. Resolve host through OpenSSH configuration.
3. Establish SSH and verify host identity using normal OpenSSH behavior.
4. Probe remote OS, architecture, runtime directory, and existing agent.
5. Select an agent matching the Smith release and Code OSS commit.
6. Upload to a versioned, user-owned directory if absent.
7. Verify hash, permissions, and executable provenance.
8. Start with a random short-lived connection token on a private Unix socket or loopback port.
9. Forward the endpoint through SSH.
10. Establish and authenticate the management connection.
11. Open remote-services and extension-host connections.
12. Open the workspace only after trust and configuration policy are resolved.

Updates install side by side. Downgrade and rollback select the previous version rather than mutating a live agent.

## 5. Source and adaptation strategy

Classify upstream modules into four groups:

| Group | Treatment |
| --- | --- |
| Remote agent and protocol | Reuse with minimal product/build adaptation |
| UI-independent platform/workbench services | Reuse directly or through thin dependency adapters |
| Browser/Electron service implementation | Replace with terminal implementation |
| DOM/pixel/HTML-only feature | Provide textual alternative, external browser handoff, or declare unsupported |

Maintain a machine-readable inventory recording:

- upstream path and commit;
- reuse classification;
- Smith adapter/implementation;
- tests covering the boundary;
- known upstream conflicts;
- licence and notices.

Do not patch upstream modules merely to make imports convenient. Prefer terminal implementations of existing service interfaces and explicit composition roots. Each unavoidable patch gets an owner, rationale, upstream issue/reference where applicable, and rebase test.

## 6. Client architecture

### 6.1 Application state and event flow

Use unidirectional event handling:

```text
terminal/remote/extension event
        → typed command or service event
        → workbench state transition
        → invalidated component set
        → layout and render
```

UI components do not spawn processes or mutate remote state directly. They invoke commands or services. Long-running operations carry cancellation tokens, correlation IDs, and document/workspace versions. Stale search, completion, file, diagnostic, and extension results are discarded.

### 6.2 Terminal platform

On startup:

- verify stdin/stdout are TTYs;
- enter raw mode and alternate screen;
- enable bracketed paste, focus events, and SGR mouse reporting;
- detect UTF-8, colour depth, underline capability, keyboard protocol, hyperlinks, and clipboard policy;
- register restoration for normal exit, exceptions, signals, and failed startup.

Baseline support must not require a particular emulator. Optional enhancements include Kitty keyboard protocol, true colour, coloured underlines, OSC 8 links, and size-limited OSC 52 clipboard.

### 6.3 Rendering

Use immediate-mode, cell-based rendering:

1. snapshot the state needed by the frame;
2. solve the responsive layout;
3. render components into an off-screen cell grid;
4. combine overlays by z-order;
5. diff against the previous grid;
6. emit changed cells, cursor state, and terminal-mode changes.

Rendering is event driven, not a permanent animation loop. Queues are bounded. Progress animations use a low maximum frame rate.

### 6.4 Responsive layout

Each component declares minimum, preferred, and maximum size; collapse priority; overlay capability; and state-preservation behavior.

| Mode | Guideline | Default composition |
| --- | ---: | --- |
| Wide | 120+ columns | activity rail, primary side bar, editor groups, optional secondary side bar, bottom panel |
| Medium | 80–119 columns | narrower side bar, secondary side bar as tab/overlay, constrained panel |
| Narrow | below 80 columns | editor-first; side bars and panels become overlays |
| Short | below 24 rows | hide breadcrumbs/tabs before editor; panel becomes full-screen overlay |
| Minimum | below supported dimensions | show a resize message while retaining state |

Resize events are coalesced for approximately one frame interval. Smith rereads the real terminal size, recomputes every rectangle, rebuilds hit regions, clamps scroll state, preserves the logical cursor/focus, and forces one full repaint.

### 6.5 Input and mouse

Commands have stable IDs and context expressions. Keybindings are terminal-aware and report indistinguishable combinations rather than silently colliding. Defaults are VS Code-like, with optional Vim and Emacs editing modes.

Every frame registers semantic hit regions:

```text
rectangle + z-index + component + target + supported gestures
```

The topmost region receives click, double/triple click, drag, wheel, hover where available, and context-menu events. Supported interactions include editor positioning/selection, tree expansion, tab activation/reorder, splitter resize, scrollbar movement, terminal selection, buttons, and menus. Every mouse action has a keyboard equivalent.

### 6.6 Editor presentation

Reuse Code OSS text models and edit/language-feature infrastructure where possible. Replace Monaco’s DOM renderer with a terminal renderer handling:

- line numbers, glyph margin, breakpoints, diagnostics, SCM changes, folds;
- grapheme-aware cursor movement and display-cell width;
- tabs, wide characters, combining marks, control characters, and configurable invisibles;
- selections, multiple cursors, rectangular selection, matching brackets;
- horizontal/vertical scrolling and soft wrapping;
- syntax and semantic tokens;
- inline/inlay decorations subject to terminal capability;
- completion, hover, signature help, rename, code actions, snippets, peek/navigation;
- side-by-side and inline diff;
- degraded merge editor initially, followed by structured merge presentation.

Position units must be represented by distinct types. Byte offsets, UTF-16 LSP positions, Unicode scalars, graphemes, and display columns cannot share raw integers without conversion.

### 6.7 Workbench presentations

Provide terminal implementations for:

- activity bar and status bar;
- title/workspace indicator and editor tabs;
- Explorer and outline trees;
- Search and replace results;
- Source Control repositories, changes, staging, diff and commit input;
- Problems and Output;
- Run and Debug views, toolbar, call stack, variables, watches and breakpoints;
- Tests hierarchy, status and output;
- Extensions search, installed state, enable/disable and compatibility;
- terminals and terminal tabs;
- command palette, quick pick/input, menus, context menus;
- notifications, progress, dialogs, authentication prompts and trust UI;
- settings and keybinding editors, with a structured form plus JSON fallback.

Models/controllers should be reused; only presentation and terminal interaction should be replaced.

### 6.8 Integrated terminal

Remote PTY bytes cannot be passed directly to the outer terminal while Smith owns the screen. Each PTY therefore has:

- remote PTY lifecycle through the agent channel;
- a terminal-emulation parser and screen state;
- normal and alternate child screens;
- styles, cursor, modes, hyperlinks and bounded scrollback;
- selection/copy state and search;
- resize propagation and backpressure.

When focused, ordinary input is encoded for the child PTY. A configurable escape chord returns to Smith command mode. Bracketed paste semantics are preserved.

## 7. Remote and extension compatibility

### 7.1 Remote protocol

Smith reuses the matching Code OSS implementation for:

- handshake and connection-token validation;
- management, extension-host, and tunnel connection types;
- persistent/reconnecting transport;
- channel registration and multiplexing;
- URI transformation;
- remote environment and authority resolution;
- filesystem and watcher channels;
- PTY/terminal channels;
- extension scanning, installation, and management;
- request/download support and port forwarding.

This is an internal compatibility contract. Smith releases pin a Code OSS commit and reject incompatible agents with upgrade/downgrade instructions.

### 7.2 Extension compatibility levels

| Level | Meaning |
| --- | --- |
| Native | Works without Smith-specific adaptation and passes automated compatibility tests |
| Adapted | Works through a documented Smith terminal adapter |
| Degraded | Core function works but visual/secondary features are unavailable |
| External | Opens an explicit browser/external viewer for an unsupported rich surface |
| Unsupported | Installation or activation is blocked/explained |

Expected early support:

- language extensions and LSP clients;
- debug adapters;
- SCM, task and test providers;
- commands, configuration and context keys;
- tree views and status-bar items;
- diagnostics, semantic tokens and decorations;
- themes mapped to terminal colours.

Expected early limitations:

- webviews and webview views;
- custom HTML editors;
- notebook renderers and rich MIME output;
- browser/Electron API assumptions;
- pixel-positioned decorations and graphical canvases;
- extensions relying on undocumented workbench internals.

Extension manifests are statically inspected, then activation is sandbox-observed. The compatibility registry records tested version, host placement, result, limitations, and evidence.

## 8. Security and licensing

- SSH remains the external security boundary.
- Agent endpoints are private and token authenticated.
- Agent files, sockets, tokens, logs, recovery data, and extension state use user-only permissions.
- Workspace trust gates project-local code, tasks, debug adapters, extensions, shell integration, and executable configuration.
- Protocol decoders enforce frame, message, string, collection, recursion, and rate limits.
- Logs are structured and redact source, environment secrets, tokens, credentials, and user-configured patterns.
- Build outputs include SBOM, licence notices, source commit, hashes, and reproducibility metadata.
- Microsoft trademarks, branding, update services, telemetry endpoints, packaged VS Code Server, and marketplace services are excluded unless separately authorised.

## 9. Reliability and recovery

Connection supervisor state:

```text
idle → connecting → authenticating → starting-agent → ready
  └──────────────────────── failures ───────────────→ failed
ready → degraded → reconnecting → ready
ready/degraded/reconnecting → disconnected
```

Services restore in dependency order: management transport, environment/filesystem, workspace/configuration, extension host, terminals/tasks/debug/tests. Each restored resource reports `restored`, `restarted`, `lost`, or `requires-user-action`.

Unsaved client buffers remain local during network loss. Saves are disabled or queued only under an explicit policy; Smith never claims a save succeeded without remote acknowledgement. Recovery snapshots are separate from source files.

## 10. Repository and build structure

Proposed layout:

```text
upstream/                       pinned Code OSS source or reproducible fetch metadata
patches/                        small documented downstream patch series
src/bootstrap/                  CLI, SSH and remote agent lifecycle
src/product/                    Smith product metadata and composition roots
src/terminal/                   terminal backend, capabilities, events and renderer
src/workbench-terminal/         terminal workbench/editor component implementations
src/compatibility/              extension and upstream compatibility manifests
src/ipc/                        optional local renderer protocol
scripts/upstream/               fetch, update, classify and patch validation
scripts/release/                packaging, SBOM, licence and signing
tests/unit/
tests/golden/
tests/integration/
tests/e2e/
tests/compatibility/
tests/performance/
test-evidence/
requirements.md
design.md
test.md
backlog.md
```

## 11. Delivery slices

1. **Architecture spikes:** prove Code OSS build, remote handshake, one remote channel, text-model reuse, terminal rendering, Unicode, mouse and resize.
2. **Vertical editor slice:** SSH bootstrap, remote files, one editor, save/conflict handling, command palette, Explorer, one language extension and one terminal.
3. **Workbench baseline:** searches, panels, settings, keybindings, SCM, Problems, Output, extension management and responsive modes.
4. **Development lifecycle:** tasks, debugging, testing, terminals, port forwarding and reconnect.
5. **Compatibility and release:** extension registry, upstream automation, security hardening, matrices, packaging, SBOM and licence review.

Each slice has a stop/go review. If direct reuse of a Code OSS subsystem costs more than adapting its stable model boundary, the architecture review may approve a Smith implementation while preserving compatibility tests.

## 12. Architecture decisions

### ADR-001: Use a thin Code OSS downstream

Accepted. Internal client services are not a supported package and the remote protocol is version-coupled.

### ADR-002: Reuse the remote-agent interface

Accepted. Smith will reuse matching Code OSS remote implementations rather than define a competing remote IDE protocol.

### ADR-003: Build and distribute a Smith agent from Code OSS source

Accepted. Microsoft’s packaged VS Code Server is not a Smith dependency.

### ADR-004: Keep presentation client-side

Accepted. The remote agent exposes services, not rendered Explorer/editor/workbench components.

### ADR-005: Start with a TypeScript terminal client

Accepted for the first vertical slice. This reduces impedance with Code OSS internals. A Rust renderer remains an optimisation option behind local IPC.

### ADR-006: Immediate-mode terminal rendering

Accepted. Off-screen cell buffers, diff output, responsive constraints, and per-frame hit regions support resize, performance, and mouse correctness.

### ADR-007: Compatibility is tiered, not universal

Accepted. HTML- and pixel-dependent extension surfaces require degraded, external, or unsupported classifications.

### ADR-008: Version-match client and agent

Accepted. Smith does not promise wire compatibility across arbitrary Code OSS commits.

## 13. Primary technical risks

| Risk | Control |
| --- | --- |
| Code OSS internals are tightly coupled to DOM/Electron services | Prove composition boundary in spikes; replace service interfaces, not arbitrary call sites |
| Upstream merges become expensive | Patch inventory, automated rebase build, monthly cadence, conflict budget |
| Terminal editor quality is below Monaco | Reuse text models; invest in Unicode/golden tests and editor-specific performance budgets |
| Extension compatibility is overstated | Tiered registry, static contribution scan, activation tests and explicit unsupported UX |
| Child TUIs break integrated terminal | Proven terminal parser/model, mode tests, backpressure and PTY compatibility fixtures |
| SSH bootstrap becomes platform-specific | Delegate host resolution/authentication to OpenSSH and isolate remote installer adapters |
| Microsoft licence or branding contamination | Smith-built Code OSS artifacts, SBOM/licence gates and legal review before distribution |
| Slow links amplify redraw and event volume | Cell diffing, event coalescing, cancellation, bounded queues and network shaping tests |

## 14. References

- [Code OSS source and MIT licence](https://github.com/microsoft/vscode)
- [Code OSS remote extension-host agent server](https://github.com/microsoft/vscode/blob/main/src/vs/server/node/remoteExtensionHostAgentServer.ts)
- [Code OSS remote-agent connection client](https://github.com/microsoft/vscode/blob/main/src/vs/platform/remote/common/remoteAgentConnection.ts)
- [Code OSS server service registration](https://github.com/microsoft/vscode/blob/main/src/vs/server/node/serverServices.ts)
- [VS Code Server licence](https://code.visualstudio.com/license/server)
- [VS Code Remote SSH documentation](https://code.visualstudio.com/docs/remote/ssh)
- [Smith UX specification and wireframes](ux.md)
- [Smith delivery plan](delivery-plan.md)
