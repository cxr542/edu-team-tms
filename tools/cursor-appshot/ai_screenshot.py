#!/usr/bin/env python3
"""
AI Screenshot Tool
단축키(⌘ + Shift + S)를 누르면 스크린샷을 캡처해서
Claude.ai 또는 Cursor 대화창에 자동으로 붙여넣는 도구
"""

import subprocess
import sys
import os
import time
import tempfile
import threading
from pathlib import Path

# ── 의존성 체크 및 설치 안내 ──────────────────────────────────
def check_dependencies():
    missing = []
    try:
        import pynput
    except ImportError:
        missing.append("pynput")
    try:
        import pyperclip
    except ImportError:
        missing.append("pyperclip")

    if missing:
        print("❌ 필요한 패키지가 없습니다. 아래 명령어로 설치해주세요:\n")
        print(f"  pip install {' '.join(missing)}\n")
        sys.exit(1)

check_dependencies()

from pynput import keyboard
import pyperclip

# ── 설정 ─────────────────────────────────────────────────────
HOTKEY = {keyboard.Key.cmd, keyboard.Key.shift, keyboard.KeyCode.from_char('s')}

# 캡처 후 항상 Cursor에 붙여넣기 (True 권장)
ALWAYS_PASTE_TO_CURSOR = True
PASTE_ACTIVATE_DELAY = 1.0
PASTE_RETRY_COUNT = 3

# 지원 AI 도구 설정
AI_TOOLS = {
    "claude": {
        "name": "Claude.ai",
        "browser_title_keywords": ["Claude", "claude.ai"],
        "type": "browser",
    },
    "cursor": {
        "name": "Cursor",
        "app_name": "Cursor",
        "type": "app",
    },
}

