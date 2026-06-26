# Smith Terminal IDE Style Guide

Status: Proposed UX reset
Date: 26 June 2026

## 1. Purpose

This guide defines how Smith should behave as a terminal-native IDE. It replaces the earlier assumption that a command prompt plus rendered frame is enough for an end-user MVP.

The current implementation proves useful technical primitives, but it is not yet an end-user-usable IDE. A viable MVP must let a developer sit in the terminal and complete basic IDE tasks without needing to know internal command names, test fixture details, or implementation shortcuts.

This guide is the UI policy for the next implementation pass. Any visible component must help the user understand and act.

## 2. Reference model

Smith should borrow proven terminal editor concepts rather than invent an opaque interface.

### 2.1 Neovim lessons

Neovim separates:

- buffers: in-memory text, normally associated with a file;
- windows: viewports onto buffers;
- tab pages: collections of windows;
- modes: clear interaction states such as normal, insert, visual, command-line, and terminal.

Smith should use this mental model because it maps cleanly to terminal constraints. Files are not tabs. Tabs are layouts. Windows are views. Buffers are edited documents.

### 2.2 Emacs lessons

Emacs also separates buffers from windows. A window displays a buffer, and the same buffer can be visible in more than one window. Emacs also uses a minibuffer for command entry, confirmation, search, and interactive prompts.

Smith should adopt a minibuffer-style command line because it gives users a single predictable place for commands, prompts, errors, and recovery.

### 2.3 Modern terminal UI lessons

Modern terminal tools should be:

- explicit about state;
- keyboard-first;
- safe with destructive actions;
- readable without colour;
- respectful of terminal size and capabilities;
- scriptable where appropriate, but interactive when the user is in an interactive session.

Smith is an interactive IDE first and a command-line tool second. The terminal screen must not look like a log output or static screenshot.

## 3. Non-negotiable UI principles

### 3.1 Every visible component must answer six questions

Each region on screen must make these obvious:

| Question | Required answer |
| --- | --- |
| What is this? | Component name or recognizable role. |
| Where am I? | Workspace, file, cursor, selection, branch, host, or focused item. |
| What can I do here? | Visible shortcut hints or discoverable command list. |
| What changed? | Dirty markers, diagnostics, recent command result, progress, or status. |
| What has focus? | Border, title marker, cursor, or text label; never colour alone. |
| How do I recover? | Escape, cancel, help, revert, retry, or error action. |

If a component cannot answer these questions, it should not be visible in the default layout.

### 3.2 Editor-first, not chrome-first

The active editor is the primary workspace. Sidebars, panels, banners, breadcrumbs, and decoration collapse before the editor becomes unusable.

Minimum useful editor area for normal editing:

- 50 columns;
- 10 rows;
- visible cursor position;
- visible filename and dirty state;
- visible save/error state.

Below that size, Smith must show a resize-safe state instead of a fake IDE.

### 3.3 Keyboard complete

Every action must be available by keyboard. Mouse support improves speed but cannot be required.

Required global keys:

| Key | Action |
| --- | --- |
| `F1` or `:` | Command palette. |
| `Ctrl+P` | Quick open file. |
| `Ctrl+B` | Toggle Explorer/sidebar. |
| `Ctrl+J` | Toggle bottom panel. |
| `Ctrl+S` | Save active buffer. |
| `Ctrl+F` | Find in active buffer. |
| `Ctrl+Shift+F` | Search workspace. |
| `F2` | Toggle integrated terminal. |
| `Esc` | Cancel overlay, return to previous focus, or leave transient mode. |
| `?` | Context help for focused component. |

### 3.4 Mouse capable

Mouse support is required for the MVP, but it must follow the same command model as keyboard input.

Required mouse actions:

- click to focus components;
- click file to open it;
- click editor to place cursor;
- wheel to scroll region under pointer;
- drag splitters to resize panes;
- double-click word selection in the editor;
- right-click or configured alternate gesture for context menu when supported.

Each mouse hit target must have a semantic command behind it.

### 3.5 Modes must be visible

Smith may use modes, but the user must always know the current mode.

Required modes:

