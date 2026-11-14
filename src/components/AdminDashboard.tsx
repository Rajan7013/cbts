import { useState } from 'react';
import {
  Plus,
  Settings,
  BarChart3,
  Trash2,
  Lock,
  Eye,
  Search,
  Calendar,
  Clock,
  Layers,
  FileText,
  Radio,
  LayoutGrid,
  List,
  Filter,
  CheckCircle2,
  X,
  HelpCircle,
  ArrowRight,
  Database,
  Sparkles,
} from 'lucide-react';
import { AiDocumentImporterModal } from './AiDocumentImporterModal';
import type { TestExam, TestQuestion, TestSection } from '../types';

interface AdminDashboardProps {
  tests: TestExam[];
  loading: boolean;
  publishedSuccessMessage?: string | null;
  onClearPublishedSuccess?: () => void;
  onCreateNew: () => void;
  onSeedSample: () => void;
  onEditSettings: (test: TestExam) => void;
  onManageQuestions: (test: TestExam) => void;
  onPreviewQuestions: (test: TestExam) => void;
  onViewResults: (test: TestExam) => void;
  onTogglePublish: (test: TestExam) => void;
  onDeleteTest: (test: TestExam) => void;
  onImportFromDoc?: (
    testData: {
      title: string;
      description: string;
      sections: TestSection[];
      questions: TestQuestion[];
    },
    publishImmediately: boolean
  ) => Promise<void>;
}

function getScheduleStatus(test: TestExam): { label: string; isLive: boolean; isScheduled: boolean } {
  const now = Date.now();
  const start = new Date(test.startTime).getTime();
  const end = new Date(test.endTime).getTime();

  if (test.status === 'draft') return { label: 'Draft', isLive: false, isScheduled: false };
  if (now < start) return { label: 'Scheduled', isLive: false, isScheduled: true };
  if (now > end) return { label: 'Ended', isLive: false, isScheduled: false };
  return { label: 'Live', isLive: true, isScheduled: false };
}

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

