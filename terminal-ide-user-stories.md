# Smith Terminal IDE Use Cases and User Stories

Status: Proposed UX reset
Date: 26 June 2026

## 1. Purpose

This document defines how users must be able to interact with Smith as a terminal IDE. It is the acceptance source for rebuilding the MVP into a usable product.

The companion UI policy is [terminal-ide-style-guide.md](terminal-ide-style-guide.md). Existing broad UX mappings remain in [ux.md](ux.md), but implementation work for the MVP should prioritize the stories below.

## 2. Personas

### P1: First-time remote developer

Uses VS Code today, knows basic terminal commands, but does not know Smith-specific commands. Needs visible guidance and safe defaults.

### P2: Terminal-native developer

Uses Neovim, Vim, Emacs, or terminal multiplexers. Expects keyboard efficiency, clear modes, fast navigation, and no unnecessary chrome.

### P3: Cautious production debugger

Connects to real remote systems. Needs clear host/workspace identity, safe save behavior, no accidental destructive actions, and obvious exit/recovery paths.

## 3. Core use cases

### UC-001 Connect to an SSH workspace

**Actor:** P1, P2, P3

**Goal:** Start Smith and reach a usable workbench connected to a remote workspace.

**Preconditions:**

- user has SSH access;
- workspace path exists or Smith can explain why it does not;
- terminal is at least 60x14.

**Primary flow:**

1. User runs `smith <ssh-host> <workspace>`.
2. Smith shows connection progress: resolving, connecting, verifying agent, opening workspace.
3. Smith opens the workbench with Explorer focused.
4. Title line shows remote host and workspace.
5. Status line shows `NORMAL`, `SSH ready`, and help hint.

**Alternate flows:**

- SSH authentication fails: Smith shows failure reason and retry/exit actions.
- Workspace is missing: Smith offers change path, create folder if safe, or exit.
- Terminal too small: Smith shows resize-safe screen.

**Required evidence:**

- screenshot of connection progress;
- screenshot of ready workbench;
- log with credentials redacted.

### UC-002 Understand the workbench

**Actor:** P1

**Goal:** Identify where files, editor, commands, status, and terminal are located.

**Primary flow:**

1. User sees Explorer, editor area, minibuffer, and status line.
2. User presses `?`.
3. Smith opens context help for the focused component.
4. User can see shortcuts for open, search, command palette, save, terminal, and quit.

**Acceptance:**

- no source-code knowledge required;
- no hidden command list required;
- help can be closed with `Esc`.

### UC-003 Browse and open a file

**Actor:** P1, P2

**Goal:** Navigate the remote file tree and open a text file.

**Primary flow:**

1. Explorer is focused.
2. User moves selection with arrow keys or `j/k`.
3. User expands folders with `Enter` or right arrow.
4. User opens a file with `Enter`.
5. Editor shows file content, filename, dirty state, line numbers, and cursor.

**Mouse flow:**

1. User clicks a folder to expand/collapse.
2. User clicks a file to open it.

**Error flow:**

- file no longer exists: Smith shows refresh/search/cancel actions.

**Required evidence:**

- terminal capture before opening;
- terminal capture after opening;
- mouse hit-map or interactive evidence for click-to-open.

### UC-004 Edit and save a file

**Actor:** P1, P2, P3

**Goal:** Make a text change and save it safely to the remote host.

**Primary flow:**

1. User opens a file.
2. User enters Insert mode with `i`.
3. Smith shows `INSERT`.
4. User edits text.
5. Smith shows dirty marker.
6. User presses `Ctrl+S`.
7. Smith saves remotely.
8. Dirty marker clears and status line confirms save.

**Alternate flows:**

- user presses `Esc`: returns to Normal mode.
- save fails: dirty marker remains and Smith shows retry/cancel/details.
- remote conflict detected: Smith shows compare/reload/overwrite/cancel choices.

**Required evidence:**

- before/after screenshot;
- remote file readback proving saved content;
- failed-save test evidence.

### UC-005 Search the workspace

**Actor:** P1, P2

**Goal:** Find text across the remote workspace and navigate to a result.

**Primary flow:**

1. User presses `Ctrl+Shift+F`.
2. Smith opens search interface.
3. User types query.
4. Results stream in grouped by file.
5. User selects a result.
6. Smith opens file at matching line.

**Acceptance:**

- result count is visible;
- no-match state is explicit;
- search can be cancelled;
- regex/case toggles are discoverable.

### UC-006 Run a remote terminal command

**Actor:** P1, P2, P3

**Goal:** Run a shell command inside the connected remote workspace.

**Primary flow:**

