import { useCallback, useMemo, useState } from 'react';
import { useGlossary } from './useGlossary.js';
import {
  buildQuizQuestions,
  checkAnswer,
  formatCorrectAnswerDisplay,
  getEligibleQuizTerms,
} from '../utils/glossaryQuiz.js';

export const QUIZ_DEFAULT_COUNT = 8;
export const QUIZ_MIN_COUNT = 3;

export function useGlossaryQuiz() {
  const { terms, loading, sourceStatus, error, refresh } = useGlossary();

  const [phase, setPhase] = useState('setup'); // 'setup' | 'playing' | 'result'
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [lastResult, setLastResult] = useState(null);

  const eligibleCount = useMemo(() => getEligibleQuizTerms(terms).length, [terms]);

  const startQuiz = useCallback(
    (count) => {
      const built = buildQuizQuestions(terms, { count });
      setQuestions(built);
      setAnswers([]);
      setCurrentIndex(0);
      setLastResult(null);
      setPhase(built.length > 0 ? 'playing' : 'setup');
    },
    [terms]
  );

  const currentQuestion = questions[currentIndex] || null;

  const submitAnswer = useCallback(
    (value) => {
      if (!currentQuestion || lastResult) return;
      const correct = checkAnswer(currentQuestion, value);
      setAnswers((prev) => [
        ...prev,
        { questionId: currentQuestion.id, value, correct },
      ]);
      setLastResult({
        correct,
        correctAnswerDisplay: formatCorrectAnswerDisplay(currentQuestion),
        explanation: currentQuestion.explanation || null,
      });
    },
    [currentQuestion, lastResult]
  );

  const nextQuestion = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setLastResult(null);
    } else {
      setPhase('result');
    }
  }, [currentIndex, questions.length]);

  const restart = useCallback(() => {
    setPhase('setup');
    setQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setLastResult(null);
  }, []);

  const resultSummary = useMemo(() => {
    if (phase !== 'result') return null;
    const correctCount = answers.filter((a) => a.correct).length;
    const wrong = answers
      .filter((a) => !a.correct)
      .map((a) => {
        const question = questions.find((q) => q.id === a.questionId);
        return {
          question,
          yourAnswer: a.value,
          correctAnswerDisplay: question ? formatCorrectAnswerDisplay(question) : '',
        };
      })
      .filter((item) => item.question);
    return { correctCount, total: questions.length, wrong };
  }, [phase, answers, questions]);

  return {
    loading,
    sourceStatus,
    error,
    refresh,
    eligibleCount,
    phase,
    questions,
    currentIndex,
    currentQuestion,
    lastResult,
    resultSummary,
    startQuiz,
    submitAnswer,
    nextQuestion,
    restart,
  };
}
