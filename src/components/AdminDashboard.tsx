import { Plus, Settings, FileQuestion, BarChart3, Trash2, Globe, Lock, Database, Eye } from 'lucide-react';
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
  const liveCount = tests.filter((t) => getScheduleLabel(t) === 'Live Window').length;
  const draftCount = tests.filter((t) => t.status === 'draft').length;
  const totalQConfigured = tests.reduce((acc, t) => acc + t.totalQuestions, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Admin Assessment Studio
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure exam windows, sections, anti-cheat strike limits, and Gemini AI question banks · Main Admin:{' '}
            <span className="font-mono text-xs font-semibold text-slate-800">{adminEmail}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {tests.length === 0 && (
            <button
              type="button"
              onClick={onSeedSample}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex-1 sm:flex-initial"
            >
              <Database className="h-4 w-4 text-slate-600" />
              <span>Seed Sample STEM Tests</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex-1 sm:flex-initial"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Test</span>
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-4 border-b border-slate-200 pb-6">
        <div>
          <div className="text-xs font-medium text-slate-500">Total Tests</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {tests.length}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">Active Live Windows</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {liveCount}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">Draft Assessments</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {draftCount}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">Configured Question Slots</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {totalQConfigured}
          </div>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              No assessments created yet
            </h2>
            <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
              Create a custom CBT exam from scratch or load our pre-built STEM &amp; Gen AI sample
              assessments with physics and circuit diagrams.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button
                type="button"
                onClick={onSeedSample}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <Database className="h-4 w-4" />
                <span>Load Sample STEM Tests</span>
              </button>
              <button
                type="button"
                onClick={onCreateNew}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create First Test</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {tests.map((test) => {
                const sched = getScheduleLabel(test);
                return (
                  <div
                    key={test.testId}
                    className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm break-words">
                          {test.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {test.sections.map((s) => `${s.name} (${s.questionCount})`).join(' · ')}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold">
                        {sched === 'Live Window' ? (
                          <span className="text-emerald-700">Live</span>
                        ) : sched === 'Scheduled' ? (
                          <span className="text-blue-700">Upcoming</span>
                        ) : sched === 'Ended' ? (
                          <span className="text-slate-500">Ended</span>
                        ) : (
                          <span className="text-amber-700">Draft</span>
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs">
                      <div>
                        <div className="text-[11px] text-slate-500">Duration</div>
                        <div className="font-mono font-semibold text-slate-800">
                          {test.durationMins}m
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Questions</div>
                        <div className="font-mono font-semibold text-slate-800">
                          {test.questionCountAdded !== undefined
                            ? `${test.questionCountAdded}/${test.totalQuestions}`
                            : `${test.totalQuestions}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Strikes</div>
                        <div className="font-mono font-semibold text-slate-800">
                          {test.maxStrikes === 0 ? 'Off' : test.maxStrikes}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Window: {new Date(test.startTime).toLocaleDateString()} –{' '}
                      {new Date(test.endTime).toLocaleDateString()}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onPreviewQuestions(test)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 text-indigo-700" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onManageQuestions(test)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <FileQuestion className="h-3.5 w-3.5 text-blue-700" />
                        <span>Questions</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditSettings(test)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>Rules</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewResults(test)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <BarChart3 className="h-3.5 w-3.5 text-emerald-700" />
                        <span>Results</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onTogglePublish(test)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {test.status === 'published' ? (
                          <>
                            <Lock className="h-3.5 w-3.5 text-amber-700" />
                            <span>Unpublish</span>
                          </>
                        ) : (
                          <>
                            <Globe className="h-3.5 w-3.5 text-emerald-700" />
                            <span>Publish</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTest(test)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50/40 px-2.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">Test Title &amp; Sections</th>
                    <th className="px-4 py-3.5">Window</th>
                    <th className="px-4 py-3.5 text-right">Duration</th>
                    <th className="px-4 py-3.5 text-right">Questions</th>
                    <th className="px-4 py-3.5 text-right">Max Strikes</th>
                    <th className="px-4 py-3.5">State</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tests.map((test) => {
                    const sched = getScheduleLabel(test);
                    return (
                      <tr key={test.testId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{test.title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {test.sections.map((s) => `${s.name} (${s.questionCount})`).join(' · ')}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-600 whitespace-nowrap">
                          <div>{new Date(test.startTime).toLocaleDateString()}</div>
                          <div className="text-slate-400">
                            to {new Date(test.endTime).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {test.durationMins} min
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {test.questionCountAdded !== undefined
                            ? `${test.questionCountAdded} / ${test.totalQuestions}`
                            : `${test.totalQuestions} Qs`}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {test.maxStrikes === 0 ? 'Off' : test.maxStrikes}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs font-semibold">
                          {sched === 'Live Window' ? (
                            <span className="text-emerald-700">Published · Live</span>
                          ) : sched === 'Scheduled' ? (
                            <span className="text-blue-700">Published · Upcoming</span>
                          ) : sched === 'Ended' ? (
                            <span className="text-slate-500">Published · Ended</span>
                          ) : (
                            <span className="text-amber-700">Draft</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onPreviewQuestions(test)}
                              title="Preview Questions in Exam View"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                            >
                              <Eye className="h-3.5 w-3.5 text-indigo-700" />
                              <span>Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onManageQuestions(test)}
                              title="Manage Questions & AI Generator"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                            >
                              <FileQuestion className="h-3.5 w-3.5 text-blue-700" />
                              <span>Questions</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditSettings(test)}
                              title="Edit Rules & Settings"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                            >
                              <Settings className="h-3.5 w-3.5" />
                              <span>Rules</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewResults(test)}
                              title="View Candidate Results & Strike Logs"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                            >
                              <BarChart3 className="h-3.5 w-3.5 text-emerald-700" />
                              <span>Results</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onTogglePublish(test)}
                              title={test.status === 'published' ? 'Move to Draft' : 'Publish Test'}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                            >
                              {test.status === 'published' ? (
                                <>
                                  <Lock className="h-3.5 w-3.5 text-amber-700" />
                                  <span>Unpublish</span>
                                </>
                              ) : (
                                <>
                                  <Globe className="h-3.5 w-3.5 text-emerald-700" />
                                  <span>Publish</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteTest(test)}
                              title="Delete Test"
                              className="inline-flex items-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
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
          </>
        )}
      </div>
    </div>
  );
}
