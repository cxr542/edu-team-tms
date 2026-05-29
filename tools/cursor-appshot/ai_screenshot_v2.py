#!/usr/bin/env python3
"""
AI Screenshot Tool v2
단축키(⌘ + Shift + S) → 영역 캡처 → 질문 선택 팝업(tkinter) → Cursor / Claude.ai 붙여넣기

- 시작 시 pynput 만 필수 (tkinter 없어도 리스너는 동작, 팝업만 생략)
- macOS: 손쉬운 사용 + 화면 기록 권한 필요
"""

from __future__ import annotations

import os
import queue
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime

LOG_PATH = os.path.expanduser("~/.cursor-appshot-v2.log")
PASTE_ACTIVATE_DELAY = 1.0
PASTE_RETRY_COUNT = 3

# ── 로깅 ─────────────────────────────────────────────────────
def log(msg: str) -> None:
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


# ── 의존성 (pynput 만 필수) ───────────────────────────────────
def check_dependencies() -> None:
    try:
        import pynput  # noqa: F401
    except ImportError:
        print("❌ pynput 이 없습니다.\n  pip install pynput\n")
        sys.exit(1)


def try_import_tkinter():
    try:
        import tkinter as tk  # noqa: F401

        return True, tk
    except ImportError:
        return False, None


check_dependencies()
from pynput import keyboard

HAS_TK, tk = try_import_tkinter()

# ── 팝업 메뉴 ───────────────────────────────────────────────
MENU_ITEMS = [
    {"label": "그냥 보내기", "text": ""},
    {"label": "에러 분석해줘", "text": "이 에러의 원인과 해결 방법을 알려줘."},
    {"label": "코드 리뷰해줘", "text": "이 코드를 리뷰하고 개선할 부분을 알려줘."},
    {"label": "디자인 개선 제안", "text": "이 UI/디자인의 개선점을 제안해줘."},
    {"label": "번역해줘 (한→영)", "text": "이 내용을 영어로 번역해줘."},
    {"label": "번역해줘 (영→한)", "text": "이 내용을 한국어로 번역해줘."},
    {"label": "요약해줘", "text": "이 내용을 핵심만 간략하게 요약해줘."},
    {"label": "직접 입력...", "text": "__CUSTOM__"},
]


