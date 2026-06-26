import { Writable } from 'node:stream';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { IdeSession } from '../src/ide/session.mjs';
import { SshWorkspaceClient, workspaceFile } from '../src/remote/ssh-workspace.mjs';
import { withSshFixture } from './ssh-fixture.mjs';
import { writeJson } from './lib.mjs';

const results = [];

class CaptureStream extends Writable {
  constructor() {
    super();
    this.text = '';
    this.columns = 100;
    this.rows = 30;
  }

  _write(chunk, _encoding, callback) {
    this.text += chunk.toString();
    callback();
  }
}

class TerminalUser {
  constructor({ session, output }) {
    this.session = session;
    this.output = output;
    this.frames = [];
    this.steps = [];
    this.stepIndex = 0;
  }

  see(goal, expectedText) {
    const screen = this.capture(goal);
    const expected = (Array.isArray(expectedText) ? expectedText : [expectedText]).filter(Boolean);
    for (const text of expected) {
      assert(screen.includes(text), `User expected to see "${text}" while trying to ${goal}`);
    }
    this.steps.push({
      index: this.stepIndex++,
      goal,
      observes: expected,
      action: 'observe screen',
      result: 'visible'
    });
    return screen;
  }

  async press(goal, key, expectedText) {
    const cue = visibleCueFor(key);
    if (cue) {
      this.see(goal, cue);
    }
    await this.session.performUserAction(key);
    const screen = this.capture(goal);
    if (expectedText) {
      const expected = Array.isArray(expectedText) ? expectedText : [expectedText];
      for (const text of expected) {
        assert(screen.includes(text), `After pressing ${key}, user expected to see "${text}" while trying to ${goal}`);
      }
    }
    this.steps.push({
      index: this.stepIndex++,
      goal,
      observes: cue || 'current focused control',
      action: `press ${key}`,
      result: expectedText ? `saw ${JSON.stringify(expectedText)}` : 'screen updated'
    });
  }

  async type(goal, text, expectedEcho = text) {
    this.see(goal, inputPromptCue(this.session));
    await this.session.performUserAction(`text:${text}`);
    const screen = this.capture(goal);
    if (expectedEcho) {
      assert(screen.includes(expectedEcho), `After typing, user expected to see "${expectedEcho}" while trying to ${goal}`);
    }
    this.steps.push({
      index: this.stepIndex++,
      goal,
      observes: inputPromptCue(this.session),
      action: `type ${redactLong(text)}`,
      result: expectedEcho ? `saw ${expectedEcho}` : 'text accepted'
    });
  }

  async click(goal, x, y, expectedText) {
    this.see(goal, 'Explorer');
    await this.session.performUserAction({ type: 'mouse', x, y });
    const screen = this.capture(goal);
    if (expectedText) {
      assert(screen.includes(expectedText), `After click, user expected to see "${expectedText}" while trying to ${goal}`);
    }
    this.steps.push({
      index: this.stepIndex++,
      goal,
      observes: 'Explorer',
      action: `click ${x},${y}`,
      result: expectedText ? `saw ${expectedText}` : 'screen updated'
    });
  }

  async rawInput(goal, sequence, forbiddenText) {
    const before = this.capture(goal);
    await this.session.performUserAction({ type: 'rawInput', sequence });
    const after = this.capture(goal);
    assert(!after.includes(forbiddenText), `Raw terminal input must not appear on screen as "${forbiddenText}"`);
    this.steps.push({
      index: this.stepIndex++,
      goal,
      observes: before.includes('INSERT') ? 'INSERT mode' : 'terminal screen',
      action: 'terminal sends raw mouse/control sequence',
      result: 'sequence routed as control input, not text'
    });
  }

  resize(goal, width, height, expectedText) {
    this.output.columns = width;
    this.output.rows = height;
    const screen = this.capture(`${goal} ${width}x${height}`);
    assert(screen.includes(expectedText), `After resize to ${width}x${height}, user expected to see "${expectedText}"`);
    this.steps.push({
      index: this.stepIndex++,
      goal,
      observes: 'terminal was resized',
      action: `resize to ${width}x${height}`,
      result: `saw ${expectedText}`
    });
  }

  capture(label) {
    const frame = this.session.renderFrame({ width: this.output.columns, height: this.output.rows });
    const safeLabel = label.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '').toLowerCase() || 'screen';
    const item = {
      index: this.frames.length,
      label,
      safeLabel,
      width: this.output.columns,
      height: this.output.rows,
      text: frame.text
    };
    this.frames.push(item);
    this.output.write(`\n--- ${String(item.index).padStart(2, '0')} ${label} ---\n${frame.text}\n`);
    return frame.text;
  }
}

