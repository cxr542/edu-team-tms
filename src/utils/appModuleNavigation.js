/** Ctrl/⌘+클릭·가운데 클릭 등은 브라우저 기본(새 탭) 동작 유지 */
export function shouldAllowNativeModuleNavigation(event) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button === 1
  );
}

export function openAppModuleInNewTab(href) {
  if (!href || typeof window === 'undefined') return;
  window.open(href, '_blank', 'noopener,noreferrer');
}