| Mode | Purpose | Visible indicator |
| --- | --- | --- |
| Normal | Navigate, run commands, switch components. | Status line shows `NORMAL`. |
| Insert | Type into active text buffer. | Status line shows `INSERT`; cursor changes where supported. |
| Command | Minibuffer command entry. | Minibuffer prompt starts with `:` or command name. |
| Search | Active editor/workspace search. | Minibuffer shows query, scope, match count. |
| Terminal | Keystrokes pass to remote PTY. | Status line shows `TERMINAL`; exit key is visible. |

Mode transitions must be explicit and reversible.

### 3.6 No decorative dead panels

Default visible panels must carry live state or actionable controls. A panel that only says “ready” or repeats static fixture data should be hidden.

Valid reasons to show a component:

- it contains focused content;
- it shows current task output;
- it shows errors or diagnostics;
- it provides navigation;
- it contains progress the user needs;
- it contains controls for the current workflow.

Invalid reasons:

- matching VS Code visually;
- filling empty space;
- proving that a renderer exists;
- showing implementation debug data to an end user.

## 4. Workbench layout policy

### 4.1 Default wide layout

```text
┌─ Smith ─ remote:user@host ─ /workspace ─ git:main ────────────────┐
│▌ Explorer        │ app.ts ●                         │ Problems 0  │
│  src/            │  1 import { start } from './x'   │ Output      │
│  ▸ app.ts        │  2                               │ Terminal    │
│  ▸ package.json  │  3 start()                       │             │
│                  │                                  │             │
│                  │                                  │             │
├──────────────────┴──────────────────────────────────┴─────────────┤
│ : command/search/prompt area                                      │
├───────────────────────────────────────────────────────────────────┤
│ NORMAL  SSH ready  main  app.ts ●  Ln 3 Col 8  UTF-8  ? Help     │
└───────────────────────────────────────────────────────────────────┘
```

The right panel is optional. If there is no useful Problems, Output, Search, or Terminal content, the editor should consume that space.

### 4.2 Medium layout

At medium widths, Smith should keep:

- one sidebar or one panel, not both unless the editor remains usable;
- active editor;
- minibuffer;
- status line.

### 4.3 Narrow layout

At narrow widths:

- Explorer becomes a full-height drawer;
- Search becomes a full-screen result picker;
- Terminal becomes a full-screen or bottom drawer;
- editor remains the default background state.

### 4.4 Short layout

At short heights:

- hide non-critical title details;
- hide breadcrumbs;
- collapse panel first;
- collapse sidebar second;
- preserve active editor and status line.

### 4.5 Minimum layout

Below the minimum usable size, show:

```text
Smith needs at least 60x14 cells.
Current: 48x10

Session is still connected.
Unsaved files: app.ts

Resize terminal or press Ctrl+C to exit safely.
```

Never render a broken frame at unusable sizes.

## 5. Component policy

### 5.1 Title/context line

Must show:

- product name;
- SSH connection state;
- remote user and host;
- workspace path;
- active branch if known;
- major background progress only when relevant.

Should not show:

- internal fixture IDs;
- implementation class names;
- permanent banners.

### 5.2 Explorer

Must show:

- root folder;
- selected item;
- expanded/collapsed state;
- file type markers only where useful;
- dirty/open markers;
- visible actions: open, create, rename, delete, refresh, filter.

Explorer interaction:

| Input | Action |
| --- | --- |
| `Enter` | Open selected file/folder. |
| `Space` | Preview selected file. |
| `a` | New file. |
| `A` | New folder. |
| `r` | Rename. |
| `d` | Delete with confirmation. |
| `/` | Filter tree. |
| `R` | Refresh. |

### 5.3 Editor

Must show:

- active file name;
- dirty marker;
- line numbers where space allows;
- cursor position;
- selection;
- diagnostics markers;
- save/conflict status;
- readonly or permission state.

Editor interaction:

| Input | Action |
| --- | --- |
| `i` | Enter Insert mode. |
| `Esc` | Return to Normal mode. |
| Arrow keys / `h j k l` | Move cursor in Normal mode. |
| `Ctrl+S` | Save. |
| `u` | Undo in Normal mode. |
| `Ctrl+R` | Redo. |
| `/` | Find in file. |
| `n` / `N` | Next/previous match. |
| `gd` | Go to definition when available. |
| `K` | Hover/help when available. |

