import React, { useEffect, useState } from 'react';
import { scrollToDocHeading } from '../utils/markdownDoc';

/**
 * @param {{ headings: import('../utils/markdownDoc').DocHeading[], scrollRoot?: HTMLElement | null }} props
 */
export default function DocTableOfContents({ headings, scrollRoot }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!headings.length) {
      setActiveId('');
      return undefined;
    }
    const root = scrollRoot || null;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      {
        root,
        rootMargin: '-80px 0px -70% 0px',
        threshold: [0, 0.25, 0.5, 1],
      }
    );
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [headings, scrollRoot]);

  if (!headings.length) {
    return <p className="doc-toc__empty">이 문서에는 목차가 없습니다.</p>;
  }

  return (
    <nav className="doc-toc" aria-label="목차">
      <ul className="doc-toc__list">
        {headings.map((h) => (
          <li key={h.id} className={`doc-toc__item doc-toc__item--h${h.level}${activeId === h.id ? ' is-active' : ''}`}>
            <a
              href={`#${h.id}`}
              className="doc-toc__link"
              onClick={(e) => {
                e.preventDefault();
                scrollToDocHeading(h.id);
                setActiveId(h.id);
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
