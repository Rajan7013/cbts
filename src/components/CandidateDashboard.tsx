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
    const userAttempt = attempts.find((a) => a.testId === t.testId);

    return {
      test: t,
      isLive,
      isUpcoming,
      isEnded,
      userAttempt,
    };
  });

  const availableCount = categorizedTests.filter((c) => c.isLive || c.userAttempt?.status === 'in_progress').length;
  const upcomingCount = categorizedTests.filter((c) => c.isUpcoming).length;
  const totalCount = tests.length;

  const filtered = categorizedTests.filter((c) => {
    const titleMatch = c.test.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!titleMatch) return false;

    if (filter === 'available') return c.isLive || c.userAttempt?.status === 'in_progress';
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
          filtered.map(({ test: t, isLive, isUpcoming, userAttempt }) => {
            const hasCompleted = userAttempt && userAttempt.status !== 'in_progress';

            return (
              <div
                key={t.testId}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
              >
                {/* Status Badge */}
                <div className="mb-3">
                  {isUpcoming ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-700">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      <span>Scheduled</span>
                    </span>
                  ) : isLive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live</span>
                    </span>
                  ) : hasCompleted ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-slate-600" />
                      <span>Completed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                      Ended
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
                    ) : hasCompleted ? (
                      <button
                        type="button"
                        onClick={() => onViewResult(t, userAttempt!)}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-6 py-2.5 text-xs sm:text-sm font-bold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>View Results</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartOrResumeTest(t, userAttempt)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>{userAttempt?.status === 'in_progress' ? 'Resume Test' : 'View test'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
