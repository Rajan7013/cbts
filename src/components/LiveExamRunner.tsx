import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  Grid,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  Maximize,
  Upload,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { MediaPipeProctor } from './MediaPipeProctor';
import { MathText } from './MathText';
import { QuestionImage } from './QuestionImage';
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
  onCancelExam?: () => void;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function LiveExamRunner({
  test,
  questions,
  initialAttempt,
  onSyncProgress,
  onSubmitExam,
  onCancelExam,
}: LiveExamRunnerProps) {
  const [attempt, setAttempt] = useState<TestAttempt>(initialAttempt);
  const attemptRef = useRef<TestAttempt>(initialAttempt);

  const [currentIndex, setCurrentIndex] = useState<number>(() =>
    Math.min(Math.max(0, initialAttempt.currentQuestionIndex || 0), Math.max(0, questions.length - 1))
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialAttempt.remainingSeconds);

  const [strikeModal, setStrikeModal] = useState<{ count: number; reason: string } | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isFullscreenExited, setIsFullscreenExited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);

  const isLockedRef = useRef(false);
  const wasFullscreenRef = useRef(Boolean(document.fullscreenElement));
  const lastStrikeTsRef = useRef(0);

  // Maintain attempt ref
  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  const isWarning = remainingSeconds > 0 && remainingSeconds <= 300; // <= 5 minutes
  const isUrgent = remainingSeconds > 0 && remainingSeconds <= 120; // <= 2 minutes
  const isMobileDevice =
    typeof window !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768 ||
      window.matchMedia?.('(pointer: coarse)')?.matches);

  const currentQuestion: SanitizedQuestion | undefined = questions[currentIndex];
  const activeSection = test.sections.find((s) => s.id === currentQuestion?.sectionId);
  const currentResp = currentQuestion ? attempt.responses[currentQuestion.questionId] : undefined;

  const [showOverviewPopover, setShowOverviewPopover] = useState(false);
  const [showGuidelinesDrawer, setShowGuidelinesDrawer] = useState(false);
  const [showSectionTimePopover, setShowSectionTimePopover] = useState(false);
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>('key');

  // Automatically record visited status when viewing a question
  useEffect(() => {
    if (!currentQuestion) return;
    const prev = attemptRef.current.responses[currentQuestion.questionId];
    if (!prev?.visited) {
      const updated: TestAttempt = {
        ...attemptRef.current,
        currentQuestionIndex: currentIndex,
        currentSectionId: currentQuestion.sectionId,
        responses: {
          ...attemptRef.current.responses,
          [currentQuestion.questionId]: {
            selectedOptionId: prev?.selectedOptionId || null,
            markedForReview: prev?.markedForReview || false,
            visited: true,
          },
        },
      };
      setAttempt(updated);
      attemptRef.current = updated;
      onSyncProgress(updated).catch(() => {});
    }
  }, [currentIndex, currentQuestion, onSyncProgress]);

  // Counts (Unstop spec)
  const answeredCount = useMemo(
    () => Object.values(attempt.responses).filter((r) => Boolean(r.selectedOptionId)).length,
    [attempt.responses]
  );
  const markedCount = useMemo(
    () => Object.values(attempt.responses).filter((r) => Boolean(r.markedForReview)).length,
    [attempt.responses]
  );
  const visitedUnansweredCount = useMemo(() => {
    return questions.filter((q) => {
      const resp = attempt.responses[q.questionId];
      return resp?.visited && !resp?.selectedOptionId;
    }).length;
  }, [questions, attempt.responses]);
  const unvisitedCount = questions.length - answeredCount - visitedUnansweredCount;
  const unansweredCount = questions.length - answeredCount;

  // Window of question pills for the top pager (Unstop spec)
  const visiblePageNumbers = useMemo(() => {
    const windowSize = 5;
    const half = Math.floor(windowSize / 2);
    let start = Math.max(0, currentIndex - half);
    let end = Math.min(questions.length - 1, start + windowSize - 1);
    if (end - start + 1 < windowSize) {
      start = Math.max(0, end - windowSize + 1);
    }
    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentIndex, questions.length]);

  const handleSkip = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  // Finalize and exit
  const finalizeAndExit = useCallback(
    async (finalAttempt: TestAttempt, status: 'submitted' | 'auto_submitted_strike') => {
      if (isLockedRef.current) return;
      isLockedRef.current = true;
      setSubmitting(true);
      try {
        if (document.fullscreenElement) {
          try {
            await document.exitFullscreen();
          } catch {
            // Ignore
          }
        }
      } finally {
        await onSubmitExam(finalAttempt, status);
      }
    },
    [onSubmitExam]
  );

  // Trigger strike
  const triggerStrike = useCallback(
    (reason: string) => {
      if (isLockedRef.current) return;
      const now = Date.now();
      if (now - lastStrikeTsRef.current < 2500) return;
      lastStrikeTsRef.current = now;

      const newCount = attemptRef.current.strikeCount + 1;
      const newStrike: StrikeLog = {
        count: newCount,
        reason,
        timestamp: new Date().toISOString(),
      };

      const updated: TestAttempt = {
        ...attemptRef.current,
        strikeCount: newCount,
        strikes: [...attemptRef.current.strikes, newStrike],
        remainingSeconds,
      };

      attemptRef.current = updated;
      setAttempt(updated);
      onSyncProgress(updated).catch(() => {});

      if (test.maxStrikes > 0 && newCount >= test.maxStrikes) {
        setStrikeModal(null);
        finalizeAndExit(updated, 'auto_submitted_strike');
      } else {
        setStrikeModal({ count: newCount, reason });
      }
    },
    [finalizeAndExit, onSyncProgress, remainingSeconds, test.maxStrikes]
  );

  // Countdown timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isLockedRef.current) return;
      setRemainingSeconds((prev) => {
        const next = Math.max(0, prev - 1);
        attemptRef.current = { ...attemptRef.current, remainingSeconds: next };
        if (next === 0) {
          window.clearInterval(timer);
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

  // Anti-cheat listeners: Fullscreen enforcement, Tab switch, Window blur & Screenshot protection
  useEffect(() => {
    const armTimeout = window.setTimeout(() => {
      if (document.fullscreenElement) {
        wasFullscreenRef.current = true;
      }
    }, 700);

    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        wasFullscreenRef.current = true;
        setIsFullscreenExited(false);
      } else if (test.enforceFullscreen && !isMobileDevice && wasFullscreenRef.current && !isLockedRef.current) {
        setIsFullscreenExited(true);
        triggerStrike('Exited Fullscreen Mode');
      }
    };

    const onVisibilityChange = () => {
      if (test.detectTabSwitch && document.hidden && !isLockedRef.current) {
        triggerStrike('Switched Browser Tab or Minimized Window');
      }
    };

    const onWindowBlur = () => {
      if (test.detectTabSwitch && !isLockedRef.current) {
        triggerStrike('Window Lost Focus (Alt+Tab / Clicked Outside)');
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isLockedRef.current) return;

      // PrintScreen key
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        try {
          navigator.clipboard?.writeText?.('');
        } catch {}
        triggerStrike('Screenshot Attempt Detected (PrintScreen Key)');
        return;
      }

      // Windows Snipping Tool (Meta + Shift + S) or Mac Screenshot (Cmd + Shift + 3/4/5)
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        ['s', 'S', '3', '4', '5'].includes(e.key)
      ) {
        e.preventDefault();
        try {
          navigator.clipboard?.writeText?.('');
        } catch {}
        triggerStrike('Screen Capture Shortcut Detected');
        return;
      }

      // Print dialog (Ctrl + P / Cmd + P)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        triggerStrike('Print / Save Page Attempt Detected');
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.clearTimeout(armTimeout);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [test.detectTabSwitch, test.enforceFullscreen, triggerStrike]);

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
    setAttempt(updated);
    attemptRef.current = updated;
    onSyncProgress(updated).catch(() => {});
  };

  const handleClearResponse = () => {
    if (!currentQuestion || isLockedRef.current) return;
    const prev = attempt.responses[currentQuestion.questionId];
    if (!prev?.selectedOptionId) return;

    const updated: TestAttempt = {
      ...attempt,
      remainingSeconds,
      currentQuestionIndex: currentIndex,
      responses: {
        ...attempt.responses,
        [currentQuestion.questionId]: {
          selectedOptionId: null,
          markedForReview: prev?.markedForReview ?? false,
          visited: true,
        },
      },
    };
    setAttempt(updated);
    attemptRef.current = updated;
    onSyncProgress(updated).catch(() => {});
  };

  const handleToggleMark = () => {
    if (!currentQuestion || isLockedRef.current) return;
    const prev = attempt.responses[currentQuestion.questionId];
    const isMarked = !prev?.markedForReview;

    const updated: TestAttempt = {
      ...attempt,
      remainingSeconds,
      currentQuestionIndex: currentIndex,
      responses: {
        ...attempt.responses,
        [currentQuestion.questionId]: {
          selectedOptionId: prev?.selectedOptionId ?? null,
          markedForReview: isMarked,
          visited: true,
        },
      },
    };
    setAttempt(updated);
    attemptRef.current = updated;
    onSyncProgress(updated).catch(() => {});
  };

  const handleSaveAndNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  return (
    <div className="h-screen w-screen bg-white flex flex-col font-sans select-none overflow-hidden">
      {/* ======================================================== */}
      {/* 1. TOP HEADER (UNSTOP STYLE)                            */}
      {/* ======================================================== */}
      <header className="h-14 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between z-30 select-none shrink-0">
        {/* Left: Brand Logo + Section Dropdown + Horizontal Question Pager */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0 pr-1 sm:pr-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              EP
            </div>
            <span className="font-display font-extrabold text-sm sm:text-base tracking-tight text-blue-700 hidden md:inline">
              ExamPulse
            </span>
          </div>

          {/* Section Selector Dropdown (Unstop style) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowSectionDropdown(!showSectionDropdown)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="max-w-[100px] sm:max-w-[140px] truncate">
                {activeSection?.name?.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '') || 'All Sections'}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showSectionDropdown && (
              <div className="absolute left-0 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Section
                </div>
                {test.sections.map((sec) => {
                  const count = questions.filter((q) => q.sectionId === sec.id).length;
                  const isSelected = activeSection?.id === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        const firstIdx = questions.findIndex((q) => q.sectionId === sec.id);
                        if (firstIdx >= 0) setCurrentIndex(firstIdx);
                        setShowSectionDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{sec.name.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '')}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Horizontal Question Strip (Unstop style: < 1 2 3 4 5 > [ N ⊞ ]) */}
          <div className="flex items-center gap-1 pl-1 sm:pl-2">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs transition-colors"
              title="Previous Question"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {visiblePageNumbers.map((idx) => {
              const resp = attempt.responses[questions[idx]?.questionId];
              const isCurrent = idx === currentIndex;
              const isAnswered = Boolean(resp?.selectedOptionId);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-7 min-w-7 px-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-neutral-900 text-white shadow-xs ring-1 ring-neutral-900'
                      : isAnswered
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={currentIndex === questions.length - 1}
              className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs transition-colors"
              title="Next Question"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            {/* Question Overview Grid Button [ N ⊞ ] */}
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setShowOverviewPopover(!showOverviewPopover)}
                className={`h-7 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-mono font-bold transition-colors cursor-pointer ${
                  showOverviewPopover
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
                title="Question's Overview"
              >
                <span>{questions.length}</span>
                <Grid className="h-3 w-3 text-slate-500" />
              </button>

              {/* Question's Overview Dropdown Popover matching Image 2 */}
              {showOverviewPopover && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[330px] sm:w-[420px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Question&apos;s Overview
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowOverviewPopover(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Grid of all questions */}
                  <div className="max-h-60 overflow-y-auto py-3 pr-1 grid grid-cols-6 sm:grid-cols-8 gap-2">
                    {questions.map((q, idx) => {
                      const resp = attempt.responses[q.questionId];
                      const isCurrent = idx === currentIndex;
                      const isAnswered = Boolean(resp?.selectedOptionId);
                      const isMarked = Boolean(resp?.markedForReview);
                      const isVisited = Boolean(resp?.visited);

                      let bgClass = 'bg-slate-100 text-slate-600 hover:bg-slate-200';
                      if (isCurrent) {
                        bgClass = 'bg-neutral-900 text-white ring-2 ring-blue-500 font-bold';
                      } else if (isAnswered) {
                        bgClass = 'bg-emerald-500 text-white font-bold';
                      } else if (isMarked) {
                        bgClass = 'bg-purple-600 text-white font-bold';
                      } else if (isVisited) {
                        bgClass = 'bg-orange-600 text-white font-bold';
                      }

                      return (
                        <button
                          key={q.questionId}
                          type="button"
                          onClick={() => {
                            setCurrentIndex(idx);
                            setShowOverviewPopover(false);
                          }}
                          className={`h-8 rounded-lg text-xs font-mono flex items-center justify-center transition-all cursor-pointer ${bgClass}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  {/* Status chips legend matching Image 2 */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-[11px] font-semibold text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-xs bg-emerald-500" />
                      <span>Completed: {answeredCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-xs bg-orange-600" />
                      <span>Not Submitted: {visitedUnansweredCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-xs bg-purple-600" />
                      <span>Re-visit: {markedCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-xs bg-slate-200" />
                      <span>Not Answered: {unvisitedCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-xs bg-neutral-900" />
                      <span>Current</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Guidelines + Section time Left */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Proctoring camera badge */}
          {test.proctoringAIEnabled && (
            <div className="hidden lg:flex items-center">
              <MediaPipeProctor
                active={!isLockedRef.current}
                compact={true}
                onMultipleFacesDetected={() => triggerStrike('Multiple Faces Detected by MediaPipe AI')}
                onNoFaceDetected={() => triggerStrike('No Candidate Face Detected by MediaPipe AI')}
              />
            </div>
          )}

          {/* Guidelines button matching Image 1 & 4 */}
          <button
            type="button"
            onClick={() => setShowGuidelinesDrawer(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer transition-colors"
          >
            <span className="text-amber-500 text-sm leading-none">💡</span>
            <span className="hidden sm:inline">Guidelines</span>
          </button>

          {/* Section time Left badge matching Image 1 & 5 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSectionTimePopover(!showSectionTimePopover)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-xs font-semibold text-blue-900 cursor-pointer shadow-2xs transition-colors"
            >
              <span className="text-slate-600 font-medium hidden sm:inline">Section time Left:</span>
              <span className="font-mono font-bold tracking-wider">
                {formatClock(remainingSeconds)}
              </span>
            </button>

            {/* All Sections Time Popover matching Image 5 */}
            {showSectionTimePopover && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  All Sections Time
                </div>
                <div className="space-y-2">
                  {test.sections.map((sec, sIdx) => {
                    const isCurrent = activeSection?.id === sec.id;
                    return (
                      <div
                        key={sec.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0"
                      >
                        <span className={`truncate mr-2 ${isCurrent ? 'font-bold text-blue-700' : 'text-slate-700'}`}>
                          S{sIdx + 1} - {sec.name.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '')}
                        </span>
                        <span className="font-mono font-semibold text-slate-500 shrink-0">
                          {formatClock(remainingSeconds)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. MAIN BODY (UNSTOP 2-COLUMN SPLIT SCREEN)             */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-120px)] overflow-hidden overflow-x-hidden">
        {/* LEFT COLUMN: Question & Context (approx 52%) */}
        <div className="w-full lg:w-[52%] h-full overflow-y-auto overflow-x-hidden p-5 sm:p-8 relative border-r border-slate-200 bg-white">
          {/* Background Watermark (Clipped SVG pattern, zero overflow, zero scrollbars) */}
          <div className="pointer-events-none select-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <svg className="absolute inset-0 h-full w-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="wm-pat" width="280" height="140" patternTransform="rotate(-25 0 0)" patternUnits="userSpaceOnUse">
                  <text x="10" y="35" fontSize="12" fontWeight="bold" fontFamily="monospace" fill="currentColor">
                    {attempt.userEmail || 'Candidate'}
                  </text>
                  <text x="10" y="65" fontSize="10" fontWeight="bold" fontFamily="monospace" fill="currentColor">
                    {attempt.userName || (attempt.userId ? `ID: ${attempt.userId.slice(0, 10)}` : 'ExamPulse')}
                  </text>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#wm-pat)" />
            </svg>
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl">
            {/* Top Row: Question number + Mark for Review button + Marks */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="font-display text-base sm:text-lg font-bold text-slate-900">
                  Question {currentIndex + 1}.
                </span>
                <button
                  type="button"
                  onClick={handleToggleMark}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-colors shadow-2xs ${
                    currentResp?.markedForReview
                      ? 'border-purple-300 bg-purple-50 text-purple-700 font-bold'
                      : 'border-slate-200 bg-white hover:bg-purple-50 hover:text-purple-700 text-slate-600'
                  }`}
                  title="Mark for later review"
                >
                  <Bookmark className="h-3.5 w-3.5 text-purple-600" />
                  <span>{currentResp?.markedForReview ? 'Marked for Review ✓' : 'Mark for Review'}</span>
                </button>
              </div>

              <div className="text-xs sm:text-sm font-bold text-slate-700 font-mono">
                Marks : {(currentQuestion?.marks || test.marksPerQuestion || 1).toFixed(2)}
              </div>
            </div>

            {/* Question Text with KaTeX */}
            <div className="text-sm sm:text-base font-normal text-slate-900 leading-relaxed pt-2">
              <MathText text={currentQuestion?.questionText} />
            </div>

            {/* Diagram / Image if present */}
            {(currentQuestion?.questionImageUrl || currentQuestion?.imageUrl) && (
              <div className="pt-2">
                <QuestionImage
                  src={currentQuestion.questionImageUrl || currentQuestion.imageUrl}
                  alt="Question diagram"
                  className="max-h-64 object-contain rounded-xl border border-slate-200 p-2"
                />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Answer & Options (approx 48%) */}
        <div className="w-full lg:w-[48%] h-full overflow-y-auto overflow-x-hidden p-5 sm:p-8 bg-slate-50/50">
          <div className="max-w-2xl space-y-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Answer</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click on &quot;Next&quot; button to proceed.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {currentQuestion?.options.map((opt) => {
                const isSelected = currentResp?.selectedOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt.id)}
                    className={`w-full text-left flex items-start gap-3.5 rounded-xl border p-4 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-white shadow-xs ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Radio Circle matching Unstop Image 1, 3, 5 */}
                    <div
                      className={`mt-0.5 h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-400 bg-white'
                      }`}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>

                    <div className="flex-1 text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                      <MathText text={opt.text} inline />
                    </div>

                    {opt.imageUrl && (
                      <QuestionImage
                        src={opt.imageUrl}
                        alt={`Option ${opt.id}`}
                        className="max-h-20"
                        allowZoom={false}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. BOTTOM ACTION BAR (UNSTOP FIXED FOOTER)              */}
      {/* ======================================================== */}
      <footer className="h-16 border-t border-slate-200 bg-white px-4 sm:px-8 flex items-center justify-between shrink-0 z-20 shadow-xs">
        {/* Left: Submit Test button (formerly Finish) */}
        <button
          type="button"
          onClick={() => setShowSubmitConfirm(true)}
          className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-xs sm:text-sm font-bold text-white shadow-xs cursor-pointer transition-colors"
        >
          Submit Test
        </button>

        {/* Right: Mark for Review, Clear Response, Previous, Skip, Next */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleToggleMark}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer transition-colors shadow-2xs ${
              currentResp?.markedForReview
                ? 'border-purple-300 bg-purple-50 text-purple-700 font-bold'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5 text-purple-600" />
            <span>{currentResp?.markedForReview ? 'Marked for Review ✓' : 'Mark for Review'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearResponse}
            disabled={!currentResp?.selectedOptionId}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Clear Response
          </button>

          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
          >
            Skip
          </button>

          {/* Next button (formerly Submit) */}
          <button
            type="button"
            onClick={handleSaveAndNext}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm font-bold text-white shadow-xs cursor-pointer transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* 4. GUIDELINES SLIDE-OVER DRAWER (UNSTOP IMAGE 4)         */}
      {/* ======================================================== */}
      {showGuidelinesDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">Guidelines</h3>
              <button
                type="button"
                onClick={() => setShowGuidelinesDrawer(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {/* Key Instructions Accordion */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenAccordion(openAccordion === 'key' ? '' : 'key')}
                  className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer"
                >
                  <span>Key Instructions</span>
                  {openAccordion === 'key' ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {openAccordion === 'key' && (
                  <div className="p-4 text-xs text-slate-600 space-y-2 border-t border-slate-200 leading-relaxed bg-white">
                    <ul className="list-disc list-inside space-y-1.5">
                      <li>You have to <strong>submit answers</strong> to questions individually. Otherwise your response will not be recorded.</li>
                      <li>While you are taking the assessment, your answers and timestamps are tracked question-wise.</li>
                      <li>You can review and modify your answers during the assessment before clicking Finish.</li>
                      <li>Any participant resorting to unfair practices (tab switching, window minimization) will be penalized.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Timelines & Questions Accordion */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenAccordion(openAccordion === 'timeline' ? '' : 'timeline')}
                  className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer"
                >
                  <span>Timelines &amp; Questions</span>
                  {openAccordion === 'timeline' ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {openAccordion === 'timeline' && (
                  <div className="p-4 text-xs text-slate-600 space-y-1.5 border-t border-slate-200 leading-relaxed bg-white">
                    <div><strong>Total Duration:</strong> {test.durationMinutes || 180} minutes</div>
                    <div><strong>Total Questions:</strong> {questions.length} questions</div>
                    <div><strong>Total Sections:</strong> {test.sections.length} sections</div>
                  </div>
                )}
              </div>

              {/* Marking Accordion */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenAccordion(openAccordion === 'marking' ? '' : 'marking')}
                  className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer"
                >
                  <span>Marking</span>
                  {openAccordion === 'marking' ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {openAccordion === 'marking' && (
                  <div className="p-4 text-xs text-slate-600 space-y-1.5 border-t border-slate-200 leading-relaxed bg-white">
                    <div><strong>Correct Answer:</strong> +{test.marksPerQuestion || 1} mark</div>
                    <div><strong>Negative Marking:</strong> -{test.negativeMarks || 0} marks for incorrect attempts</div>
                  </div>
                )}
              </div>

              {/* Proctoring Guidelines Accordion */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenAccordion(openAccordion === 'proctor' ? '' : 'proctor')}
                  className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer"
                >
                  <span>Proctoring Guidelines</span>
                  {openAccordion === 'proctor' ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {openAccordion === 'proctor' && (
                  <div className="p-4 text-xs text-slate-600 space-y-2 border-t border-slate-200 leading-relaxed bg-white">
                    <p>On-device MediaPipe AI vision monitoring is active to ensure academic integrity.</p>
                    <p>Strikes will be issued for: multiple faces detected, candidate face absent from camera frame, exiting fullscreen, or switching browser tabs.</p>
                    <div><strong>Maximum strikes allowed:</strong> {test.maxStrikes || 3} strikes.</div>
                  </div>
                )}
              </div>

              {/* Sections Guidelines Accordion */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenAccordion(openAccordion === 'sections' ? '' : 'sections')}
                  className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer"
                >
                  <span>Sections Guidelines</span>
                  {openAccordion === 'sections' ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {openAccordion === 'sections' && (
                  <div className="p-4 text-xs text-slate-600 space-y-2 border-t border-slate-200 leading-relaxed bg-white">
                    {test.sections.map((s, idx) => {
                      const count = questions.filter((q) => q.sectionId === s.id).length;
                      return (
                        <div key={s.id} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
                          <span>{idx + 1}. {s.name}</span>
                          <span className="font-semibold">{count} Questions</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen 4: Submit Test Confirmation Modal (Matching Image 4) */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="text-center">
              <div className="h-14 w-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Submit your test?
              </h2>
              <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto">
                Submission ends the attempt. You will not be able to return to the test or make any changes.
              </p>
            </div>

            {/* Test progress container (Matching Image 4) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Test progress</span>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>{formatClock(remainingSeconds)} remaining</span>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Total questions: <strong className="text-slate-800">{questions.length}</strong>
              </div>

              {/* 3 Status Boxes */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* Answered */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-800 block">Answered</span>
                    <span className="text-base font-bold text-emerald-900 tabular-nums">{answeredCount}</span>
                  </div>
                </div>

                {/* Unanswered */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <div className="h-3.5 w-3.5 border-2 border-blue-600 rounded-xs" />
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-800 block">Unanswered</span>
                    <span className="text-base font-bold text-blue-900 tabular-nums">{unansweredCount}</span>
                  </div>
                </div>

                {/* Marked for review */}
                <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-3 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Bookmark className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-purple-800 block">Marked for review</span>
                    <span className="text-base font-bold text-purple-900 tabular-nums">{markedCount}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Marked for review may include answered questions.</span>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors"
              >
                Return to test
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => finalizeAndExit(attemptRef.current, 'submitted')}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
              >
                {submitting ? 'Submitting…' : 'Confirm submission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proctoring Strike Modal */}
      {strikeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-rose-300 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-700">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h2 className="font-display text-lg font-bold">
                Proctoring Strike {strikeModal.count} of {test.maxStrikes || '∞'} Recorded
              </h2>
            </div>
            <p className="text-sm text-slate-700">
              Violation detected: <strong>{strikeModal.reason}</strong>.
            </p>
            <p className="text-xs text-slate-500">
              {test.maxStrikes > 0
                ? `${test.maxStrikes - strikeModal.count} more strike(s) will automatically submit your exam.`
                : 'This event has been logged to your proctoring history.'}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStrikeModal(null)}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
              >
                Acknowledge &amp; Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Exited Blocking Overlay */}
      {isFullscreenExited && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-amber-300 bg-white p-7 sm:p-9 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="h-16 w-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <Maximize className="h-8 w-8 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                Fullscreen Exited — Live Test Paused
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                You have left full-screen mode. To protect exam integrity and comply with proctoring rules, you must return to full-screen mode immediately to continue your test.
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 font-medium">
              ⚠️ Exiting fullscreen or minimizing windows logs a proctoring strike on your session.
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!document.fullscreenElement) {
                      await document.documentElement.requestFullscreen();
                    }
                    setIsFullscreenExited(false);
                  } catch {
                    setIsFullscreenExited(false);
                  }
                }}
                className="w-full rounded-xl bg-blue-600 py-3 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 shadow-sm cursor-pointer transition-colors"
              >
                Re-enter Fullscreen &amp; Resume Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Exam Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900">
              <XCircle className="h-6 w-6 text-red-600 shrink-0" />
              <h2 className="font-display text-lg font-bold">Cancel Examination?</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Are you sure you want to cancel and leave this exam? Your active exam session will be terminated and you will return to your dashboard.
            </p>
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                Keep Taking Test
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowCancelModal(false);
                  if (document.fullscreenElement) {
                    try {
                      await document.exitFullscreen();
                    } catch {}
                  }
                  onCancelExam?.();
                }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 cursor-pointer shadow-xs"
              >
                Yes, Cancel Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
