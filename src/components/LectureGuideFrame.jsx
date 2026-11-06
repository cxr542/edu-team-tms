import React, { useCallback, useEffect, useRef, useState } from 'react';

/** 가이드 HTML 안쪽에 주입: 자체 목차를 숨기고 한 단으로 펼친다(목차는 부모의 오른쪽 레일이 대신함). */
const INJECTED_CSS = `
  html, body { overflow-y: hidden !important; }
  nav#TOC, nav.toc, nav[role="doc-toc"] { display: none !important; }
  .layout { display: block !important; max-width: none !important; padding: 24px 28px 48px !important; }
  h2, h3 { scroll-margin-top: 16px; }
`;

const ACTIVE_OFFSET = 120;

/**
 * 같은 출처 iframe 으로 가이드 HTML 을 보여주고, 안쪽 h2/h3 를 읽어 부모의 목차에 전달한다.
 * iframe 은 내용 높이만큼 늘려서 바깥 문서 영역 하나만 스크롤되게 한다.
 *
 * @param {{
 *   src?: string,
 *   srcDoc?: string,
 *   title: string,
 *   scrollEl: HTMLElement | null,
 *   onHeadings: (list: { id: string, text: string, level: number }[]) => void,
 *   onActiveChange: (id: string) => void,
 *   jumpRef: { current: ((id: string) => void) | null },
 * }} props
 */
export default function LectureGuideFrame({ src, srcDoc, title, scrollEl, onHeadings, onActiveChange, jumpRef }) {
  const frameRef = useRef(null);
  const cleanupRef = useRef(null);
  const [height, setHeight] = useState(640);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (jumpRef) jumpRef.current = null;
    },
    [src, srcDoc, jumpRef]
  );

  const handleLoad = useCallback(() => {
    cleanupRef.current?.();
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc?.body) return;

    const style = doc.createElement('style');
    style.textContent = INJECTED_CSS;
    doc.head.appendChild(style);

    const els = [...doc.querySelectorAll('h2, h3')];
    const list = els.map((el, i) => {
      if (!el.id) el.id = `guide-heading-${i}`;
      return {
        id: el.id,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        level: el.tagName === 'H2' ? 2 : 3,
      };
    });
    onHeadings(list.filter((h) => h.text));

    const resize = () => setHeight(Math.ceil(doc.documentElement.scrollHeight));
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(doc.body);

    /**
     * 실제로 스크롤되는 쪽을 고른다: 문서 영역이 자체 스크롤을 가지면 그것, 아니면 페이지(window).
     * (앱 셸이 화면 높이로 고정되지 않은 배치에서는 window 가 스크롤된다.)
     */
    const useWindow = () =>
      !scrollEl ||
      scrollEl.clientHeight > window.innerHeight || // 화면보다 큰 요소는 뷰포트가 될 수 없다
      scrollEl.scrollHeight <= scrollEl.clientHeight + 2;
    const scrollTopNow = () => (useWindow() ? window.scrollY : scrollEl.scrollTop);

    /** iframe 안 요소의 위치를 스크롤 기준 좌표로 환산 */
    const absoluteTop = (el) => {
      const elTop = el.getBoundingClientRect().top + frame.getBoundingClientRect().top;
      if (useWindow()) return elTop + window.scrollY;
      return elTop - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    };

    if (jumpRef) {
      jumpRef.current = (id) => {
        const el = doc.getElementById(id);
        if (!el) return;
        (useWindow() ? window : scrollEl).scrollTo({ top: absoluteTop(el) - 16, behavior: 'smooth' });
        onActiveChange(id);
      };
    }

    let raf = 0;
    const updateActive = () => {
      raf = 0;
      let current = '';
      const now = scrollTopNow();
      for (const h of list) {
        const el = doc.getElementById(h.id);
        if (el && absoluteTop(el) <= now + ACTIVE_OFFSET) current = h.id;
      }
      onActiveChange(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(updateActive);
    };
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    updateActive();

    cleanupRef.current = () => {
      ro.disconnect();
      scrollEl?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollEl, onHeadings, onActiveChange, jumpRef]);

  return (
    <iframe
      ref={frameRef}
      key={srcDoc !== undefined ? `doc:${title}:${srcDoc.length}` : src}
      className="ref-docs-html-frame"
      {...(srcDoc !== undefined ? { srcDoc } : { src })}
      title={title}
      /* 업로드본(srcDoc)은 스크립트 실행을 막는다. 저장소 가이드는 기존대로 스크립트 허용. */
      sandbox={srcDoc !== undefined ? 'allow-same-origin allow-popups' : 'allow-scripts allow-same-origin allow-popups'}
      style={{ height }}
      onLoad={handleLoad}
    />
  );
}
