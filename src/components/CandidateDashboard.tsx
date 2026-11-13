import { useState } from 'react';
import { Play, RotateCcw, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import type { TestAttempt, TestExam } from '../types';

interface CandidateDashboardProps {
  tests: TestExam[];
  attempts: TestAttempt[];
  loading: boolean;
  onStartOrResumeTest: (test: TestExam, existingAttempt?: TestAttempt) => void;
  onViewResult: (test: TestExam, attempt: TestAttempt) => void;
}

type FilterTab = 'live' | 'upcoming' | 'completed';

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CandidateDashboard({
  tests,
  attempts,
  loading,
  onStartOrResumeTest,
  onViewResult,
}: CandidateDashboardProps) {
  const [filter, setFilter] = useState<FilterTab>('live');

  const inProgressAttempt = attempts.find((a) => a.status === 'in_progress');
  const inProgressTest = inProgressAttempt
    ? tests.find((t) => t.testId === inProgressAttempt.testId)
    : undefined;

  const now = Date.now();

  const filteredTests = tests.filter((t) => {
    const start = new Date(t.startTime).getTime();
    const end = new Date(t.endTime).getTime();
    const completedAtt = attempts.find(
      (a) => a.testId === t.testId && a.status !== 'in_progress'
    );

    if (filter === 'completed') return Boolean(completedAtt) || now > end;
    if (filter === 'upcoming') return now < start;
    return now >= start && now <= end;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Candidate Assessment Portal
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Launch proctored fullscreen exams, resume interrupted sessions, and inspect AI solutions.
          </p>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-1 rounded-lg bg-slate-200/70 p-1">
          {(
            [
              { id: 'live', label: 'Live Now' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'completed', label: 'Completed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex-1 sm:flex-initial rounded-md px-3 sm:px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prominent Resume In-Progress Test Banner */}
      {inProgressAttempt && inProgressTest && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Interrupted Exam Detected — Progress Saved</span>
            </div>
            <h2 className="mt-1 font-display text-base sm:text-lg font-bold text-slate-900">
              {inProgressTest.title}
            </h2>
            <p className="mt-1 text-xs text-slate-700 font-mono tabular-nums">
              Remaining Time: {formatRemaining(inProgressAttempt.remainingSeconds)} · Strikes:{' '}
              {inProgressAttempt.strikeCount} / {inProgressTest.maxStrikes || '∞'} · Answered:{' '}
              {
                Object.values(inProgressAttempt.responses).filter((r) => Boolean(r.selectedOptionId))
                  .length
              }
            </p>
          </div>

          <button
            type="button"
            onClick={() => onStartOrResumeTest(inProgressTest, inProgressAttempt)}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Resume Test</span>
          </button>
        </div>
      )}

      {/* Tests Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No tests found under <strong>{filter}</strong> right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {filteredTests.map((test) => {
              const userAttemptsForTest = attempts.filter((a) => a.testId === test.testId);
              const activeAttempt = userAttemptsForTest.find((a) => a.status === 'in_progress');
              const finishedAttempt = userAttemptsForTest.find(
                (a) => a.status !== 'in_progress'
              );
              const isUpcoming = now < new Date(test.startTime).getTime();
              const isEnded = now > new Date(test.endTime).getTime();

              return (
                <article
                  key={test.testId}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
                >
                  <div>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      <span>{test.durationMins} min</span>
                      <span aria-hidden="true"> · </span>
                      <span>{test.totalQuestions} questions</span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        +{test.marksPerQuestion ?? 4}
                        {test.negativeMarking ? ` / -${test.negativeMarkValue}` : ''} marks
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        {test.maxStrikes === 0
                          ? 'No strike limit'
                          : `Max ${test.maxStrikes} strikes`}
                      </span>
                      {test.proctoringAIEnabled && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="text-blue-700 font-medium">MediaPipe AI Proctor</span>
                        </>
                      )}
                    </div>

                    <h2 className="mt-2 font-display text-base sm:text-lg font-bold text-slate-900">
                      {test.title}
                    </h2>
                    <p className="mt-1.5 text-xs sm:text-sm text-slate-600 line-clamp-2">
                      {test.description || 'Timed sectioned assessment with instant solution review.'}
                    </p>

                    <div className="mt-4 text-xs text-slate-500">
                      Sections: {test.sections.map((s) => `${s.name} (${s.questionCount})`).join(' · ')}
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="text-xs text-slate-500">
                      {isUpcoming ? (
                        <span>Starts {new Date(test.startTime).toLocaleString()}</span>
                      ) : isEnded ? (
                        <span>Window closed</span>
                      ) : (
                        <span>Ends {new Date(test.endTime).toLocaleDateString()}</span>
                      )}
                    </div>

                    {activeAttempt ? (
                      <button
                        type="button"
                        onClick={() => onStartOrResumeTest(test, activeAttempt)}
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-amber-800 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Resume Test</span>
                      </button>
                    ) : finishedAttempt ? (
                      <button
                        type="button"
                        onClick={() => onViewResult(test, finishedAttempt)}
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {finishedAttempt.status === 'auto_submitted_strike' ? (
                          <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                        )}
                        <span>View Result &amp; Solutions</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isUpcoming || isEnded}
                        onClick={() => onStartOrResumeTest(test)}
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>{isUpcoming ? 'Not Started' : isEnded ? 'Closed' : 'Start Test'}</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