1. User presses <kbd>Ctrl</kbd>+<kbd>`</kbd>.
2. Smith opens integrated terminal panel.
3. Status line shows `TERMINAL`.
4. User runs `pwd` or project command.
5. Output appears in the terminal panel.
6. User exits terminal focus using the visible escape hint.

**Acceptance:**

- command runs on the remote host, not locally;
- current working directory is visible;
- exit status is visible after command completion;
- user is not trapped in terminal mode.

### UC-007 Use the command palette

**Actor:** P1, P2

**Goal:** Discover and run available commands.

**Primary flow:**

1. User presses `F1` or `:`.
2. Command palette opens.
3. User types “save”.
4. Smith filters commands and shows shortcuts.
5. User selects `File: Save`.
6. Command executes or explains why disabled.

**Acceptance:**

- disabled commands show a reason;
- recently used commands are available;
- palette can be closed with `Esc`.

### UC-008 Resize terminal without losing state

**Actor:** P1, P2

**Goal:** Resize the terminal and continue working.

**Primary flow:**

1. User has an open file with cursor and dirty state.
2. User resizes the terminal from wide to medium to narrow.
3. Smith recomputes layout.
4. Editor remains usable or sidebars become overlays.
5. Cursor, selection, dirty state, and focused component persist.

**Minimum-size flow:**

- if terminal becomes too small, Smith shows resize-safe screen and preserves session state.

### UC-009 Exit safely with dirty buffers

**Actor:** P1, P3

**Goal:** Quit without losing unsaved remote edits.

**Primary flow:**

1. User has a dirty file.
2. User triggers quit.
3. Smith lists dirty buffers.
4. User chooses save, discard, or cancel.
5. Smith performs chosen action and exits or returns to workbench.

**Acceptance:**

- no dirty edit is lost silently;
- terminal mode is restored after exit;
- failed save blocks exit unless user explicitly discards.

### UC-010 Recover from common errors

**Actor:** P1, P3

**Goal:** Understand and recover from common operational failures.

**Errors covered:**

- SSH authentication failed;
- workspace path missing;
- file deleted remotely;
- permission denied on save;
- remote command not found;
- terminal below minimum size.

**Acceptance:**

- error uses user language;
- recovery actions are shown;
- logs are available separately;
- stack traces are not shown in normal UI.

## 4. Prioritized MVP user stories

### US-MVP-001 Launch and orient

As a first-time user, I want Smith to open a remote workspace and show me a recognizable IDE layout so that I know where to start.

Acceptance:

- workbench appears after SSH connection;
- remote host and workspace are visible;
- focus is visible;
- `?` opens useful help;
- screenshot evidence exists.

### US-MVP-002 Browse remote files

As a developer, I want to browse the remote workspace in an Explorer so that I can find files without typing paths.

Acceptance:

- tree navigation works by keyboard;
- click-to-open works by mouse;
- folders expand/collapse;
- selected item is visible;
- missing/deleted file recovery is handled.

### US-MVP-003 Edit and save safely

As a developer, I want to edit and save a remote text file so that Smith can replace a basic remote editor for simple changes.

Acceptance:

- insert and normal modes are visible;
- text edits affect the active buffer;
- dirty state is visible;
- save writes remote file;
- failed save preserves edits;
- remote readback proves saved content.

### US-MVP-004 Search and navigate

As a developer, I want workspace search so that I can find code and jump to matches.

Acceptance:

- search opens from global shortcut;
- query, scope, count, and selected result are visible;
- results are grouped by file;
- selecting a result opens the file at the match.

### US-MVP-005 Run remote commands

As a developer, I want an integrated remote terminal so that I can run build, test, and shell commands without leaving Smith.

Acceptance:

- terminal opens from shortcut;
- command runs on remote host;
- working directory and exit status are visible;
- terminal mode escape is visible and tested.

### US-MVP-006 Discover commands

As a new user, I want a command palette and context help so that I can learn the IDE without reading documentation first.

Acceptance:

- command palette filters commands;
- shortcuts are shown;
- disabled commands explain why;
- context help changes based on focused component.

### US-MVP-007 Resize safely

As a terminal user, I want Smith to resize fluidly so that I can use it in different terminal sizes and multiplexers.

Acceptance:

- wide, medium, narrow, short, and minimum states are tested;
- focused component persists;
- unsaved edits persist;
- unusable sizes show a clear resize screen.

### US-MVP-008 Exit without data loss

As a cautious user, I want Smith to protect unsaved edits when quitting or disconnecting so that I do not lose work.

Acceptance:

- dirty buffers are listed before exit;
- save/discard/cancel are available;
- save errors block exit unless user explicitly discards;
- terminal is restored.

## 5. MVP evidence checklist

An MVP evidence bundle must include:

- connection progress screenshot;
- ready workbench screenshot;
- Explorer open-file screenshot;
- edit dirty-state screenshot;
- post-save screenshot;
- search results screenshot;
- integrated terminal screenshot;
- command palette screenshot;
- resize screenshots for wide, medium, narrow, and minimum;
- dirty-exit confirmation screenshot;
- remote readback logs for saved file;
- keyboard-only transcript;
- mouse interaction transcript or hit-map evidence;
- redacted error-recovery logs.

## 6. Implementation implications

The next product work should prioritize a real interactive event loop and useful screen composition over more static frame generation.

Required implementation tracks:

1. terminal lifecycle and event loop;
2. focus model and modes;
3. Explorer as an actual navigable tree;
4. editor buffer interaction with visible insert/normal modes;
5. minibuffer for command/search/prompt flows;
6. integrated remote terminal panel;
7. command palette and contextual help;
8. resize policy with golden evidence;
9. dirty-buffer protection;
10. end-user test agent script that performs the MVP flows without internal shortcuts.
