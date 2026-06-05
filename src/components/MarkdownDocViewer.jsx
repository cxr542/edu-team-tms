import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { resolveReferenceDocIdFromHref } from '../constants/referenceDocs';
import { enrichArticleHeadings } from '../utils/markdownDoc';

marked.setOptions({ gfm: true, breaks: false });

function rewriteInternalDocLinks(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('a[href]').forEach((anchor) => {
    const docId = resolveReferenceDocIdFromHref(anchor.getAttribute('href'));
    if (!docId) return;
    anchor.setAttribute('href', '#');
    anchor.dataset.refDocId = docId;
    anchor.classList.add('ref-doc-internal-link');
  });
  return template.innerHTML;
}

/**
 * @param {{
 *   src: string,
 *   className?: string,
 *   onHeadingsChange?: (headings: import('../utils/markdownDoc').DocHeading[]) => void,
 *   onDocSelect?: (docId: string) => void,
 * }} props
 */
export default function MarkdownDocViewer({ src, className = '', onHeadingsChange, onDocSelect }) {
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
        setHtml(rewriteInternalDocLinks(marked.parse(md)));
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

  useEffect(() => {
    const root = articleRef.current;
    if (!root || !onDocSelect) return undefined;
    const onClick = (e) => {
      const anchor = e.target.closest('a[data-ref-doc-id]');
      if (!anchor) return;
      e.preventDefault();
      onDocSelect(anchor.dataset.refDocId);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [html, onDocSelect]);

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
