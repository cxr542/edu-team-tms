import React, { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  MAX_GUIDE_HTML_BYTES,
  guessGuideTitle,
  normalizeExtraDomains,
  processGuideHtml,
} from '../utils/lectureGuideSanitize.js';
import { uploadLectureGuide } from '../utils/referenceDocsHidden.js';

const formatKb = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`);

/**
 * 관리자 전용 가이드 HTML 업로드. 파일을 고르면 정화·마스킹 결과를 미리 보여 주고,
 * 확인 후 올리면 서버가 같은 규칙을 한 번 더 적용해 저장한다.
 *
 * @param {{ groups: string[], onUploaded: (id: string) => void }} props
 */
export default function LectureGuideUploadPanel({ groups, onUploaded }) {
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rawHtml, setRawHtml] = useState('');
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('');
  const [summary, setSummary] = useState('');
  const [extraDomains, setExtraDomains] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const processed = useMemo(
    () => (rawHtml ? processGuideHtml(rawHtml, { extraDomains: normalizeExtraDomains(extraDomains) }) : null),
    [rawHtml, extraDomains]
  );

  const reset = () => {
    setFileName('');
    setRawHtml('');
    setTitle('');
    setGroup('');
    setSummary('');
    setExtraDomains('');
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const onPickFile = async (event) => {
    const file = event.target.files?.[0];
    setError('');
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setError('.html 파일만 올릴 수 있습니다.');
      return;
    }
    if (file.size > MAX_GUIDE_HTML_BYTES * 1.25) {
      setError(`파일이 너무 큽니다. (${formatKb(file.size)})`);
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setRawHtml(text);
    setTitle((cur) => cur || guessGuideTitle(text) || file.name.replace(/\.html?$/i, ''));
  };

  const tooLarge = processed && processed.sizeBytes > MAX_GUIDE_HTML_BYTES;
  const canSubmit = Boolean(processed && !tooLarge && title.trim() && group.trim() && !busy);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    const res = await uploadLectureGuide({
      title: title.trim(),
      group: group.trim(),
      summary: summary.trim(),
      html: processed.html,
      extraDomains: normalizeExtraDomains(extraDomains),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    reset();
    setOpen(false);
    onUploaded(res.data.id);
  };

  const removedTotal = processed
    ? processed.sanitize.scripts + processed.sanitize.handlers + processed.sanitize.jsLinks + processed.sanitize.embeds
    : 0;

  return (
    <section className="ref-docs-upload" aria-label="가이드 업로드">
      <button
        type="button"
        className="btn btn-secondary ref-docs-upload__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Upload size={16} aria-hidden />
        가이드 업로드
      </button>

      {open && (
        <form className="ref-docs-upload__form" onSubmit={submit}>
          <p className="ref-docs-upload__hint">
            강사가 만든 HTML 파일을 올립니다. 올리면 스크립트가 제거되고 사설 IP·내부 도메인이 문서용 값으로 바뀝니다.
            이미지에 찍힌 IP·도메인은 자동으로 가릴 수 없으니 올리기 전에 확인해 주세요. (최대 {formatKb(MAX_GUIDE_HTML_BYTES)})
          </p>

          <div className="form-group">
            <label htmlFor="ref-upload-file">HTML 파일</label>
            <input id="ref-upload-file" ref={fileRef} type="file" accept=".html,.htm,text/html" onChange={onPickFile} />
          </div>

          {processed && (
            <>
              <div className="ref-docs-upload__row">
                <div className="form-group">
                  <label htmlFor="ref-upload-title">제목</label>
                  <input
                    id="ref-upload-title"
                    className="form-input"
                    value={title}
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="ref-upload-group">그룹 (제품·버전)</label>
                  <input
                    id="ref-upload-group"
                    className="form-input"
                    list="ref-upload-groups"
                    value={group}
                    maxLength={40}
                    placeholder="예: CONTRABASS"
                    onChange={(e) => setGroup(e.target.value)}
                  />
                  <datalist id="ref-upload-groups">
                    {groups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="ref-upload-summary">한 줄 요약 (선택)</label>
                <input
                  id="ref-upload-summary"
                  className="form-input"
                  value={summary}
                  maxLength={200}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ref-upload-domains">추가로 가릴 도메인 (선택, 쉼표로 구분)</label>
                <input
                  id="ref-upload-domains"
                  className="form-input"
                  value={extraDomains}
                  placeholder="예: corp.example.net, lab.example.org"
                  onChange={(e) => setExtraDomains(e.target.value)}
                />
              </div>

              <div className="ref-docs-upload__report" role="status">
                <p>
                  <strong>{fileName}</strong> · 저장 크기 {formatKb(processed.sizeBytes)}
                  {tooLarge && <span className="ref-docs-upload__bad"> · 크기 초과 (이미지를 줄여 주세요)</span>}
                </p>
                <p>
                  제거: 스크립트 {processed.sanitize.scripts} · 이벤트 속성 {processed.sanitize.handlers} · 위험 링크{' '}
                  {processed.sanitize.jsLinks} · 삽입 요소 {processed.sanitize.embeds}
                  {removedTotal === 0 && ' (없음)'}
                </p>
                {processed.changes.length === 0 ? (
                  <p>마스킹할 사설 IP·도메인을 찾지 못했습니다.</p>
                ) : (
                  <table className="ref-docs-upload__changes">
                    <thead>
                      <tr>
                        <th>종류</th>
                        <th>원본</th>
                        <th>변경</th>
                        <th>횟수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processed.changes.map((c) => (
                        <tr key={`${c.kind}-${c.from}`}>
                          <td>{c.kind === 'ip' ? 'IP' : '도메인'}</td>
                          <td>{c.from}</td>
                          <td>{c.to}</td>
                          <td>{c.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {error && <p className="ref-docs-admin-bar__error">{error}</p>}

          <div className="ref-docs-upload__actions">
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {busy ? '올리는 중…' : '업로드'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              취소
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
