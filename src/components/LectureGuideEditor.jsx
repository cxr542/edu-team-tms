import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_TAGS, normalizeTags } from '../utils/referenceDocSearch.js';
import { MAX_GUIDE_HTML_BYTES, processGuideHtml } from '../utils/lectureGuideSanitize.js';

const formatKb = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`);

/** iframe 안 문서를 다시 HTML 문자열로 만든다. */
function serializeFrame(frame) {
  const doc = frame?.contentDocument;
  if (!doc?.documentElement) return null;
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

const TOOLS = [
  { label: '굵게', cmd: 'bold', text: 'B', style: { fontWeight: 800 } },
  { label: '기울임', cmd: 'italic', text: 'I', style: { fontStyle: 'italic' } },
  { label: '밑줄', cmd: 'underline', text: 'U', style: { textDecoration: 'underline' } },
  { label: '제목 2', cmd: 'formatBlock', arg: 'h2', text: 'H2' },
  { label: '제목 3', cmd: 'formatBlock', arg: 'h3', text: 'H3' },
  { label: '본문', cmd: 'formatBlock', arg: 'p', text: '본문' },
  { label: '글머리 목록', cmd: 'insertUnorderedList', text: '• 목록' },
  { label: '번호 목록', cmd: 'insertOrderedList', text: '1. 목록' },
  { label: '서식 지우기', cmd: 'removeFormat', text: '서식 지우기' },
  { label: '실행 취소', cmd: 'undo', text: '↶' },
  { label: '다시 실행', cmd: 'redo', text: '↷' },
];

/**
 * 관리자 전용 가이드 HTML 편집기. 업로드본만 편집한다.
 *  - 화면 편집: 본문 글자를 직접 고친다 (스크립트는 실행되지 않는 iframe)
 *  - 소스 편집: HTML 을 직접 고치고 오른쪽에서 바로 확인한다
 * 저장하면 서버가 정화·마스킹을 다시 적용하고 이전 본문 1개를 보관한다.
 *
 * @param {{
 *   doc: { id: string, title: string, group: string, summary?: string, category?: string, tags?: string[] },
 *   initialHtml: string,
 *   hasPrevious: boolean,
 *   groups: string[],
 *   onSave: (fields: object) => Promise<{ ok: boolean, message?: string }>,
 *   onRevert: () => Promise<{ ok: boolean, message?: string }>,
 *   onClose: () => void,
 * }} props
 */
export default function LectureGuideEditor({ doc, initialHtml, hasPrevious, groups, onSave, onRevert, onClose }) {
  const frameRef = useRef(null);
  const [mode, setMode] = useState('visual');
  const [html, setHtml] = useState(initialHtml);
  const [title, setTitle] = useState(doc.title);
  const [group, setGroup] = useState(doc.group);
  const [summary, setSummary] = useState(doc.summary || '');
  const [tags, setTags] = useState((doc.tags || []).join(', '));
  /** 리서치 자료는 제품 버전 그룹이 없다 (서버가 고정값을 쓴다). */
  const research = doc.category === 'research';
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const markDirty = useCallback(() => setDirty(true), []);

  // 화면 편집 iframe 이 열리면 편집 모드를 켠다.
  const onFrameLoad = useCallback(() => {
    const d = frameRef.current?.contentDocument;
    if (!d) return;
    d.designMode = 'on';
    d.addEventListener('input', markDirty);
  }, [markDirty]);

  /** 지금 화면 편집 중이면 iframe 내용을 html 상태로 가져온다. */
  const captureVisual = useCallback(() => {
    if (mode !== 'visual') return html;
    const out = serializeFrame(frameRef.current);
    if (out != null) setHtml(out);
    return out ?? html;
  }, [mode, html]);

  const switchMode = (next) => {
    if (next === mode) return;
    captureVisual();
    setMode(next);
  };

  const runTool = (tool) => {
    const d = frameRef.current?.contentDocument;
    if (!d) return;
    frameRef.current.contentWindow?.focus();
    d.execCommand(tool.cmd, false, tool.arg ?? null);
    markDirty();
  };

  const preview = useMemo(
    () => (mode === 'source' ? processGuideHtml(html) : null),
    [mode, html]
  );

  const save = async () => {
    const current = captureVisual();
    const processed = processGuideHtml(current);
    if (processed.sizeBytes > MAX_GUIDE_HTML_BYTES) {
      setError(`크기가 너무 큽니다. (${formatKb(processed.sizeBytes)} / 최대 ${formatKb(MAX_GUIDE_HTML_BYTES)})`);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const res = await onSave({
      title: title.trim(),
      ...(research ? {} : { group: group.trim() }),
      summary: summary.trim(),
      tags: normalizeTags(tags),
      html: current,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message || '저장하지 못했습니다.');
      return;
    }
    setDirty(false);
  };

  const revert = async () => {
    if (!window.confirm('이전 버전과 현재 버전을 맞바꿉니다. 지금 편집 중인 변경은 버려집니다. 계속할까요?')) return;
    setBusy(true);
    setError('');
    const res = await onRevert();
    setBusy(false);
    if (!res.ok) setError(res.message || '되돌리지 못했습니다.');
  };

  const close = () => {
    if (dirty && !window.confirm('저장하지 않은 변경이 있습니다. 닫을까요?')) return;
    onClose();
  };

  // 저장하지 않고 창을 닫으려 할 때 경고
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // 소스 편집에서 글자를 고치면 dirty
  const onSourceChange = (e) => {
    setHtml(e.target.value);
    markDirty();
  };

  return (
    <section className="ref-docs-editor" aria-label="가이드 편집기">
      <div className="ref-docs-editor__meta">
        <div className="form-group">
          <label htmlFor="ref-edit-title">제목</label>
          <input
            id="ref-edit-title"
            className="form-input"
            value={title}
            maxLength={120}
            onChange={(e) => (setTitle(e.target.value), markDirty())}
          />
        </div>
        {!research && (
          <div className="form-group">
            <label htmlFor="ref-edit-group">그룹 (제품 버전)</label>
            <input
              id="ref-edit-group"
              className="form-input"
              list="ref-edit-groups"
              value={group}
              maxLength={40}
              onChange={(e) => (setGroup(e.target.value), markDirty())}
            />
            <datalist id="ref-edit-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
        )}
        <div className="form-group">
          <label htmlFor="ref-edit-tags">태그 (쉼표로 구분, 최대 {MAX_TAGS}개)</label>
          <input
            id="ref-edit-tags"
            className="form-input"
            value={tags}
            placeholder="예: 기술 조사, 경쟁사 비교"
            onChange={(e) => (setTags(e.target.value), markDirty())}
          />
        </div>
        <div className="form-group ref-docs-editor__summary">
          <label htmlFor="ref-edit-summary">한 줄 요약</label>
          <input
            id="ref-edit-summary"
            className="form-input"
            value={summary}
            maxLength={200}
            onChange={(e) => (setSummary(e.target.value), markDirty())}
          />
        </div>
      </div>

      <div className="ref-docs-editor__bar" role="toolbar" aria-label="편집 도구">
        <div className="ref-docs-editor__modes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'visual'}
            className={`ref-docs-editor__mode${mode === 'visual' ? ' is-active' : ''}`}
            onClick={() => switchMode('visual')}
          >
            화면 편집
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'source'}
            className={`ref-docs-editor__mode${mode === 'source' ? ' is-active' : ''}`}
            onClick={() => switchMode('source')}
          >
            소스 편집
          </button>
        </div>
        {mode === 'visual' && (
          <div className="ref-docs-editor__tools">
            {TOOLS.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.label}
                aria-label={t.label}
                className="ref-docs-editor__tool"
                style={t.style}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runTool(t)}
              >
                {t.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'visual' ? (
        <iframe
          key="visual"
          ref={frameRef}
          title="가이드 화면 편집"
          className="ref-docs-editor__frame"
          sandbox="allow-same-origin"
          srcDoc={html}
          onLoad={onFrameLoad}
        />
      ) : (
        <div className="ref-docs-editor__split">
          <textarea
            className="ref-docs-editor__source"
            aria-label="HTML 소스"
            spellCheck={false}
            value={html}
            onChange={onSourceChange}
          />
          <iframe
            key="preview"
            title="가이드 미리보기"
            className="ref-docs-editor__frame ref-docs-editor__frame--preview"
            sandbox=""
            srcDoc={preview.html}
          />
        </div>
      )}

      <p className="ref-docs-editor__hint">
        저장하면 스크립트가 제거되고 사설 IP·내부 도메인이 문서용 값으로 바뀝니다. 이전 버전은 1개까지 보관됩니다.
        {mode === 'source' && preview && ` · 현재 크기 ${formatKb(preview.sizeBytes)} / 최대 ${formatKb(MAX_GUIDE_HTML_BYTES)}`}
      </p>
      {error && <p className="ref-docs-admin-bar__error">{error}</p>}
      {notice && <p className="ref-docs-editor__notice">{notice}</p>}

      <div className="ref-docs-editor__actions">
        <button type="button" className="btn btn-primary" disabled={busy || !title.trim() || (!research && !group.trim())} onClick={save}>
          {busy ? '저장 중…' : '저장'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={close}>
          닫기
        </button>
        {hasPrevious && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={revert}>
            이전 버전으로 되돌리기
          </button>
        )}
      </div>
    </section>
  );
}