class PopupMenu:
    def __init__(self):
        self.result = None
        self.root = None

    def show(self):
        if not HAS_TK:
            return ""

        self.root = tk.Tk()
        self.root.title("")
        self.root.resizable(False, False)
        self.root.attributes("-topmost", True)
        self.root.configure(bg="#1E1E2E")

        w, h = 320, 420
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.root.geometry(f"{w}x{h}+{x}+{y}")
        self.root.overrideredirect(True)

        header_frame = tk.Frame(self.root, bg="#2D2D3F", pady=12)
        header_frame.pack(fill="x")
        tk.Label(
            header_frame,
            text="📸  어떻게 보낼까요?",
            font=("SF Pro Display", 14, "bold"),
            bg="#2D2D3F",
            fg="#FFFFFF",
            pady=4,
        ).pack()
        tk.Label(
            header_frame,
            text="숫자 키 또는 클릭으로 선택  •  ESC 취소",
            font=("SF Pro Text", 10),
            bg="#2D2D3F",
            fg="#888888",
        ).pack()

        tk.Frame(self.root, bg="#3D3D5C", height=1).pack(fill="x")

        items_frame = tk.Frame(self.root, bg="#1E1E2E", padx=12, pady=8)
        items_frame.pack(fill="both", expand=True)

        for i, item in enumerate(MENU_ITEMS):
            btn_frame = tk.Frame(items_frame, bg="#1E1E2E")
            btn_frame.pack(fill="x", pady=2)
            tk.Label(
                btn_frame,
                text=f"{i + 1}",
                font=("SF Mono", 11, "bold"),
                bg="#1E1E2E",
                fg="#7B7B9F",
                width=2,
            ).pack(side="left", padx=(4, 6))
            color = "#FFB86C" if item["text"] == "__CUSTOM__" else "#FFFFFF"
            tk.Button(
                btn_frame,
                text=item["label"],
                font=("SF Pro Text", 12),
                bg="#1E1E2E",
                fg=color,
                activebackground="#2D2D4F",
                activeforeground="#FFFFFF",
                relief="flat",
                anchor="w",
                cursor="hand2",
                command=lambda idx=i: self._select(idx),
            ).pack(side="left", fill="x", expand=True, ipady=5)

        tk.Frame(self.root, bg="#3D3D5C", height=1).pack(fill="x")
        tk.Label(
            self.root,
            text="⌘+Shift+S  •  AI Screenshot Tool v2",
            font=("SF Pro Text", 9),
            bg="#1E1E2E",
            fg="#555577",
            pady=6,
        ).pack()

        for i in range(len(MENU_ITEMS)):
            self.root.bind(str(i + 1), lambda e, idx=i: self._select(idx))
        self.root.bind("<Escape>", lambda e: self._cancel())
        self.root.protocol("WM_DELETE_WINDOW", self._cancel)

        self.root.focus_force()
        self.root.mainloop()
        return self.result

    def _select(self, idx):
        item = MENU_ITEMS[idx]
        if item["text"] == "__CUSTOM__":
            self._show_custom_input()
        else:
            self.result = item["text"]
            self.root.destroy()

    def _show_custom_input(self):
        self.root.destroy()
        input_win = tk.Tk()
        input_win.resizable(False, False)
        input_win.attributes("-topmost", True)
        input_win.configure(bg="#1E1E2E")
        input_win.overrideredirect(True)

        w, h = 360, 160
        sw = input_win.winfo_screenwidth()
        sh = input_win.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        input_win.geometry(f"{w}x{h}+{x}+{y}")

        tk.Label(
            input_win,
            text="💬  질문을 입력하세요",
            font=("SF Pro Display", 13, "bold"),
            bg="#1E1E2E",
            fg="#FFFFFF",
            pady=10,
        ).pack()

        entry = tk.Entry(
            input_win,
            font=("SF Pro Text", 12),
            bg="#2D2D4F",
            fg="#FFFFFF",
            insertbackground="#FFFFFF",
            relief="flat",
            width=36,
        )
        entry.pack(padx=16, ipady=6)
        entry.focus_set()

        btn_frame = tk.Frame(input_win, bg="#1E1E2E", pady=10)
        btn_frame.pack()

        def confirm():
            self.result = entry.get().strip()
            input_win.destroy()

        def cancel():
            self.result = None
            input_win.destroy()

        tk.Button(
            btn_frame,
            text="보내기",
            font=("SF Pro Text", 11),
            bg="#6272A4",
            fg="#FFFFFF",
            relief="flat",
            cursor="hand2",
            padx=16,
            pady=4,
            command=confirm,
        ).pack(side="left", padx=6)
        tk.Button(
            btn_frame,
            text="취소",
            font=("SF Pro Text", 11),
            bg="#44475A",
            fg="#AAAAAA",
            relief="flat",
            cursor="hand2",
            padx=16,
            pady=4,
            command=cancel,
        ).pack(side="left", padx=6)

        input_win.bind("<Return>", lambda e: confirm())
        input_win.bind("<Escape>", lambda e: cancel())
        input_win.mainloop()

    def _cancel(self):
        self.result = None
        if self.root:
            try:
                self.root.destroy()
            except tk.TclError:
                pass


# ── 캡처 · 클립보드 · AI 감지 ───────────────────────────────
def capture_screenshot():
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp_path = tmp.name
    tmp.close()
    subprocess.run(["screencapture", "-i", "-x", tmp_path], capture_output=True)
    if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        return None
    return tmp_path


def _cursor_is_running() -> bool:
    script = """
    tell application "System Events"
        return (name of processes) contains "Cursor"
    end tell
    """
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    return result.stdout.strip().lower() == "true"


def detect_ai_tool():
    script = """
    tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
    end tell
    return frontApp
    """
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    active_app = result.stdout.strip()
    if "Cursor" in active_app:
        return "cursor", active_app

    # 캡처는 다른 앱에서 해도 붙여넣기는 Cursor 우선
    if _cursor_is_running():
        return "cursor", "Cursor"

    browser_apps = ["Google Chrome", "Safari", "Arc", "Firefox", "Brave Browser", "Chromium"]
    if any(b in active_app for b in browser_apps):
        for browser in browser_apps:
            script2 = f'''
            tell application "{browser}"
                if it is running then
                    try
                        return URL of active tab of front window
                    end try
                end if
            end tell
            '''
            res = subprocess.run(["osascript", "-e", script2], capture_output=True, text=True)
            url = res.stdout.strip()
            if url and "claude.ai" in url:
                return "claude", browser
    return "unknown", active_app


