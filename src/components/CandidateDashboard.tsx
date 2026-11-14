import { useState, useMemo } from 'react';
import {
  ClipboardList,
  BarChart2,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  FileText,
  Info,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { DonutScoreGauge } from './DonutScoreGauge';
import { MathText } from './MathText';
import { QuestionImage } from './QuestionImage';
import type { TestAttempt, TestExam, TestQuestion, UserProfile } from '../types';

interface CandidateDashboardProps {
  user?: UserProfile;
  tests: TestExam[];
  attempts: TestAttempt[];
  loading: boolean;
  onStartOrResumeTest: (test: TestExam, existingAttempt?: TestAttempt) => void;
  onViewResult: (test: TestExam, attempt: TestAttempt, initialMode?: 'summary' | 'review') => void;
  onSwitchToAdmin?: () => void;
  initialTab?: 'available-tests' | 'my-results';
}

type TabType = 'available-tests' | 'my-results';
type StatusFilter = 'all' | 'passed' | 'failed' | 'pending';
type AvailableFilter = 'all' | 'available' | 'upcoming';

export function CandidateDashboard({
  user,
  tests,
  attempts,
  loading,
  onStartOrResumeTest,
  onViewResult,
  onSwitchToAdmin,
  initialTab = 'available-tests',
}: CandidateDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [availableFilter, setAvailableFilter] = useState<AvailableFilter>('all');

  const now = Date.now();
  const isAdmin = user?.role === 'admin';

  // Map tests with attempts
  const categorizedTests = useMemo(() => {
    return tests.map((t) => {
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
  }, [tests, attempts, now]);

  // All completed or submitted attempts for "My Results"
  const completedAttemptsList = useMemo(() => {
    const list: Array<{
      attempt: TestAttempt;
      test: TestExam;
      passed: boolean;
      percentage: number;
      isPending: boolean;
    }> = [];

    attempts.forEach((att) => {
      const test = tests.find((t) => t.testId === att.testId);
      if (!test) return;

      const pct =
        att.maxScore > 0 ? Math.max(0, Math.round((att.score / att.maxScore) * 100)) : 0;
      const pass = pct >= (test.passPercentage || 50);
      const isPending = att.status === 'in_progress' || (att.score === 0 && att.maxScore === 0);

      list.push({
        attempt: att,
        test,
        passed: pass,
        percentage: pct,
        isPending,
      });
    });

    // Sort newest first
    list.sort((a, b) => {
      const tsA = new Date(a.attempt.submittedAtIso || a.attempt.startedAtIso).getTime();
      const tsB = new Date(b.attempt.submittedAtIso || b.attempt.startedAtIso).getTime();
      return tsB - tsA;
    });

    return list;
  }, [attempts, tests]);

  // Filtered for "My Results" tab
  const filteredResults = useMemo(() => {
    return completedAttemptsList.filter((item) => {
      const matchText =
        item.test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.attempt.testTitle.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchText) return false;

      if (statusFilter === 'passed') return !item.isPending && item.passed;
      if (statusFilter === 'failed') return !item.isPending && !item.passed;
      if (statusFilter === 'pending') return item.isPending;
      return true;
    });
  }, [completedAttemptsList, searchQuery, statusFilter]);

  // Filtered for "Available Tests" tab
  const filteredAvailableTests = useMemo(() => {
    return categorizedTests.filter((c) => {
      const titleMatch = c.test.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!titleMatch) return false;

      if (availableFilter === 'available') {
        return (c.isLive && (!c.hasReachedMax || c.inProgressAttempt)) || c.inProgressAttempt;
      }
      if (availableFilter === 'upcoming') return c.isUpcoming;
      return true;
    });
  }, [categorizedTests, searchQuery, availableFilter]);

  const pageTitle = activeTab === 'my-results' ? 'My Results' : 'Available Tests';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#dce7f8] via-[#eef3fb] to-[#e4ecf9] p-3 sm:p-6 lg:p-8 flex flex-col font-sans select-none">
      {/* Top Bar matching Images 1, 2, 3, 4, 5 */}
      <div className="w-full max-w-7xl mx-auto flex items-center gap-2.5 pb-4 px-1 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
          EP
        </div>
        <span className="font-bold text-slate-900 text-sm">ExamPulse</span>
        <span className="text-slate-300">|</span>
        <span className="font-bold text-slate-800 text-sm">{pageTitle}</span>
      </div>

      {/* Main Container Card matching Images 1, 2, 3, 4, 5 */}
      <div className="w-full max-w-7xl mx-auto rounded-3xl border border-white/90 bg-white/80 shadow-xl shadow-blue-900/5 backdrop-blur-xl flex flex-col md:flex-row overflow-hidden min-h-[82vh] flex-1">
        {/* Left Sidebar matching Images 1, 2, 3, 4, 5 */}
        <aside className="w-full md:w-60 lg:w-64 border-b md:border-b-0 md:border-r border-slate-100 bg-white/60 p-4 sm:p-5 flex flex-col justify-between shrink-0">
          <nav className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('available-tests');
                setSearchQuery('');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'available-tests'
                  ? 'bg-blue-100/70 text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span>Available Tests</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('my-results');
                setSearchQuery('');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'my-results'
                  ? 'bg-blue-100/70 text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <BarChart2 className="h-4 w-4 shrink-0" />
              <span>My Results</span>
            </button>
          </nav>

          {/* Bottom Back to Admin Studio if Admin */}
          {isAdmin && onSwitchToAdmin && (
            <div className="pt-4 border-t border-slate-100 mt-auto">
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="w-full inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer p-2 rounded-xl hover:bg-white/70"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                <span>Back to Admin Studio</span>
              </button>
            </div>
          )}
        </aside>

        {/* Right Main Content Area */}
        <main className="flex-1 p-5 sm:p-7 lg:p-8 overflow-y-auto bg-white/40">
          {/* ======================================================== */}
          {/* TAB 1: AVAILABLE TESTS                                   */}
          {/* ======================================================== */}
          {activeTab === 'available-tests' && (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Available Tests
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  View and take your assigned tests, and check upcoming schedules.
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAvailableFilter('all')}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      availableFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    All ({tests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailableFilter('available')}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      availableFilter === 'available'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Live &amp; Available
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailableFilter('upcoming')}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      availableFilter === 'upcoming'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Upcoming
                  </button>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tests..."
                    className="w-full rounded-full border border-slate-200/90 bg-white pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 shadow-2xs transition-all"
                  />
                </div>
              </div>

              {/* Tests Grid / List */}
              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400">Loading tests…</div>
              ) : filteredAvailableTests.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
                  No tests found matching your search.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAvailableTests.map((item) => {
                    const t = item.test;
                    return (
                      <div
                        key={t.testId}
                        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-blue-200 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                                {t.title}
                              </h2>
                              {item.isLive && (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                  Live Now
                                </span>
                              )}
                              {item.isUpcoming && (
                                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                                  Upcoming
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <p className="text-xs text-slate-600 line-clamp-2 max-w-2xl">
                                {t.description}
                              </p>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0 pt-1">
                            {item.isUpcoming ? (
                              <button
                                type="button"
                                disabled
                                className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-500 cursor-not-allowed"
                              >
                                Upcoming
                              </button>
                            ) : item.inProgressAttempt ? (
                              <button
                                type="button"
                                onClick={() => onStartOrResumeTest(t, item.inProgressAttempt)}
                                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs cursor-pointer transition-colors"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Resume Attempt #{item.inProgressAttempt.attemptNumber || 1}</span>
                              </button>
                            ) : item.canAttemptAgain ? (
                              item.userAttempts.length === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => onStartOrResumeTest(t, undefined)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer transition-colors"
                                >
                                  <span>Start Test</span>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onStartOrResumeTest(t, undefined)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer transition-colors"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>Retake (Attempt #{item.userAttempts.length + 1})</span>
                                  </button>
                                  {item.latestAttempt && (
                                    <button
                                      type="button"
                                      onClick={() => onViewResult(t, item.latestAttempt!)}
                                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                                    >
                                      <span>View Result</span>
                                    </button>
                                  )}
                                </div>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => onViewResult(t, item.latestAttempt || item.userAttempts[0])}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors"
                              >
                                <span>View Result</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2 border-t border-slate-100 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span>{t.durationMins} minutes</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <HelpCircle className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span>{t.totalQuestions} Questions</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <RotateCcw className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span>
                              Attempts: {item.userAttempts.length} of {item.maxAttempts} used
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: MY RESULTS (Matches Images 1 & 5)                 */}
          {/* ======================================================== */}
          {activeTab === 'my-results' && (
            <div className="space-y-6">
              {/* Header matching Images 1 & 5 */}
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  My Results
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  View your submitted test results and check their status.
                </p>
              </div>

              {/* Search & Filter Bar matching Images 1 & 5 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search results..."
                    className="w-full rounded-2xl border border-slate-200/90 bg-white/90 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 shadow-2xs transition-all"
                  />
                </div>

                {/* Status Dropdown Filter */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-slate-600">Status:</span>
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                      className="appearance-none rounded-2xl border border-slate-200 bg-white pl-4 pr-9 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500 shadow-2xs cursor-pointer"
                    >
                      <option value="all">All results</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="pending">Results pending</option>
                    </select>
                    <Filter className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Results Cards List */}
              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400">Loading results…</div>
              ) : filteredResults.length === 0 ? (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center space-y-3">
                  <p className="text-xs text-slate-500">
                    No test results found. Take a test from Available Tests to see your results here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('available-tests')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    <span>← Back to assessments</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredResults.map(({ attempt: att, test: t, passed, percentage, isPending }) => {
                    const answered = (att.correctCount || 0) + (att.wrongCount || 0);
                    const totalQuestions = t.totalQuestions || att.maxScore / (t.marksPerQuestion || 4) || 10;
                    const unanswered = Math.max(0, totalQuestions - answered);

                    // VARIANT A: Results Pending (Image 1)
                    if (isPending) {
                      return (
                        <div
                          key={att.attemptId}
                          className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4"
                        >
                          {/* Title & Badges */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="font-display text-lg font-bold text-slate-900">
                              {t.title}
                            </h2>
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 px-3 py-0.5 text-xs font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                              <span>Submitted</span>
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 px-3 py-0.5 text-xs font-semibold">
                              <Clock className="h-3.5 w-3.5 text-purple-600" />
                              <span>Results pending</span>
                            </span>
                          </div>

                          {/* 3 Summary Boxes matching Image 1 */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Total questions */}
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                                <Check className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-500 block">Total questions</span>
                                <span className="font-display font-bold text-base text-slate-900">
                                  {totalQuestions}
                                </span>
                              </div>
                            </div>

                            {/* Answered */}
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                                <Check className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-500 block">Answered</span>
                                <span className="font-display font-bold text-base text-slate-900">
                                  {answered}
                                </span>
                              </div>
                            </div>

                            {/* Unanswered */}
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl border-2 border-slate-300 flex items-center justify-center shrink-0" />
                              <div>
                                <span className="text-[11px] text-slate-500 block">Unanswered</span>
                                <span className="font-display font-bold text-base text-slate-900">
                                  {unanswered}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Info notice */}
                          <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                            <Info className="h-4 w-4 text-blue-600 shrink-0" />
                            <span>Your result will appear here when it is available.</span>
                          </div>

                          {/* Disabled pending button */}
                          <button
                            type="button"
                            disabled
                            className="w-full rounded-2xl bg-slate-200/90 py-3 text-xs font-bold text-slate-500 cursor-not-allowed"
                          >
                            Results pending
                          </button>

                          {/* Back link */}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => setActiveTab('available-tests')}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                            >
                              <span>← Back to assessments</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // VARIANT B: Evaluated Result (Image 5)
                    return (
                      <div
                        key={att.attemptId}
                        className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4"
                      >
                        {/* Header: Title, Badges & Score Gauge */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <h2 className="font-display text-lg font-bold text-slate-900">
                              {t.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 px-3 py-0.5 text-xs font-semibold">
                                <Calendar className="h-3 w-3 text-blue-600" />
                                <span>Submitted</span>
                              </span>
                              {passed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-0.5 text-xs font-semibold">
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span>Passed</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 px-3 py-0.5 text-xs font-semibold">
                                  <X className="h-3 w-3 text-rose-600" />
                                  <span>Failed</span>
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400 font-medium ml-1">
                                Attempt #{att.attemptNumber || 1}
                              </span>
                            </div>
                          </div>

                          {/* Right Score Gauge matching Image 5 */}
                          <div className="flex items-center gap-3 self-start sm:self-center">
                            <div className="text-right">
                              <span className="text-[11px] font-semibold text-slate-500 block">Score</span>
                              <div className="font-display font-bold text-xl text-slate-900 leading-tight">
                                {att.score} / {att.maxScore}
                              </div>
                              <span className="text-xs font-semibold text-slate-500">
                                ({percentage}%)
                              </span>
                            </div>
                            <DonutScoreGauge percentage={percentage} size={70} strokeWidth={7} />
                          </div>
                        </div>

                        {/* Middle Stats Breakdown matching Image 5 */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-8 pt-3 border-t border-slate-100 text-xs font-semibold">
                          <div className="flex items-center gap-2 text-slate-700">
                            <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
                            <span>{totalQuestions} Questions</span>
                          </div>
                          <div className="flex items-center gap-2 text-emerald-800">
                            <div className="h-5 w-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <Check className="h-3 w-3" />
                            </div>
                            <span>{att.correctCount || 0} Correct</span>
                          </div>
                          <div className="flex items-center gap-2 text-purple-800">
                            <div className="h-5 w-5 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                              <X className="h-3 w-3" />
                            </div>
                            <span>{att.wrongCount || 0} Incorrect</span>
                          </div>
                          <div className="flex items-center gap-2 text-blue-700">
                            <div className="h-5 w-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                              <span className="text-xs leading-none font-bold">–</span>
                            </div>
                            <span>{unanswered} Unanswered</span>
                          </div>
                        </div>

                        {/* Bottom Actions matching Image 5 */}
                        <div className="flex items-center gap-4 pt-2">
                          <button
                            type="button"
                            onClick={() => onViewResult(t, att, 'summary')}
                            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer transition-colors"
                          >
                            <span>View result</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewResult(t, att, 'review')}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 cursor-pointer transition-colors"
                          >
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span>Review answers</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
