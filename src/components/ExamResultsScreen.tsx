import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Sparkles,
  Languages,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { MathText } from './MathText';
import { askAiTutor, translateTextsWithAI } from '../lib/api';
import type { TestAttempt, TestExam, TestQuestion } from '../types';

interface ExamResultsScreenProps {
  test: TestExam;
  questions: TestQuestion[];
  attempt: TestAttempt;
  onBackToDashboard: () => void;
}

type ReviewFilter = 'all' | 'wrong' | 'marked';

const LANGUAGES = ['Hindi', 'Tamil', 'Bengali', 'Bahasa Indonesia', 'Japanese'];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function ExamResultsScreen({
  test,
  questions,
  attempt,
  onBackToDashboard,
}: ExamResultsScreenProps) {
  const [viewState, setViewState] = useState<'success_summary' | 'detailed_results'>('success_summary');
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [translatedByQ, setTranslatedByQ] = useState<
    Record<string, { lang: string; shortExplanation: string; steps: string[] }>
  >({});
  const [translatingQId, setTranslatingQId] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState('Hindi');

  // AI Tutor Drawer state
  const [tutorQuestion, setTutorQuestion] = useState<TestQuestion | null>(null);
  const [tutorHistory, setTutorHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>(
    []
  );
  const [tutorInput, setTutorInput] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);

  const percentage =
    attempt.maxScore > 0 ? Math.max(0, Math.round((attempt.score / attempt.maxScore) * 100)) : 0;
  const passed = percentage >= test.passPercentage;

  const sectionPerformance = test.sections.map((sec) => {
    const secQs = questions.filter((q) => q.sectionId === sec.id);
    const correct = secQs.filter(
      (q) => attempt.responses[q.questionId]?.selectedOptionId === q.correctOptionId
    ).length;
    const pct = secQs.length > 0 ? Math.round((correct / secQs.length) * 100) : 0;
    return { ...sec, total: secQs.length, correct, pct };
  });

  const filteredQuestions = questions.filter((q) => {
    const resp = attempt.responses[q.questionId];
    if (filter === 'wrong') {
      return Boolean(resp?.selectedOptionId) && resp?.selectedOptionId !== q.correctOptionId;
    }
    if (filter === 'marked') {
      return Boolean(resp?.markedForReview);
    }
    return true;
  });

  const handleTranslateSolution = async (q: TestQuestion) => {
    setTranslatingQId(q.questionId);
    try {
      const inputs = [q.shortExplanation || '', ...(q.stepByStepSolution || [])];
      const out = await translateTextsWithAI(inputs, targetLang);
      setTranslatedByQ((prev) => ({
        ...prev,
        [q.questionId]: {
          lang: targetLang,
          shortExplanation: out[0] || q.shortExplanation,
          steps: out.slice(1),
        },
      }));
      setExpandedSteps((prev) => ({ ...prev, [q.questionId]: true }));
    } catch {
      // Keep original text on failure
    } finally {
      setTranslatingQId(null);
    }
  };

  const openTutor = (q: TestQuestion) => {
    setTutorQuestion(q);
    const resp = attempt.responses[q.questionId];
    const introPrompt = resp?.selectedOptionId
      ? resp.selectedOptionId === q.correctOptionId
        ? `I answered ${resp.selectedOptionId} correctly, can you reinforce the key intuition?`
        : `I selected option ${resp.selectedOptionId}, but the correct answer is ${q.correctOptionId}. Explain why my choice is wrong and how to get it right.`
      : `I skipped this question. Walk me through how to approach and solve it.`;
    setTutorHistory([]);
    setTutorInput(introPrompt);
  };

  const sendTutorMessage = async (customText?: string) => {
    if (!tutorQuestion) return;
    const msg = (customText ?? tutorInput).trim();
    if (!msg) return;

    setTutorInput('');
    const nextHistory = [...tutorHistory, { role: 'user' as const, text: msg }];
    setTutorHistory(nextHistory);
    setTutorLoading(true);
    try {
      const resp = attempt.responses[tutorQuestion.questionId];
      const reply = await askAiTutor({
        attemptStatus: attempt.status,
        questionText: tutorQuestion.questionText,
        options: tutorQuestion.options,
        correctOptionId: tutorQuestion.correctOptionId,
        selectedOptionId: resp?.selectedOptionId ?? null,
        shortExplanation: tutorQuestion.shortExplanation,
        stepByStepSolution: tutorQuestion.stepByStepSolution,
        history: tutorHistory,
        message: msg,
      });
      setTutorHistory([...nextHistory, { role: 'model', text: reply }]);
    } catch (err) {
      setTutorHistory([
        ...nextHistory,
        {
          role: 'model',
          text:
            err instanceof Error
              ? `Unable to reach Gemini Tutor: ${err.message}`
              : 'Unable to reach Gemini Tutor right now.',
        },
      ]);
    } finally {
      setTutorLoading(false);
    }
  };

  const answeredCount = Object.values(attempt.responses).filter((r) => Boolean(r.selectedOptionId)).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const markedCount = Object.values(attempt.responses).filter((r) => Boolean(r.markedForReview)).length;

  const formatRemainingClock = (s: number) => {
    const sec = Math.max(0, Math.floor(s));
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };

  // Screen 5: Test Submitted Successfully Hero View (Matching Image 5)
  if (viewState === 'success_summary') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200/90 bg-white p-7 sm:p-9 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Green Checkmark Circle */}
          <div className="text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <Check className="h-9 w-9 stroke-[3]" />
            </div>

            <h1 className="font-display text-2xl font-bold text-slate-900">
              Test submitted successfully
            </h1>

            <div className="inline-block">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-bold text-blue-700">
                {test.title}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-500">
              Your responses have been submitted.
            </p>
          </div>

          {/* Attempt summary container (Matching Image 5) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Attempt summary</span>
              <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>Time remaining at submission {formatRemainingClock(attempt.remainingSeconds || 272)}</span>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Total questions: <strong className="text-slate-800 font-bold">{questions.length}</strong>
            </div>

            {/* 3 Status Boxes */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Answered */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-800 block font-medium">Answered</span>
                  <span className="text-base font-bold text-emerald-900 tabular-nums">{answeredCount}</span>
                </div>
              </div>

              {/* Unanswered */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <div className="h-3.5 w-3.5 border-2 border-blue-600 rounded-xs" />
                </div>
                <div>
                  <span className="text-[10px] text-blue-800 block font-medium">Unanswered</span>
                  <span className="text-base font-bold text-blue-900 tabular-nums">{unansweredCount}</span>
                </div>
              </div>

              {/* Marked for review */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-3 flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <span className="text-[10px] text-purple-800 block font-medium">Marked for review</span>
                  <span className="text-base font-bold text-purple-900 tabular-nums">{markedCount}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
              <span className="text-blue-600 font-bold">ℹ</span>
              <span>Results will be available according to the test's result settings.</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer transition-colors"
            >
              Back to assessments
            </button>

            <button
              type="button"
              onClick={() => setViewState('detailed_results')}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer transition-colors"
            >
              View my results
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <button
        type="button"
        onClick={onBackToDashboard}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Candidate Portal</span>
      </button>

      {/* Score Hero Card */}
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {attempt.status === 'auto_submitted_strike' ? (
                <span className="inline-flex items-center gap-1.5 text-red-700">
                  <ShieldAlert className="h-4 w-4" /> Auto-Submitted ({attempt.strikeCount} Strikes)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Submitted Normally
                </span>
              )}
              <span className="text-slate-400">·</span>
              <span className={passed ? 'text-emerald-700' : 'text-amber-700'}>
                {passed ? 'Passed Threshold' : `Below ${test.passPercentage}% Threshold`}
              </span>
            </div>
            <h1 className="mt-2 font-display text-xl sm:text-2xl font-bold text-slate-900">{test.title}</h1>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="text-xs text-slate-500">Final Score</div>
            <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              {attempt.score} / {attempt.maxScore}{' '}
              <span className="text-base sm:text-lg text-blue-700">({percentage}%)</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-5">
          <div>
            <div className="text-xs text-slate-500">Correct</div>
            <div className="mt-1 font-mono text-xl font-semibold text-emerald-700 tabular-nums">
              {attempt.correctCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Wrong</div>
            <div className="mt-1 font-mono text-xl font-semibold text-red-700 tabular-nums">
              {attempt.wrongCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Unattempted</div>
            <div className="mt-1 font-mono text-xl font-semibold text-slate-600 tabular-nums">
              {attempt.unattemptedCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Time Taken</div>
            <div className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {formatDuration(attempt.timeTakenSeconds)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Strikes Logged</div>
            <div className="mt-1 font-mono text-xl font-semibold text-amber-700 tabular-nums">
              {attempt.strikeCount} / {test.maxStrikes || '∞'}
            </div>
          </div>
        </div>

        {/* Section-Wise Performance Bars */}
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="font-display text-sm font-semibold text-slate-900 mb-4">
            Section-Wise Performance
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {sectionPerformance.map((sec) => (
              <div key={sec.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>{sec.name}</span>
                  <span className="font-mono tabular-nums">
                    {sec.correct}/{sec.total} ({sec.pct}%)
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-700 transition-all"
                    style={{ width: `${sec.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Question Review Header */}
      <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1">
          {(
            [
              { id: 'all', label: `All (${questions.length})` },
              { id: 'wrong', label: `Wrong (${attempt.wrongCount})` },
              { id: 'marked', label: 'Marked' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex-1 sm:flex-initial rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Languages className="h-4 w-4 text-slate-500 shrink-0" />
          <span className="text-slate-600">Translate Solutions:</span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Detailed Solutions List */}
      <div className="mt-5 space-y-5">
        {filteredQuestions.map((q, idx) => {
          const resp = attempt.responses[q.questionId];
          const chosen = resp?.selectedOptionId;
          const isCorrect = chosen === q.correctOptionId;
          const isStepsOpen = Boolean(expandedSteps[q.questionId]);
          const translated = translatedByQ[q.questionId];
          const displayShort = translated?.shortExplanation || q.shortExplanation;
          const displaySteps = translated?.steps || q.stepByStepSolution;

          return (
            <article
              key={q.questionId}
              className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold">
                  <span className="text-slate-500">Q{idx + 1}</span>
                  <span>·</span>
                  {!chosen ? (
                    <span className="text-slate-500">Unattempted</span>
                  ) : isCorrect ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Correct (+{q.marks})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-700">
                      <XCircle className="h-3.5 w-3.5" /> Incorrect (Selected {chosen})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={translatingQId === q.questionId}
                    onClick={() => handleTranslateSolution(q)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    {translatingQId === q.questionId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Languages className="h-3.5 w-3.5 text-blue-700" />
                    )}
                    <span>
                      {translated ? `Translated (${translated.lang})` : `Translate (${targetLang})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openTutor(q)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Ask AI Tutor</span>
                  </button>
                </div>
              </div>

              <MathText
                text={q.questionText}
                className="text-[15px] leading-[1.7] text-slate-900"
              />

              {q.questionImageUrl && (
                <div className="my-2">
                  <img
                    src={q.questionImageUrl}
                    alt="Question reference diagram"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // If image failed to load, hide broken image icon cleanly
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                    className="max-h-56 rounded-lg border border-slate-200 object-contain bg-white p-1 shadow-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {q.options.map((opt) => {
                  const isCorrectOpt = opt.id === q.correctOptionId;
                  const isUserOpt = opt.id === chosen;
                  let optStyle = 'border-slate-200 bg-white text-slate-700';
                  if (isCorrectOpt) {
                    optStyle = 'border-emerald-300 bg-emerald-50 text-emerald-950 font-semibold';
                  } else if (isUserOpt && !isCorrectOpt) {
                    optStyle = 'border-red-300 bg-red-50 text-red-950';
                  }
                  return (
                    <div key={opt.id} className={`rounded-lg border p-3.5 text-xs leading-relaxed ${optStyle}`}>
                      <div className="flex items-start gap-2">
                        <span className="font-mono font-bold shrink-0">{opt.id})</span>
                        <MathText text={opt.text} inline className="min-w-0" />
                      </div>
                      {opt.imageUrl && (
                        <img
                          src={opt.imageUrl}
                          alt={`Option ${opt.id}`}
                          referrerPolicy="no-referrer"
                          className="mt-2 max-h-24 rounded border border-slate-200 bg-white object-contain"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Short Explanation */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                <span className="font-semibold text-slate-900">Short Explanation: </span>
                {displayShort ? (
                  <MathText text={displayShort} inline />
                ) : (
                  'No short explanation provided.'
                )}
              </div>

              {/* Step-by-Step Solution */}
              {displaySteps.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSteps((prev) => ({
                        ...prev,
                        [q.questionId]: !isStepsOpen,
                      }))
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    {isStepsOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isStepsOpen
                        ? 'Hide Step-by-Step Solution'
                        : `View Step-by-Step Solution (${displaySteps.length} steps)`}
                    </span>
                  </button>

                  {isStepsOpen && (
                    <ol className="mt-3 space-y-2.5 rounded-lg border border-blue-100 bg-blue-50/40 p-4 text-xs leading-relaxed text-slate-800 list-decimal pl-7">
                      {displaySteps.map((step, sIdx) => (
                        <li key={sIdx}>
                          <MathText text={step} inline />
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Gemini AI Tutor Drawer */}
      {tutorQuestion && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50">
          <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-700" />
                <h2 className="font-display text-sm font-bold text-slate-900">
                  Gemini AI Doubt Tutor
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTutorQuestion(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900 line-clamp-2">
                <MathText text={tutorQuestion.questionText} inline />
              </div>
              <div className="mt-1 font-mono text-slate-500">
                Correct: {tutorQuestion.correctOptionId} · Your Choice:{' '}
                {attempt.responses[tutorQuestion.questionId]?.selectedOptionId || 'Skipped'}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {tutorHistory.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
                  Ask why your chosen option was incorrect, request a simpler analogy, or ask about
                  any step in the solution.
                </div>
              )}
              {tutorHistory.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-8 bg-blue-700 text-white whitespace-pre-wrap'
                      : 'mr-6 border border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  {m.role === 'user' ? m.text : <MathText text={m.text} />}
                </div>
              ))}
              {tutorLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" />
                  <span>Gemini Tutor is thinking…</span>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendTutorMessage();
              }}
              className="border-t border-slate-200 p-4 flex items-center gap-2"
            >
              <input
                type="text"
                value={tutorInput}
                onChange={(e) => setTutorInput(e.target.value)}
                placeholder="Ask a doubt about this question..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={tutorLoading || !tutorInput.trim()}
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 p-2 text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
