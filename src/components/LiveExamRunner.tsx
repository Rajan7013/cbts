import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
  CheckCircle2,
  HelpCircle,
  Info,
  Layers,
  Upload,
  X,
  ZoomIn,
  Maximize,
  XCircle,
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

  const [navigatorSectionId, setNavigatorSectionId] = useState<string>('all');
  const activeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeBtnRef.current) {
      activeBtnRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex]);

  const navigatorQuestions = useMemo(() => {
    if (navigatorSectionId === 'all') {
      return questions.map((q, idx) => ({ q, idx }));
    }
    return questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.sectionId === navigatorSectionId);
  }, [questions, navigatorSectionId]);

  // Counts
  const answeredCount = useMemo(
    () => Object.values(attempt.responses).filter((r) => Boolean(r.selectedOptionId)).length,
    [attempt.responses]
  );
  const markedCount = useMemo(
    () => Object.values(attempt.responses).filter((r) => Boolean(r.markedForReview)).length,
    [attempt.responses]
  );
  const unansweredCount = questions.length - answeredCount;

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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200/90 bg-white px-2.5 sm:px-6 py-2 sm:py-3 shadow-2xs">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-xs shrink-0 shadow-2xs">
            EP
          </div>
          <span className="hidden sm:inline font-bold text-sm sm:text-base text-slate-900 shrink-0">
            ExamPulse
          </span>
          <span className="hidden sm:inline text-slate-300 shrink-0">|</span>
          <h1
            title={test.title}
            className="font-semibold text-xs sm:text-sm md:text-base text-slate-900 truncate min-w-0"
          >
            {test.title}
          </h1>
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
            Attempt #{initialAttempt.attemptNumber || 1} of {test.maxAttempts || 1}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Timer Pill — Clear Label & Urgency Colors */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2 rounded-xl border px-2 sm:px-3.5 py-1 sm:py-1.5 shadow-2xs shrink-0 transition-colors ${
              isUrgent
                ? 'border-red-400 bg-red-50 text-red-900 shadow-xs ring-1 ring-red-400/50'
                : isWarning
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
            title="Time remaining for this assessment"
          >
            <Clock
              className={`h-3.5 sm:h-4 w-3.5 sm:w-4 shrink-0 ${
                isUrgent ? 'text-red-600 animate-pulse' : isWarning ? 'text-amber-600' : 'text-blue-600'
              }`}
            />
            <div className="text-right leading-tight">
              <span className="font-mono text-xs sm:text-sm font-bold tabular-nums block">
                {formatClock(remainingSeconds)}
              </span>
              <span
                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block ${
                  isUrgent ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-slate-400'
                }`}
              >
                {isUrgent ? 'Urgent' : 'Remaining'}
              </span>
            </div>
          </div>

          {/* Cancel Test Button */}
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-red-700 hover:bg-red-50 hover:border-red-200 shadow-2xs cursor-pointer transition-colors shrink-0"
            title="Cancel Examination"
          >
            <XCircle className="h-4 w-4 text-slate-400 hover:text-red-600" />
            <span className="hidden sm:inline">Cancel</span>
          </button>

          {/* Submit Test Button */}
          <button
            type="button"
            onClick={() => setShowSubmitConfirm(true)}
            className="inline-flex items-center gap-1 sm:gap-2 rounded-xl bg-blue-600 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer transition-colors shrink-0"
            title="Submit Assessment"
          >
            <Upload className="h-3.5 sm:h-4 w-3.5 sm:w-4 shrink-0" />
            <span className="hidden sm:inline">Submit Test</span>
            <span className="sm:hidden text-xs">Submit</span>
          </button>
        </div>
      </header>

      {/* Mobile Sticky Sub-Header: Question X of Y • Section Name • Persistent Time */}
      <div className="sm:hidden sticky top-[49px] z-20 flex items-center justify-between border-b border-slate-200 bg-slate-100/95 px-3 py-1.5 backdrop-blur-xs text-[11px] font-semibold text-slate-700 shadow-2xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-blue-700 font-bold shrink-0">
            Q{currentIndex + 1} of {questions.length}
          </span>
          <span className="text-slate-300 shrink-0">•</span>
          <span className="truncate max-w-[130px] text-slate-600">
            {activeSection?.name || 'General Section'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`font-mono font-bold ${
              isUrgent
                ? 'text-red-600 animate-pulse font-extrabold'
                : isWarning
                ? 'text-amber-700'
                : 'text-slate-800'
            }`}
          >
            ⏱ {formatClock(remainingSeconds)} left
          </span>
          <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.2 rounded-full text-slate-600 font-medium">
            Att. #{initialAttempt.attemptNumber || 1}
          </span>
        </div>
      </div>

      {/* Main Content Area: Left Question Area, Right Navigator */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 sm:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Question Area */}
          <div className="lg:col-span-8 flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
            {currentQuestion ? (
              <div className="p-5 sm:p-7 space-y-4">
                {/* Section Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    <h2 className="font-display text-base font-bold text-slate-900">
                      {activeSection?.name || 'General Section'}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                    +{currentQuestion.marks || test.marksPerQuestion || 1} / -{test.negativeMarks || 0} marks
                  </span>
                </div>

                {/* Subtitle spec */}
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Time continues during test</span>
                  </div>
                </div>

                {/* Question Stem */}
                <div className="pt-2 text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                  <MathText text={currentQuestion.questionText} />
                </div>

                {/* Question Diagram Image if present */}
                {(currentQuestion.questionImageUrl || currentQuestion.imageUrl) && (
                  <div className="my-2 p-2 rounded-xl border border-slate-200 bg-slate-50/50 max-w-lg">
                    <QuestionImage
                      src={currentQuestion.questionImageUrl || currentQuestion.imageUrl}
                      alt="Question diagram"
                    />
                  </div>
                )}

                {/* Radio Option Rows */}
                <div className="pt-3 space-y-2.5">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = currentResp?.selectedOptionId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(opt.id)}
                        className={`w-full text-left flex items-center gap-3.5 rounded-2xl border p-3.5 sm:p-4 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Radio Circle */}
                        <div
                          className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected ? (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 font-mono">{opt.id}</span>
                          )}
                        </div>

                        {/* Option Text */}
                        <div className="flex-1 text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
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
            ) : (
              <div className="p-8 text-center text-slate-400">No question selected</div>
            )}

            {/* Bottom Controls Bar (Positioned immediately below options, with sticky bottom on long viewports) */}
            <div className="border-t border-slate-100 bg-slate-50/85 backdrop-blur-md px-5 py-3.5 sm:px-7 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky bottom-0 z-10 shadow-2xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearResponse}
                  disabled={!currentResp?.selectedOptionId}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
                >
                  Clear response
                </button>
                <button
                  type="button"
                  onClick={handleToggleMark}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold cursor-pointer shadow-2xs transition-colors ${
                    currentResp?.markedForReview
                      ? 'border-purple-300 bg-purple-50 text-purple-700 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5 text-purple-600" />
                  <span>{currentResp?.markedForReview ? 'Marked for Review ✓' : 'Mark for review'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndNext}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer transition-colors"
                >
                  <span>Save &amp; Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  className="inline-flex sm:hidden items-center gap-1 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-black shadow-xs cursor-pointer transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Submit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Question Navigator & Legend */}
          <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* MediaPipe On-Device Face Proctoring Preview */}
            {test.proctoringAIEnabled && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                <MediaPipeProctor
                  active={!isLockedRef.current}
                  compact={true}
                  onMultipleFacesDetected={() => triggerStrike('Multiple Faces Detected by MediaPipe AI')}
                  onNoFaceDetected={() => triggerStrike('No Candidate Face Detected by MediaPipe AI')}
                />
              </div>
            )}

            {/* Question Navigator */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-slate-900">
                  Question navigator
                </h2>
                <span className="text-[11px] font-mono font-medium text-slate-500">
                  {answeredCount}/{questions.length} answered
                </span>
              </div>

              {/* Section Filter Pills if multiple sections */}
              {test.sections && test.sections.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-semibold scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setNavigatorSectionId('all')}
                    className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
                      navigatorSectionId === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({questions.length})
                  </button>
                  {test.sections.map((sec) => {
                    const secCount = questions.filter((q) => q.sectionId === sec.id).length;
                    if (secCount === 0) return null;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setNavigatorSectionId(sec.id)}
                        className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
                          navigatorSectionId === sec.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {sec.name.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '')} ({secCount})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Scrollable Grid 1..N with max height to avoid page stretching */}
              <div className="max-h-[300px] sm:max-h-[360px] overflow-y-auto pr-1 grid grid-cols-5 gap-2">
                {navigatorQuestions.map(({ q, idx }) => {
                  const resp = attempt.responses[q.questionId];
                  const isCurrent = idx === currentIndex;
                  const isAnswered = Boolean(resp?.selectedOptionId);
                  const isMarked = Boolean(resp?.markedForReview);

                  return (
                    <button
                      key={q.questionId}
                      ref={isCurrent ? activeBtnRef : undefined}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-10 rounded-xl font-mono text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300 ring-offset-1'
                          : isAnswered
                          ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : isMarked
                          ? 'border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="tabular-nums">{idx + 1}</span>
                      {isAnswered && !isCurrent && (
                        <Check className="h-2.5 w-2.5 text-emerald-600 -mt-0.5" />
                      )}
                      {isMarked && !isAnswered && !isCurrent && (
                        <Bookmark className="h-2.5 w-2.5 text-purple-600 -mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend (Compact 2x2 grid) */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-2.5">
              <h3 className="font-display text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Legend
              </h3>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-md bg-blue-600 shrink-0" />
                  <span className="truncate">Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-md border border-emerald-300 bg-emerald-50 flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 text-emerald-600" />
                  </div>
                  <span className="truncate">Answered ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-md border border-purple-300 bg-purple-50 flex items-center justify-center shrink-0">
                    <Bookmark className="h-2.5 w-2.5 text-purple-600" />
                  </div>
                  <span className="truncate">Flagged ({markedCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-md border border-slate-300 bg-white shrink-0" />
                  <span className="truncate">Unanswered ({unansweredCount})</span>
                </div>
              </div>
            </div>

            {/* Direct Submit Action Card */}
            <div className="rounded-2xl border border-blue-200/90 bg-blue-50/70 p-4 space-y-2 shadow-2xs">
              <div className="text-xs font-bold text-slate-800">
                Ready to Submit?
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {answeredCount} of {questions.length} answered ({unansweredCount} remaining).
              </p>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer transition-colors"
              >
                <Upload className="h-4 w-4" />
                <span>Submit Test Now</span>
              </button>
            </div>
          </div>
        </div>
      </main>
        </div>
      </main>

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
