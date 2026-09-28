import React, { useState } from 'react';
import { CheckCircle2, ChevronLeft, HelpCircle, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import AppModuleLink from '../components/AppModuleLink.jsx';
import { useGlossaryQuiz, QUIZ_DEFAULT_COUNT, QUIZ_MIN_COUNT } from '../hooks/useGlossaryQuiz.js';
import { isOxQuestion, QUIZ_SUBJECT_OPTIONS } from '../utils/glossaryQuiz.js';
import './GlossaryQuizPage.css';

const QUIZ_TYPE_TABS = [
  { value: 'mixed', label: '전체', emoji: '🔀' },
  { value: 'ox', label: 'OX만', emoji: '⭕' },
  { value: 'short-answer', label: '주관식만', emoji: '✏️' },
];

const SUBJECT_EMOJI = { all: '🎲', cloud: '☁️', ai: '🤖' };

const WIZARD_MASCOT_TEXT = {
  0: '오늘은 어떤 과목으로 놀아볼까요?',
  1: '문제 스타일도 골라주세요!',
  2: '몇 문제 풀어볼지 정하고 시작해요~',
};

function formatYourAnswer(question, value) {
  if (isOxQuestion(question)) return value === 'O' ? '참 (O)' : '거짓 (X)';
  return value && value.trim() ? value : '(응답 없음)';
}

export default function GlossaryQuizPage() {
  const {
    loading,
    sourceStatus,
    eligibleCountsBySubject,
    phase,
    currentIndex,
    questions,
    currentQuestion,
    lastResult,
    resultSummary,
    startQuiz,
    submitAnswer,
    nextQuestion,
    restart,
  } = useGlossaryQuiz();

  const [setupStep, setSetupStep] = useState(0); // 0: subject, 1: type, 2: count + start
  const [subject, setSubject] = useState('all');
  const eligibleCount = eligibleCountsBySubject[subject] ?? 0;
  const minCount = Math.min(QUIZ_MIN_COUNT, eligibleCount || 1);
  const defaultCount = Math.max(minCount, Math.min(QUIZ_DEFAULT_COUNT, eligibleCount));
  const [countInput, setCountInput] = useState(String(defaultCount));
  const [quizType, setQuizType] = useState('mixed');
  const [shortAnswerInput, setShortAnswerInput] = useState('');

  const clampCount = (raw, forCount = eligibleCount) => {
    const forMin = Math.min(QUIZ_MIN_COUNT, forCount || 1);
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return Math.max(forMin, Math.min(QUIZ_DEFAULT_COUNT, forCount || forMin));
    return Math.max(forMin, Math.min(parsed, forCount || forMin));
  };

  const handleCountBlur = () => {
    setCountInput(String(clampCount(countInput)));
  };

  const handleSubjectChange = (value) => {
    setSubject(value);
    const newEligible = eligibleCountsBySubject[value] ?? 0;
    setCountInput(String(clampCount(countInput, newEligible)));
  };

  const handleSubjectSelect = (value) => {
    handleSubjectChange(value);
    setSetupStep(1);
  };

  const handleTypeSelect = (value) => {
    setQuizType(value);
    setSetupStep(2);
  };

  const handleStart = () => {
    const count = clampCount(countInput);
    setCountInput(String(count));
    startQuiz(count, quizType, subject);
  };

  const handleSubmitShortAnswer = (event) => {
    event.preventDefault();
    if (!shortAnswerInput.trim()) return;
    submitAnswer(shortAnswerInput.trim());
  };

  const handleNext = () => {
    setShortAnswerInput('');
    nextQuestion();
  };

  const handleRestart = () => {
    setShortAnswerInput('');
    setSetupStep(0);
    restart();
  };

  const handleExitToSetup = () => {
    if (!window.confirm('처음 화면으로 돌아가면 지금까지 푼 퀴즈 결과가 반영되지 않습니다. 계속할까요?')) {
      return;
    }
    setShortAnswerInput('');
    setSetupStep(0);
    restart();
  };

  return (
    <main className="glossary-quiz-page">
      <header className="glossary-quiz-header">
        <div className="glossary-quiz-header__title">
          <Sparkles size={18} aria-hidden />
          <div>
            <h2>용어사전 퀴즈</h2>
            <p>용어사전에 등록된 내용으로 만든 O/X · 단답형 퀴즈입니다.</p>
          </div>
        </div>
        <AppModuleLink module="glossary" className="btn btn-secondary">
          용어사전으로
        </AppModuleLink>
      </header>

      <section className="glossary-quiz-panel">
        {loading ? (
          <div className="glossary-quiz-loading">용어를 불러오는 중입니다.</div>
        ) : phase === 'setup' ? (
          <div className="glossary-quiz-wizard">
            <div className="glossary-quiz-wizard__mascot">
              <img src="/okestro-bear-mascot.png" alt="" className="glossary-quiz-wizard__mascot-img" />
              <div className="glossary-quiz-wizard__bubble">{WIZARD_MASCOT_TEXT[setupStep]}</div>
            </div>

            <div className="glossary-quiz-wizard__steps" aria-hidden>
              <span className={setupStep >= 0 ? 'is-active' : ''}>1</span>
              <span className={setupStep >= 1 ? 'is-active' : ''}>2</span>
              <span className={setupStep >= 2 ? 'is-active' : ''}>3</span>
            </div>

            {setupStep === 0 && (
              <>
                <h3 className="glossary-quiz-wizard__title">어떤 과목을 풀어볼까요?</h3>
                <div className="glossary-quiz-wizard__grid">
                  {QUIZ_SUBJECT_OPTIONS.map((opt) => {
                    const count = eligibleCountsBySubject[opt.value] ?? 0;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className="glossary-quiz-wizard__card"
                        disabled={count === 0}
                        onClick={() => handleSubjectSelect(opt.value)}
                      >
                        <span className="glossary-quiz-wizard__card-emoji">{SUBJECT_EMOJI[opt.value]}</span>
                        <span className="glossary-quiz-wizard__card-label">{opt.label}</span>
                        <small className="glossary-quiz-wizard__card-count">{count}개</small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {setupStep === 1 && (
              <>
                <button type="button" className="glossary-quiz-wizard__back" onClick={() => setSetupStep(0)}>
                  <ChevronLeft size={14} aria-hidden />
                  과목 다시 고르기
                </button>
                <h3 className="glossary-quiz-wizard__title">문제 스타일은요?</h3>
                <div className="glossary-quiz-wizard__grid">
                  {QUIZ_TYPE_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      className="glossary-quiz-wizard__card"
                      onClick={() => handleTypeSelect(tab.value)}
                    >
                      <span className="glossary-quiz-wizard__card-emoji">{tab.emoji}</span>
                      <span className="glossary-quiz-wizard__card-label">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {setupStep === 2 && (
              <>
                <button type="button" className="glossary-quiz-wizard__back" onClick={() => setSetupStep(1)}>
                  <ChevronLeft size={14} aria-hidden />
                  스타일 다시 고르기
                </button>
                {eligibleCount === 0 ? (
                  <p className="glossary-quiz-alert glossary-quiz-alert--warning">
                    <HelpCircle size={14} aria-hidden />
                    이 과목으로 퀴즈를 만들 수 있는 용어가 아직 없습니다. 다른 과목을 선택하거나 용어사전에 항목을 등록한 뒤 다시 시도해 주세요.
                  </p>
                ) : (
                  <>
                    <p className="glossary-quiz-setup__desc">
                      <strong>{QUIZ_SUBJECT_OPTIONS.find((o) => o.value === subject)?.label}</strong>
                      {' · '}
                      <strong>{QUIZ_TYPE_TABS.find((t) => t.value === quizType)?.label}</strong>
                      {' · '}현재 <strong>{eligibleCount}개</strong>의 용어로 퀴즈를 만들 수 있어요.
                    </p>
                    <div className="glossary-quiz-setup__controls">
                      <label htmlFor="quiz-count">문제 수</label>
                      <input
                        id="quiz-count"
                        type="number"
                        className="form-input"
                        min={minCount}
                        max={eligibleCount}
                        value={countInput}
                        onChange={(e) => setCountInput(e.target.value)}
                        onBlur={handleCountBlur}
                      />
                      <button type="button" className="btn btn-primary" onClick={handleStart}>
                        <Sparkles size={14} />
                        퀴즈 시작
                      </button>
                    </div>
                    {sourceStatus !== 'supabase' && (
                      <p className="glossary-quiz-note">
                        로컬/캐시 데이터로 출제됩니다. Supabase 연동 시 최신 용어로 갱신됩니다.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        ) : phase === 'playing' && currentQuestion ? (
          <div className="glossary-quiz-play">
            <div className="glossary-quiz-play__progress">
              <span>문항 {currentIndex + 1} / {questions.length}</span>
              <button type="button" className="glossary-quiz-play__exit" onClick={handleExitToSetup}>
                처음 화면으로
              </button>
            </div>
            <p className="glossary-quiz-play__prompt">{currentQuestion.prompt}</p>

            {!lastResult && isOxQuestion(currentQuestion) && (
              <div className="glossary-quiz-play__ox">
                <button
                  type="button"
                  className="glossary-quiz-ox-btn glossary-quiz-ox-btn--o"
                  onClick={() => submitAnswer('O')}
                >
                  <img src="/okestro-bear-mascot.png" alt="" className="glossary-quiz-ox-btn__mascot" />
                  <span className="glossary-quiz-ox-btn__paddle glossary-quiz-ox-btn__paddle--o">O</span>
                  <span className="glossary-quiz-ox-btn__label">참</span>
                </button>
                <button
                  type="button"
                  className="glossary-quiz-ox-btn glossary-quiz-ox-btn--x"
                  onClick={() => submitAnswer('X')}
                >
                  <img
                    src="/okestro-bear-mascot.png"
                    alt=""
                    className="glossary-quiz-ox-btn__mascot glossary-quiz-ox-btn__mascot--flip"
                  />
                  <span className="glossary-quiz-ox-btn__paddle glossary-quiz-ox-btn__paddle--x">X</span>
                  <span className="glossary-quiz-ox-btn__label">거짓</span>
                </button>
              </div>
            )}

            {!lastResult && !isOxQuestion(currentQuestion) && (
              <form className="glossary-quiz-play__answer-form" onSubmit={handleSubmitShortAnswer}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="이 용어는?"
                  value={shortAnswerInput}
                  onChange={(e) => setShortAnswerInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" disabled={!shortAnswerInput.trim()}>
                  제출
                </button>
              </form>
            )}

            {lastResult && (
              <div
                className={`glossary-quiz-feedback ${lastResult.correct ? 'is-correct' : 'is-wrong'}`}
              >
                <div className="glossary-quiz-feedback__head">
                  {lastResult.correct ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}
                  {lastResult.correct ? '정답입니다!' : '오답입니다.'}
                </div>
                <p>정답: {lastResult.correctAnswerDisplay}</p>
                {lastResult.explanation && <p className="glossary-quiz-feedback__explain">{lastResult.explanation}</p>}
                <button type="button" className="btn btn-primary" onClick={handleNext}>
                  {currentIndex + 1 < questions.length ? '다음 문제' : '결과 보기'}
                </button>
              </div>
            )}
          </div>
        ) : phase === 'result' && resultSummary ? (
          <div className="glossary-quiz-result">
            <h3>
              정답 {resultSummary.correctCount} / {resultSummary.total}
            </h3>
            {resultSummary.wrong.length === 0 ? (
              <p className="glossary-quiz-note">
                <CheckCircle2 size={14} aria-hidden />
                모든 문제를 맞혔습니다!
              </p>
            ) : (
              <ul className="glossary-quiz-result__list">
                {resultSummary.wrong.map((item) => (
                  <li key={item.question.id} className="glossary-quiz-result__item">
                    <p className="glossary-quiz-result__prompt">{item.question.prompt}</p>
                    <p>내 답: {formatYourAnswer(item.question, item.yourAnswer)}</p>
                    <p>정답: {item.correctAnswerDisplay}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="glossary-quiz-result__actions">
              <button type="button" className="btn btn-primary" onClick={handleRestart}>
                <RotateCcw size={14} />
                다시 풀기
              </button>
              <AppModuleLink module="glossary" className="btn btn-secondary">
                용어사전으로 돌아가기
              </AppModuleLink>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
