# Smith UX Specification and Wireframes

Status: Proposed
Date: 25 June 2026

## 1. Purpose

This document defines the user experience required for Smith, a terminal-native IDE client for Code OSS workspaces over SSH.

The goal is not pixel parity with VS Code. The goal is functional parity for the core IDE experience where terminal constraints allow it: navigation, editing, language intelligence, source control, debugging, testing, terminals, extension contributions, settings, trust, notifications, and responsive layouts.

This document is an implementation contract for:

- required UI elements;
- the functions each UI element must expose;
- keyboard and mouse behavior;
- responsive collapse rules;
- terminal wireframes for the main workbench states.

Architecture is defined in [design.md](design.md), requirements in [requirements.md](requirements.md), verification in [test.md](test.md), and implementation work in [backlog.md](backlog.md).

## 2. UX baseline

Smith follows the VS Code workbench model:

- an editor region for text, diff, merge, terminal-editor, and structured editor surfaces;
- primary and secondary side bars for persistent view containers;
- a panel for Problems, Output, Terminal, Debug Console, Ports, and similar views;
- an activity rail for switching view containers;
- a status bar for workspace, source-control, diagnostics, language, connection, and background-operation state;
- command palette, quick open, quick pick, menus, context menus, dialogs, notifications, and progress overlays.

The baseline references are:

- VS Code User Interface overview: <https://code.visualstudio.com/docs/editing/userinterface>
- VS Code Custom Layout: <https://code.visualstudio.com/docs/configure/custom-layout>
- VS Code Basic Editing: <https://code.visualstudio.com/docs/editing/codebasics>
- VS Code Terminal Basics: <https://code.visualstudio.com/docs/terminal/basics>
- VS Code Extension Contribution Points: <https://code.visualstudio.com/api/references/contribution-points>
- VS Code Accessibility: <https://code.visualstudio.com/docs/configure/accessibility/accessibility>

## 3. UX principles

### 3.1 Editor-first

The editor remains the dominant region. Side bars, panels, tabs, breadcrumbs, and overlays must collapse before the active editor becomes unusable.

### 3.2 Keyboard complete

Every feature must be reachable by keyboard. Mouse support is first-class, but never required.

### 3.3 Terminal honest

If the terminal cannot faithfully represent a VS Code surface, Smith must use a textual fallback or explicitly mark it unsupported. It must not imply support for browser-only surfaces such as arbitrary webviews, rich notebook renderers, graphical custom editors, or media previews.

### 3.4 Stable mental model

Smith uses VS Code concepts, names, command IDs, settings, keybinding patterns, and workspace state where practical. Users should recognize Explorer, Search, Source Control, Run and Debug, Testing, Extensions, Problems, Output, Terminal, Command Palette, Quick Open, tabs, editor groups, and status indicators.

### 3.5 Fluid resize

The layout must adapt deterministically across terminal sizes. Resize must preserve focused component, logical cursor, selection, scroll position, active view, active editor group, and overlay intent where valid.

### 3.6 Explicit degradation

Each UI feature has one of four support levels:

| Level | Meaning |
| --- | --- |
| Native | Rendered and controlled directly in terminal UI. |
| Textual fallback | Supported through a simplified terminal-safe representation. |
| External handoff | Opened through an external browser, GUI VS Code, or host tool by explicit user action. |
| Unsupported | Hidden before activation where possible or shown with a clear reason. |

## 4. Responsive layout modes

Smith does not use fixed pixel dimensions. All dimensions below are terminal cells.

| Mode | Size guideline | Layout rule |
| --- | ---: | --- |
| Wide | 120+ columns and 32+ rows | Activity rail, primary side bar, editor grid, optional secondary side bar, bottom panel, status bar. |
| Medium | 80-119 columns or 24-31 rows | Activity rail, one side bar, editor grid, bottom panel; secondary side bar becomes a tabbed overlay. |
| Narrow | 60-79 columns or 18-23 rows | Editor-first; side bars and panel become modal overlays or full-height drawers. |
| Short | 80+ columns and under 18 rows | Hide breadcrumbs and low-priority chrome; panel and side bars become full-screen overlays. |
| Minimum | below 60 columns or below 14 rows | Show resize state with connection/save safety indicators; retain session state. |

Default collapse priority:

1. secondary side bar;
2. breadcrumbs;
3. editor minimap/overview ruler representation;
4. panel height;
5. primary side bar width;
6. tabs condense to single active tab plus count;
7. activity rail condenses to command overlay;
8. editor switches to minimum readable mode;
9. resize message replaces normal workbench.

## 5. Global interaction model

### 5.1 Focus

Only one component owns primary focus. Focus state is visible and represented without relying on colour alone.