async function test(id, name, fn) {
  const startedAt = Date.now();
  try {
    await fn();
    results.push({ id, name, status: 'passed', durationMs: Date.now() - startedAt });
  } catch (error) {
    results.push({ id, name, status: 'failed', durationMs: Date.now() - startedAt, message: error.message });
  }
}

await test('USER-MVP-001', 'user completes IDE tasks by reading terminal feedback and using visible UX cues', async () => {
  await withSshFixture(async ({ target, workspace }) => {
    const output = new CaptureStream();
    const client = new SshWorkspaceClient(target);
    const session = new IdeSession({ client, workspace, remoteLabel: 'ssh:fixture', outputWriter: output });
    await session.initialize({ seedDemo: true });
    const user = new TerminalUser({ session, output });

    user.see('orient in the terminal IDE', ['Explorer', 'Editor: src/app.ts', '? Help']);

    await user.press('open contextual help because the status line says help is available', '?', ['Explorer help', 'Esc closes this help.']);
    await user.press('close help using the visible close instruction', 'escape', 'Help closed.');

    await user.press('discover commands from the visible command-palette shortcut', 'ctrl+shift+p', 'Command palette');
    await user.type('ask the command palette for help', 'help');
    await user.press('run the selected help command', 'enter', ['Command help', 'Esc closes this help.']);
    await user.press('close command help using the visible close instruction', 'escape', 'Help closed.');

    await user.click('open the visible app.ts file from Explorer with the mouse', 8, 5, 'Opened src/app.ts');

    await user.press('enter Insert mode because the screen says i edits', 'i', 'INSERT');
    await user.type('edit the file and see dirty state feedback', '// end-user edit ', 'end-user edit');
    await user.rawInput('click while editing without inserting terminal control text', '\u001b[<0;10;5M', '[<0;10;5M');
    await user.press('save the dirty file using the visible save shortcut', 'ctrl+s', 'Saved src/app.ts');
    await user.press('return to Normal mode after saving', 'escape', 'NORMAL');

    await user.press('open command palette to create a file', 'ctrl+shift+p', 'Command palette');
    await user.type('choose the visible command path for creating a file', 'new file');
    await user.press('submit create-file command and wait for file path prompt', 'enter', 'New file:');
    await user.type('enter new file path in the visible prompt', 'notes/todo.md');
    await user.press('create the new file and open it', 'enter', ['Created notes/todo.md', 'Editor: notes/todo.md']);
    await user.press('enter Insert mode for the new file', 'i', 'INSERT');
    await user.type('add content to the new file', 'created from explorer workflow', 'created from explorer workflow');
    await user.press('save the new file', 'ctrl+s', 'Saved notes/todo.md');
    await user.press('return to Normal mode after saving the new file', 'escape', 'NORMAL');

    await user.press('open command palette to rename the active file', 'ctrl+shift+p', 'Command palette');
    await user.type('choose rename from the command palette', 'rename');
    await user.press('submit rename command and wait for destination prompt', 'enter', 'Rename notes/todo.md to:');
    await user.type('enter rename destination', 'notes/done.md');
    await user.press('complete rename and see confirmation', 'enter', ['Renamed notes/todo.md to notes/done.md', 'Editor: notes/done.md']);

    await user.press('open command palette to delete the active file', 'ctrl+shift+p', 'Command palette');
    await user.type('choose delete from command palette', 'delete');
    await user.press('open delete confirmation and read the destructive action prompt', 'enter', ['Delete file', 'Press d to delete permanently']);
    await user.press('cancel delete using the visible escape path', 'escape', 'Delete cancelled.');

    await user.press('open command palette to delete the active file again', 'ctrl+shift+p', 'Command palette');
    await user.type('choose delete again after confirming the file is still active', 'delete');
    await user.press('open delete confirmation again', 'enter', ['Delete file', 'Press d to delete permanently']);
    await user.press('confirm delete using the visible key in the prompt', 'd', 'Deleted notes/done.md');

    await user.press('use visible quick-open shortcut to reopen the original source file', 'ctrl+p', 'Open file:');
    await user.type('type the source file path into quick open', 'src/app.ts');
    await user.press('open the source file from quick open', 'enter', ['Opened src/app.ts', 'Editor: src/app.ts']);

    await user.press('start search from the visible slash search hint', '/', 'Search:');
    await user.type('search for the text just added', 'end-user');
    await user.press('submit search and inspect result feedback', 'enter', ['Search results', 'src/app.ts']);

    await user.press('open terminal using the visible terminal shortcut', 'ctrl+`', 'TERMINAL');
    await user.type('type a remote terminal command into the terminal panel', '/bin/echo ide-ok');
    await user.press('run the terminal command and read its output', 'enter', ['ide-ok', 'exit 0']);
    await user.press('leave terminal mode using Escape', 'escape', 'Returned to editor.');

    await user.press('make a second edit to test dirty-exit protection', 'i', 'INSERT');
    await user.type('type unsaved text before quitting', '// dirty-exit check ', 'dirty-exit check');
    await user.press('return to Normal mode with unsaved changes visible', 'escape', 'Unsaved changes');
    await user.press('try to quit and read the dirty-buffer warning', 'q', ['Unsaved changes', 'Press s to save and quit']);
    await user.press('cancel quit because the warning shows Escape is safe', 'escape', 'Quit cancelled.');
    await user.press('save after cancelling quit', 'ctrl+s', 'Saved src/app.ts');

    user.resize('verify wide resize preserves workbench context', 140, 40, 'Editor: src/app.ts');
    user.resize('verify narrow resize explains overlay behavior', 70, 24, 'Narrow layout');
    user.resize('verify minimum resize gives recovery guidance', 52, 11, 'Smith needs more space');
    user.resize('return to usable size before quitting', 100, 30, 'Editor: src/app.ts');
    await user.press('quit after all files are saved', 'q', 'Goodbye.');

    const transcript = output.text;
    await rm('test-evidence/manual-product-mvp/frames', { recursive: true, force: true });
    await mkdir('test-evidence/manual-product-mvp/frames', { recursive: true });
    await writeFile('test-evidence/manual-product-mvp/transcript.txt', transcript, 'utf8');
    await writeJson('test-evidence/manual-product-mvp/user-journey.json', {
      schema: 'smith.user-journey-evidence.v1',
      perspective: 'end-user reads terminal screen, chooses visible action, verifies visible feedback',
      steps: user.steps
    });
    for (const frame of user.frames) {
      await writeFile(
        `test-evidence/manual-product-mvp/frames/${String(frame.index).padStart(3, '0')}-${frame.safeLabel}.txt`,
        frame.text,
        'utf8'
      );
    }

    const saved = await client.readFile(workspaceFile(workspace, 'src/app.ts'));
    assert(saved.includes('end-user edit'), 'user edit must be saved remotely');
    assert(saved.includes('dirty-exit check'), 'post-warning edit must be saved remotely');
    assert(!saved.includes('[<0;10;5M'), 'raw mouse sequence must not be written to the editor');
    assert(!saved.includes('\u001b'), 'terminal escape sequence must not be written to the editor');
    let deletedFileMissing = false;
    try {
      await client.readFile(workspaceFile(workspace, 'notes/done.md'));
    } catch {
      deletedFileMissing = true;
    }
    assert(deletedFileMissing, 'confirmed delete must remove renamed remote file');
    assert(!transcript.includes('│E│'), 'default MVP UI must not show the unclear activity rail');
    assert(session.quitRequested, 'session must quit through user workflow');
  });
});

