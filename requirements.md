# Smith Requirements

Status: Proposed
Date: 23 June 2026

## 1. Purpose

Smith is a terminal-native client for Code OSS workspaces. A developer connects from a terminal to a development host over SSH and receives an IDE experience comparable to VS Code: editing, navigation, terminals, source control, language services, debugging, tasks, tests, extensions, settings, and workspace state.

Smith is not a Neovim integration and is not a terminal skin driven by the public VS Code Extension API. It reuses the MIT-licensed Code OSS remote-agent protocol and as much of the Code OSS client/workbench service layer as practical, while implementing a terminal presentation layer.

## 2. Product boundary

### 2.1 Core model

- The local Smith client owns terminal rendering, input, layouts, commands, and client-side workbench state.
- A matching Smith remote agent runs on the development host.
- SSH installs, starts, authenticates, and tunnels the remote agent.
- The remote agent provides remote filesystem, file watching, PTYs, remote extension host, environment, extension management, and port-forwarding services.
- Smith builds its agent from the MIT-licensed Code OSS source. The Microsoft-distributed VS Code Server is not a runtime dependency.
- Client and agent releases are version matched because the Code OSS remote protocol is internal and version-coupled.

### 2.2 Compatibility definition

Smith compatibility means:

- supported Code OSS workspace, configuration, command, extension-host, SCM, debug, task, test, and remote-service models are reused or faithfully adapted;
- terminal-safe extensions operate through the Code OSS extension host;
- familiar VS Code concepts, command IDs, settings, keybindings, workspace files, and interactions are retained where terminal constraints allow;
- unsupported visual capabilities fail explicitly or receive a documented textual fallback.

It does not mean pixel equivalence or universal extension compatibility.

## 3. Scope

### 3.1 MVP scope

- Terminal clients on macOS, Linux, and Windows connecting to Linux and macOS development hosts.
- OpenSSH configuration, keys, agents, jump hosts, and host verification.
- Automated installation and startup of a matching remote Smith agent.
- Responsive TUI with editor groups, Explorer, Search, Source Control, Run and Debug, Extensions, Problems, Output, Tests, integrated terminals, status bar, command palette, quick picks, dialogs, and notifications.
- Keyboard-complete operation and first-class mouse support.
- Code OSS text models, configuration, command/keybinding services, extension-host RPC, and remote-agent services reused where technically viable.
- Language extensions, LSP clients, debug adapters, task providers, test controllers, SCM providers, tree views, status items, diagnostics, decorations, and themes within the compatibility contract.
- Crash-safe terminal restoration, reconnect behavior, workspace trust, logs, and recovery.

### 3.2 Deferred scope

- Windows development hosts.
- Native session daemon preserving a workbench after complete client termination.
- Collaboration and shared editing.
- Browser-hosted webviews and custom editors inside the terminal.
- Rich notebook output, image rendering, audio/video, and arbitrary HTML.
- Marketplace publishing under Microsoft branding or use of the Microsoft VS Code Marketplace without confirmed rights.

### 3.3 Explicit non-goals

- Depending on undocumented behavior of Microsoft’s packaged VS Code Server.
- Presenting the remote agent as though it sends rendered VS Code components.
- Implementing the entire Code OSS remote and extension protocol independently in Rust.
- Allowing project content to execute automatically before workspace trust.
- Claiming support for an extension until it passes the compatibility suite.

## 4. Users

- **Remote developer:** needs a complete development environment through SSH from a terminal.
- **Keyboard-focused developer:** expects discoverable commands, efficient navigation, and optional Vim/Emacs-style editing.
- **Extension user:** expects common language, debugger, source-control, task, and test extensions to work.
- **Maintainer:** needs a controlled Code OSS downstream with measurable upstream-integration cost.
- **Security administrator:** needs SSH-native access control, workspace trust, auditability, and no unexpected network listener.

## 5. Business requirements

| ID | Requirement | Success measure |
| --- | --- | --- |
| BR-001 | Deliver a credible IDE through a standard SSH terminal session. | At least 85% of defined core developer journeys complete without a GUI fallback. |
| BR-002 | Reuse Code OSS behavior and ecosystem rather than rebuilding an unrelated editor. | Architecture review confirms reuse of remote services, extension-host RPC, text/workbench models, and supported configuration contracts. |
| BR-003 | Keep the product legally and operationally independent of Microsoft’s packaged server. | Release contains only approved dependencies and Smith-built Code OSS artifacts; licence inventory passes. |
| BR-004 | Make terminal operation reliable across changing sizes and network conditions. | Resize, reconnect, latency, mouse, and terminal-restoration quality gates pass. |
| BR-005 | Keep upstream maintenance bounded. | A documented upstream update can be integrated and validated within five engineer-days for a routine monthly Code OSS release. |

