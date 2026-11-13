import { useState } from 'react';
import { ArrowLeft, AlertTriangle, ShieldAlert, CheckCircle2, Clock, X } from 'lucide-react';
import type { TestAttempt, TestExam } from '../types';

interface AdminResultsViewProps {
  test: TestExam | null;
  tests?: TestExam[];
  attempts: TestAttempt[];
  loading: boolean;
  onSelectTest?: (test: TestExam) => void;
  onBack: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function AdminResultsView({
  test,
  tests = [],
  attempts,
  loading,
  onSelectTest,
  onBack,
}: AdminResultsViewProps) {
  const [selectedAttempt, setSelectedAttempt] = useState<TestAttempt | null>(null);

  const completed = attempts.filter((a) => a.status !== 'in_progress');
  const strikeouts = attempts.filter((a) => a.status === 'auto_submitted_strike').length;
  const avgScore =
    completed.length > 0
      ? (completed.reduce((s, a) => s + a.score, 0) / completed.length).toFixed(1)
      : '0.0';
  const highScore =
    completed.length > 0 ? Math.max(...completed.map((a) => a.score)) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Tests</span>
      </button>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Results &amp; Proctoring Logs {test ? `— ${test.title}` : ''}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Review candidate performance, live progress, and timestamped anti-cheat strike telemetry.
          </p>
        </div>

        {tests.length > 0 && onSelectTest && (
          <div className="flex items-center gap-2">
            <label htmlFor="test-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Test:
            </label>
            <select
              id="test-select"
              value={test?.testId || ''}
              onChange={(e) => {
                const found = tests.find((t) => t.testId === e.target.value);
                if (found) onSelectTest(found);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-blue-600 focus:outline-hidden"
            >
              {tests.map((t) => (
                <option key={t.testId} value={t.testId}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!test && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-slate-800">No Assessment Tests Found</p>
          <p className="mt-1 text-xs text-slate-500">Create an assessment test first to view candidate results.</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-4 border-b border-slate-200 pb-6">
        <div>
          <div className="text-xs font-medium text-slate-500">Total Attempts</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {attempts.length}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">Average Score</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
            {avgScore}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">Highest Score</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {highScore}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">Auto-Submitted (Strikeouts)</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-red-700 tabular-nums">
            {strikeouts}
          </div>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ) : attempts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No candidates have started this test yet.
          </div>
        ) : (
          <>
            {/* Mobile Candidate Attempt Cards */}
            <div className="md:hidden space-y-3">
              {attempts.map((att) => (
                <div
                  key={att.attemptId}
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 truncate">
                        {att.userName}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{att.userEmail}</div>
                    </div>
                    <span className="shrink-0 text-xs font-semibold">
                      {att.status === 'submitted' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                        </span>
                      ) : att.status === 'auto_submitted_strike' ? (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <ShieldAlert className="h-3.5 w-3.5" /> Strikeout
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <Clock className="h-3.5 w-3.5" /> Active
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-500">Score</div>
                      <div className="font-mono font-semibold text-slate-900">
                        {att.status === 'in_progress' ? '—' : `${att.score}/${att.maxScore}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Acc.</div>
                      <div className="font-mono font-semibold text-slate-800">
                        {att.status === 'in_progress' ? '—' : `${att.accuracy}%`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Time</div>
                      <div className="font-mono font-semibold text-slate-800">
                        {formatDuration(att.timeTakenSeconds)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Strikes</div>
                      <div
                        className={`font-mono font-semibold ${
                          att.strikeCount > 0 ? 'text-amber-700' : 'text-slate-700'
                        }`}
                      >
                        {att.strikeCount}/{test.maxStrikes || '∞'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAttempt(att)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    View Strike Log
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop Results Table */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3.5">Candidate</th>
                      <th className="px-4 py-3.5 text-center">Score</th>
                      <th className="px-4 py-3.5 text-center">Accuracy</th>
                      <th className="px-4 py-3.5 text-center">Time Taken</th>
                      <th className="px-4 py-3.5 text-center">Strikes</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {attempts.map((att) => (
                      <tr key={att.attemptId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{att.userName}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{att.userEmail}</div>
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {att.status === 'in_progress' ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-1 border border-blue-100 font-bold">
                              {att.score} / {att.maxScore}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-xs text-slate-700 tabular-nums">
                          {att.status === 'in_progress' ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span className="font-semibold">{att.accuracy}%</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-xs text-slate-700 tabular-nums">
                          {formatDuration(att.timeTakenSeconds)}
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-xs font-semibold tabular-nums">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                              att.strikeCount > 0
                                ? 'bg-amber-100 text-amber-800 font-bold'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {att.strikeCount} / {test.maxStrikes || '∞'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-xs font-semibold whitespace-nowrap">
                          {att.status === 'submitted' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                            </span>
                          ) : att.status === 'auto_submitted_strike' ? (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                              <ShieldAlert className="h-3.5 w-3.5" /> Auto-Submitted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                              <Clock className="h-3.5 w-3.5" /> In Progress
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedAttempt(att)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                          >
                            View Strike Log
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Strike Log Drawer / Modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Proctoring Strike Log
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedAttempt.userName} ({selectedAttempt.userEmail})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto space-y-2.5">
              {selectedAttempt.strikes.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                  Clean session — zero anti-cheat violations recorded.
                </div>
              ) : (
                selectedAttempt.strikes.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          Strike {s.count}: {s.reason}
                        </div>
                        <div className="mt-0.5 font-mono text-slate-500">
                          {new Date(s.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