export function AdminDashboard({
  tests,
  loading,
  publishedSuccessMessage,
  onClearPublishedSuccess,
  onCreateNew,
  onSeedSample,
  onEditSettings,
  onManageQuestions,
  onPreviewQuestions,
  onViewResults,
  onTogglePublish,
  onDeleteTest,
  onImportFromDoc,
}: AdminDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showToast, setShowToast] = useState(true);
  const [showDocImporterModal, setShowDocImporterModal] = useState(false);

  const liveCount = tests.filter((t) => getScheduleStatus(t).isLive).length;
  const draftCount = tests.filter((t) => t.status === 'draft').length;
  const totalQConfigured = tests.reduce((acc, t) => acc + t.totalQuestions, 0);

  // Filter tests based on search query and status filter
  const filteredTests = tests.filter((t) => {
    const sched = getScheduleStatus(t);
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sections.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'live') return sched.isLive;
    if (statusFilter === 'scheduled') return sched.isScheduled;
    if (statusFilter === 'draft') return t.status === 'draft';
    if (statusFilter === 'ended') return sched.label === 'Ended';
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
            Create, schedule, and manage your assessments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Green Published Success Banner if triggered */}
          {publishedSuccessMessage && showToast && (
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs animate-in fade-in duration-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{publishedSuccessMessage}</span>
              <button
                type="button"
                onClick={() => {
                  setShowToast(false);
                  onClearPublishedSuccess?.();
                }}
                className="ml-1 text-emerald-600 hover:text-emerald-900 cursor-pointer"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

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
            onClick={() => setShowDocImporterModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-linear-to-r from-indigo-50 to-blue-50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-indigo-700 hover:from-indigo-100 hover:to-blue-100 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>Import PDF / Booklet (AI)</span>
          </button>

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
            <Radio className="h-6 w-6 text-emerald-600" />
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
          <div className="h-12 w-12 rounded-2xl bg-blue-50/70 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Draft Assessments</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
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
      <div className="space-y-4">
        {/* Filters and View Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests by name..."
              className="w-full rounded-xl border border-slate-200/80 bg-white pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 shadow-xs transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Status Dropdown */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <Filter className="h-3.5 w-3.5" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200/80 bg-white pl-8 pr-8 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:outline-hidden focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="all">Status: All Statuses</option>
                <option value="live">Live Only</option>
                <option value="scheduled">Scheduled Only</option>
                <option value="draft">Drafts</option>
                <option value="ended">Ended</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-blue-50 text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Card View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-blue-50 text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span>List View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content based on View Mode */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center text-xs text-slate-400">
            Loading assessments...
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center">
            <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No assessments found</p>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery ? 'Try clearing your search query or filters.' : 'Click "Create New Test" above to build your first test.'}
            </p>
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards Grid View (Matching Image 1) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredTests.map((test) => {
              const sched = getScheduleStatus(test);
              return (
                <div
                  key={test.testId}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Title and Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <h3
                        onClick={() => onPreviewQuestions(test)}
                        className="font-display text-base sm:text-lg font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                      >
                        {test.title}
                      </h3>

                      {sched.isScheduled ? (
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Scheduled</span>
                        </span>
                      ) : sched.isLive ? (
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                          <span>Live</span>
                        </span>
                      ) : test.status === 'draft' ? (
                        <span className="shrink-0 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          <span>Draft</span>
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          <span>{sched.label}</span>
                        </span>
                      )}
                    </div>

                    {/* Schedule Date Range */}
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-800">
                      <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>{formatDisplayDate(test.startTime)}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>{formatDisplayDate(test.endTime)}</span>
                    </div>

                    {/* Specs Divider */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
                        <span className="font-semibold text-slate-800">{test.totalQuestions} Questions</span>
                      </div>
                      <span className="text-slate-300">|</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                        <span className="font-semibold text-slate-800">{test.durationMins} Minutes</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions Row: 6 Equal Rounded Buttons (Matching Image 1) */}
                  <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-6 gap-2">
                    {/* 1. Preview */}
                    <button
                      type="button"
                      onClick={() => onPreviewQuestions(test)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/80 bg-white p-2 text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors cursor-pointer shadow-2xs"
                      title="Preview Test Overview"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Preview</span>
                    </button>

                    {/* 2. Questions */}
                    <button
                      type="button"
                      onClick={() => onManageQuestions(test)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/80 bg-white p-2 text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors cursor-pointer shadow-2xs"
                      title="Manage Questions in Studio"
                    >
                      <Layers className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Questions</span>
                    </button>

                    {/* 3. Settings */}
                    <button
                      type="button"
                      onClick={() => onEditSettings(test)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/80 bg-white p-2 text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors cursor-pointer shadow-2xs"
                      title="Edit Test Settings"
                    >
                      <Settings className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Settings</span>
                    </button>

                    {/* 4. Results */}
                    <button
                      type="button"
                      onClick={() => onViewResults(test)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/80 bg-white p-2 text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors cursor-pointer shadow-2xs"
                      title="View Candidate Results"
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Results</span>
                    </button>

                    {/* 5. Lock/Unlock */}
                    <button
                      type="button"
                      onClick={() => onTogglePublish(test)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/80 bg-white p-2 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                      title={test.status === 'published' ? 'Lock as Draft' : 'Publish Test'}
                    >
                      <Lock className={`h-4 w-4 ${test.status === 'published' ? 'text-slate-600' : 'text-amber-600'}`} />
                      <span className="text-[10px] font-medium">
                        {test.status === 'published' ? 'Lock' : 'Publish'}
                      </span>
                    </button>

                    {/* 6. Delete */}
                    <button
                      type="button"
                      onClick={() => onDeleteTest(test)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-rose-200/80 bg-white p-2 text-rose-600 hover:bg-rose-50/80 hover:border-rose-300 transition-colors cursor-pointer shadow-2xs"
                      title="Delete Assessment"
                    >
                      <Trash2 className="h-4 w-4 text-rose-600" />
                      <span className="text-[10px] font-medium">Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table / List View */
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold">
                    <th className="py-3.5 px-4">Test Title</th>
                    <th className="py-3.5 px-4">Start Date</th>
                    <th className="py-3.5 px-4">End Date</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Questions</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTests.map((test) => {
                    const sched = getScheduleStatus(test);
                    return (
                      <tr key={test.testId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs truncate">
                          <button
                            type="button"
                            onClick={() => onPreviewQuestions(test)}
                            className="hover:text-blue-600 transition-colors cursor-pointer text-left font-bold"
                          >
                            {test.title}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDisplayDate(test.startTime)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDisplayDate(test.endTime)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                          {test.durationMins} min
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 tabular-nums">
                          {test.totalQuestions} Qs
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {sched.isScheduled ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <Calendar className="h-3 w-3" /> Scheduled
                            </span>
                          ) : sched.isLive ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <Radio className="h-3 w-3 animate-pulse" /> Live
                            </span>
                          ) : test.status === 'draft' ? (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                              Draft
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                              {sched.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onPreviewQuestions(test)}
                              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer"
                              title="Preview"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onManageQuestions(test)}
                              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer"
                              title="Questions"
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditSettings(test)}
                              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer"
                              title="Settings"
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewResults(test)}
                              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer"
                              title="Results"
                            >
                              <BarChart3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onTogglePublish(test)}
                              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer"
                              title={test.status === 'published' ? 'Lock as Draft' : 'Publish'}
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteTest(test)}
                              className="h-7 w-7 rounded-lg border border-rose-200 flex items-center justify-center text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete"
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
          </div>
        )}
      </div>

      {showDocImporterModal && (
        <AiDocumentImporterModal
          isOpen={showDocImporterModal}
          onClose={() => setShowDocImporterModal(false)}
          onApplyExam={async (examData, publishImmediately) => {
            if (onImportFromDoc) {
              await onImportFromDoc(examData, publishImmediately);
            }
            setShowDocImporterModal(false);
          }}
        />
      )}
    </div>
  );
}
