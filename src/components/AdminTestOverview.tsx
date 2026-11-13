import React from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Layers,
  BarChart3,
  Award,
  Settings,
  BookOpen,
  Monitor,
  CheckCircle2,
  XCircle,
  Shield,
  HelpCircle,
  Pencil,
  Radio,
  ListOrdered,
} from 'lucide-react';
import type { TestExam, TestQuestion } from '../types';

interface AdminTestOverviewProps {
  test: TestExam;
  questions: TestQuestion[];
  onBack: () => void;
  onEditSettings: () => void;
  onManageQuestions: () => void;
  onCandidatePreview: () => void;
  onEditQuestion: (question: TestQuestion) => void;
}

function formatDateTime(iso: string): string {
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

function getScheduleStatus(test: TestExam): { label: string; isLive: boolean; isScheduled: boolean } {
  const now = Date.now();
  const start = new Date(test.startTime).getTime();
  const end = new Date(test.endTime).getTime();

  if (test.status === 'draft') return { label: 'Draft', isLive: false, isScheduled: false };
  if (now < start) return { label: 'Scheduled', isLive: false, isScheduled: true };
  if (now > end) return { label: 'Ended', isLive: false, isScheduled: false };
  return { label: 'Live', isLive: true, isScheduled: false };
}

function cleanMarkdownText(md: string): string {
  return md
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$(.*?)\$/g, '$1')
    .trim();
}

export function AdminTestOverview({
  test,
  questions,
  onBack,
  onEditSettings,
  onManageQuestions,
  onCandidatePreview,
  onEditQuestion,
}: AdminTestOverviewProps) {
  const status = getScheduleStatus(test);
  const maxMarks = test.totalQuestions * (test.marksPerQuestion || 4);

  // Map section question counts
  const sectionCounts = test.sections.map((sec) => {
    const count = questions.filter((q) => q.sectionId === sec.id).length;
    return {
      id: sec.id,
      name: sec.name,
      configured: count,
      target: sec.questionCount,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Tests</span>
          </button>

          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {test.title}
          </h1>

          {status.isScheduled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span>Scheduled</span>
            </span>
          ) : status.isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
              <span>Live</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              <span>{status.label}</span>
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onEditSettings}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <Settings className="h-4 w-4 text-slate-500" />
            <span>Edit Settings</span>
          </button>

          <button
            type="button"
            onClick={onManageQuestions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <BookOpen className="h-4 w-4 text-slate-500" />
            <span>Manage Questions</span>
          </button>

          <button
            type="button"
            onClick={onCandidatePreview}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
          >
            <Monitor className="h-4 w-4 text-white" />
            <span>Candidate Preview</span>
          </button>
        </div>
      </div>

      {/* 5 Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Questions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Questions</div>
            <div className="text-xl font-bold text-blue-700 tabular-nums mt-0.5">
              {test.totalQuestions}
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Duration</div>
            <div className="text-xl font-bold text-blue-700 tabular-nums mt-0.5">
              {test.durationMins} Minutes
            </div>
          </div>
        </div>

        {/* Maximum Marks */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Maximum Marks</div>
            <div className="text-xl font-bold text-blue-700 tabular-nums mt-0.5">
              {maxMarks}
            </div>
          </div>
        </div>

        {/* Passing Score */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Passing Score</div>
            <div className="text-xl font-bold text-blue-700 tabular-nums mt-0.5">
              {test.passPercentage}%
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500">Schedule</div>
            <div className="text-xs font-semibold text-slate-800 mt-0.5 truncate" title={`${formatDateTime(test.startTime)} → ${formatDateTime(test.endTime)}`}>
              {formatDateTime(test.startTime)} →
            </div>
            <div className="text-xs font-semibold text-slate-800 truncate">
              {formatDateTime(test.endTime)}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Summary Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sections & Question Distribution */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 mb-3">
              Sections &amp; Question Distribution
            </h2>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between pb-2 text-xs font-semibold text-slate-400">
                <span>Section</span>
                <span>Questions</span>
              </div>
              {sectionCounts.map((sec) => (
                <div key={sec.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-medium text-slate-800">{sec.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 tabular-nums">
                    {sec.configured} / {sec.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Marking Summary */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 mb-3">
              Marking Summary
            </h2>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="text-lg font-bold text-emerald-700 tabular-nums">
                  +{test.marksPerQuestion || 4}
                </div>
                <div className="text-xs font-medium text-emerald-800">Correct Marks</div>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-rose-100 text-rose-700 mb-1">
                  <XCircle className="h-4 w-4" />
                </div>
                <div className="text-lg font-bold text-rose-700 tabular-nums">
                  {test.negativeMarking ? `-${test.negativeMarkValue}` : '0'}
                </div>
                <div className="text-xs font-medium text-rose-800">Wrong Marks</div>
              </div>
            </div>
          </div>
        </div>

        {/* Proctoring Summary */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h2 className="font-display text-sm font-bold text-slate-900 mb-3">
            Proctoring Summary
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Fullscreen Mode</span>
              {test.enforceFullscreen ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                  <XCircle className="h-3.5 w-3.5 text-slate-400" /> Disabled
                </span>
              )}
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Tab Switch Detection</span>
              {test.detectTabSwitch ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                  <XCircle className="h-3.5 w-3.5 text-slate-400" /> Disabled
                </span>
              )}
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">AI Face Proctoring</span>
              {test.proctoringAIEnabled ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                  <XCircle className="h-3.5 w-3.5 text-rose-500" /> Disabled
                </span>
              )}
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Maximum Attempts</span>
              <span className="font-bold text-slate-800 tabular-nums">{test.maxAttempts || 1}</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Maximum Strikes</span>
              <span className="font-bold text-slate-800 tabular-nums">{test.maxStrikes || 3}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Card: Question List Preview */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900">
            Question List Preview
          </h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {questions.length} Questions
          </span>
        </div>

        {questions.length === 0 ? (
          <div className="py-12 text-center">
            <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No questions added yet</p>
            <p className="text-xs text-slate-500 mt-1">Open Question Studio to create or generate questions.</p>
            <button
              type="button"
              onClick={onManageQuestions}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Open Question Studio</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Question Title</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4 text-center">Marks</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questions.map((q, idx) => {
                  const sec = test.sections.find((s) => s.id === q.sectionId);
                  return (
                    <tr key={q.questionId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-blue-700">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-semibold text-xs">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 max-w-md truncate">
                        {cleanMarkdownText(q.questionText) || 'Untitled Question'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                          <Layers className="h-3 w-3 text-blue-600" />
                          <span>{sec?.name || q.sectionId}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800 tabular-nums">
                        {q.marks || test.marksPerQuestion || 4}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <ListOrdered className="h-3.5 w-3.5 text-slate-400" />
                          <span>Multiple Choice</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onEditQuestion(q)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer"
                          title="Edit question in Studio"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