Required focus commands:

| Function | Description |
| --- | --- |
| `focus.activity` | Focus activity rail. |
| `focus.primarySideBar` | Focus visible primary side bar. |
| `focus.secondarySideBar` | Focus visible secondary side bar or open its overlay. |
| `focus.editor` | Focus active editor group/editor. |
| `focus.panel` | Focus panel or open selected panel view. |
| `focus.statusBar` | Focus status bar item navigation mode. |
| `focus.nextPart` | Move to next workbench part. |
| `focus.previousPart` | Move to previous workbench part. |
| `focus.restore` | Restore focus to last meaningful component after closing an overlay. |

### 5.2 Command dispatch

All UI actions resolve to commands. Mouse events select targets, but the resulting operation is still a command invocation.

Required command routing metadata:

- command ID;
- title;
- category;
- enablement expression;
- keyboard shortcut;
- mouse gesture, if any;
- target component;
- cancellation behavior;
- source event correlation ID;
- trust requirement;
- remote/local execution classification.

### 5.3 Mouse behavior

Smith must build a hit map for every rendered frame.

Required gestures:

| Gesture | Required uses |
| --- | --- |
| Click | Focus, select, open, toggle, activate tab, set editor cursor. |
| Double click | Open/pin file, word selection, terminal word selection. |
| Triple click | Line selection where supported. |
| Drag | Text selection, splitter resize, tab reorder, tree drag where safe. |
| Wheel | Scroll focused scrollable region under pointer. |
| Right click or configured chord | Context menu. |
| Shift/Alt/Ctrl modified click | Multi-select, open to side, split behavior where terminal reports modifiers. |

Every mouse operation must have a keyboard equivalent.

### 5.4 Overlays

Overlays are z-ordered. Input routes to the topmost overlay unless it declares pass-through regions.

Overlay types:

- command palette;
- quick open;
- quick pick;
- context menu;
- editor hover;
- completion list;
- signature help;
- find/replace;
- rename input;
- code action menu;
- notification center;
- dialog;
- workspace trust prompt;
- authentication prompt;
- side-bar drawer in narrow mode;
- panel drawer in narrow mode.

## 6. Required UI elements mapped to functions

### 6.1 Workbench frame

| UI element | Smith presentation | Required functions | Primary backlog |
| --- | --- | --- | --- |
| Activity Bar / rail | Left or top compact rail with view icons/letters and badges | switch view container, show badge counts, context menu, reorder/hide where supported | SMITH-012, SMITH-013, SMITH-017 |
| Title / workspace indicator | Top row segment or status item | show workspace name, remote host, branch/session, command center entry, connection state | SMITH-005, SMITH-009, SMITH-017 |
| Menu Bar | Command palette and structured menu overlay | show application/workbench commands, nested menus, mnemonic navigation where terminal supports it | SMITH-017 |
| Primary Side Bar | Resizable tree/list region or overlay | host Explorer/Search/SCM/Debug/Tests/Extensions/custom views, resize, hide, reveal focused item | SMITH-012, SMITH-018 |
| Secondary Side Bar | Optional right region or overlay | host secondary views, pin/unpin, move views between containers, collapse first | SMITH-012, SMITH-018 |
| Editor Area | Grid of editor groups | edit files, show diffs, show merge, show terminal editors, split, resize, reorder, navigate history | SMITH-014, SMITH-016 |
| Editor Tabs | Compact tab row; narrow mode shows active tab and count | open, pin, preview, dirty state, close, close others, reorder, move group | SMITH-016 |
| Breadcrumbs | Optional path/symbol row | navigate path segments and symbols; collapse before tabs/editor | SMITH-015, SMITH-016 |
| Panel | Bottom/side region or overlay | host Problems, Output, Terminal, Debug Console, Ports, Tasks, custom panels | SMITH-012, SMITH-018, SMITH-019 |
| Status Bar | Bottom row split into left/right items | show remote, branch, sync, errors/warnings, language, encoding, line/column, indentation, tasks, extension status | SMITH-013, SMITH-017, SMITH-020 |
| Notifications | Stacked toast and notification center overlay | info/warn/error prompts, actions, progress, persisted failure details | SMITH-017, SMITH-026 |
| Dialogs | Modal overlay | confirm close/save/delete/trust/auth; validation; destructive-action guard | SMITH-017, SMITH-025 |

### 6.2 View containers and views