# ── 스크린샷 캡처 ─────────────────────────────────────────────
def capture_screenshot(mode="region"):
    """
    mode:
      - "region"   : 드래그로 영역 선택 (기본)
      - "fullscreen": 전체화면 캡처
      - "window"   : 현재 창 캡처
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp_path = tmp.name
    tmp.close()

    if mode == "region":
        # screencapture -i : 인터랙티브 영역 선택
        result = subprocess.run(
            ["screencapture", "-i", "-x", tmp_path],
            capture_output=True
        )
    elif mode == "window":
        # screencapture -w : 윈도우 선택
        result = subprocess.run(
            ["screencapture", "-w", "-x", tmp_path],
            capture_output=True
        )
    else:
        # 전체화면
        result = subprocess.run(
            ["screencapture", "-x", tmp_path],
            capture_output=True
        )

    # 캡처 취소된 경우 (파일이 없거나 크기 0)
    if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        return None

    return tmp_path


# ── 활성 창 감지 ─────────────────────────────────────────────
def get_active_app():
    """현재 포커스된 앱 이름 반환"""
    script = '''
    tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
    end tell
    return frontApp
    '''
    result = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True, text=True
    )
    return result.stdout.strip()


def get_browser_tab_title():
    """브라우저 현재 탭 제목 반환"""
    for browser in ["Google Chrome", "Safari", "Arc", "Firefox", "Brave Browser"]:
        script = f'''
        tell application "{browser}"
            if it is running then
                try
                    return URL of active tab of front window
                end try
            end if
        end tell
        '''
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True
        )
        url = result.stdout.strip()
        if url:
            return browser, url
    return None, None


def detect_ai_tool():
    """
    현재 활성 앱이 어떤 AI 도구인지 감지
    반환: ("claude" | "cursor" | "unknown", app_name)
    """
    active_app = get_active_app()

    # Cursor 앱 감지
    if "Cursor" in active_app:
        return "cursor", active_app

    # 브라우저 감지 → Claude.ai 탭 확인
    browser_apps = ["Google Chrome", "Safari", "Arc", "Firefox", "Brave Browser", "Chromium"]
    if any(b in active_app for b in browser_apps):
        browser, url = get_browser_tab_title()
        if url and "claude.ai" in url:
            return "claude", browser

    return "unknown", active_app


# ── 클립보드에 이미지 복사 ────────────────────────────────────
def copy_image_to_clipboard(image_path):
    """이미지 파일을 클립보드에 복사 (macOS osascript 활용)"""
    script = f'''
    set the clipboard to (read (POSIX file "{image_path}") as «class PNGf»)
    '''
    result = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True, text=True
    )
    return result.returncode == 0


# ── AI 도구에 붙여넣기 ────────────────────────────────────────
def _run_osascript(script):
    return subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        text=True,
    )


def paste_with_retry(activate_script, process_name=None):
    """activate 후 Cmd+V를 여러 번 시도 (Cursor/Electron 포커스 지연 대응)"""
    delay = PASTE_ACTIVATE_DELAY
    retries = PASTE_RETRY_COUNT

    full_script = f'''
    {activate_script}
    delay {delay}
    tell application "System Events"
        {"set frontmost of process \"" + process_name + "\" to true" if process_name else ""}
        {"delay 0.35" if process_name else ""}
        repeat {retries} times
            keystroke "v" using command down
            delay 0.4
        end repeat
    end tell
    '''
    result = _run_osascript(full_script)
    if result.returncode != 0:
        return False

    # 메뉴 Paste fallback (한글/영문 macOS)
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


def paste_to_claude(browser_app):
    """Claude.ai 브라우저 탭 입력창에 붙여넣기"""
    activate = f'''
    tell application "{browser_app}"
        activate
    end tell
    '''
    paste_with_retry(activate, process_name=browser_app)


def paste_to_cursor():
    """Cursor 채팅창에 붙여넣기"""
    activate = '''
    tell application "Cursor"
        activate
    end tell
    '''
    return paste_with_retry(activate, process_name="Cursor")


def paste_to_active():
    """현재 활성 창에 그냥 붙여넣기 (fallback)"""
    script = '''
    tell application "System Events"
        keystroke "v" using command down
    end tell
    '''
    subprocess.run(["osascript", "-e", script], capture_output=True)


# ── 알림 표시 ─────────────────────────────────────────────────
def show_notification(title, message):
    script = f'''
    display notification "{message}" with title "{title}"
    '''
    subprocess.run(["osascript", "-e", script], capture_output=True)


# ── 메인 캡처 흐름 ────────────────────────────────────────────
def run_capture():
    """단축키 트리거 시 실행되는 메인 흐름"""
    if capture_busy.is_set():
        return
    capture_busy.set()
    try:
        _run_capture_body()
    finally:
        capture_busy.clear()


def _run_capture_body():
    print("\n📸 스크린샷 캡처 시작...")

    # 1. 활성 AI 도구 감지
    tool, app_name = detect_ai_tool()
    print(f"   감지된 도구: {app_name} ({tool})")

    # 2. 스크린샷 캡처 (영역 선택)
    image_path = capture_screenshot(mode="region")

    if image_path is None:
        print("   ⚠️ 캡처 취소됨")
        return

    print(f"   ✅ 캡처 완료: {image_path}")

    # 3. 클립보드에 이미지 복사
    success = copy_image_to_clipboard(image_path)
    if not success:
        print("   ❌ 클립보드 복사 실패")
        show_notification("AI Screenshot", "❌ 클립보드 복사 실패")
        os.unlink(image_path)
        return

    print("   📋 클립보드 복사 완료")

    # 4. AI 도구에 붙여넣기
    time.sleep(0.15)

    target = tool
    if ALWAYS_PASTE_TO_CURSOR:
        target = "cursor"

    if target == "claude":
        paste_to_claude(app_name)
        show_notification(
            "AI Screenshot",
            "클립보드 복사 완료. Claude에 붙여넣기 시도함 — 안 보이면 ⌘V",
        )
        print("   🤖 Claude.ai 붙여넣기 시도 완료")
    elif target == "cursor":
        paste_to_cursor()
        show_notification(
            "AI Screenshot",
            "클립보드 복사 완료. Cursor에 붙여넣기 시도함 — 안 보이면 채팅창 클릭 후 ⌘V",
        )
        print("   🤖 Cursor 붙여넣기 시도 완료 (채팅 입력창에 커서가 있어야 함)")
    else:
        show_notification(
            "AI Screenshot",
            "클립보드에 복사됨. Cursor/Claude에서 ⌘V로 붙여넣으세요.",
        )
        print(f"   ℹ️ AI 도구 미감지 ({app_name}) → 클립보드에 복사만 완료")

    # 5. 임시 파일 정리
    try:
        os.unlink(image_path)
    except:
        pass


# ── 단축키 리스너 ─────────────────────────────────────────────
def _is_s_key(key):
    """Shift+S 는 char 'S' 로 올라오는 경우가 많음"""
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


listener_stop = threading.Event()
capture_busy = threading.Event()


def check_accessibility():
    script = '''
    tell application "System Events"
        return UI elements enabled
    end tell
    '''
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    return result.stdout.strip().lower() == "true"


class HotkeyListener:
    def __init__(self):
        self.current_keys = set()
        self.triggered = False

    def on_press(self, key):
        self.current_keys.add(key)

        if _cmd_shift_s_active(self.current_keys):
            if not self.triggered:
                self.triggered = True
                threading.Thread(target=run_capture, daemon=True).start()

    def on_release(self, key):
        self.current_keys.discard(key)
        self.triggered = False
        if _cmd_shift_q_active(self.current_keys):
            print("\n👋 종료합니다. (⌘+Shift+Q)")
            listener_stop.set()
            return False


# ── 엔트리포인트 ──────────────────────────────────────────────
def main():
    listener_stop.clear()
    print("=" * 50)
    print("  🤖 AI Screenshot Tool (v1)")
    print("=" * 50)
    print("  단축키 : ⌘ + Shift + S")
    print("  지원   : Claude.ai, Cursor (기본 Cursor 붙여넣기)")
    print("  종료   : ⌘ + Shift + Q  (ESC는 캡처 취소만)")
    print("=" * 50)
    print("\n✅ 대기 중... 단축키를 눌러보세요!\n")

    if not check_accessibility():
        print("⚠️  [손쉬운 사용] 권한이 꺼져 있습니다.")
        print("   시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용")
        print("   → 터미널(또는 Python)을 켜고 스크립트를 다시 실행하세요.\n")
        show_notification(
            "AI Screenshot",
            "손쉬운 사용 권한이 필요합니다 (터미널/Python)",
        )
    else:
        print("✅ 손쉬운 사용 권한 확인됨\n")

    # 접근성 권한 안내
    print("💡 [시스템 설정 → 개인정보 보호 → 손쉬운 사용]에서")
    print("   이 스크립트를 실행한 터미널(Python) 권한을 허용해야 붙여넣기가 됩니다.")
    print("💡 캡처 전 Cursor 채팅 입력창을 한 번 클릭해 두면 성공률이 높아집니다.\n")

    while not listener_stop.is_set():
        listener = HotkeyListener()
        try:
            with keyboard.Listener(
                on_press=listener.on_press,
                on_release=listener.on_release,
            ) as l:
                l.join()
        except Exception as e:
            print(f"⚠️ 리스너 오류: {e}")
        if not listener_stop.is_set():
            print("↻ 리스너 재시작…")
            time.sleep(1)


if __name__ == "__main__":
    main()
