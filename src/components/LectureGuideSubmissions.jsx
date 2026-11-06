import React, { useCallback, useEffect, useState } from 'react';
import {
  approveGuideSubmission,
  fetchGuideSubmissionHtml,
  listGuideSubmissions,
  rejectGuideSubmission,
} from '../utils/referenceDocsHidden.js';

const formatKb = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`);
const formatDate = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '');

/**
 * 관리자 전용: 구성원이 제출한 가이드(승인 대기) 목록.
 * 미리보기로 내용을 확인한 뒤 승인하면 목록에 공개되고, 거절하면 삭제된다.
 *
 * @param {{ onApproved: (id: string) => void }} props
 */
export default function LectureGuideSubmissions({ onApproved }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [preview, setPreview] = useState({ id: '', html: '' });

  const load = useCallback(async () => {
    const res = await listGuideSubmissions();
    if (res.ok) {
      setItems(res.items);
      setError('');
    } else {
      setItems([]);
      setError(res.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePreview = async (item) => {
    if (preview.id === item.id) {
      setPreview({ id: '', html: '' });
      return;
    }
    setBusyId(item.id);
    const res = await fetchGuideSubmissionHtml(item.id);
    setBusyId('');
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setPreview({ id: item.id, html: res.html });
  };

  const approve = async (item) => {
    if (!window.confirm(`'${item.title}' 가이드를 승인해 구성원에게 공개할까요?`)) return;
    setBusyId(item.id);
    const res = await approveGuideSubmission(item.id);
    setBusyId('');
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setPreview({ id: '', html: '' });
    await load();
    window.dispatchEvent(new Event('guide-submissions-changed'));
    onApproved(res.data.id);
  };

  const reject = async (item) => {
    if (!window.confirm(`'${item.title}' 제출을 거절하고 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusyId(item.id);
    const res = await rejectGuideSubmission(item.id);
    setBusyId('');
    if (!res.ok) {
      setError(res.message);
      return;
    }
    if (preview.id === item.id) setPreview({ id: '', html: '' });
    await load();
    window.dispatchEvent(new Event('guide-submissions-changed'));
  };

  // 목록을 아직 못 받았거나 승인 대기가 없으면 아무것도 그리지 않는다 (오류는 보여 준다).
  if (items === null) return null;
  if (items.length === 0 && !error) {
    return (
      <section className="ref-docs-submissions" aria-label="승인 대기 가이드">
        <h2 className="ref-docs-submissions__title">
          승인 대기 <span className="ref-docs-submissions__count">0</span>
        </h2>
        <p className="ref-docs-submissions__meta">구성원이 제출한 가이드가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="ref-docs-submissions" aria-label="승인 대기 가이드">
      <h2 className="ref-docs-submissions__title">
        승인 대기 <span className="ref-docs-submissions__count">{items.length}</span>
      </h2>
      {error && <p className="ref-docs-admin-bar__error">{error}</p>}
      <ul className="ref-docs-submissions__list">
        {items.map((it) => (
          <li key={it.id} className="ref-docs-submissions__item">
            <div className="ref-docs-submissions__row">
              <div className="ref-docs-submissions__info">
                <strong>{it.title}</strong>
                <span className="ref-docs-submissions__meta">
                  {it.group} · {it.submitter || '제출자 미기재'} · {formatKb(it.sizeBytes)} · {formatDate(it.createdAt)}
                </span>
                {it.summary && <span className="ref-docs-submissions__meta">{it.summary}</span>}
              </div>
              <div className="ref-docs-submissions__actions">
                <button type="button" className="btn btn-secondary" disabled={busyId === it.id} onClick={() => togglePreview(it)}>
                  {preview.id === it.id ? '미리보기 닫기' : '미리보기'}
                </button>
                <button type="button" className="btn btn-primary" disabled={busyId === it.id} onClick={() => approve(it)}>
                  승인
                </button>
                <button type="button" className="btn btn-secondary" disabled={busyId === it.id} onClick={() => reject(it)}>
                  거절
                </button>
              </div>
            </div>
            {preview.id === it.id && (
              <iframe title={`${it.title} 미리보기`} className="ref-docs-editor__frame" sandbox="" srcDoc={preview.html} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