| View | Required functions | Terminal UX |
| --- | --- | --- |
| Explorer | open, open to side, create, rename, delete, move, copy, paste, reveal active file, collapse folders, refresh, filter, context actions, open integrated terminal at path | Lazy tree with dirty/open badges, type-to-filter, keyboard expand/collapse, optional mouse drag/drop gated by confirmation. |
| Open Editors | list open files by group, switch, close, save all, close saved, dirty indicators | Compact list in Explorer or quick overlay. |
| Outline | symbols, filter, follow cursor, reveal in editor | Tree/list using language symbol provider. |
| Timeline | file history, Git history, local history where available | Chronological list with filter chips and open/diff commands. |
| Search | global search, replace, include/exclude, regex/case/word toggles, streaming results, cancellation | Form plus grouped result tree; Enter navigates; replace actions require confirmation. |
| Source Control | repository list, changes, staged/unstaged, commit input, branch, sync, diff, stage/unstage, discard, resolve conflicts | Tree plus commit box; destructive commands always confirm. |
| Run and Debug | configurations, start/stop/restart, call stack, variables, watch, breakpoints, debug console | Side view plus panel console; top debug toolbar becomes command strip. |
| Testing | test tree, run/debug, status, duration, output, peek failure, filter by failed/running | Tree with status glyphs and panel output. |
| Extensions | search, installed list, details, enable/disable, uninstall, update, compatibility state | List/detail split; terminal compatibility badge is mandatory. |
| Problems | diagnostics by file/severity/source, filter, navigate, quick fix | Panel list grouped by file with severity glyphs and count. |
| Output | output channels, follow mode, copy, clear, search, redaction warnings | Read-only scrollable buffer with channel selector. |
| Terminal | remote PTYs, profiles, split, tabs, scrollback, search, selection, paste, kill/restart | Terminal emulator surface inside panel or editor group. |
| Debug Console | evaluate expressions, history, output, completion where supported | REPL-like panel bound to active debug session. |
| Ports / Tunnels | list forwarded ports, visibility, labels, open/copy URI/stop | Table in panel or side view. |
| Custom Tree Views | contributed tree items, icons, commands, context menus, badges | Native tree where contribution contains terminal-safe labels and commands. |
| Custom Webviews | arbitrary HTML UI | Unsupported by default; optional external handoff if extension declares an external URL or Smith adapter. |
| Notebooks | cells, execution, rich outputs | Deferred textual fallback for source-like notebooks; rich outputs unsupported initially. |

### 6.3 Editor UI

| UI element | Required functions | Terminal UX |
| --- | --- | --- |
| Text viewport | render, scroll, soft wrap, horizontal scroll, reveal range | Cell renderer with Unicode width correctness. |
| Line numbers | absolute/relative modes, click line, select line | Left gutter; hides at minimum width only after explicit compact mode. |
| Glyph margin | breakpoints, diagnostics, SCM changes, folds, test status | Compact glyph column using ASCII-safe fallback symbols. |
| Folding controls | fold/unfold region, fold all, unfold all | Keyboard command plus clickable gutter marker. |
| Indent guides | show indentation structure | Low-contrast vertical guides if terminal supports styling; fallback to subtle glyphs. |
| Sticky scroll | show current scope headers | Optional top editor rows; collapses before tabs in constrained height. |
| Minimap | quick navigation overview | Textual overview ruler only; full pixel minimap unsupported. |
| Overview ruler | diagnostics, search hits, SCM marks | Right-side one-cell ruler where width allows. |
| Selections | single/multiple, rectangular, mouse drag | Highlighted ranges with non-colour fallback on active line. |
| Cursors | primary/multiple cursors | Terminal cursor for primary plus rendered secondary cursors. |
| Find/replace widget | find, replace, regex/case/word, previous/next, all | Inline overlay pinned to top of editor. |
| Completion list | suggestions, details, docs, commit characters, filtering | Popup under cursor or centered fallback if space constrained. |
| Hover | docs, type info, actions | Bounded popup with scroll and keyboard focus. |
| Signature help | parameter hints | Compact popup near cursor. |
| Code actions | quick fixes/refactors/source actions | Lightbulb glyph plus quick pick menu. |
| Rename | symbol rename with validation | Inline input overlay. |
| Peek definition/references | preview target and list references | Split overlay or panel-style preview. |
| Inlay hints | types/parameter hints | Render inline only if it does not break editing; otherwise toggleable annotation mode. |
| Inline suggestions | ghost text | Render with dim style; accept/next/previous commands. |
| Diagnostics | squiggles, gutter, hover, Problems link | Underline or marker glyph depending on terminal capability. |
| Diff editor | side-by-side, inline, accept/revert hunk | Side-by-side in wide mode, inline in medium/narrow. |
| Merge editor | conflict navigation, choose incoming/current/both | Textual merge workflow initially; structured merge as follow-up. |

### 6.4 Navigation and command surfaces