## 6. User stories and acceptance criteria

### US-001 Connect to a remote workspace

As a developer, I want `smith ssh-host /workspace` to open the remote workspace so that I can start work without manually installing or starting services.

- AC-001.1: Smith uses the user’s OpenSSH configuration and host verification.
- AC-001.2: It selects, installs, validates, and starts the matching agent for the remote OS and architecture.
- AC-001.3: The remote listener is bound to a user-private socket or loopback endpoint and reached through SSH forwarding.
- AC-001.4: Version, authentication, installation, and startup failures produce actionable recovery steps.

### US-002 Edit source safely

As a developer, I want VS Code-class text editing so that remote work does not put source integrity at risk.

- AC-002.1: Open, edit, undo/redo, save, revert, diff, multi-cursor, selection, folding, and find/replace work for supported text files.
- AC-002.2: Byte, Unicode scalar, grapheme, display-cell, and UTF-16 positions are converted explicitly.
- AC-002.3: External changes and save conflicts never cause silent overwrite.
- AC-002.4: Abnormal client or connection loss does not corrupt source files.

### US-003 Navigate the workbench

As a developer, I want familiar views and commands so that I can work without relearning basic IDE operations.

- AC-003.1: Explorer, Search, Problems, Output, Source Control, Debug, Tests, Extensions, terminals, tabs, editor groups, quick picks, and command palette are present.
- AC-003.2: Every operation is keyboard accessible.
- AC-003.3: Supported mouse click, drag, wheel, selection, splitter, tab, tree, and context-menu interactions work.
- AC-003.4: Focus and hidden-view state remain coherent after layout changes.

### US-004 Resize fluidly

As a developer, I want Smith to adapt to terminal size so that it remains usable in a full screen, split pane, or small mobile terminal.

- AC-004.1: Layout is recomputed on every effective terminal-size change.
- AC-004.2: Wide, medium, narrow, short, and minimum-size modes have deterministic collapse rules.
- AC-004.3: Logical cursor, selection, scroll, and focused component are preserved where valid.
- AC-004.4: Resize bursts do not produce stale hit targets, corruption, or unbounded redraw work.

### US-005 Use remote terminals and processes

As a developer, I want integrated remote terminals and tasks so that builds and shells run beside the source and toolchain.

- AC-005.1: Remote PTYs support input, output, resize, scrollback, selection, copy, paste, exit, and reconnection semantics.
- AC-005.2: Child terminal escape sequences are decoded into an internal screen model instead of taking over Smith’s outer terminal.
- AC-005.3: Tasks expose lifecycle, output, cancellation, problem matching, and background status.

### US-006 Use extensions

As a developer, I want compatible Code OSS extensions to run so that language intelligence and workflow integrations remain available.

- AC-006.1: Smith runs a matching remote extension host using the Code OSS RPC contract.
- AC-006.2: Language, debugger, SCM, task, test, tree-view, status-item, diagnostic, and command contributions are mapped to terminal UI.
- AC-006.3: Unsupported contributions are identified before installation where possible and explained at activation time.
- AC-006.4: Extension failure is isolated and cannot corrupt the client or leave the terminal unusable.

### US-007 Debug and test

As a developer, I want debugging and test management so that the terminal client supports complete development cycles.

- AC-007.1: Breakpoints, call stack, variables, watches, debug console, stepping, restart, and stop are usable.
- AC-007.2: Test discovery, hierarchy, status, run/debug, output, duration, and source navigation are usable.
- AC-007.3: Existing supported `launch.json`, `tasks.json`, settings, and workspace files are retained.

### US-008 Work through connection failures

As a developer, I want predictable reconnect and recovery so that transient network loss does not destroy my session.

- AC-008.1: Connection states are visible as connecting, ready, degraded, reconnecting, disconnected, or failed.
- AC-008.2: Reconnect uses bounded backoff and restores services in dependency order.
- AC-008.3: Unsaved buffers, running tasks, debug sessions, and PTYs receive explicit recovered/lost state.
- AC-008.4: The terminal is restored after normal exit, panic, signal, failed startup, and forced disconnect.

### US-009 Trust the workspace

As a security-conscious developer, I want execution controlled by workspace trust so that opening a repository cannot silently run code.

- AC-009.1: Project-local agents, extensions, tasks, debug adapters, shell hooks, and executables are blocked until trusted.
- AC-009.2: Tokens, environment secrets, source content, and credentials are excluded from default logs.
- AC-009.3: Protocol messages and extension contributions are size-limited and validated.

### US-010 Maintain and release Smith

As a maintainer, I want a thin, testable Code OSS downstream so that releases remain supportable.

