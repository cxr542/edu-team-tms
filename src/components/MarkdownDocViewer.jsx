import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { enrichArticleHeadings } from '../utils/markdownDoc';

marked.setOptions({ gfm: true, breaks: false });

/**
 * @param {{
 *   src: string,
 *   className?: string,
 *   onHeadingsChange?: (headings: import('../utils/markdownDoc').DocHeading[]) => void,
 * }} props
 */
export default function MarkdownDocViewer({ src, className = '', onHeadingsChange }) {
  const articleRef = useRef(null);
  const [html, setHtml] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(src));

  useEffect(() => {
    if (!src) {
      setHtml('');
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      })
      .then((md) => {
        if (cancelled) return;
        setHtml(marked.parse(md));
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || '문서를 불러오지 못했습니다.');
        setHtml('');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!html || !articleRef.current) {
      onHeadingsChange?.([]);
      return;
    }
    articleRef.current.querySelectorAll('table').forEach((table) => {
      if (table.parentElement?.classList.contains('table-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode?.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
    const headings = enrichArticleHeadings(articleRef.current);
    onHeadingsChange?.(headings);
  }, [html, onHeadingsChange]);

  if (loading) {
    return <p className="tech-doc-status">문서를 불러오는 중…</p>;
  }
  if (error) {
    return (
      <p className="tech-doc-status tech-doc-status--error" role="alert">
        {error}
        <br />
        <code>{src}</code>
      </p>
    );
  }

  return (
    <article
      ref={articleRef}
      className={`tech-doc-content${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
