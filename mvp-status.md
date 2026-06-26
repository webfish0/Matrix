# Smith Product MVP Status

Status: Usable terminal IDE vertical slice implemented; pending live user acceptance
Date: 26 June 2026
Verified commit: the repository commit containing this status update

## Product MVP boundary

Product MVP means a basic VS Code-like IDE accessible over a terminal through SSH. Language extensions/LSP are explicitly deferred until after MVP.

The previous implementation and evidence proved SSH-backed primitives and a command-driven smoke path. The current implementation replaces that prompt with a screen-oriented terminal workbench and scripted end-user workflow evidence. Live user acceptance is still required before closing the Product MVP gate.

The usable MVP boundary is defined by:

- [terminal-ide-style-guide.md](terminal-ide-style-guide.md)
- [terminal-ide-user-stories.md](terminal-ide-user-stories.md)

A Product MVP cannot be called complete until the prioritized MVP user stories in that document pass with end-user style evidence and a real user can reproduce the core flow.

## Confirmed command

```bash
npm run verify:product-mvp
```

Result: passed locally against a disposable localhost OpenSSH server.

## Manual command

Run:

```bash
npm run smith -- ide-demo
```

This starts a disposable localhost OpenSSH server, connects Smith to it over SSH, opens a temporary remote workspace, and enters the full-screen terminal IDE.

To connect to a supplied SSH target:

```bash
npm run smith -- ide --host <host> --workspace <remote-path> --identity <private-key> --user <user> --port <port>
```

Primary keys:

```text
?              context help
Tab            move focus
Enter          open/toggle Explorer selection
i              enter Insert mode in the editor
Esc            leave Insert/Search/Terminal/help state
Ctrl+S         save active file
/              workspace search
Ctrl+Shift+P   command palette
Ctrl+P         quick open
Ctrl+`         integrated remote terminal
q              quit; dirty buffers require confirmation
```

## Confirmed usable vertical slice

The existing verification confirms:

| Capability | Evidence |
| --- | --- |
| Open SSH workspace | Disposable `sshd` starts locally and Smith connects over OpenSSH with a temporary key. |
| Browse remote workspace | Remote workspace directory is listed over SSH. |
| Open remote file | Remote `src/app.ts` is read over SSH. |
| Edit and save remote file | Remote `src/app.ts` is modified and read back over SSH. |
| Search remote workspace | Remote text search finds the edited content. |
| Run remote terminal command | Remote `/bin/echo terminal-ok` executes over SSH. |
| Render terminal workbench | Workbench frame with Explorer/editor/panel/status/minibuffer/status line is captured under `test-evidence/product-mvp/frames/`. |
| Screen-oriented manual flow | `npm run smith -- ide-demo` opens a full-screen terminal workbench. |
| End-user workflow evidence | Scripted workflow uses help, command palette, mouse click, Explorer, Insert mode, save, create, rename, delete-cancel, delete-confirm, search, terminal, resize, dirty-exit cancellation, and quit. |

Existing evidence:

```text
test-evidence/product-mvp/manifest.json
test-evidence/product-mvp/results.json
test-evidence/product-mvp/junit/product-mvp.xml
test-evidence/product-mvp/frames/workbench-100x30.txt
test-evidence/manual-product-mvp/transcript.txt
test-evidence/manual-product-mvp/screenshots/manual-session.png
test-evidence/product-mvp/screenshots/workbench-100x30.png
```

## Confirmed foundation scope

The current implementation confirms the executable foundation across MVP-0 through MVP-4:

| Slice | Confirmed capability | Tests |
| --- | --- | --- |
| MVP-0 Engineering foundation | Pinned Code OSS baseline metadata, Smith product policy, module inventory, deterministic artifact metadata, evidence skeleton | T-001, T-026, T-027-smoke |
| MVP-1 Remote connection spine | OpenSSH target resolution through `ssh -G`, shell-metacharacter rejection, versioned remote-agent install plan, handshake compatibility policy, `smith connect-plan` smoke path | T-002, T-002-security, T-002-parser, T-003, T-005-startup-smoke |
| MVP-2 Terminal workbench shell | Responsive layout modes, deterministic workbench frame rendering, keyboard command resolution, mouse hit-region routing, bounded internal terminal screen model | T-008, T-009, T-010, T-011, T-012-smoke |
| MVP-3 Remote editing and workspace navigation | Workspace file service, text buffer edit/undo/redo/save-conflict model, Unicode position helpers, Explorer/Search/Problems/Output view models | T-004, T-006, T-007, T-013-subset |
| MVP-4 Language and extension MVP | Extension contribution classification, unsupported graphical surface detection, terminal-safe completion/diagnostic/hover/code-action view models | T-014, T-014-language, T-015, T-016-subset |

## Evidence locations

Generated evidence is intentionally ignored by git and should be produced locally or in CI:

```text
artifacts/dev/
test-evidence/mvp-0-foundation/
test-evidence/mvp-1-remote-spine/
test-evidence/mvp-2-terminal-workbench/
test-evidence/mvp-3-remote-editing/
test-evidence/mvp-4-language-extensions/
```

These directories are regenerated by `npm run verify:mvp`.

## Remaining Product MVP hardening

These gaps should be closed or explicitly accepted before closing the Product MVP gate:

- live user acceptance on a real terminal, not only scripted evidence;
- broader terminal compatibility testing for mouse/key sequences;
- fuller quick-open result picker instead of simple substring open;
- true persistent PTY/multiplexing for long-running terminal commands;
- save-failure and permission-denied evidence against an injected failure;
- final issue/project status reconciliation.

These remain post-MVP unless explicitly pulled forward:

- language extensions/LSP;
- full Code OSS remote-agent protocol integration;
- full VS Code extension-host activation;
- direct GitHub Project v2 field automation.

## GitHub task state

Issues for MVP-0 through MVP-4 have evidence comments linking the relevant commit, command, test IDs, evidence path, and known limitation. Only issues whose original acceptance criteria are satisfied should be marked Done.

Any issue that depends on end-user usability must now reference the style guide and user stories before it can be marked done.

Current blocker work items:

- `BLK-001 Confirm Product MVP acceptance boundary` — confirms exactly what must be present before “Product MVP Done.”
- `BLK-002 Provide Product MVP SSH validation target` — provides or approves the live SSH target needed for end-to-end evidence.
- `BLK-003 Enable GitHub Project v2 automation scope` — direct Project v2 access still appears unavailable through `gh`; labels/milestones/comments are used until then.

Current closed implementation issues:

- `SMITH-002 Inventory reusable Code OSS modules and presentation dependencies`
- `SMITH-004 Define licensing, branding, marketplace and distribution policy`
