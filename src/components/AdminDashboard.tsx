import { useState } from 'react';
import {
  Plus,
  Settings,
  FileQuestion,
  BarChart3,
  Trash2,
  Globe,
  Lock,
  Database,
  Eye,
  Search,
  Calendar,
  Clock,
  Layers,
  Play,
  SquarePen,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { TestExam } from '../types';

interface AdminDashboardProps {
  tests: TestExam[];
  loading: boolean;
  onCreateNew: () => void;
  onSeedSample: () => void;
  onEditSettings: (test: TestExam) => void;
  onManageQuestions: (test: TestExam) => void;
  onPreviewQuestions: (test: TestExam) => void;
  onViewResults: (test: TestExam) => void;
  onTogglePublish: (test: TestExam) => void;
  onDeleteTest: (test: TestExam) => void;
}

function getScheduleLabel(test: TestExam): string {
  const now = Date.now();
  const start = new Date(test.startTime).getTime();
  const end = new Date(test.endTime).getTime();
  if (test.status === 'draft') return 'Draft';
  if (now < start) return 'Scheduled';
  if (now > end) return 'Ended';
  return 'Live Window';
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function AdminDashboard({
  tests,
  loading,
  onCreateNew,
  onSeedSample,
  onEditSettings,
  onManageQuestions,
  onPreviewQuestions,
  onViewResults,
  onTogglePublish,
  onDeleteTest,
}: AdminDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const liveCount = tests.filter((t) => getScheduleLabel(t) === 'Live Window').length;
  const draftCount = tests.filter((t) => t.status === 'draft').length;
  const totalQConfigured = tests.reduce((acc, t) => acc + t.totalQuestions, 0);

  // Filter tests based on search query and status filter
  const filteredTests = tests.filter((t) => {
    const sched = getScheduleLabel(t);
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sections.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'live') return sched === 'Live Window';
    if (statusFilter === 'scheduled') return sched === 'Scheduled';
    if (statusFilter === 'draft') return sched === 'Draft';
    if (statusFilter === 'ended') return sched === 'Ended';
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Assessment Studio
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Create, configure, and administer assessments for your candidates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {tests.length === 0 && (
            <button
              type="button"
              onClick={onSeedSample}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              <Database className="h-4 w-4 text-slate-500" />
              <span>Load Samples</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Test</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Tests */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Tests</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {tests.length}
            </div>
          </div>
        </div>

        {/* Card 2: Active Live Windows */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Play className="h-5 w-5 fill-emerald-600/20" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Active Live Windows</div>
            <div className="text-2xl font-bold text-emerald-600 tabular-nums mt-0.5">
              {liveCount}
            </div>
          </div>
        </div>

        {/* Card 3: Draft Assessments */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <SquarePen className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Draft Assessments</div>
            <div className="text-2xl font-bold text-amber-600 tabular-nums mt-0.5">
              {draftCount}
            </div>
          </div>
        </div>

        {/* Card 4: Configured Question Slots */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Configured Question Slots</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {totalQConfigured}
            </div>
          </div>
        </div>
      </div>

      {/* Main Container: All assessments */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-5">
        {/* Title & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
            All assessments
          </h2>

          {/* Desktop View Switcher */}
          <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table view"
            >
              <List className="h-4 w-4" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Cards grid view"
            >
              <LayoutGrid className="h-4 w-4" />
              <span>Cards</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assessments by title or section..."
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="live">Live</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
              <option value="ended">Ended</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="mt-2 text-xs">Loading assessments from Firestore…</p>
          </div>
        ) : filteredTests.length === 0 ? (
          /* Empty State */
          <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
            <Layers className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No assessments found</p>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Click "Create New Test" above to configure your first assessment.'}
            </p>
          </div>
        ) : (
          <>
            {/* View 1: Desktop Table View (Matches Image 1) */}
            <div className={`${viewMode === 'table' ? 'hidden md:block' : 'hidden'} overflow-x-auto`}>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-600 font-semibold">
                    <th className="py-3 px-3">Test Title</th>
                    <th className="py-3 px-3">Start Date</th>
                    <th className="py-3 px-3">End Date</th>
                    <th className="py-3 px-3">Duration</th>
                    <th className="py-3 px-3">Questions</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTests.map((test) => {
                    const sched = getScheduleLabel(test);
                    return (
                      <tr key={test.testId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-3 min-w-[200px]">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            {test.title}
                          </div>
                          {test.sections.length > 0 && (
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                              {test.sections.map((s) => `${s.name} (${s.questionCount})`).join(' · ')}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{formatDate(test.startTime)}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{formatDate(test.endTime)}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{test.durationMins} min</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{test.totalQuestions} Qs</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {sched === 'Live Window' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              Live
                            </span>
                          ) : sched === 'Scheduled' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                              Upcoming
                            </span>
                          ) : sched === 'Ended' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Ended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                              Draft
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Preview */}
                            <button
                              type="button"
                              onClick={() => onPreviewQuestions(test)}
                              title="Preview"
                              className="p-1.5 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* Questions */}
                            <button
                              type="button"
                              onClick={() => onManageQuestions(test)}
                              title="Question Builder & AI Studio"
                              className="p-1.5 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            >
                              <FileQuestion className="h-3.5 w-3.5" />
                            </button>

                            {/* Settings */}
                            <button
                              type="button"
                              onClick={() => onEditSettings(test)}
                              title="Settings & Rules"
                              className="p-1.5 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </button>

                            {/* Candidate Results */}
                            <button
                              type="button"
                              onClick={() => onViewResults(test)}
                              title="Candidate Results"
                              className="p-1.5 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            >
                              <BarChart3 className="h-3.5 w-3.5" />
                            </button>

                            {/* Publish / Unpublish */}
                            <button
                              type="button"
                              onClick={() => onTogglePublish(test)}
                              title={test.status === 'published' ? 'Unpublish Test' : 'Publish Test'}
                              className="p-1.5 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            >
                              {test.status === 'published' ? (
                                <Lock className="h-3.5 w-3.5" />
                              ) : (
                                <Globe className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => onDeleteTest(test)}
                              title="Delete Test"
                              className="p-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* View 2: Cards Grid View (Matches Image 2 & Mobile View) */}
            <div
              className={`${
                viewMode === 'cards' ? 'grid' : 'grid md:hidden'
              } grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5`}
            >
              {filteredTests.map((test) => {
                const sched = getScheduleLabel(test);
                return (
                  <div
                    key={test.testId}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
                  >
                    {/* Card Top: Title & Status */}
                    <div className="space-y-2">
                      <div className="font-bold text-slate-900 text-sm leading-snug">
                        {test.title}
                      </div>
                      <div>
                        {sched === 'Live Window' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            Live
                          </span>
                        ) : sched === 'Scheduled' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                            Upcoming
                          </span>
                        ) : sched === 'Ended' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Ended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                            Draft
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Details: Start Date, End Date, Duration, Questions */}
                    <div className="space-y-2 py-2 border-t border-b border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>Start Date</span>
                        </span>
                        <span className="font-medium text-slate-800">
                          {formatDate(test.startTime)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>End Date</span>
                        </span>
                        <span className="font-medium text-slate-800">
                          {formatDate(test.endTime)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-500">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>Duration</span>
                        </span>
                        <span className="font-medium text-slate-800">
                          {test.durationMins} min
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-500">
                          <Layers className="h-3.5 w-3.5 text-slate-400" />
                          <span>Questions</span>
                        </span>
                        <span className="font-medium text-slate-800">
                          {test.totalQuestions} Qs
                        </span>
                      </div>
                    </div>

                    {/* Card Action Buttons: Row of 6 Icon buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      {/* Preview */}
                      <button
                        type="button"
                        onClick={() => onPreviewQuestions(test)}
                        title="Preview"
                        className="p-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex-1 flex items-center justify-center"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {/* Questions */}
                      <button
                        type="button"
                        onClick={() => onManageQuestions(test)}
                        title="Questions & AI Studio"
                        className="p-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex-1 flex items-center justify-center"
                      >
                        <FileQuestion className="h-4 w-4" />
                      </button>

                      {/* Settings */}
                      <button
                        type="button"
                        onClick={() => onEditSettings(test)}
                        title="Settings & Rules"
                        className="p-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex-1 flex items-center justify-center"
                      >
                        <Settings className="h-4 w-4" />
                      </button>

                      {/* Results */}
                      <button
                        type="button"
                        onClick={() => onViewResults(test)}
                        title="Candidate Results"
                        className="p-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex-1 flex items-center justify-center"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </button>

                      {/* Publish / Unpublish */}
                      <button
                        type="button"
                        onClick={() => onTogglePublish(test)}
                        title={test.status === 'published' ? 'Unpublish Test' : 'Publish Test'}
                        className="p-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex-1 flex items-center justify-center"
                      >
                        {test.status === 'published' ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Globe className="h-4 w-4" />
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => onDeleteTest(test)}
                        title="Delete Test"
                        className="p-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-500 transition-colors cursor-pointer flex-1 flex items-center justify-center"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
