import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Presentation, RefreshCcw, Upload } from 'lucide-react';
import {
  fetchAcademizerHealth,
  postAcademize,
  postWizardPreview,
} from '../utils/academizerApi.js';
import {
  readSavedSaveMode,
  savePptxBlob,
  supportsSaveFilePicker,
  writeSavedSaveMode,
} from '../utils/academizerSave.js';
import './AcademizerPage.css';

const PREVIEW_PHASES = [
  { at: 0, label: '파일 업로드 중…' },
  { at: 3, label: '덱 구조 분석 중…' },
  { at: 8, label: '변환 방식 추천 준비 중…' },
];

const ACADEMIZE_PHASES = [
  { at: 0, label: '파일 업로드 중…' },
  { at: 4, label: '아카데미 템플릿에 맞추는 중…' },
  { at: 12, label: '슬라이드 배치·스타일 적용 중…' },
  { at: 22, label: '결과 파일 준비 중…' },
];

function phaseLabel(phases, elapsedSec) {
  let label = phases[0]?.label || '처리 중…';
  for (const phase of phases) {
    if (elapsedSec >= phase.at) label = phase.label;
  }
  return label;
}

function formatElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${String(s).padStart(2, '0')}초` : `${s}초`;
}

function BusyProgress({ kind, elapsedSec, saveMode }) {
  const phases = kind === 'preview' ? PREVIEW_PHASES : ACADEMIZE_PHASES;
  const label = phaseLabel(phases, elapsedSec);
  const title = kind === 'preview' ? '분석·미리보기 진행 중' : '아카데미화 실행 중';
  const doneHint =
    kind === 'academize' && saveMode === 'pick'
      ? '완료되면 저장할 폴더·파일명을 고르는 창이 뜹니다.'
      : '완료되면 파일이 다운로드됩니다.';
  const hint =
    elapsedSec >= 20
      ? 'API가 잠들어 있으면 첫 요청에 30~60초 걸릴 수 있습니다. 창을 닫지 마세요.'
      : doneHint;

  return (
    <div className="academizer-busy" role="status" aria-live="polite" aria-busy="true">
      <div className="academizer-busy__row">
        <Loader2 className="academizer-busy__spinner" size={20} aria-hidden />
        <div className="academizer-busy__copy">
          <strong>{title}</strong>
          <span>{label}</span>
        </div>
        <span className="academizer-busy__elapsed">{formatElapsed(elapsedSec)}</span>
      </div>
      <div className="academizer-busy__track" aria-hidden>
        <div className="academizer-busy__bar" />
      </div>
      <p className="academizer-busy__hint">{hint}</p>
    </div>
  );
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
  const [busyKind, setBusyKind] = useState(/** @type {''|'preview'|'academize'} */ (''));
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [warnings, setWarnings] = useState(/** @type {object[]} */ ([]));
  const [saveMode, setSaveMode] = useState(/** @type {'pick'|'download'} */ (() => readSavedSaveMode()));
  const [lastResult, setLastResult] = useState(
    /** @type {{ blob: Blob, filename: string, slideCount?: string }|null} */ (null)
  );
  const canPickPath = supportsSaveFilePicker();

  const onSaveModeChange = (mode) => {
    setSaveMode(mode);
    writeSavedSaveMode(mode);
  };

  const persistResult = async (blob, filename, slideCount) => {
    setLastResult({ blob, filename, slideCount });
    const saved = await savePptxBlob(blob, filename, { mode: saveMode });
    if (saved.method === 'cancelled') {
      setStatus(
        `변환 완료${slideCount ? ` · 출력 ${slideCount}장` : ''} · 저장이 취소되었습니다. 아래에서 다시 저장할 수 있습니다.`
      );
      return;
    }
    const where =
      saved.method === 'picker'
        ? `선택한 위치에 저장됨 (${saved.name || filename})`
        : `다운로드 시작 (${saved.name || filename})`;
    setStatus(`완료${slideCount ? ` · 출력 ${slideCount}장` : ''} · ${where}`);
  };

  useEffect(() => {
    if (!busy) {
      setElapsedSec(0);
      return undefined;
    }
    setElapsedSec(0);
    const id = window.setInterval(() => {
      setElapsedSec((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [busy]);

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
    setLastResult(null);
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
    setBusyKind('preview');
    setError('');
    setStatus('');
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
      setBusyKind('');
    }
  };

  const runAcademize = async () => {
    if (!file || !apiBase || !selectedProfile) return;
    setBusy(true);
    setBusyKind('academize');
    setError('');
    setWarnings([]);
    setStatus('');
    setLastResult(null);
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
      await persistResult(result.blob, result.filename, result.slideCount);
    } catch (e) {
      setError(e?.message || String(e));
      setStatus('');
    } finally {
      setBusy(false);
      setBusyKind('');
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
                  {busy && busyKind === 'preview' ? (
                    <>
                      <Loader2 className="academizer-busy__spinner" size={16} aria-hidden />
                      분석 중…
                    </>
                  ) : (
                    '분석·미리보기'
                  )}
                </button>
              </div>

              {busy && busyKind === 'preview' ? (
                <BusyProgress kind="preview" elapsedSec={elapsedSec} />
              ) : null}

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
                        disabled={!mode.available || busy}
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

              <h2>결과 저장</h2>
              <div className="academizer-save" role="radiogroup" aria-label="결과 저장 방식">
                <label className={`academizer-save__option${saveMode === 'pick' ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="academizer-save-mode"
                    value="pick"
                    checked={saveMode === 'pick'}
                    disabled={busy || !canPickPath}
                    onChange={() => onSaveModeChange('pick')}
                  />
                  <span>
                    <strong>저장 위치 선택</strong>
                    <span className="academizer-save__desc">
                      {canPickPath
                        ? '완료 후 폴더·파일명을 직접 지정합니다 (Chrome / Edge).'
                        : '이 브라우저에서는 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.'}
                    </span>
                  </span>
                </label>
                <label className={`academizer-save__option${saveMode === 'download' ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="academizer-save-mode"
                    value="download"
                    checked={saveMode === 'download'}
                    disabled={busy}
                    onChange={() => onSaveModeChange('download')}
                  />
                  <span>
                    <strong>브라우저 다운로드</strong>
                    <span className="academizer-save__desc">
                      기본 다운로드 폴더로 바로 받습니다.
                    </span>
                  </span>
                </label>
              </div>

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
                  {busy && busyKind === 'academize' ? (
                    <>
                      <Loader2 className="academizer-busy__spinner" size={16} aria-hidden />
                      실행 중…
                    </>
                  ) : (
                    '아카데미화 실행'
                  )}
                </button>
              </div>
              {busy && busyKind === 'academize' ? (
                <BusyProgress kind="academize" elapsedSec={elapsedSec} saveMode={saveMode} />
              ) : null}
              {!busy && status ? <p className="academizer-status">{status}</p> : null}
              {!busy && lastResult ? (
                <div className="academizer-actions academizer-actions--result">
                  {canPickPath ? (
                    <button
                      type="button"
                      className="academizer-secondary"
                      onClick={async () => {
                        const saved = await savePptxBlob(lastResult.blob, lastResult.filename, {
                          mode: 'pick',
                        });
                        if (saved.method === 'cancelled') return;
                        setStatus(
                          `다시 저장함 · ${saved.name || lastResult.filename}${
                            lastResult.slideCount ? ` · ${lastResult.slideCount}장` : ''
                          }`
                        );
                      }}
                    >
                      다른 위치에 저장
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="academizer-secondary"
                    onClick={async () => {
                      await savePptxBlob(lastResult.blob, lastResult.filename, { mode: 'download' });
                      setStatus(
                        `다운로드 시작 · ${lastResult.filename}${
                          lastResult.slideCount ? ` · ${lastResult.slideCount}장` : ''
                        }`
                      );
                    }}
                  >
                    다시 다운로드
                  </button>
                </div>
              ) : null}
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
