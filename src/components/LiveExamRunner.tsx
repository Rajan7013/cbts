import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Languages,
  Loader2,
  Maximize2,
  Send,
  X,
  ZoomIn,
} from 'lucide-react';
import { MediaPipeProctor } from './MediaPipeProctor';
import { MathText } from './MathText';
import { translateTextsWithAI } from '../lib/api';
import type { OptionId, SanitizedQuestion, StrikeLog, TestAttempt, TestExam } from '../types';

interface LiveExamRunnerProps {
  test: TestExam;
  questions: SanitizedQuestion[];
  initialAttempt: TestAttempt;
  onSyncProgress: (attempt: TestAttempt) => Promise<void>;
  onSubmitExam: (
    attempt: TestAttempt,
    status: 'submitted' | 'auto_submitted_strike'
  ) => Promise<void>;
}

const TARGET_LANGUAGES = [
  'English',
  'Hindi',
  'Tamil',
  'Bengali',
  'Bahasa Indonesia',
  'Japanese',
];

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function LiveExamRunner({
  test,
  questions,
  initialAttempt,
  onSyncProgress,
  onSubmitExam,
}: LiveExamRunnerProps) {
  const [attempt, setAttempt] = useState<TestAttempt>(initialAttempt);
  const attemptRef = useRef<TestAttempt>(initialAttempt);

  const [currentIndex, setCurrentIndex] = useState<number>(() =>
    Math.min(Math.max(0, initialAttempt.currentQuestionIndex || 0), Math.max(0, questions.length - 1))
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialAttempt.remainingSeconds);

  const [strikeModal, setStrikeModal] = useState<{ count: number; reason: string } | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);

  // Translation state
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [translating, setTranslating] = useState(false);
  const [translationCache, setTranslationCache] = useState<
    Record<string, { questionText: string; options: string[] }>
  >({});

  const isLockedRef = useRef(false);
  const wasFullscreenRef = useRef(Boolean(document.fullscreenElement));
  const lastStrikeTsRef = useRef(0);
  const strikeModalOpenRef = useRef(false);

  useEffect(() => {
    strikeModalOpenRef.current = Boolean(strikeModal);
  }, [strikeModal]);

  const currentQuestion = questions[currentIndex];

  const sectionQuestionsMap = useMemo(() => {
    const map: Record<string, Array<{ q: SanitizedQuestion; globalIdx: number }>> = {};
    test.sections.forEach((s) => {
      map[s.id] = [];
    });
    questions.forEach((q, idx) => {
      if (!map[q.sectionId]) map[q.sectionId] = [];
      map[q.sectionId].push({ q, globalIdx: idx });
    });
    return map;
  }, [questions, test.sections]);

  const activeSectionId = currentQuestion?.sectionId || test.sections[0]?.id || '';

  const persistAttempt = useCallback(
    async (nextAttempt: TestAttempt) => {
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
      try {
        await onSyncProgress(nextAttempt);
      } catch {
        // Non-blocking background sync
      }
    },
    [onSyncProgress]
  );

  const finalizeAndExit = useCallback(
    async (finalAttempt: TestAttempt, status: 'submitted' | 'auto_submitted_strike') => {
      if (isLockedRef.current) return;
      isLockedRef.current = true;
      setSubmitting(true);
      if (document.fullscreenElement && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch {
          // Ignore fullscreen exit failure
        }
      }
      await onSubmitExam(finalAttempt, status);
    },
    [onSubmitExam]
  );

  const triggerStrike = useCallback(
    (reason: string) => {
      if (isLockedRef.current || strikeModalOpenRef.current) return;
      const now = Date.now();
      if (now - lastStrikeTsRef.current < 2500) return;
      lastStrikeTsRef.current = now;

      const cur = attemptRef.current;
      const nextCount = cur.strikeCount + 1;
      const logEntry: StrikeLog = {
        count: nextCount,
        reason,
        timestamp: new Date().toISOString(),
      };
      const updated: TestAttempt = {
        ...cur,
        strikeCount: nextCount,
        strikes: [...cur.strikes, logEntry],
        remainingSeconds,
        currentQuestionIndex: currentIndex,
        currentSectionId: activeSectionId,
      };
      attemptRef.current = updated;
      setAttempt(updated);

      if (test.maxStrikes > 0 && nextCount >= test.maxStrikes) {
        finalizeAndExit(updated, 'auto_submitted_strike');
      } else {
        setStrikeModal({ count: nextCount, reason });
        onSyncProgress(updated).catch(() => {});
      }
    },
    [activeSectionId, currentIndex, finalizeAndExit, onSyncProgress, remainingSeconds, test.maxStrikes]
  );

  // Mark current question visited on index change
  useEffect(() => {
    if (!currentQuestion || isLockedRef.current) return;
    const prevResp = attemptRef.current.responses[currentQuestion.questionId];
    if (!prevResp?.visited || attemptRef.current.currentQuestionIndex !== currentIndex) {
      const updated: TestAttempt = {
        ...attemptRef.current,
        currentQuestionIndex: currentIndex,
        currentSectionId: currentQuestion.sectionId,
        responses: {
          ...attemptRef.current.responses,
          [currentQuestion.questionId]: {
            selectedOptionId: prevResp?.selectedOptionId ?? null,
            markedForReview: prevResp?.markedForReview ?? false,
            visited: true,
          },
        },
      };
      persistAttempt(updated);
    }
  }, [currentIndex, currentQuestion, persistAttempt]);

  // Countdown Timer + 5s Heartbeat Sync
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isLockedRef.current) return;
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        attemptRef.current = { ...attemptRef.current, remainingSeconds: Math.max(0, next) };
        if (next <= 0) {
          finalizeAndExit(attemptRef.current, 'submitted');
          return 0;
        }
        if (next % 5 === 0) {
          onSyncProgress(attemptRef.current).catch(() => {});
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finalizeAndExit, onSyncProgress]);

  // Fullscreen, Visibility, and Window Blur Anti-Cheat Listeners
  useEffect(() => {
    const armTimeout = window.setTimeout(() => {
      if (document.fullscreenElement) {
        wasFullscreenRef.current = true;
      }
    }, 700);

    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        wasFullscreenRef.current = true;
      } else if (test.enforceFullscreen && wasFullscreenRef.current && !isLockedRef.current) {
        triggerStrike('Exited Fullscreen Mode');
      }
    };

    const onVisibilityChange = () => {
      if (test.detectTabSwitch && document.hidden && !isLockedRef.current) {
        triggerStrike('Switched Browser Tab / Minimized');
      }
    };

    const onWindowBlur = () => {
      if (test.detectTabSwitch && !isLockedRef.current) {
        triggerStrike('Window Lost Focus (Alt+Tab / Clicked Outside)');
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.clearTimeout(armTimeout);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [test.detectTabSwitch, test.enforceFullscreen, triggerStrike]);

  // Language Translation Handler
  useEffect(() => {
    if (!currentQuestion || selectedLanguage === 'English') return;
    const cacheKey = `${currentQuestion.questionId}__${selectedLanguage}`;
    if (translationCache[cacheKey]) return;

    let cancelled = false;
    setTranslating(true);
    const textsToTranslate = [
      currentQuestion.questionText,
      ...currentQuestion.options.map((o) => o.text),
    ];

    translateTextsWithAI(textsToTranslate, selectedLanguage)
      .then((translated) => {
        if (cancelled) return;
        setTranslationCache((prev) => ({
          ...prev,
          [cacheKey]: {
            questionText: translated[0] || currentQuestion.questionText,
            options: currentQuestion.options.map((o, idx) => translated[idx + 1] || o.text),
          },
        }));
      })
      .catch(() => {
        // Keep English if translation fails
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentQuestion, selectedLanguage, translationCache]);

  const handleSelectOption = (optionId: OptionId) => {
    if (!currentQuestion || isLockedRef.current) return;
    const prev = attempt.responses[currentQuestion.questionId];
    const updated: TestAttempt = {
      ...attempt,
      remainingSeconds,
      currentQuestionIndex: currentIndex,
      currentSectionId: currentQuestion.sectionId,
      responses: {
        ...attempt.responses,
        [currentQuestion.questionId]: {
          selectedOptionId: optionId,
          markedForReview: prev?.markedForReview ?? false,
          visited: true,
        },
      },
    };
    persistAttempt(updated);
  };

  const handleClearResponse = () => {
    if (!currentQuestion || isLockedRef.current) return;
    const prev = attempt.responses[currentQuestion.questionId];
    const updated: TestAttempt = {
      ...attempt,
      remainingSeconds,
      responses: {
        ...attempt.responses,
        [currentQuestion.questionId]: {
          selectedOptionId: null,
          markedForReview: prev?.markedForReview ?? false,
          visited: true,
        },
      },
    };
    persistAttempt(updated);
  };

  const handleMarkAndNext = () => {
    if (!currentQuestion || isLockedRef.current) return;
    const prev = attempt.responses[currentQuestion.questionId];
    const updated: TestAttempt = {
      ...attempt,
      remainingSeconds,
      responses: {
        ...attempt.responses,
        [currentQuestion.questionId]: {
          selectedOptionId: prev?.selectedOptionId ?? null,
          markedForReview: !(prev?.markedForReview ?? false),
          visited: true,
        },
      },
    };
    persistAttempt(updated);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleReenterFullscreen = async () => {
    if (test.enforceFullscreen && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Allow continuation if browser blocks programmatic fullscreen
      }
    }
    setStrikeModal(null);
  };

  if (!currentQuestion) {
    return (
      <div className="p-10 text-center text-sm text-slate-600">
        No questions available in this test yet.
      </div>
    );
  }

  const currentResp = attempt.responses[currentQuestion.questionId];
  const cacheKey = `${currentQuestion.questionId}__${selectedLanguage}`;
  const translatedView = selectedLanguage !== 'English' ? translationCache[cacheKey] : undefined;
  const displayedQuestionText = translatedView?.questionText || currentQuestion.questionText;

  const answeredCount = Object.values(attempt.responses).filter((r) => Boolean(r.selectedOptionId)).length;
  const markedCount = Object.values(attempt.responses).filter((r) => r.markedForReview).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Exam Top Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3.5 sm:px-5 py-2.5 sm:py-3">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="font-display text-sm font-bold text-slate-900 truncate max-w-[180px] sm:max-w-[260px]">
              {test.title}
            </span>
            <div className="hidden md:flex items-center gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto">
              {test.sections.map((sec) => {
                const firstInSec = sectionQuestionsMap[sec.id]?.[0]?.globalIdx;
                const isActive = sec.id === activeSectionId;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      if (firstInSec !== undefined) setCurrentIndex(firstInSec);
                    }}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sec.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {test.proctoringAIEnabled && (
              <MediaPipeProctor active={true} compact={true} onViolation={triggerStrike} />
            )}

            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 font-mono text-[11px] sm:text-xs font-semibold tabular-nums ${
                attempt.strikeCount > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {attempt.strikeCount}/{test.maxStrikes || '∞'}
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 font-mono text-xs sm:text-sm font-bold tabular-nums ${
                remainingSeconds <= 300
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-slate-900 text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span>{formatClock(remainingSeconds)}</span>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowSubmitConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Submit</span>
            </button>
          </div>
        </div>

        {/* Mobile Section Switcher */}
        {test.sections.length > 1 && (
          <div className="mt-2 flex md:hidden items-center gap-1.5 overflow-x-auto pb-0.5">
            {test.sections.map((sec) => {
              const firstInSec = sectionQuestionsMap[sec.id]?.[0]?.globalIdx;
              const isActive = sec.id === activeSectionId;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    if (firstInSec !== undefined) setCurrentIndex(firstInSec);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {sec.name}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Split Workspace */}
      <div className="mx-auto w-full max-w-[1440px] flex-1 grid grid-cols-1 gap-4 sm:gap-6 p-3.5 sm:p-6 lg:grid-cols-12">
        {/* Left 70%: Question Canvas */}
        <section className="lg:col-span-8 min-w-0 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
                Question {currentIndex + 1} of {questions.length} · +{currentQuestion.marks} Marks
                {test.negativeMarking ? ` / -${test.negativeMarkValue} Negative` : ''}
              </div>

              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-slate-500" />
                <select
                  aria-label="Translate question language"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
                >
                  {TARGET_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                {translating && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" />}
              </div>
            </div>

            <div className="mt-5">
              <MathText
                text={displayedQuestionText}
                className="text-[15.5px] leading-[1.75] text-slate-900"
              />
            </div>

            {currentQuestion.questionImageUrl && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setZoomImgUrl(currentQuestion.questionImageUrl!)}
                  className="group relative inline-block rounded-lg border border-slate-200 bg-white p-2.5 hover:border-blue-400 cursor-pointer"
                >
                  <img
                    src={currentQuestion.questionImageUrl}
                    alt="Question diagram"
                    referrerPolicy="no-referrer"
                    className="max-h-72 rounded object-contain"
                  />
                  <span className="mt-1.5 flex items-center justify-center gap-1 text-xs text-slate-500 group-hover:text-blue-700">
                    <ZoomIn className="h-3.5 w-3.5" />
                    <span>Click to enlarge diagram</span>
                  </span>
                </button>
              </div>
            )}

            {(() => {
              const allCompact = currentQuestion.options.every((opt, idx) => {
                const label = translatedView?.options[idx] || opt.text;
                return !opt.imageUrl && label.length <= 55 && !label.includes('$$') && !label.includes('\\[');
              });
              return (
                <div className={allCompact ? 'mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2' : 'mt-6 space-y-3'}>
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = currentResp?.selectedOptionId === opt.id;
                    const optionLabel = translatedView?.options[idx] || opt.text;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(opt.id)}
                        className={`w-full text-left flex items-start gap-3.5 rounded-xl border p-4 transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-blue-700 bg-blue-50/70'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ${
                            isSelected
                              ? 'bg-blue-700 text-white'
                              : 'border border-slate-300 bg-slate-50 text-slate-700'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <div className="flex-1 min-w-0 space-y-2">
                          <MathText
                            text={optionLabel}
                            className="text-sm font-medium leading-relaxed text-slate-900"
                          />
                          {opt.imageUrl && (
                            <img
                              src={opt.imageUrl}
                              alt={`Option ${opt.id}`}
                              referrerPolicy="no-referrer"
                              className="max-h-32 rounded border border-slate-200 bg-white object-contain"
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 pt-4 sm:pt-5">
            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearResponse}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer text-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleMarkAndNext}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 sm:py-2 text-xs font-semibold cursor-pointer ${
                  currentResp?.markedForReview
                    ? 'border-purple-400 bg-purple-50 text-purple-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {currentResp?.markedForReview ? 'Unmark & Next' : 'Mark & Next'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={currentIndex >= questions.length - 1}
                onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
              >
                <span>Save &amp; Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Right 30%: Question Palette Sidebar */}
        <aside className="lg:col-span-4 min-w-0 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="font-display text-sm font-bold text-slate-900">Question Palette</h2>
            <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
              Answered: {answeredCount} · Marked: {markedCount} · Remaining:{' '}
              {questions.length - answeredCount}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-600 inline-block" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-purple-600 inline-block" />
                <span>Marked</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-slate-300 bg-slate-100 inline-block" />
                <span>Unanswered</span>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {test.sections.map((sec) => {
                const items = sectionQuestionsMap[sec.id] || [];
                if (items.length === 0) return null;
                return (
                  <div key={sec.id}>
                    <div className="mb-2 text-xs font-semibold text-slate-700">{sec.name}</div>
                    <div className="grid grid-cols-5 gap-2">
                      {items.map(({ q, globalIdx }) => {
                        const r = attempt.responses[q.questionId];
                        const isCurrent = globalIdx === currentIndex;
                        let style =
                          'border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200';
                        if (r?.markedForReview && r?.selectedOptionId) {
                          style = 'bg-purple-700 text-white border border-purple-700';
                        } else if (r?.markedForReview) {
                          style = 'bg-purple-600 text-white border border-purple-600';
                        } else if (r?.selectedOptionId) {
                          style = 'bg-emerald-600 text-white border border-emerald-600';
                        }
                        return (
                          <button
                            key={q.questionId}
                            type="button"
                            onClick={() => setCurrentIndex(globalIdx)}
                            className={`h-9 rounded-lg font-mono text-xs font-semibold tabular-nums transition-transform cursor-pointer ${style} ${
                              isCurrent ? 'ring-2 ring-blue-700 ring-offset-1' : ''
                            }`}
                          >
                            {globalIdx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Urgent Anti-Cheat Strike Modal */}
      {strikeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-red-300 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-700">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h2 className="font-display text-lg font-bold">
                Proctoring Strike {strikeModal.count} of {test.maxStrikes || '∞'} Recorded
              </h2>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Violation detected: <strong>{strikeModal.reason}</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              {test.maxStrikes > 0
                ? `${test.maxStrikes - strikeModal.count} more strike(s) will immediately lock and auto-submit your test.`
                : 'This event has been logged to your exam proctoring record.'}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleReenterFullscreen}
                className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 cursor-pointer"
              >
                <Maximize2 className="h-4 w-4" />
                <span>Return to Fullscreen &amp; Continue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="font-display text-lg font-bold text-slate-900">Submit Assessment?</h2>
            <p className="mt-2 text-sm text-slate-600">
              You have answered <strong>{answeredCount}</strong> of{' '}
              <strong>{questions.length}</strong> questions ({markedCount} marked for review). Once
              submitted, responses cannot be modified.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Continue Exam
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => finalizeAndExit(attemptRef.current, 'submitted')}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
              >
                {submitting ? 'Submitting…' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Diagram Modal */}
      {zoomImgUrl && (
        <div
          onClick={() => setZoomImgUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl rounded-xl bg-white p-4"
          >
            <button
              type="button"
              onClick={() => setZoomImgUrl(null)}
              className="absolute right-3 top-3 rounded-md bg-slate-100 p-1.5 text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={zoomImgUrl}
              alt="Enlarged question diagram"
              referrerPolicy="no-referrer"
              className="max-h-[80vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