The MVP may start with single-cursor editing, but it must not pretend to support multi-cursor until implemented.

### 5.4 Minibuffer

The minibuffer is the single place for:

- command entry;
- quick open;
- search;
- rename prompts;
- delete/save confirmations;
- error recovery;
- progress that requires user attention.

It must provide:

- prompt label;
- current input;
- validation error;
- completion suggestions;
- cancel key;
- selected action.

### 5.5 Status line

Must show:

- mode;
- SSH connection state;
- branch;
- active file dirty state;
- line/column;
- diagnostics count;
- task/terminal activity;
- help hint.

Example:

```text
NORMAL  SSH ready  main  app.ts ●  Ln 12 Col 4  Problems 0  ? Help
```

### 5.6 Integrated terminal

Must show:

- remote shell identity;
- current working directory;
- command status;
- scrollback;
- clear exit key from terminal pass-through mode.

Terminal mode must not trap the user. A visible hint such as `Ctrl+\ then Esc: leave terminal mode` or the configured equivalent is required.

### 5.7 Search

Workspace search must show:

- query;
- scope;
- case/regex/word toggles;
- result count;
- grouped results by file;
- selected match context;
- keyboard actions for open/replace.

### 5.8 Problems and output

Problems must show actionable diagnostics. Output must show named output channels. Empty Problems/Output panels should collapse unless the user explicitly opened them.

### 5.9 Help overlay

`?` opens context help for the focused component.

Help must include:

- common keys;
- current mode;
- component actions;
- global navigation;
- how to exit safely;
- where to report unsupported functionality.

## 6. Interaction model

### 6.1 Startup

Startup should move through visible states:

1. resolving SSH target;
2. connecting;
3. verifying remote agent;
4. opening workspace;
5. ready.

Failures must show:

- what failed;
- likely cause;
- exact retry action;
- safe exit option;
- log location.

### 6.2 Command palette

The command palette is the discoverability backbone. `F1` and `:` are the primary terminal-safe bindings. `Ctrl+Shift+P` may be supported as an optional compatibility alias only when the terminal reports it distinctly; it must not be the only visible path.

It must support:

- fuzzy filtering;
- command categories;
- disabled command reason;
- shortcut display;
- recent commands;
- execution result or error.

### 6.3 Quick open

Quick open must support:

- file search by name;
- current selection preview;
- open in current editor;
- open to side when splits are implemented;
- not-found state with create-file option only when safe.

### 6.4 Dirty buffer protection

Smith must never lose user edits silently.

On exit, close, reload, disconnect, or conflict:

- list dirty buffers;
- offer save, discard, cancel;
- show save errors inline;
- keep local edit state if remote save fails.

### 6.5 Error handling

User-facing errors must be written in action language.

Bad:

```text
ENOENT: no such file or directory
```

Good:

```text
File not found: src/app.ts
The file may have been deleted or renamed on the remote host.
[Refresh Explorer] [Search by name] [Cancel]
```

Stack traces belong in logs, not the main UI.

## 7. MVP usability bar

The MVP is not complete until a first-time user can complete these flows without reading source code:

1. connect to an SSH workspace;
2. understand the screen within 30 seconds;
3. browse files;
4. open a file;
5. edit text;
6. save and see confirmation;
7. search the workspace;
8. run a remote command in the integrated terminal;
9. recover from a missing file or failed save;
10. resize the terminal and continue;
11. discover commands from the UI;
12. exit without losing dirty edits.

Each flow must have screenshot or terminal-capture evidence from an end-user style session.

## 8. Anti-patterns

Smith must avoid:

- static demo frames presented as a product UI;
- command-only workflows for core IDE tasks;
- hidden modes;
- hidden unsaved state;
- panels with no actionable value;
- mouse support without keyboard equivalence;
- raw stack traces in user workflows;
- forced VS Code visual mimicry where terminal-specific interaction is clearer;
- claiming support for language features, extensions, or graphical surfaces before there is working evidence.