| Surface | Required functions | Terminal UX |
| --- | --- | --- |
| Command Palette | search commands, show keybindings, execute, extension commands | Center/top overlay with fuzzy filtering and context-aware enablement. |
| Quick Open | open file, recent editor, symbol, line, command prefixes | Same input engine as Command Palette with mode prefixes. |
| Go to Symbol | file/workspace symbol navigation | Quick pick grouped by symbol kind. |
| Go to Line/Column | line and optional column input | Small editor overlay. |
| Context Menu | command list for selected target | Anchored popup or centered fallback. |
| Quick Pick | single/multi select, separators, detail text, buttons | Reusable list overlay with keyboard and mouse selection. |
| Input Box | validation, password mode, placeholder, buttons | Reusable text input overlay. |
| Progress | cancellable/non-cancellable, location-specific | Status bar item, notification, or overlay depending on requested location. |
| Welcome / Empty Workbench | recent workspaces, connect, clone, open folder, help | Start screen in editor area. |

### 6.5 Settings, identity, and trust

| Surface | Required functions | Terminal UX |
| --- | --- | --- |
| Settings editor | search settings, user/workspace/folder scope, edit value, reset, JSON fallback | Structured list/detail form with direct JSON opening. |
| Keyboard Shortcuts | search command/key, record key, detect collision, edit JSON fallback | Table with conflict warnings and terminal capability notes. |
| Profiles | select/export/import profile where supported | List/detail with active profile marker. |
| Workspace Trust | restricted mode, trust folder/workspace, explain blocked actions | First-run modal and persistent status item. |
| Accounts/Auth | sign in/out prompts for extension auth providers | Modal prompt and external browser handoff for OAuth if required. |
| Remote indicator | host, agent version, connection state, reopen/reconnect commands | Status item with detail popover. |

### 6.6 Extension contribution mapping

| VS Code contribution/API surface | Smith support target | UX requirement |
| --- | --- | --- |
| `commands` | Native | Commands appear in palette, menus, context menus, keybindings. |
| `keybindings` | Native with collision reporting | Terminal-impossible chords are reported and remappable. |
| `menus` | Native | Menus render through context/command overlays. |
| `configuration` | Native | Settings surface shows extension settings. |
| `views` and `viewsContainers` | Native for tree/list views | Contributed tree views appear in side bar/panel containers. |
| `statusBarItems` | Native | Items appear in status bar with text fallback for icons. |
| `languages`, `grammars`, `semanticTokenTypes` | Native | Editor uses syntax and semantic token data. |
| `snippets` | Native | Completion and snippet insertion supported. |
| `debuggers` | Native for DAP flows | Run and Debug surfaces expose contributed debug types. |
| `breakpoints` | Native | Gutter and Breakpoints view expose contributed breakpoint support. |
| `taskDefinitions`, problem matchers | Native | Tasks and terminal/problem integration supported. |
| SCM provider API | Native | Source Control view maps repositories/groups/resources/commands. |
| Test controller API | Native | Testing view maps test hierarchy, run profiles, status, output. |
| `authentication` | Native with external browser handoff | Auth prompts visible; secrets are not logged. |
| `walkthroughs` | Textual fallback | Render markdown-like walkthrough steps where possible. |
| `colors`, icon themes, product icon themes | Partial | Map to terminal palette and fallback glyphs. |
| `webviews` | Unsupported by default | Show unsupported reason and possible external handoff. |
| `customEditors` | Unsupported unless text-backed adapter exists | Offer open-as-text or external handoff. |
| notebook renderers | Deferred/textual fallback | Source and plain text output only initially. |
| proposed APIs | Unsupported unless explicitly whitelisted | Prevent accidental compatibility claims. |

## 7. Wireframes

Wireframes use ASCII boxes to show layout, not exact drawing characters. The implementation may use Unicode box drawing when the terminal profile allows it.

Legend:

- `A` activity rail;
- `P` primary side bar;
- `S` secondary side bar;
- `E` editor area;
- `B` panel;
- `T` tabs/breadcrumbs/title;
- `Z` overlays;
- `=` status bar.

### W-001 Wide workbench

Target: 140x40 and larger.

