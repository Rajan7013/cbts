import { useState } from 'react';
import {
  Calendar,
  Clock,
  ListOrdered,
  Search,
  ArrowRight,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import type { TestAttempt, TestExam } from '../types';

interface CandidateDashboardProps {
  tests: TestExam[];
  attempts: TestAttempt[];
  loading: boolean;
  onStartOrResumeTest: (test: TestExam, existingAttempt?: TestAttempt) => void;
  onViewResult: (test: TestExam, attempt: TestAttempt) => void;
}

type FilterTab = 'all' | 'available' | 'upcoming';

function formatDisplayDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function formatOpensAtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())} ${months[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

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
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const now = Date.now();

  const inProgressAttempt = attempts.find((a) => a.status === 'in_progress');
  const inProgressTest = inProgressAttempt
    ? tests.find((t) => t.testId === inProgressAttempt.testId)
    : undefined;

  // Categorize tests into available (live), upcoming (scheduled), or completed
  const categorizedTests = tests.map((t) => {
    const start = new Date(t.startTime).getTime();
    const end = new Date(t.endTime).getTime();
    const isLive = now >= start && now <= end;
    const isUpcoming = now < start;
    const isEnded = now > end;

    const userAttempts = attempts.filter((a) => a.testId === t.testId);
    userAttempts.sort((a, b) => (a.attemptNumber || 1) - (b.attemptNumber || 1));
    const inProgressAttempt = userAttempts.find((a) => a.status === 'in_progress');
    const completedAttempts = userAttempts.filter((a) => a.status !== 'in_progress');
    const latestAttempt = userAttempts[userAttempts.length - 1];
    const maxAttempts = Math.max(1, t.maxAttempts || 1);
    const attemptsRemaining = Math.max(0, maxAttempts - userAttempts.length);
    const canAttemptAgain = attemptsRemaining > 0 && !inProgressAttempt && isLive;
    const hasReachedMax = userAttempts.length >= maxAttempts && !inProgressAttempt;

    return {
      test: t,
      isLive,
      isUpcoming,
      isEnded,
      userAttempts,
      inProgressAttempt,
      completedAttempts,
      latestAttempt,
      maxAttempts,
      attemptsRemaining,
      canAttemptAgain,
      hasReachedMax,
    };
  });

  const availableCount = categorizedTests.filter(
    (c) => (c.isLive && (!c.hasReachedMax || c.inProgressAttempt)) || c.inProgressAttempt
  ).length;
  const upcomingCount = categorizedTests.filter((c) => c.isUpcoming).length;
  const totalCount = tests.length;

  const filtered = categorizedTests.filter((c) => {
    const titleMatch = c.test.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!titleMatch) return false;

    if (filter === 'available') {
      return (c.isLive && (!c.hasReachedMax || c.inProgressAttempt)) || c.inProgressAttempt;
    }
    if (filter === 'upcoming') return c.isUpcoming;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Your assessments
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          View and take your assigned tests, and check your past results.
        </p>
      </div>

      {/* Filter Pills and Search Input (Matching Image 2) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-full px-5 py-2 text-xs font-bold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            All ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('available')}
            className={`rounded-full px-5 py-2 text-xs font-bold transition-all cursor-pointer ${
              filter === 'available'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Available ({availableCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('upcoming')}
            className={`rounded-full px-5 py-2 text-xs font-bold transition-all cursor-pointer ${
              filter === 'upcoming'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Upcoming ({upcomingCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tests by name"
            className="w-full rounded-full border border-slate-200/90 bg-white pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 shadow-2xs transition-all"
          />
        </div>
      </div>

      {/* Active Interrupted In-Progress Test Banner if present */}
      {inProgressAttempt && inProgressTest && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-xs">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
              <Clock className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Interrupted Exam Session Detected — Progress Saved</span>
            </div>
            <h2 className="mt-1 font-display text-base sm:text-lg font-bold text-slate-900">
              {inProgressTest.title}
            </h2>
            <p className="mt-1 text-xs text-slate-700 tabular-nums">
              Remaining: {formatRemaining(inProgressAttempt.remainingSeconds)} · Questions: {inProgressTest.totalQuestions}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onStartOrResumeTest(inProgressTest, inProgressAttempt)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 shadow-xs cursor-pointer transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Resume Attempt</span>
          </button>
        </div>
      )}

      {/* Test Cards List (Matching Image 2) */}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
            Loading assessments...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No assessments found</p>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery ? 'Try clearing your search query.' : 'There are currently no assessments matching this filter.'}
            </p>
          </div>
        ) : (
          filtered.map(
            ({
              test: t,
              isLive,
              isUpcoming,
              isEnded,
              userAttempts,
              inProgressAttempt,
              completedAttempts,
              latestAttempt,
              maxAttempts,
              attemptsRemaining,
              canAttemptAgain,
              hasReachedMax,
            }) => {
              return (
                <div
                  key={t.testId}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  {/* Status Badge */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {isUpcoming ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-700">
                        <Calendar className="h-3.5 w-3.5 text-blue-600" />
                        <span>Scheduled</span>
                      </span>
                    ) : inProgressAttempt ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>In Progress (Attempt #{inProgressAttempt.attemptNumber || 1})</span>
                      </span>
                    ) : isLive ? (
                      canAttemptAgain && userAttempts.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Live · {attemptsRemaining} More Attempt{attemptsRemaining > 1 ? 's' : ''} Allowed</span>
                        </span>
                      ) : hasReachedMax ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Completed ({completedAttempts.length}/{maxAttempts} Attempts)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Live</span>
                        </span>
                      )
                    ) : userAttempts.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-slate-600" />
                        <span>Completed ({completedAttempts.length} Attempt{completedAttempts.length > 1 ? 's' : ''})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                        Ended
                      </span>
                    )}

                    {maxAttempts > 1 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/60 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                        <RotateCcw className="h-3 w-3 text-blue-500" />
                        <span>Max {maxAttempts} Attempts</span>
                      </span>
                    )}
                  </div>

                  {/* Card Main: Title & Details & Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-3">
                      <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                        {t.title}
                      </h2>

                      {/* Metadata Items */}
                      <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700">
                        {isUpcoming ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                              <div>
                                <span className="text-slate-400 block text-[10px]">Start</span>
                                <span className="font-semibold text-slate-800">{formatDisplayDate(t.startTime)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                              <div>
                                <span className="text-slate-400 block text-[10px]">End</span>
                                <span className="font-semibold text-slate-800">{formatDisplayDate(t.endTime)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                              <div>
                                <span className="text-slate-400 block text-[10px]">Duration</span>
                                <span className="font-semibold text-slate-800">{t.durationMins} minutes</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <ListOrdered className="h-4 w-4 text-blue-600 shrink-0" />
                              <div>
                                <span className="text-slate-400 block text-[10px]">Questions</span>
                                <span className="font-semibold text-slate-800">{t.totalQuestions}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <ListOrdered className="h-4 w-4 text-blue-600 shrink-0" />
                              <div>
                                <span className="text-slate-400 block text-[10px]">Questions</span>
                                <span className="font-semibold text-slate-800">{t.totalQuestions}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                              <div>
                                <span className="text-slate-400 block text-[10px]">Duration</span>
                                <span className="font-semibold text-slate-800">{t.durationMins} minutes</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <RotateCcw className="h-4 w-4 text-blue-600 shrink-0" />
                              <div>
                                <span className="text-slate-400 block text-[10px]">Attempts Allowed</span>
                                <span className="font-semibold text-slate-800">
                                  {userAttempts.length} of {maxAttempts} used
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right Button */}
                    <div className="shrink-0 pt-2 sm:pt-0">
                      {isUpcoming ? (
                        <button
                          type="button"
                          disabled
                          className="rounded-xl border border-slate-200 bg-slate-100/90 px-6 py-2.5 text-xs sm:text-sm font-semibold text-slate-500 cursor-not-allowed whitespace-nowrap"
                        >
                          Opens at {formatOpensAtDate(t.startTime)}
                        </button>
                      ) : inProgressAttempt ? (
                        <button
                          type="button"
                          onClick={() => onStartOrResumeTest(t, inProgressAttempt)}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-amber-700 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>Resume Attempt #{inProgressAttempt.attemptNumber || 1}</span>
                        </button>
                      ) : canAttemptAgain ? (
                        userAttempts.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => onStartOrResumeTest(t, undefined)}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <span>Start Test</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onStartOrResumeTest(t, undefined)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>Retake (Attempt #{userAttempts.length + 1} of {maxAttempts})</span>
                            </button>
                            {latestAttempt && (
                              <button
                                type="button"
                                onClick={() => onViewResult(t, latestAttempt)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <span>View Results</span>
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => onViewResult(t, latestAttempt || userAttempts[0])}
                          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-6 py-2.5 text-xs sm:text-sm font-bold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>View Results</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* All Attempts History Drawer / Card List */}
                  {userAttempts.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                          <span>Your Attempts History ({userAttempts.length} of {maxAttempts} taken)</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Select any attempt to inspect question-by-question review &amp; solutions
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {userAttempts.map((att) => {
                          const isCompleted = att.status !== 'in_progress';
                          const pct = att.maxScore > 0 ? (att.score / att.maxScore) * 100 : att.accuracy;
                          const isPass = pct >= (t.passPercentage || 50);

                          return (
                            <div
                              key={att.attemptId}
                              className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 hover:bg-blue-50/40 hover:border-blue-200 transition-all"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-slate-900">
                                    Attempt #{att.attemptNumber || 1}
                                  </span>
                                  {isCompleted ? (
                                    <span
                                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                        isPass
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {isPass ? 'Passed' : 'Failed'}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                      In Progress
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-600 tabular-nums">
                                  {isCompleted ? (
                                    <span>
                                      Score: <strong>{att.score}/{att.maxScore}</strong> ({pct.toFixed(0)}%)
                                    </span>
                                  ) : (
                                    <span>Remaining: {formatRemaining(att.remainingSeconds)}</span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  isCompleted ? onViewResult(t, att) : onStartOrResumeTest(t, att)
                                }
                                className="shrink-0 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 cursor-pointer"
                              >
                                {isCompleted ? 'View ->' : 'Resume ->'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          )
        )}
      </div>
    </div>
  );
}