const failed = results.filter((result) => result.status !== 'passed');
await mkdir('test-evidence/manual-product-mvp/junit', { recursive: true });
await writeJson('test-evidence/manual-product-mvp/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'manual-product-mvp',
  perspective: 'user-facing terminal UX',
  results
});
await writeFile(
  'test-evidence/manual-product-mvp/junit/manual-mvp.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="manual-product-mvp" tests="${results.length}" failures="${failed.length}">`,
    ...results.map((result) => {
      const failure = result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : '';
      return `  <testcase classname="smith.manual-product-mvp" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
    }),
    '</testsuite>',
    ''
  ].join('\n'),
  'utf8'
);

for (const result of results) {
  console.log(`${result.status.toUpperCase()} ${result.id} ${result.name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function visibleCueFor(key) {
  const cues = {
    '?': '? Help',
    escape: 'Esc',
    'ctrl+shift+p': 'Ctrl+Shift+P',
    'ctrl+p': 'Ctrl+P',
    'ctrl+`': 'Ctrl+`',
    'ctrl+s': 'Ctrl+S',
    '/': '/ search',
    i: 'i to edit',
    q: 'q quit',
    enter: '',
    d: 'Press d'
  };
  return cues[key] ?? '';
}

function inputPromptCue(session) {
  if (session.mode === 'insert') return 'INSERT';
  if (session.mode === 'terminal') return 'TERMINAL';
  if (session.minibuffer?.prompt) return session.minibuffer.prompt;
  return 'Editor';
}

function redactLong(text) {
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