```text
┌A┬────────────────────────────── T: Smith / host:/repo ──────────────────────────────┬S────────────┐
│ │ P: EXPLORER                         │ E: editor group 1        │ E: editor group 2 │ OUTLINE     │
│E│ ▾ repo                              │ tabs: app.ts ●  test.ts   │ tabs: readme.md    │ symbols     │
│x│   ▾ src                             │ breadcrumbs               │ breadcrumbs        │             │
│p│     app.ts ●                        │  1 import ...             │  1 # Readme        │             │
│l│     test.ts                         │  2 function main() {      │  2 ...             │             │
│o│   package.json                      │  3   call();              │                    │             │
│r│                                     │  4 }                      │                    │             │
│e│                                     │                           │                    │             │
├─┴─────────────────────────────────────┴───────────────────────────┴────────────────┴─────────────┤
│ B: PROBLEMS | OUTPUT | DEBUG CONSOLE | TERMINAL                                                    │
│ 0 errors, 1 warning     terminal: zsh     $ npm test                                                │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ = ssh:devbox  main*  ↕ sync  ⚠1  app.ts  TypeScript  UTF-8  LF  Ln 3, Col 8  trust:yes             │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Required behavior:

- side bars and panel are independently resizable;
- editor groups resize through splitters;
- mouse click in any region focuses that region;
- status bar items expose popovers or commands;
- all view headers expose actions and context menu.

### W-002 Medium workbench

Target: 100x30.

```text
┌A┬ P: SEARCH ─────────────┬ T: app.ts ● ─────────────────────────────────────────────┐
│ │ query: parseUser       │ breadcrumbs: repo > src > app.ts                        │
│S│ [Aa] [.*] [word]       │  42 export function parseUser(input: string) {          │
│C│ results 12             │  43   const value = JSON.parse(input);                  │
│M│ ▾ src/app.ts           │  44   return validate(value);                           │
│ │   42 parseUser         │                                                           │
│ │ ▸ src/test.ts          │                                                           │
├─┴────────────────────────┴───────────────────────────────────────────────────────────┤
│ B: TERMINAL                                                                          │
│ $ npm run test                                                                       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ = ssh:devbox main* ⚠1 TypeScript Ln 44, Col 10                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Required behavior:

- secondary side bar is hidden and reachable as an overlay;
- panel height is constrained;
- status bar hides low-priority items first.

### W-003 Narrow workbench with side drawer

Target: 70x24.

```text
┌ T: app.ts ●  [2 tabs] ─────────────────────────────────────────┐
│  42 export function parseUser(input: string) {                 │
│  43   const value = JSON.parse(input);                         │
│  44   return validate(value);                                  │
│  45 }                                                          │
│                                                                │
│ ┌Z: EXPLORER───────────────────────────────────────────────┐   │
│ │ repo                                                     │   │
│ │ ▾ src                                                    │   │
│ │   app.ts ●                                               │   │
│ │   test.ts                                                │   │
│ │ package.json                                             │   │
│ │ Enter open  Ctrl+Enter side  Esc close                   │   │
│ └──────────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────┤
│ = devbox main* ⚠1 Ln44:10                                      │
└────────────────────────────────────────────────────────────────┘
```

Required behavior:

- editor remains visible behind overlay where possible;
- Esc closes the drawer and restores editor focus;
- drawer supports all Explorer keyboard commands and mouse selection.

### W-004 Minimum-size state

Target: below 60x14.

```text
┌──────────────────────────────────────────────┐
│ Smith needs more space                       │
│ Current: 52x11   Minimum: 60x14              │
│ Workspace: devbox:/repo                      │
│ Unsaved: 1   Connection: ready   Trust: yes  │
│                                              │
│ Resize terminal to continue.                 │
│ Press Ctrl+C to exit safely.                 │
└──────────────────────────────────────────────┘
```

Required behavior:

- no workbench state is discarded;
- dirty/connection/trust state remains visible;
- terminal can still exit safely.

### W-005 Command Palette

```text
┌Z: Command Palette───────────────────────────────────────────────┐
│ > git stage                                                     │
├─────────────────────────────────────────────────────────────────┤
│ Source Control: Stage Selected Ranges        Ctrl+K Ctrl+S      │
│ Git: Stage Changes                                             │
│ Git: Stage All Changes                                         │
│ Git: Unstage Selected Ranges                                   │
├─────────────────────────────────────────────────────────────────┤
│ ↑↓ select  Enter run  Alt+Enter configure keybinding  Esc close │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- fuzzy filtering;
- disabled commands are visible only when useful and include reason;
- keybinding conflicts are visible;
- mouse click runs or selects based on configured behavior.

### W-006 Quick Open and symbol modes

```text
┌Z: Quick Open────────────────────────────────────────────────────┐
│ app@parse                                                       │
├─────────────────────────────────────────────────────────────────┤
│ src/app.ts           function parseUser       line 42           │
│ src/parser.ts        class Parser.parse       line 18           │
│ test/app.test.ts     test parses users        line 9            │
├─────────────────────────────────────────────────────────────────┤
│ prefixes: > commands  @ symbols  # workspace symbols  : line    │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- mode prefixes match VS Code mental model where practical;
- selecting a file opens it in preview unless pinned by command/modifier;
- `Ctrl+Enter` opens to side.

### W-007 Editor with completion, diagnostics, and hover

```text
┌ T: src/app.ts ● ────────────────────────────────────────────────┐
│ repo > src > app.ts                                             │
│  40                                                             │
│  41 function run() {                                            │
│  42   const user = parseU│                                      │
│  43 }        ┌Z: Suggestions──────────────┐                     │
│              │ parseUser(input): User     │                     │
│              │ parseUrl(url): URL         │                     │
│              │ parseInt(string): number   │                     │
│              └────────────────────────────┘                     │
│  44                                                             │
│ ⚠ 45 validate(user)                                             │
│    └─ hover/code action: Type mismatch. Quick Fix available.    │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- completion popup repositions above the cursor if there is no space below;
- diagnostics can be reached from gutter, hover, Problems, and next/previous diagnostic commands;
- popup focus does not corrupt editor selection.

### W-008 Search and replace

```text
┌P: SEARCH──────────────────────┬E: app.ts────────────────────────┐
│ Search: parseUser             │ 42 export function parseUser... │
│ Replace: readUser             │ 43                              │
│ [Aa] [.*] [word] files:src    │ 44 const user = parseUser(raw)  │
│                               │                                 │
│ ▾ 2 files, 4 results          │                                 │
│ ▾ src/app.ts                  │                                 │
│   42 parseUser                │                                 │
│   44 parseUser                │                                 │
│ ▾ test/app.test.ts            │                                 │
│   12 parseUser                │                                 │
│                               │                                 │
│ Enter open  R replace result  │                                 │
└───────────────────────────────┴─────────────────────────────────┘
```

Required behavior:

- streaming results show loading and cancellation;
- replace-all requires confirmation and previews count;
- stale results are marked if files changed after search.

### W-009 Source Control

```text
┌P: SOURCE CONTROL──────────────┬E: diff app.ts───────────────────┐
│ repo  main*  3 changes        │ left: HEAD        right: working│
│ Message                       │ 40 function run() {             │
│ ┌───────────────────────────┐ │ 41 - parseUser(raw)             │
│ │ fix parser edge case      │ │ 41 + readUser(raw)              │
│ └───────────────────────────┘ │ 42 }                            │
│                               │                                 │
│ Changes                       │                                 │
│  M src/app.ts                 │                                 │
│  A src/parser.ts              │                                 │
│  D old.ts                     │                                 │
│                               │                                 │
│ [Stage] [Commit] [Sync]       │                                 │
└───────────────────────────────┴─────────────────────────────────┘
```

Required behavior:

- staged and unstaged resources are separate groups;
- commit input validates empty message and repository state;
- discard/delete/destructive operations require confirmation;
- diff supports hunk navigation and stage selected ranges.

### W-010 Run and Debug

```text
┌P: RUN AND DEBUG───────────────┬E: app.ts────────────────────────┐
│ config: Node: Launch          │  88 breakpoint ●                │
│ [Start] [Stop] [Restart]      │  89 const result = handler();   │
│                               │  90                             │
│ Variables                     │                                 │
│ ▾ Local                       │                                 │
│   result: {...}               │                                 │
│   user: User                  │                                 │
│ Watch                         │                                 │
│ Call Stack                    │                                 │
│ ▸ main app.ts:89              │                                 │
│ Breakpoints                   │                                 │
├───────────────────────────────┴─────────────────────────────────┤
│ B: DEBUG CONSOLE                                                 │
│ > user.id                                                        │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- top debug toolbar is a command strip;
- variables support expand/copy/set value where adapter allows it;
- stepping commands remain reachable when focus is in editor or debug views.

### W-011 Testing

```text
┌P: TESTING─────────────────────┬E: app.test.ts───────────────────┐
│ [Run All] [Debug Failed]      │  10 test("parses users", () => {│
│ Filter: failed                │  11   expect(parseUser(raw))... │
│                               │                                 │
│ ▾ parser                      │                                 │
│   ✓ parses valid user         │                                 │
│   ✕ rejects empty id          │                                 │
│   ○ handles unicode names     │                                 │
├───────────────────────────────┴─────────────────────────────────┤
│ B: TEST OUTPUT                                                   │
│ AssertionError: expected id                                      │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- test state is visible without colour alone;
- failures navigate to source and output;
- run/debug profiles from extensions are supported.

### W-012 Terminal panel

```text
┌E: app.ts─────────────────────────────────────────────────────────┐
│ ...                                                             │
├─────────────────────────────────────────────────────────────────┤
│ B: TERMINAL                                       + split trash  │
│ tabs: zsh  npm:test ✕  server ●                                │
│ ┌ zsh ─────────────────────────┬ npm:test ────────────────────┐ │
│ │ $ git status                 │ PASS src/app.test.ts          │ │
│ │ On branch main              │                                │ │
│ │                              │                                │ │
│ └──────────────────────────────┴────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- PTY output is parsed into Smith’s internal terminal screen model;
- child TUIs cannot take over Smith’s outer terminal;
- terminal selection, copy, paste, search, scrollback, split, kill, and rename work.

### W-013 Extensions

```text
┌P: EXTENSIONS──────────────────┬E: Extension Details─────────────┐
│ Search: python                │ Python                          │
│                               │ Installed  Enabled              │
│ Installed                     │ Smith compatibility: Native     │
│ ✓ Python                      │                                 │
│ ✓ ESLint                      │ Contributions                   │
│                               │ commands, languages, debugger,  │
│ Marketplace / Registry        │ testing                         │
│ Python                        │                                 │
│  millions installs            │ Unsupported surfaces: none      │
│ [Install] [Disable]           │                                 │
└───────────────────────────────┴─────────────────────────────────┘
```

Required behavior:

- every extension has compatibility state before or during activation;
- unsupported contributions are listed clearly;
- enabling a risky extension may require workspace trust.

### W-014 Settings and keybindings

```text
┌Z: Settings───────────────────────────────────────────────────────┐
│ Search settings: minimap                                         │
│ Scope: User | Remote | Workspace | Folder                        │
├───────────────────────────────┬─────────────────────────────────┤
│ Editor > Minimap              │ editor.minimap.enabled           │
│ [x] Enabled                   │ Show a textual overview ruler    │
│ Side: right                   │ Smith support: partial           │
│ Size: proportional            │ [Reset] [Open JSON]              │
├───────────────────────────────┴─────────────────────────────────┤
│ Esc close  Ctrl+S save  Ctrl+, keybindings                       │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- settings preserve VS Code scope precedence;
- terminal-specific unsupported values are explained;
- JSON fallback is always available for advanced editing.

### W-015 Workspace trust and authentication

```text
┌Z: Workspace Trust────────────────────────────────────────────────┐
│ This workspace is not trusted.                                  │
│                                                                 │
│ Until trusted, Smith will block tasks, debug adapters, project   │
│ executables, shell hooks, and extension code that can run from   │
│ this workspace.                                                  │
│                                                                 │
│ [Trust Workspace] [Open Restricted] [Cancel]                     │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- trust decision appears before executing workspace-controlled code;
- restricted mode is visible in status bar;
- blocked actions explain exactly what was blocked.

### W-016 Notifications and progress

```text
┌─────────────────────────────────────────────────────────────────┐
│ E: app.ts                                                       │
│                                                                 │
│                                      ┌Z: Notifications────────┐  │
│                                      │ ⚠ Extension crashed    │  │
│                                      │ Python language server │  │
│                                      │ [Show Log] [Restart]   │  │
│                                      │                        │  │
│                                      │ ⟳ Searching... Cancel  │  │
│                                      └────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│ = devbox main* indexing 42%  ⚠1                                 │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- notifications are actionable and reviewable after toast dismissal;
- long tasks expose cancellation where available;
- default logs are redacted.

### W-017 Hit regions and mouse routing

```text
Frame N hit map:

z=30  [command palette overlay]          click/select/type/escape
z=20  [completion popup]                 click/select/wheel
z=10  [editor text viewport]             cursor/select/drag/context
z=10  [editor gutter]                    breakpoint/fold/context
z=10  [splitter editor|side bar]         drag resize
z=10  [tabs]                             activate/reorder/close/context
z=10  [status item: remote]              open remote menu
z=0   [background workbench]             focus only
```

Required behavior:

- hit regions are rebuilt after every layout pass;
- stale hit regions are never reused after resize;
- topmost z-order wins;
- disabled targets explain their disabled state if invoked by keyboard.

### W-018 Reconnect and degraded state

```text
┌ T: app.ts ● ────────────────────────────────────────────────────┐
│  42 const user = parseUser(raw);                                │
│                                                                 │
│ ┌Z: Connection degraded──────────────────────────────────────┐   │
│ │ Reconnecting to devbox... attempt 2 of 5                   │   │
│ │ Unsaved buffers are preserved locally.                     │   │
│ │ Terminals: restoring   Debug: lost   File watching: paused │   │
│ │ [Retry Now] [Work Offline] [Show Details]                  │   │
│ └────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ = devbox reconnecting  app.ts dirty  trust:yes                  │
└─────────────────────────────────────────────────────────────────┘
```

Required behavior:

- connection state is globally visible;
- service recovery status is explicit;
- saves are not falsely acknowledged while disconnected.

## 8. Functional map by user journey

| Journey | Required UI elements | Required functions |
| --- | --- | --- |
| Connect to remote workspace | Welcome, remote indicator, trust prompt, notification center, status bar | choose host/workspace, show install/start progress, authenticate, show connection state, handle version mismatch. |
| Open and edit file | Explorer, Quick Open, editor, tabs, breadcrumbs, status bar | open, preview/pin, edit, undo/redo, save, save as, revert, conflict resolve, navigate history. |
| Navigate code | editor, outline, breadcrumbs, quick open, hover, peek | go to definition/declaration/type/reference, symbols, line, bracket, next diagnostic, next change. |
| Use language intelligence | editor overlays, Problems, status | completion, signature help, hover, rename, code actions, formatting, semantic tokens, inlay hints. |
| Search and replace | Search view, editor, confirmation dialog | stream search, cancel, filter, replace result, replace file, replace all with confirmation. |
| Use source control | SCM view, diff editor, status bar, dialogs | stage, unstage, commit, branch, sync, diff, discard, conflict navigation. |
| Run tasks | command palette, terminal panel, Problems, status | pick task, run, reveal output, cancel, problem-match, rerun. |
| Debug | Run and Debug, editor gutter, debug console, panel, status | configure, start, step, continue, pause, stop, variables, watches, breakpoints, evaluate. |
| Test | Testing view, editor glyphs, output panel | discover, run, debug, filter, show failed output, navigate failure. |
| Use terminal | Terminal panel/editor, status, command palette | create, profile, split, kill, scroll, search, select/copy/paste, shell integration. |
| Manage extensions | Extensions view, compatibility details, trust/auth prompts | search, install, update, enable, disable, uninstall, inspect unsupported surfaces. |
| Configure workspace | Settings, keybindings, profiles, JSON editors | search, edit, reset, scope selection, record keybinding, resolve conflicts. |
| Recover from failure | reconnect overlay, notification center, logs, status | retry, work offline, show details, preserve dirty buffers, restore terminal. |

## 9. Accessibility requirements

Smith must satisfy these requirements before feature completion:

- keyboard path for every operation;
- visible focus indicator independent of colour;
- severity/status represented by text or glyph, not colour alone;
- configurable contrast and colour themes mapped to terminal capability;
- screen-reader friendly linear navigation mode where terminal/shell supports it;
- predictable tab/focus order;
- command palette access to every command;
- no hidden mouse-only controls;
- no time-limited prompt without a persistent review path;
- resize state and connection state understandable without colour.

## 10. Open UX decisions

| ID | Decision | Options | Default recommendation |
| --- | --- | --- | --- |
| UXD-001 | Activity rail placement in narrow mode | hidden, top row, command-only | command-only plus shortcut hint. |
| UXD-002 | Minimap replacement | none, overview ruler, textual map | overview ruler only for MVP. |
| UXD-003 | Modal editor handling | regular tab, centered modal, full-screen overlay | centered modal in wide/medium; full-screen overlay in narrow/short. |
| UXD-004 | Webview fallback | unsupported, external browser, extension adapter API | unsupported by default; explicit external handoff only. |
| UXD-005 | Mouse drag/drop in Explorer | disabled, copy/move with confirmation, full parity | enable only intra-tree move/copy with confirmation after basic file ops are stable. |
| UXD-006 | Screen-reader mode | normal terminal, simplified linear UI, external accessibility bridge | simplified linear UI as a dedicated mode. |

## 11. Traceability

| UX area | Requirement links | Backlog links | Test links |
| --- | --- | --- | --- |
| Responsive workbench | FR-006, FR-007, FR-010, NFR-003, NFR-008 | SMITH-011, SMITH-012, SMITH-013 | T-008, T-009, T-010, T-011 |
| Editor | FR-008, FR-009 | SMITH-014, SMITH-015, SMITH-016 | T-006, T-007, T-014 |
| Views | FR-010, FR-012 | SMITH-018, SMITH-020, SMITH-021, SMITH-022 | T-013, T-015, T-016, T-017, T-018 |
| Terminal | FR-005, FR-011 | SMITH-010, SMITH-019 | T-005, T-012 |
| Extensions | FR-012, FR-013, FR-014 | SMITH-023, SMITH-024 | T-014, T-023 |
| Trust/security | FR-014, NFR-007 | SMITH-025 | T-024, T-025 |
| Recovery | FR-015, NFR-005, NFR-012 | SMITH-009, SMITH-026 | T-019, T-020 |

