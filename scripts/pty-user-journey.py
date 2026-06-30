#!/usr/bin/env python3
"""Drive the real Smith CLI through an operating-system pseudo-terminal."""

from __future__ import annotations

import errno
import fcntl
import json
import os
import platform
import pty
import re
import select
import shutil
import signal
import struct
import sys
import termios
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "test-evidence" / "pty-product-mvp"
RAW_TRANSCRIPT = EVIDENCE / "transcript.ansi"
TEXT_TRANSCRIPT = EVIDENCE / "transcript.txt"
JOURNEY = EVIDENCE / "user-journey.json"
RESULT = EVIDENCE / "harness-result.json"
DEFAULT_TIMEOUT = 25.0

ENTER_MODES = [
    b"\x1b[?1049h",
    b"\x1b[?1000h",
    b"\x1b[?1006h",
    b"\x1b[?25l",
]
RESTORE_MODES = [
    b"\x1b[?1000l",
    b"\x1b[?1006l",
    b"\x1b[?25h",
    b"\x1b[?1049l",
]


class PtyJourney:
    def __init__(self) -> None:
        self.pid: int | None = None
        self.master: int | None = None
        self.output = bytearray()
        self.steps: list[dict[str, object]] = []
        self.started_at = time.monotonic()
        self.width = 100
        self.height = 30
        self.frame_index = 0

    def start(self) -> None:
        pid, master = pty.fork()
        if pid == 0:
            os.chdir(ROOT)
            os.environ["TERM"] = "xterm-256color"
            os.environ["COLORTERM"] = "truecolor"
            os.execvp("node", ["node", "scripts/smith.mjs", "ide-demo"])
        self.pid = pid
        self.master = master
        self.resize(100, 30, record=False)

    def resize(self, width: int, height: int, *, record: bool = True) -> None:
        assert self.master is not None
        fcntl.ioctl(
            self.master,
            termios.TIOCSWINSZ,
            struct.pack("HHHH", height, width, 0, 0),
        )
        self.width = width
        self.height = height
        if record:
            self.steps.append(
                {
                    "goal": "keep working after changing terminal size",
                    "observes": f"current terminal size before resize",
                    "action": f"resize real PTY to {width}x{height}",
                }
            )

    def wait_for(self, text: str, *, after: int = 0, timeout: float = DEFAULT_TIMEOUT) -> int:
        needle = text.encode("utf-8")
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            found = self.output.find(needle, after)
            if found >= 0:
                return found
            self.read_once(min(0.2, max(0.01, deadline - time.monotonic())))
        tail = strip_terminal_controls(bytes(self.output[-4000:]))
        raise AssertionError(f'Timed out waiting for visible text "{text}". Last output:\n{tail}')

    def act(
        self,
        *,
        goal: str,
        observes: str,
        action: str,
        payload: bytes,
        expected: str | list[str],
    ) -> None:
        start = len(self.output)
        self.write(payload)
        expected_values = [expected] if isinstance(expected, str) else expected
        for expected_text in expected_values:
            self.wait_for(expected_text, after=start)
        self.steps.append(
            {
                "goal": goal,
                "observes": observes,
                "action": action,
                "result": f"saw {expected_values}",
                "rawBytesHex": payload.hex(),
            }
        )
        self.capture_frame(goal)

    def write(self, payload: bytes) -> None:
        assert self.master is not None
        os.write(self.master, payload)

    def capture_frame(self, label: str) -> None:
        frames = EVIDENCE / "frames"
        frames.mkdir(parents=True, exist_ok=True)
        home = self.output.rfind(b"\x1b[H")
        raw = bytes(self.output[home + len(b"\x1b[H") :]) if home >= 0 else bytes(self.output)
        lines = strip_terminal_controls(raw).splitlines()[: self.height]
        safe_label = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or "screen"
        path = frames / f"{self.frame_index:03d}-{safe_label}.txt"
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self.frame_index += 1

    def read_once(self, timeout: float) -> bool:
        assert self.master is not None
        readable, _, _ = select.select([self.master], [], [], timeout)
        if not readable:
            return False
        try:
            chunk = os.read(self.master, 65536)
        except OSError as error:
            if error.errno == errno.EIO:
                return False
            raise
        if not chunk:
            return False
        self.output.extend(chunk)
        return True

    def wait_for_exit(self, timeout: float = DEFAULT_TIMEOUT) -> int:
        assert self.pid is not None
        deadline = time.monotonic() + timeout
        status: int | None = None
        while time.monotonic() < deadline:
            self.read_once(0.1)
            completed, candidate = os.waitpid(self.pid, os.WNOHANG)
            if completed == self.pid:
                status = candidate
                break
        if status is None:
            raise AssertionError("Smith did not exit after the user pressed q")
        while self.read_once(0):
            pass
        return os.waitstatus_to_exitcode(status)

    def stop(self) -> None:
        if self.pid is not None:
            try:
                completed, _ = os.waitpid(self.pid, os.WNOHANG)
                if completed == 0:
                    os.kill(self.pid, signal.SIGTERM)
                    time.sleep(0.1)
                    completed, _ = os.waitpid(self.pid, os.WNOHANG)
                    if completed == 0:
                        os.kill(self.pid, signal.SIGKILL)
                        os.waitpid(self.pid, 0)
            except (ChildProcessError, ProcessLookupError):
                pass
        if self.master is not None:
            try:
                os.close(self.master)
            except OSError:
                pass