def copy_image_to_clipboard(image_path):
    script = f'''
    set the clipboard to (read (POSIX file "{image_path}") as «class PNGf»)
    '''
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    return result.returncode == 0


def escape_applescript(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def show_notification(title, message):
    safe_title = escape_applescript(title)
    safe_msg = escape_applescript(message)
    script = f'display notification "{safe_msg}" with title "{safe_title}"'
    subprocess.run(["osascript", "-e", script], capture_output=True)


def _run_osascript(script):
    return subprocess.run(["osascript", "-e", script], capture_output=True, text=True)


def paste_with_retry(activate_script, process_name=None):
    delay = PASTE_ACTIVATE_DELAY
    retries = PASTE_RETRY_COUNT
    frontmost = (
        f'set frontmost of process "{process_name}" to true\ndelay 0.35\n'
        if process_name
        else ""
    )
    full_script = f"""
    {activate_script}
    delay {delay}
    tell application "System Events"
        {frontmost}
        repeat {retries} times
            keystroke "v" using command down
            delay 0.4
        end repeat
    end tell
    """
    result = _run_osascript(full_script)
    if result.returncode != 0:
        return False
    if process_name:
        for menu_name in ("Paste", "붙여넣기"):
            fallback = f'''
            tell application "System Events"
                tell process "{process_name}"
                    try
                        click menu item "{menu_name}" of menu "Edit" of menu bar 1
                    on error
                        click menu item "{menu_name}" of menu "편집" of menu bar 1
                    end try
                end tell
            end tell
            '''
            _run_osascript(fallback)
    return True


def type_followup_text(text: str):
    if not text:
        return
    escaped = escape_applescript(text)
    script = f'''
    tell application "System Events"
        key code 36
        delay 0.15
        keystroke "{escaped}"
    end tell
    '''
    _run_osascript(script)


def paste_image_and_text(tool, app_name, text):
    if tool == "cursor":
        activate = 'tell application "Cursor" to activate'
        paste_with_retry(activate, process_name="Cursor")
    elif tool == "claude":
        activate = f'tell application "{app_name}" to activate'
        paste_with_retry(activate, process_name=app_name)
    else:
        _run_osascript(
            'tell application "System Events" to keystroke "v" using command down'
        )
    time.sleep(0.2)
    type_followup_text(text)


# ── 메인 캡처 (메인 스레드에서만 호출) ───────────────────────
capture_busy = threading.Event()


def run_capture_flow():
    if capture_busy.is_set():
        log("capture: skipped (already in progress)")
        return
    capture_busy.set()
    try:
        log("capture: start")
        tool, app_name = detect_ai_tool()
        log(f"capture: detected {app_name} ({tool})")

        image_path = capture_screenshot()
        if image_path is None:
            log("capture: cancelled")
            return

        log(f"capture: saved {image_path}")

        if HAS_TK:
            selected_text = PopupMenu().show()
            if selected_text is None:
                log("capture: menu cancelled")
                os.unlink(image_path)
                return
        else:
            selected_text = ""
            show_notification(
                "AI Screenshot v2",
                "tkinter 없음 — 이미지만 붙여넣습니다 (brew install python-tk@3.13)",
            )
            log("capture: no tkinter, image only")

        log(f"capture: selected text len={len(selected_text)}")

        if not copy_image_to_clipboard(image_path):
            log("capture: clipboard failed")
            show_notification("AI Screenshot v2", "클립보드 복사 실패")
            os.unlink(image_path)
            return

        time.sleep(0.15)
        paste_image_and_text(tool, app_name, selected_text)

        tool_name = "Claude.ai" if tool == "claude" else ("Cursor" if tool == "cursor" else app_name)
        show_notification("AI Screenshot v2", f"{tool_name}에 전송 완료")
        log(f"capture: pasted to {tool_name}")

        try:
            os.unlink(image_path)
        except OSError:
            pass
    except Exception as e:
        log(f"capture: error {e!r}")
        show_notification("AI Screenshot v2", f"오류: {e}")
    finally:
        capture_busy.clear()


# ── 단축키 (v1 호환) ─────────────────────────────────────────
capture_queue: queue.Queue = queue.Queue()
listener_stop = threading.Event()


def _is_s_key(key):
    if key in (keyboard.KeyCode.from_char("s"), keyboard.KeyCode.from_char("S")):
        return True
    try:
        ch = getattr(key, "char", None)
        return bool(ch) and ch.lower() == "s"
    except (AttributeError, TypeError):
        return False


def _cmd_shift_s_active(keys):
    return (
        keyboard.Key.cmd in keys
        and keyboard.Key.shift in keys
        and any(_is_s_key(k) for k in keys)
    )


def _is_q_key(key):
    if key in (keyboard.KeyCode.from_char("q"), keyboard.KeyCode.from_char("Q")):
        return True
    try:
        ch = getattr(key, "char", None)
        return bool(ch) and ch.lower() == "q"
    except (AttributeError, TypeError):
        return False


def _cmd_shift_q_active(keys):
    return (
        keyboard.Key.cmd in keys
        and keyboard.Key.shift in keys
        and any(_is_q_key(k) for k in keys)
    )


def check_accessibility():
    script = """
    tell application "System Events"
        return UI elements enabled
    end tell
    """
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    return result.stdout.strip().lower() == "true"


class HotkeyListener:
    def __init__(self):
        self.current_keys = set()
        self.triggered = False

    def on_press(self, key):
        self.current_keys.add(key)
        if _cmd_shift_s_active(self.current_keys) and not self.triggered:
            self.triggered = True
            log("hotkey: Cmd+Shift+S")
            capture_queue.put("capture")

    def on_release(self, key):
        self.current_keys.discard(key)
        self.triggered = False
        # ESC는 캡처/팝업 취소용 — 전역 리스너를 끄면 ⌘⇧S가 영구히 안 먹음
        if _cmd_shift_q_active(self.current_keys):
            log("hotkey: Cmd+Shift+Q quit")
            capture_queue.put("quit")


def start_keyboard_listener():
    def run():
        while not listener_stop.is_set():
            listener = HotkeyListener()
            try:
                with keyboard.Listener(
                    on_press=listener.on_press,
                    on_release=listener.on_release,
                ) as l:
                    l.join()
            except Exception as e:
                log(f"listener: error {e!r}")
            if not listener_stop.is_set():
                log("listener: restarting in 1s")
                time.sleep(1)

    t = threading.Thread(target=run, daemon=True)
    t.start()
    return t


def pump_capture_queue_tk(root):
    try:
        while True:
            job = capture_queue.get_nowait()
            if job == "quit":
                listener_stop.set()
                root.quit()
                return
            run_capture_flow()
    except queue.Empty:
        pass
    if not listener_stop.is_set():
        root.after(100, lambda: pump_capture_queue_tk(root))


def pump_capture_queue_blocking():
    while not listener_stop.is_set():
        try:
            job = capture_queue.get(timeout=0.3)
            if job == "quit":
                listener_stop.set()
                return
            run_capture_flow()
        except queue.Empty:
            continue


def main():
    log("=" * 40)
    log("AI Screenshot Tool v2 starting")
    print("=" * 50)
    print("  🤖 AI Screenshot Tool v2")
    print("=" * 50)
    print("  단축키 : ⌘ + Shift + S  (영역 캡처)")
    print("  종료   : ⌘ + Shift + Q  (ESC는 캡처/메뉴 취소만)")
    print(f"  로그   : {LOG_PATH}")
    print("=" * 50)

    if HAS_TK:
        print("  팝업   : tkinter 사용 가능")
    else:
        print("  팝업   : ⚠️ tkinter 없음 → 이미지만 전송")
        print("         brew install python-tk@3.13 후 venv 재생성 권장")

    if not check_accessibility():
        print("\n⚠️  [손쉬운 사용] 권한이 꺼져 있을 수 있습니다.")
        show_notification("AI Screenshot v2", "손쉬운 사용 권한 확인 (터미널/Python)")
    else:
        print("\n✅ 손쉬운 사용 권한 확인됨")

    print("\n✅ 대기 중... ⌘+Shift+S\n")
    log(f"ready (HAS_TK={HAS_TK})")

    start_keyboard_listener()

    if HAS_TK:
        root = tk.Tk()
        root.withdraw()
        root.after(100, lambda: pump_capture_queue_tk(root))
        try:
            root.mainloop()
        except KeyboardInterrupt:
            pass
    else:
        try:
            pump_capture_queue_blocking()
        except KeyboardInterrupt:
            pass

    log("exit")


if __name__ == "__main__":
    main()