- AC-010.1: Downstream changes are isolated by explicit adaptation boundaries and tracked patches.
- AC-010.2: Client and agent artifacts record source commit, Smith version, protocol compatibility, licences, and hashes.
- AC-010.3: CI tests upstream merge compatibility, supported terminals, SSH paths, extensions, performance, recovery, and packaging.

## 7. Functional requirements

| ID | Requirement |
| --- | --- |
| FR-001 | Parse Smith commands and SSH targets without shell interpolation. |
| FR-002 | Discover host OS/architecture and install/start a matching user-scoped remote agent. |
| FR-003 | Implement authenticated, version-checked remote management, extension-host, and tunnel connections. |
| FR-004 | Reuse/adapt Code OSS remote filesystem, file-watching, environment, request, telemetry-policy, extension-management, PTY, and port-forwarding channels. |
| FR-005 | Provide terminal backend capability detection, raw mode, alternate screen, bracketed paste, focus events, SGR mouse, colour negotiation, and safe restoration. |
| FR-006 | Provide an immediate-mode, cell-diffed renderer with responsive constraint layout and overlays. |
| FR-007 | Provide per-frame hit regions and routed keyboard, mouse, paste, focus, and resize events. |
| FR-008 | Reuse/adapt Code OSS text models, edits, selections, undo/redo, language-feature registries, decorations, and diagnostics. |
| FR-009 | Implement terminal editor rendering including Unicode widths, wrapping, folds, cursors, selections, diff, completion, hover, signature help, and code actions. |
| FR-010 | Implement Explorer, Search, Problems, Output, Source Control, Debug, Tests, Extensions, terminal, status, command-palette, quick-pick, notification, and dialog presentations. |
| FR-011 | Integrate remote PTYs through a terminal-emulation screen model with bounded scrollback and backpressure. |
| FR-012 | Run compatible local/remote extension hosts and map supported extension contribution points to terminal components. |
| FR-013 | Detect and report unsupported webviews, custom editors, notebook renderers, browser-only APIs, and graphical contributions. |
| FR-014 | Preserve Code OSS configuration precedence, workspace files, commands, context keys, keybindings, workspace trust, profiles, and storage where supported. |
| FR-015 | Implement connection supervision, reconnection, service restart, cancellation, stale-result rejection, and recovery reporting. |
| FR-016 | Produce structured, redacted logs, health information, protocol traces, crash diagnostics, and release evidence. |
| FR-017 | Build matched client and remote-agent artifacts from pinned Code OSS source under an audited licence policy. |
| FR-018 | Maintain a compatibility manifest for Code OSS commit, protocol version, terminal capabilities, operating systems, and extension support. |

## 8. Non-functional requirements

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-001 | Local input latency | p95 input-to-frame submission under 16 ms on the reference host. |
| NFR-002 | Remote interaction latency | Smith adds under 20 ms p95 processing overhead, excluding network and remote tool latency. |
| NFR-003 | Resize responsiveness | Final resize frame submitted within 50 ms under normal load. |
| NFR-004 | Idle efficiency | No polling render loop; idle CPU effectively zero. |
| NFR-005 | Reliability | 1,000 edit/save operations and 100 connect/disconnect cycles without data loss or terminal corruption. |
| NFR-006 | Resource control | Bounded queues and memory for PTYs, search, diagnostics, logs, file events, and rendering. |
| NFR-007 | Security | No public listener by default; workspace trust and protocol validation gates pass. |
| NFR-008 | Accessibility | Keyboard-complete operation, visible focus, configurable contrast, and non-colour status indicators. |
| NFR-009 | Portability | Compatibility matrix covers nominated terminals on macOS, Linux, and Windows clients and Linux/macOS hosts. |
| NFR-010 | Maintainability | Routine monthly upstream integration target of five engineer-days or less. |
| NFR-011 | Legal compliance | SBOM and licence review show no unapproved dependency on Microsoft-distributed server or branding. |
| NFR-012 | Observability | Every failure includes state, component, timestamp, correlation ID, actionable message, and redacted context. |

## 9. Release definition

A Smith release is complete only when:

1. client and agent are built from the same approved Code OSS baseline;
2. all in-scope acceptance criteria map to implementation tasks and tests;
3. terminal, SSH, operating-system, and extension compatibility matrices pass;
4. security, workspace-trust, protocol-fuzzing, recovery, performance, and licence gates pass;
5. unsupported features are documented in the compatibility manifest;
6. install, upgrade, downgrade, reconnect, and uninstall paths are verified;
7. immutable evidence identifies source commits, artefact hashes, test results, licences, and known deviations.

Architecture is defined in [design.md](design.md), UX behavior and wireframes in [ux.md](ux.md), delivery sequencing in [delivery-plan.md](delivery-plan.md), current MVP status in [mvp-status.md](mvp-status.md), verification in [test.md](test.md), and implementation work in [backlog.md](backlog.md).