def run() -> dict[str, object]:
    journey = PtyJourney()
    try:
        shutil.rmtree(EVIDENCE / "frames", ignore_errors=True)
        journey.start()
        journey.wait_for("Editor: src/app.ts")
        journey.wait_for("F1 commands")
        journey.steps.append(
            {
                "goal": "orient in the terminal IDE",
                "observes": ["Editor: src/app.ts", "F1 commands", "q quit"],
                "action": "read initial screen rendered by the real CLI",
                "result": "ready workbench visible",
            }
        )
        journey.capture_frame("initial ready workbench")

        journey.act(
            goal="open command palette using the advertised function key",
            observes="F1 commands",
            action="press F1 using xterm bytes ESC O P",
            payload=b"\x1bOP",
            expected="Command palette:",
        )
        journey.act(
            goal="filter the command palette",
            observes="Command palette:",
            action="type help",
            payload=b"help",
            expected="Command palette: help",
        )
        journey.act(
            goal="run the selected command",
            observes="Command palette: help",
            action="press Enter",
            payload=b"\r",
            expected="Command help",
        )
        journey.act(
            goal="close contextual command help",
            observes="Esc closes this help.",
            action="press Escape",
            payload=b"\x1b",
            expected="Help closed.",
        )
        journey.act(
            goal="open command palette using its terminal-safe fallback",
            observes="Commands: F1 or :",
            action="press :",
            payload=b":",
            expected="Command palette:",
        )
        journey.act(
            goal="filter to a disabled post-MVP command",
            observes="Command palette:",
            action="type debug",
            payload=b"debug",
            expected="Debug: Start",
        )
        journey.act(
            goal="understand why a command is unavailable",
            observes="Debug: Start is marked disabled",
            action="press Enter",
            payload=b"\r",
            expected="Disabled: Requires post-MVP debugger extension support.",
        )
        journey.act(
            goal="cancel command palette fallback",
            observes="disabled command reason",
            action="press Escape",
            payload=b"\x1b",
            expected="Cancelled.",
        )
        journey.act(
            goal="open Quick Open using the advertised control binding",
            observes="Quick open: Ctrl+P",
            action="press Ctrl+P byte 0x10",
            payload=b"\x10",
            expected="Open file:",
        )
        journey.act(
            goal="filter Quick Open to a visible remote file",
            observes="Open file:",
            action="type README",
            payload=b"README",
            expected="README.md",
        )
        journey.act(
            goal="open the selected Quick Open result",
            observes="README.md is visibly selected",
            action="press Enter",
            payload=b"\r",
            expected="Editor: README.md",
        )
        journey.act(
            goal="return to the source file through Quick Open",
            observes="Quick open: Ctrl+P",
            action="press Ctrl+P",
            payload=b"\x10",
            expected="Open file:",
        )
        journey.act(
            goal="filter Quick Open to app.ts",
            observes="Quick Open result list",
            action="type app.ts",
            payload=b"app.ts",
            expected="src/app.ts",
        )
        journey.act(
            goal="open app.ts from the selected result",
            observes="src/app.ts is visibly selected",
            action="press Enter",
            payload=b"\r",
            expected="Editor: src/app.ts",
        )
        journey.act(
            goal="open the integrated terminal using the advertised function key",
            observes="Terminal: F2",
            action="press F2 using xterm bytes ESC O Q",
            payload=b"\x1bOQ",
            expected="TERMINAL",
        )
        journey.act(
            goal="enter a remote command",
            observes="TERMINAL",
            action="type /bin/echo pty-terminal",
            payload=b"/bin/echo pty-terminal",
            expected="$ /bin/echo pty-terminal",
        )
        journey.act(
            goal="run a command in the remote workspace",
            observes="$ /bin/echo pty-terminal",
            action="press Enter",
            payload=b"\r",
            expected="exit 0",
        )
        journey.act(
            goal="change directory inside the persistent remote shell",
            observes="exit 0 from the first command",
            action="type cd src",
            payload=b"cd src",
            expected="$ cd src",
        )
        journey.act(
            goal="apply the shell state change",
            observes="$ cd src",
            action="press Enter",
            payload=b"\r",
            expected="exit 0",
        )
        journey.act(
            goal="check that shell state persists for the next command",
            observes="persistent terminal remains focused",
            action="type pwd",
            payload=b"pwd",
            expected="$ pwd",
        )
        journey.act(
            goal="prove cwd persisted across commands",
            observes="$ pwd",
            action="press Enter",
            payload=b"\r",
            expected=["/src", "exit 0"],
        )
        journey.act(
            goal="return the persistent shell to workspace root",
            observes="pwd output ends in /src",
            action="type cd ..",
            payload=b"cd ..",
            expected="$ cd ..",
        )
        journey.act(
            goal="apply workspace-root recovery",
            observes="$ cd ..",
            action="press Enter",
            payload=b"\r",
            expected="exit 0",
        )
        journey.act(
            goal="return from terminal focus after the command finishes",
            observes="exit 0",
            action="press Escape",
            payload=b"\x1b",
            expected="Returned to editor.",
        )
        journey.act(
            goal="enter Insert mode from the real keyboard stream",
            observes="i to edit",
            action="press i",
            payload=b"i",
            expected="INSERT",
        )
        journey.act(
            goal="edit the active file",
            observes="INSERT",
            action="type pty-e2e",
            payload=b"pty-e2e ",
            expected="pty-e2e",
        )
        journey.act(
            goal="leave Insert mode with an unsaved buffer",
            observes="Unsaved changes",
            action="press Escape",
            payload=b"\x1b",
            expected="NORMAL mode.",
        )
        journey.act(
            goal="switch away from the dirty source file",
            observes="Quick open: Ctrl+P",
            action="press Ctrl+P",
            payload=b"\x10",
            expected="Open file:",
        )
        journey.act(
            goal="select README while app.ts is dirty",
            observes="Quick Open",
            action="type README",
            payload=b"README",
            expected="README.md",
        )
        journey.act(
            goal="open README without discarding app.ts",
            observes="README.md selected",
            action="press Enter",
            payload=b"\r",
            expected="Editor: README.md",
        )
        journey.act(
            goal="reopen the dirty source file",
            observes="Quick open: Ctrl+P",
            action="press Ctrl+P",
            payload=b"\x10",
            expected="Open file:",
        )
        journey.act(
            goal="filter back to app.ts",
            observes="Quick Open",
            action="type app.ts",
            payload=b"app.ts",
            expected="src/app.ts",
        )
        journey.act(
            goal="prove the unsaved edit survived file switching",
            observes="src/app.ts selected",
            action="press Enter",
            payload=b"\r",
            expected=["Editor: src/app.ts", "pty-e2e", "Unsaved changes"],
        )
        journey.act(
            goal="save the preserved remote file",
            observes="Ctrl+S save",
            action="press Ctrl+S byte 0x13",
            payload=b"\x13",
            expected="Saved src/app.ts",
        )
        journey.act(
            goal="open workspace search",
            observes="/ search",
            action="press /",
            payload=b"/",
            expected="Search:",
        )
        journey.act(
            goal="enter a search query",
            observes="Search:",
            action="type hello",
            payload=b"hello",
            expected="Search: hello",
        )
        journey.act(
            goal="run workspace search",
            observes="Search: hello",
            action="press Enter",
            payload=b"\r",
            expected="Search results (1)",
        )
        journey.act(
            goal="open the selected search result",
            observes="selected result and Enter open hint",
            action="press Enter",
            payload=b"\r",
            expected="Opened search result src/app.ts:1",
        )

        mouse_start = len(journey.output)
        journey.act(
            goal="open a visible Explorer file using a real SGR mouse event",
            observes="Explorer tree and mouse mode enabled",
            action="send SGR left-click at Explorer app.ts row",
            payload=b"\x1b[<0;8;6M",
            expected="Opened src/app.ts",
        )
        mouse_output = bytes(journey.output[mouse_start:])
        if b"[<0;8;6M" in mouse_output:
            raise AssertionError("Mouse control bytes leaked into visible terminal output")

        narrow_start = len(journey.output)
        journey.resize(70, 24)
        journey.wait_for("Narrow layout", after=narrow_start)
        journey.steps[-1]["result"] = 'saw "Narrow layout"'
        journey.capture_frame("narrow layout")

        minimum_start = len(journey.output)
        journey.resize(52, 11)
        journey.wait_for("Smith needs more space", after=minimum_start)
        journey.steps[-1]["result"] = 'saw "Smith needs more space"'
        journey.capture_frame("minimum layout")

        restored_start = len(journey.output)
        journey.resize(100, 30)
        journey.wait_for("Editor: src/app.ts", after=restored_start)
        journey.steps[-1]["result"] = 'saw "Editor: src/app.ts" with session preserved'
        journey.capture_frame("restored layout")

        journey.act(
            goal="make the remote file read-only to exercise failed-save recovery",
            observes="Terminal: F2",
            action="press F2",
            payload=b"\x1bOQ",
            expected="TERMINAL",
        )
        journey.act(
            goal="enter a remote permission-change command",
            observes="TERMINAL",
            action="type /bin/chmod 444 src/app.ts",
            payload=b"/bin/chmod 444 src/app.ts",
            expected="$ /bin/chmod 444 src/app.ts",
        )
        journey.act(
            goal="make the active remote file read-only",
            observes="$ /bin/chmod 444 src/app.ts",
            action="press Enter",
            payload=b"\r",
            expected="exit 0",
        )
        journey.act(
            goal="return to the editor",
            observes="exit 0",
            action="press Escape",
            payload=b"\x1b",
            expected="Returned to editor.",
        )
        journey.act(
            goal="edit a read-only remote file",
            observes="i to edit",
            action="press i",
            payload=b"i",
            expected="INSERT",
        )
        journey.act(
            goal="create a dirty buffer before a failing save",
            observes="INSERT",
            action="type permission-test",
            payload=b"permission-test ",
            expected="permission-test",
        )
        journey.act(
            goal="attempt to save and retain the dirty buffer on failure",
            observes="Unsaved changes",
            action="press Ctrl+S",
            payload=b"\x13",
            expected="Permission denied.",
        )
        journey.act(
            goal="leave Insert mode while preserving the failed edit",
            observes="Permission denied and Unsaved changes",
            action="press Escape",
            payload=b"\x1b",
            expected="NORMAL mode.",
        )
        journey.act(
            goal="open terminal to repair remote permissions",
            observes="F2 terminal",
            action="press F2",
            payload=b"\x1bOQ",
            expected="TERMINAL",
        )
        journey.act(
            goal="enter permission recovery command",
            observes="TERMINAL",
            action="type /bin/chmod 644 src/app.ts",
            payload=b"/bin/chmod 644 src/app.ts",
            expected="$ /bin/chmod 644 src/app.ts",
        )
        journey.act(
            goal="restore remote write permission",
            observes="$ /bin/chmod 644 src/app.ts",
            action="press Enter",
            payload=b"\r",
            expected="exit 0",
        )
        journey.act(
            goal="return to the dirty editor buffer",
            observes="exit 0",
            action="press Escape",
            payload=b"\x1b",
            expected="Returned to editor.",
        )
        journey.act(
            goal="retry the failed save after recovery",
            observes="Unsaved changes",
            action="press Ctrl+S",
            payload=b"\x13",
            expected="Saved src/app.ts",
        )
        journey.act(
            goal="make a final unsaved edit to test safe quit",
            observes="Saved src/app.ts",
            action="press i",
            payload=b"i",
            expected="INSERT",
        )
        journey.act(
            goal="create an unsaved change",
            observes="INSERT",
            action="type dirty-exit",
            payload=b"dirty-exit ",
            expected="dirty-exit",
        )
        journey.act(
            goal="leave Insert mode with a dirty buffer",
            observes="Unsaved changes",
            action="press Escape",
            payload=b"\x1b",
            expected="NORMAL mode.",
        )
        journey.act(
            goal="try to quit with unsaved changes",
            observes="q quit",
            action="press q",
            payload=b"q",
            expected="Press s to save and quit",
        )
        journey.act(
            goal="cancel unsafe quit",
            observes="Press s to save and quit, d to discard, Esc to cancel",
            action="press Escape",
            payload=b"\x1b",
            expected="Quit cancelled.",
        )
        journey.act(
            goal="save after cancelling quit",
            observes="Unsaved changes",
            action="press Ctrl+S",
            payload=b"\x13",
            expected="Saved src/app.ts",
        )

        quit_start = len(journey.output)
        journey.write(b"q")
        exit_code = journey.wait_for_exit()
        journey.steps.append(
            {
                "goal": "quit Smith after saving",
                "observes": "q quit",
                "action": "press q",
                "result": f"process exited with status {exit_code}",
                "rawBytesHex": "71",
            }
        )
        if exit_code != 0:
            raise AssertionError(f"Smith exited with status {exit_code}")
        if b"Goodbye." not in journey.output[quit_start:]:
            raise AssertionError("Quit did not show Goodbye feedback")

        for sequence in ENTER_MODES:
            if sequence not in journey.output:
                raise AssertionError(f"Missing terminal mode entry sequence {sequence!r}")
        for sequence in RESTORE_MODES:
            if sequence not in journey.output:
                raise AssertionError(f"Missing terminal restoration sequence {sequence!r}")

        return {
            "status": "passed",
            "durationMs": round((time.monotonic() - journey.started_at) * 1000),
            "exitCode": exit_code,
            "steps": journey.steps,
            "terminalModesEntered": [sequence.hex() for sequence in ENTER_MODES],
            "terminalModesRestored": [sequence.hex() for sequence in RESTORE_MODES],
            "output": bytes(journey.output),
        }
    except Exception:
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        RAW_TRANSCRIPT.write_bytes(bytes(journey.output))
        TEXT_TRANSCRIPT.write_text(
            strip_terminal_controls(bytes(journey.output)),
            encoding="utf-8",
        )
        JOURNEY.write_text(
            json.dumps(
                {
                    "schema": "smith.pty-user-journey.v1",
                    "perspective": "black-box user controls the real CLI through an OS pseudo-terminal",
                    "status": "failed",
                    "steps": journey.steps,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        raise
    finally:
        journey.stop()


def strip_terminal_controls(raw: bytes) -> str:
    text = raw.decode("utf-8", errors="replace")
    text = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", text)
    text = re.sub(r"\x1bO.", "", text)
    text = text.replace("\r", "")
    return "".join(char for char in text if char == "\n" or ord(char) >= 32)


def signal_evidence_paths(signal_name: str) -> tuple[Path, Path, Path]:
    suffix = signal_name.lower()
    return (
        EVIDENCE / f"signal-{suffix}-transcript.ansi",
        EVIDENCE / f"signal-{suffix}-transcript.txt",
        EVIDENCE / f"signal-{suffix}-result.json",
    )


def run_signal_restoration(signal_name: str) -> dict[str, object]:
    journey = PtyJourney()
    raw_path, text_path, _ = signal_evidence_paths(signal_name)
    expected_exit = {"SIGHUP": 129, "SIGINT": 130, "SIGTERM": 143}[signal_name]
    try:
        journey.start()
        journey.wait_for("Editor: src/app.ts")
        if signal_name == "SIGTERM":
            journey.write(b"\x1bOQ")
            journey.wait_for("TERMINAL")
            journey.write(b"/bin/echo signal-terminal")
            journey.wait_for("$ /bin/echo signal-terminal")
            journey.write(b"\r")
            journey.wait_for("exit 0")
        assert journey.pid is not None
        os.kill(journey.pid, getattr(signal, signal_name))
        exit_code = journey.wait_for_exit()
        if exit_code != expected_exit:
            raise AssertionError(
                f"{signal_name} should produce exit status {expected_exit}, got {exit_code}"
            )
        for sequence in ENTER_MODES:
            if sequence not in journey.output:
                raise AssertionError(f"Missing terminal mode entry sequence {sequence!r}")
        for sequence in RESTORE_MODES:
            if sequence not in journey.output:
                raise AssertionError(f"Missing terminal restoration sequence after SIGTERM {sequence!r}")
        return {
            "status": "passed",
            "durationMs": round((time.monotonic() - journey.started_at) * 1000),
            "signal": signal_name,
            "exitCode": exit_code,
            "terminalModesEntered": [sequence.hex() for sequence in ENTER_MODES],
            "terminalModesRestored": [sequence.hex() for sequence in RESTORE_MODES],
            "output": bytes(journey.output),
        }
    except Exception:
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        raw_path.write_bytes(bytes(journey.output))
        text_path.write_text(
            strip_terminal_controls(bytes(journey.output)),
            encoding="utf-8",
        )
        raise
    finally:
        journey.stop()


def write_evidence(result: dict[str, object]) -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    output = result.pop("output")
    assert isinstance(output, bytes)
    RAW_TRANSCRIPT.write_bytes(output)
    TEXT_TRANSCRIPT.write_text(strip_terminal_controls(output), encoding="utf-8")
    JOURNEY.write_text(
        json.dumps(
            {
                "schema": "smith.pty-user-journey.v1",
                "perspective": "black-box user controls the real CLI through an OS pseudo-terminal",
                "steps": result["steps"],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    RESULT.write_text(
        json.dumps(
            {
                key: value
                for key, value in result.items()
                if key != "steps"
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> int:
    signal_mode = len(sys.argv) > 1 and sys.argv[1] == "signal"
    signal_name = sys.argv[2] if len(sys.argv) > 2 else "SIGTERM"
    try:
        if signal_mode:
            raw_path, text_path, result_path = signal_evidence_paths(signal_name)
            result = run_signal_restoration(signal_name)
            output = result.pop("output")
            assert isinstance(output, bytes)
            EVIDENCE.mkdir(parents=True, exist_ok=True)
            raw_path.write_bytes(output)
            text_path.write_text(strip_terminal_controls(output), encoding="utf-8")
            result_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
            print(f"PASS T-005-{signal_name.lower()} {signal_name} restores terminal")
            return 0
        result = run()
        result["environment"] = {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "term": "xterm-256color",
            "initialSize": "100x30",
        }
        write_evidence(result)
        print("PASS USER-PTY-001 real CLI terminal journey")
        return 0
    except Exception as error:
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        result_path = signal_evidence_paths(signal_name)[2] if signal_mode else RESULT
        result_path.write_text(
            json.dumps(
                {
                    "status": "failed",
                    "message": str(error),
                    "environment": {
                        "platform": platform.platform(),
                        "python": platform.python_version(),
                        "term": "xterm-256color",
                    },
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        test_id = f"T-005-{signal_name.lower()}" if signal_mode else "USER-PTY-001"
        print(f"FAIL {test_id} {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
