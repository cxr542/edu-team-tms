import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Presentation, RefreshCcw, Upload } from 'lucide-react';
import {
  fetchAcademizerHealth,
  postAcademize,
  postWizardPreview,
} from '../utils/academizerApi.js';
import './AcademizerPage.css';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'academy-deck.pptx';
  a.click();
  URL.revokeObjectURL(url);
}

export default function AcademizerPage() {
  const [healthLoading, setHealthLoading] = useState(true);
  const [unavailableMessage, setUnavailableMessage] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [limits, setLimits] = useState({ maxUploadMb: 50, standardMaxSlides: 40, version: '' });

  const [file, setFile] = useState(/** @type {File|null} */ (null));
  const [step, setStep] = useState(/** @type {1|2} */ (1));
  const [wizardData, setWizardData] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedQuality, setSelectedQuality] = useState('standard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [warnings, setWarnings] = useState(/** @type {object[]} */ ([]));

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setUnavailableMessage('');
    try {
      const data = await fetchAcademizerHealth();
      setApiBase(data.apiBase || '');
      const h = data.health || {};
      setLimits({
        maxUploadMb: h.max_upload_mb ?? 50,
        standardMaxSlides: h.standard_max_slides ?? 40,
        version: h.service_version ? String(h.service_version) : '',
      });
      if (!data.available) {
        setUnavailableMessage(
          data.message || '변환 API를 사용할 수 없습니다. PPT_ACADEMIZER_API_URL과 템플릿을 확인하세요.'
        );
      }
    } catch (e) {
      setApiBase('');
      setUnavailableMessage(e?.message || String(e));
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const selectedCard = useMemo(() => {
    if (!wizardData || !selectedProfile) return null;
    return (wizardData.cards || []).find((c) => c.id === selectedProfile) || null;
  }, [wizardData, selectedProfile]);

  const qualityModes = wizardData?.slide_limits?.quality_modes || [];

  const onPickFile = (next) => {
    setError('');
    setWarnings([]);
    setWizardData(null);
    setStep(1);
    setSelectedProfile('');
    setSelectedQuality('standard');
    setStatus('');
    if (!next) {
      setFile(null);
      return;
    }
    if (!/\.pptx$/i.test(next.name)) {
      setError('PowerPoint(.pptx) 파일만 업로드할 수 있습니다.');
      setFile(null);
      return;
    }
    const maxBytes = (limits.maxUploadMb || 50) * 1024 * 1024;
    if (next.size > maxBytes) {
      setError(`파일이 너무 큽니다. 최대 ${limits.maxUploadMb}MB까지 가능합니다.`);
      setFile(null);
      return;
    }
    setFile(next);
  };

  const runPreview = async () => {
    if (!file || !apiBase) return;
    setBusy(true);
    setError('');
    setStatus('덱 분석 중…');
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('deck_subtitle', 'PPT 아카데미화');
      const data = await postWizardPreview(apiBase, fd);
      setWizardData(data);
      const recommended = data.recommended_profile || data.cards?.[0]?.id || 'auto';
      setSelectedProfile(recommended);
      setSelectedQuality(data.slide_limits?.default_quality_mode || 'standard');
      setStatus(
        `자동 감지: ${data.detected_profile || '—'} → 추천 ${recommended}` +
          (data.slide_limits?.source_slide_count != null
            ? ` · 원본 ${data.slide_limits.source_slide_count}장`
            : '')
      );
    } catch (e) {
      setWizardData(null);
      setError(e?.message || String(e));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const runAcademize = async () => {
    if (!file || !apiBase || !selectedProfile) return;
    setBusy(true);
    setError('');
    setWarnings([]);
    setStatus('아카데미화 실행 중…');
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('profile', selectedProfile);
      fd.append('quality_mode', selectedQuality);
      fd.append('deck_subtitle', 'PPT 아카데미화');
      const est = selectedCard?.preview?.output_slide_count;
      if (est != null) fd.append('estimated_output_slides', String(est));
      const result = await postAcademize(apiBase, fd);
      if (Array.isArray(result.meta?.warnings)) setWarnings(result.meta.warnings);
      downloadBlob(result.blob, result.filename);
      setStatus(
        `완료${result.slideCount ? ` · 출력 ${result.slideCount}장` : ''} · ${result.filename}`
      );
    } catch (e) {
      setError(e?.message || String(e));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="academizer-page">
      <header className="academizer-header">
        <div className="academizer-header__brand">
          <span className="academizer-header__icon" aria-hidden>
            <Presentation size={22} />
          </span>
          <div>
            <h1>PPT 아카데미화</h1>
            <p className="academizer-header__tagline">
              일반·AI .pptx를 OKESTRO 아카데미 강의안 형식으로 변환합니다
            </p>
          </div>
        </div>
        <div className="academizer-header__actions">
          <button
            type="button"
            className="academizer-refresh"
            onClick={() => loadHealth()}
            disabled={healthLoading || busy}
          >
            <RefreshCcw size={16} aria-hidden />
            상태 확인
          </button>
        </div>
      </header>

      <p className="academizer-meta">
        업로드 최대 {limits.maxUploadMb}MB · 표준 모드 권장 {limits.standardMaxSlides}장 이하
        {limits.version ? ` · API v${limits.version}` : ''}
        {apiBase ? ` · ${apiBase}` : ''}
      </p>

      {unavailableMessage ? (
        <div className="academizer-banner academizer-banner--warn" role="status">
          <p>{unavailableMessage}</p>
          <p className="academizer-banner__hint">
            Vercel/로컬에 <code>PPT_ACADEMIZER_API_URL</code>을 설정하고, API에 아카데미 템플릿(
            <code>TEMPLATE_PPTX</code>)을 연결하세요. 배포 안내:{' '}
            <code>ppt-academizer/docs/DEPLOY-TMS-RENDER.md</code>
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="academizer-banner academizer-banner--error" role="alert">
          {error}
        </div>
      ) : null}

      {healthLoading ? <div className="academizer-empty">상태 확인 중…</div> : null}

      {!healthLoading && !unavailableMessage ? (
        <>
          <div className="academizer-steps" aria-label="단계">
            <span className={step === 1 ? 'is-active' : ''}>1. 업로드·분석</span>
            <span className={step === 2 ? 'is-active' : ''}>2. 실행·다운로드</span>
          </div>

          {step === 1 ? (
            <section className="academizer-panel">
              <label className="academizer-drop">
                <input
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  disabled={busy}
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
                <Upload size={20} aria-hidden />
                <span>{file ? file.name : '클릭하거나 파일을 선택하세요 (.pptx)'}</span>
              </label>

              <p className="academizer-caveat">
                텍스트·구조를 아카데미 형식으로 맞춥니다. 사진·차트는 가능한 범위에서 원본을 옮기며
                새로 그리지 않습니다.
              </p>

              <div className="academizer-actions">
                <button
                  type="button"
                  className="academizer-primary"
                  disabled={!file || busy || !apiBase}
                  onClick={runPreview}
                >
                  분석·미리보기
                </button>
              </div>

              {wizardData ? (
                <div className="academizer-wizard">
                  {status ? <p className="academizer-status">{status}</p> : null}
                  <h2>덱 구조</h2>
                  <ul className="academizer-bullets">
                    {(wizardData.structure_bullets || []).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <h2>변환 방식</h2>
                  <div className="academizer-cards">
                    {(wizardData.cards || []).map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className={`academizer-card${selectedProfile === card.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedProfile(card.id)}
                      >
                        <strong>{card.title}</strong>
                        <span className="academizer-card__sub">{card.subtitle}</span>
                        <span className="academizer-card__desc">{card.description}</span>
                        {card.recommended ? <span className="academizer-badge">추천</span> : null}
                      </button>
                    ))}
                  </div>
                  {selectedCard?.preview ? (
                    <div className="academizer-preview">
                      <h3>{selectedCard.title} — 예상 결과</h3>
                      <ul className="academizer-bullets">
                        {(selectedCard.preview.summary || []).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <div className="academizer-preview-slides">
                        {(selectedCard.preview.slides || []).slice(0, 12).map((s, i) => (
                          <div key={`${s.out_slide || s.src_slide || i}-${i}`} className="academizer-slide-row">
                            {s.out_slide != null
                              ? `출력 ${s.out_slide}장 · ${s.layout || ''}`
                              : s.src_slide != null
                                ? `원본 ${s.src_slide}장 → ${s.layout_hint || s.plan_kind || ''}`
                                : ''}
                            {(s.lines || []).length ? (
                              <div className="academizer-slide-lines">{(s.lines || []).join(' · ')}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="academizer-actions">
                    <button
                      type="button"
                      className="academizer-primary"
                      disabled={!selectedProfile || busy}
                      onClick={() => setStep(2)}
                    >
                      다음
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="academizer-panel">
              <p className="academizer-status">
                선택: <strong>{selectedCard?.title || selectedProfile}</strong>
                {file ? ` · ${file.name}` : ''}
              </p>
              {qualityModes.length > 0 ? (
                <>
                  <h2>품질 모드</h2>
                  <div className="academizer-cards">
                    {qualityModes.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        disabled={!mode.available}
                        className={`academizer-card${selectedQuality === mode.id ? ' is-selected' : ''}${
                          !mode.available ? ' is-disabled' : ''
                        }`}
                        onClick={() => mode.available && setSelectedQuality(mode.id)}
                      >
                        <strong>{mode.title}</strong>
                        <span className="academizer-card__sub">{mode.id}</span>
                        <span className="academizer-card__desc">{mode.description}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <div className="academizer-actions">
                <button type="button" className="academizer-secondary" disabled={busy} onClick={() => setStep(1)}>
                  이전
                </button>
                <button
                  type="button"
                  className="academizer-primary"
                  disabled={busy || !apiBase}
                  onClick={runAcademize}
                >
                  아카데미화 실행
                </button>
              </div>
              {status ? <p className="academizer-status">{status}</p> : null}
              {warnings.length > 0 ? (
                <div className="academizer-warnings">
                  <strong>참고</strong>
                  <ul>
                    {warnings.map((w, i) => (
                      <li key={`${w.slide || ''}-${i}`}>
                        {w.slide ? `원본 ${w.slide}장 — ` : ''}
                        {w.message || ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}
