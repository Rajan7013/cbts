import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Layers,
  BarChart3,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  Eye,
  Info,
  Check,
  X,
  User,
  FileText,
  RotateCw,
  HelpCircle,
  FileQuestion,
  ChevronLeft,
  ChevronRight,
  Radio,
  MinusCircle,
  ListOrdered,
} from 'lucide-react';
import { MathText } from './MathText';
import type { OptionId, QuestionResponse, TestAttempt, TestExam, TestQuestion } from '../types';

interface AdminResultsViewProps {
  test: TestExam | null;
  tests?: TestExam[];
  questions?: TestQuestion[];
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function cleanMarkdown(md: string): string {
  return md
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$(.*?)\$/g, '$1')
    .trim();
}

export function AdminResultsView({
  test,
  tests = [],
  questions = [],
  attempts,
  loading,
  onSelectTest,
  onBack,
}: AdminResultsViewProps) {
  const [selectedAttempt, setSelectedAttempt] = useState<TestAttempt | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [useSampleData, setUseSampleData] = useState(false);
  const [activeDetailQuestion, setActiveDetailQuestion] = useState<{
    q: TestQuestion;
    candidateOptionId: OptionId | null;
    isCorrect: boolean;
  } | null>(null);

  // Generate mock/sample cohort matching Mockup 4 & 5 if requested or toggled
  const sampleCohortAttempts: TestAttempt[] = useMemo(() => {
    if (!test) return [];
    const maxScore = test.totalQuestions * (test.marksPerQuestion || 4);

    return [
      {
        attemptId: 'sample_asha_sharma',
        testId: test.testId,
        testTitle: test.title,
        userId: 'cand_asha',
        userName: 'Asha Sharma',
        userEmail: 'asha.sharma@exampulse.edu',
        status: 'submitted',
        startedAtIso: '2026-11-21T02:24:36Z',
        lastActiveAtIso: '2026-11-21T02:41:00Z',
        submittedAtIso: '2026-11-21T02:41:00Z',
        remainingSeconds: 216,
        currentQuestionIndex: 5,
        currentSectionId: test.sections[1]?.id || test.sections[0]?.id || 'sec_1',
        strikeCount: 0,
        strikes: [],
        responses: {
          q_1: { selectedOptionId: 'A', markedForReview: false, visited: true },
          q_2: { selectedOptionId: 'B', markedForReview: false, visited: true },
          q_3: { selectedOptionId: 'C', markedForReview: false, visited: true },
          q_4: { selectedOptionId: 'A', markedForReview: false, visited: true },
          q_5: { selectedOptionId: 'B', markedForReview: false, visited: true }, // incorrect
          q_6: { selectedOptionId: 'C', markedForReview: false, visited: true },
        },
        score: 20,
        maxScore: maxScore || 24,
        accuracy: 83.3,
        correctCount: 5,
        wrongCount: 1,
        unattemptedCount: 0,
        timeTakenSeconds: 984, // 16m 24s
      },
      {
        attemptId: 'sample_ravi_kumar',
        testId: test.testId,
        testTitle: test.title,
        userId: 'cand_ravi',
        userName: 'Ravi Kumar',
        userEmail: 'ravi.kumar@exampulse.edu',
        status: 'submitted',
        startedAtIso: '2026-11-21T02:20:00Z',
        lastActiveAtIso: '2026-11-21T02:39:00Z',
        submittedAtIso: '2026-11-21T02:39:00Z',
        remainingSeconds: 320,
        currentQuestionIndex: 5,
        currentSectionId: test.sections[1]?.id || test.sections[0]?.id || 'sec_1',
        strikeCount: 0,
        strikes: [],
        responses: {},
        score: 18,
        maxScore: maxScore || 24,
        accuracy: 75,
        correctCount: 4,
        wrongCount: 1,
        unattemptedCount: 1,
        timeTakenSeconds: 1140,
      },
      {
        attemptId: 'sample_priya_singh',
        testId: test.testId,
        testTitle: test.title,
        userId: 'cand_priya',
        userName: 'Priya Singh',
        userEmail: 'priya.singh@exampulse.edu',
        status: 'submitted',
        startedAtIso: '2026-11-21T02:25:00Z',
        lastActiveAtIso: '2026-11-21T02:45:00Z',
        submittedAtIso: '2026-11-21T02:45:00Z',
        remainingSeconds: 0,
        currentQuestionIndex: 5,
        currentSectionId: test.sections[1]?.id || test.sections[0]?.id || 'sec_1',
        strikeCount: 1,
        strikes: [],
        responses: {},
        score: 16,
        maxScore: maxScore || 24,
        accuracy: 66.7,
        correctCount: 4,
        wrongCount: 2,
        unattemptedCount: 0,
        timeTakenSeconds: 1200,
      },
      {
        attemptId: 'sample_aman_patel',
        testId: test.testId,
        testTitle: test.title,
        userId: 'cand_aman',
        userName: 'Aman Patel',
        userEmail: 'aman.patel@exampulse.edu',
        status: 'in_progress',
        startedAtIso: '2026-11-21T02:35:00Z',
        lastActiveAtIso: '2026-11-21T02:45:00Z',
        remainingSeconds: 600,
        currentQuestionIndex: 2,
        currentSectionId: test.sections[0]?.id || 'sec_1',
        strikeCount: 0,
        strikes: [],
        responses: {},
        score: 0,
        maxScore: maxScore || 24,
        accuracy: 0,
        correctCount: 0,
        wrongCount: 0,
        unattemptedCount: test.totalQuestions,
        timeTakenSeconds: 600,
      },
    ];
  }, [test]);

  // Active attempts: use real attempts unless sample data is toggled or no real attempts exist
  const activeAttemptsList = useMemo(() => {
    if (useSampleData) return sampleCohortAttempts;
    if (attempts.length > 0) return attempts;
    return [];
  }, [useSampleData, sampleCohortAttempts, attempts]);

  // Cohort statistics
  const completedAttempts = activeAttemptsList.filter((a) => a.status !== 'in_progress');
  const inProgressAttempts = activeAttemptsList.filter((a) => a.status === 'in_progress');
  const averageScorePercent =
    completedAttempts.length > 0
      ? (
          completedAttempts.reduce((sum, a) => {
            const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : a.accuracy;
            return sum + pct;
          }, 0) / completedAttempts.length
        ).toFixed(0)
      : '—';

  // Filtered attempts based on search and status
  const filteredAttempts = activeAttemptsList.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      a.userName.toLowerCase().includes(q) ||
      a.userEmail.toLowerCase().includes(q) ||
      a.userId.toLowerCase().includes(q);

    if (!matchSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'passed') {
      const passPct = test?.passPercentage || 50;
      const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : a.accuracy;
      return a.status !== 'in_progress' && pct >= passPct;
    }
    if (statusFilter === 'failed') {
      const passPct = test?.passPercentage || 50;
      const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : a.accuracy;
      return a.status !== 'in_progress' && pct < passPct;
    }
    if (statusFilter === 'in_progress') return a.status === 'in_progress';
    return true;
  });

  // Handle Export CSV
  const handleExportCSV = () => {
    if (activeAttemptsList.length === 0) return;
    const headers = ['Candidate Name', 'Email', 'Attempt', 'Score', 'Max Score', 'Percentage', 'Status', 'Submitted At'];
    const rows = activeAttemptsList.map((a) => [
      `"${a.userName.replace(/"/g, '""')}"`,
      `"${a.userEmail.replace(/"/g, '""')}"`,
      '1',
      a.status === 'in_progress' ? '—' : a.score,
      a.maxScore,
      a.status === 'in_progress' ? '—' : `${((a.score / (a.maxScore || 1)) * 100).toFixed(1)}%`,
      a.status === 'in_progress' ? 'In Progress' : (a.score / (a.maxScore || 1)) * 100 >= (test?.passPercentage || 50) ? 'Passed' : 'Failed',
      a.submittedAtIso ? formatDisplayDate(a.submittedAtIso) : '—',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${test?.title || 'test'}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If viewing candidate attempt details (Image 5)
  if (selectedAttempt && test) {
    const isPassed =
      (selectedAttempt.score / (selectedAttempt.maxScore || 1)) * 100 >= test.passPercentage;
    const scorePct =
      selectedAttempt.maxScore > 0
        ? ((selectedAttempt.score / selectedAttempt.maxScore) * 100).toFixed(1)
        : '0.0';

    // Build question list for review
    const reviewQuestions: Array<{
      q: TestQuestion;
      qNumber: number;
      candidateChoiceText: string;
      candidateOptionId: OptionId | null;
      correctChoiceText: string;
      isCorrect: boolean;
      sectionName: string;
    }> = questions.map((q, idx) => {
      const resp = selectedAttempt.responses[q.questionId] ||
        selectedAttempt.responses[`q_${idx + 1}`];
      const candidateOptionId = resp?.selectedOptionId || null;
      const candidateOpt = q.options.find((o) => o.id === candidateOptionId);
      const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
      const isCorrect = Boolean(candidateOptionId && candidateOptionId === q.correctOptionId);
      const sec = test.sections.find((s) => s.id === q.sectionId);

      return {
        q,
        qNumber: idx + 1,
        candidateChoiceText: candidateOpt ? candidateOpt.text : candidateOptionId || '—',
        candidateOptionId,
        correctChoiceText: correctOpt ? correctOpt.text : q.correctOptionId || '—',
        isCorrect,
        sectionName: sec?.name || q.sectionId,
      };
    });

    // Calculate section breakdown
    const sectionPerformance = test.sections.map((sec) => {
      const secQs = reviewQuestions.filter((item) => item.q.sectionId === sec.id);
      const totalSec = secQs.length || sec.questionCount;
      const correctSec = secQs.filter((item) => item.isCorrect).length;
      const incorrectSec = secQs.filter((item) => item.candidateOptionId && !item.isCorrect).length;
      const unansweredSec = secQs.filter((item) => !item.candidateOptionId).length;
      const marksPerQ = test.marksPerQuestion || 4;
      const secScore = correctSec * marksPerQ;
      const secMaxScore = totalSec * marksPerQ;
      const secPct = secMaxScore > 0 ? ((secScore / secMaxScore) * 100).toFixed(0) : '0';

      return {
        id: sec.id,
        name: sec.name,
        total: totalSec,
        correct: correctSec,
        incorrect: incorrectSec,
        unanswered: unansweredSec,
        score: secScore,
        maxScore: secMaxScore,
        percentage: `${secPct}%`,
      };
    });

    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => setSelectedAttempt(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors cursor-pointer mb-2.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
              <span>Back to Results</span>
            </button>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Candidate attempt details
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              View the candidate's responses, correct answers, and scoring for this attempt.
            </p>
          </div>

          {useSampleData && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <Info className="h-3.5 w-3.5" />
              <span>Sample data</span>
            </span>
          )}
        </div>

        {/* Candidate & Test Meta Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-400">Candidate</div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {selectedAttempt.userName}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-400">Test</div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {test.title}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400">Attempt</div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                1
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400">Status</div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {isPassed ? '✓ Passed' : '✕ Failed'}
              </span>
            </div>
          </div>
        </div>

        {/* 6 Metric Cards Row (Matching Image 5) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
          {/* Score */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <span className="text-[11px] font-medium">Score</span>
            </div>
            <div className="text-base sm:text-lg font-bold text-blue-700 tabular-nums">
              {selectedAttempt.score} / {selectedAttempt.maxScore} ({scorePct}%)
            </div>
          </div>

          {/* Correct */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-[11px] font-medium">Correct</span>
            </div>
            <div className="text-xl font-bold text-emerald-600 tabular-nums">
              {selectedAttempt.correctCount}
            </div>
          </div>

          {/* Incorrect */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <XCircle className="h-4 w-4 text-rose-600" />
              <span className="text-[11px] font-medium">Incorrect</span>
            </div>
            <div className="text-xl font-bold text-rose-600 tabular-nums">
              {selectedAttempt.wrongCount}
            </div>
          </div>

          {/* Unanswered */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <MinusCircle className="h-4 w-4 text-slate-400" />
              <span className="text-[11px] font-medium">Unanswered</span>
            </div>
            <div className="text-xl font-bold text-slate-700 tabular-nums">
              {selectedAttempt.unattemptedCount}
            </div>
          </div>

          {/* Questions */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Layers className="h-4 w-4 text-purple-600" />
              <span className="text-[11px] font-medium">Questions</span>
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {test.totalQuestions}
            </div>
          </div>

          {/* Marking Pill */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col justify-center">
            <div className="text-xs font-bold text-emerald-700">
              +{test.marksPerQuestion || 4} Correct
            </div>
            <div className="text-xs font-bold text-rose-600 mt-0.5">
              {test.negativeMarking ? `-${test.negativeMarkValue}` : '0'} Wrong
            </div>
          </div>
        </div>

        {/* Time & Submission Details Bar */}
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs text-xs">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-slate-500">Time Taken:</span>
            <span className="font-bold text-slate-800">
              {formatDuration(selectedAttempt.timeTakenSeconds || 984)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-slate-500">Submitted:</span>
            <span className="font-bold text-slate-800">
              {selectedAttempt.submittedAtIso ? formatDisplayDate(selectedAttempt.submittedAtIso) : '21 Nov 2026 02:41'}
            </span>
          </div>
        </div>

        {/* Section Performance Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
            Section Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4 text-center">Questions</th>
                  <th className="py-3 px-4 text-center">Correct</th>
                  <th className="py-3 px-4 text-center">Incorrect</th>
                  <th className="py-3 px-4 text-center">Unanswered</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sectionPerformance.map((sp) => (
                  <tr key={sp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800">{sp.name}</td>
                    <td className="py-3 px-4 text-center text-slate-700 tabular-nums">{sp.total}</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-semibold tabular-nums">{sp.correct}</td>
                    <td className="py-3 px-4 text-center text-rose-600 font-semibold tabular-nums">{sp.incorrect}</td>
                    <td className="py-3 px-4 text-center text-slate-500 tabular-nums">{sp.unanswered}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800 tabular-nums">{sp.score} / {sp.maxScore}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-700 tabular-nums">{sp.percentage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Question-by-Question Review Card (Matching Image 5) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
            Question-by-Question Review ({reviewQuestions.length} Questions)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold">
                  <th className="py-3 px-4 w-12 text-center">Q#</th>
                  <th className="py-3 px-4">Question (short text)</th>
                  <th className="py-3 px-4">Candidate Answer</th>
                  <th className="py-3 px-4">Correct Answer</th>
                  <th className="py-3 px-4 text-center">Outcome</th>
                  <th className="py-3 px-4 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviewQuestions.map((item) => (
                  <tr key={item.q.questionId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-semibold text-xs">
                        {item.qNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 max-w-sm truncate">
                      {cleanMarkdown(item.q.questionText) || 'Question item'}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {item.candidateChoiceText}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {item.correctChoiceText}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.isCorrect ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Check className="h-3 w-3" /> Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                          <X className="h-3 w-3" /> Incorrect
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDetailQuestion({
                            q: item.q,
                            candidateOptionId: item.candidateOptionId,
                            isCorrect: item.isCorrect,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-slate-700 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Detail</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Question Detail Modal */}
        {activeDetailQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Question Detail
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveDetailQuestion(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Question stem */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <MathText text={activeDetailQuestion.q.questionText} className="text-xs sm:text-sm text-slate-900" />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500">Answer Options:</div>
                {activeDetailQuestion.q.options.map((opt) => {
                  const isCandidateChoice = opt.id === activeDetailQuestion.candidateOptionId;
                  const isCorrectChoice = opt.id === activeDetailQuestion.q.correctOptionId;

                  return (
                    <div
                      key={opt.id}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                        isCorrectChoice
                          ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium'
                          : isCandidateChoice
                          ? 'border-rose-300 bg-rose-50/70 text-rose-950 font-medium'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span className="font-bold shrink-0">{opt.id}.</span>
                      <MathText text={opt.text} className="flex-1" />
                      {isCorrectChoice && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Correct Answer
                        </span>
                      )}
                      {isCandidateChoice && !isCorrectChoice && (
                        <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          Candidate Choice
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Solution / Explanation if present */}
              {activeDetailQuestion.q.shortExplanation && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-950">
                  <div className="font-bold text-blue-900 mb-1">Explanation:</div>
                  <MathText text={activeDetailQuestion.q.shortExplanation} />
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveDetailQuestion(null)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 cursor-pointer"
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

  // Primary Candidate Results Cohort View (Matching Images 3 & 4)
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors cursor-pointer mb-2.5"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Tests</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Candidate Results
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            View and manage candidate attempts, scores, and submission details for a test.
          </p>
        </div>

        {/* Sample Data Toggle Pill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUseSampleData(!useSampleData)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
              useSampleData
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle between live test attempts and sample cohort data"
          >
            <Info className="h-3.5 w-3.5" />
            <span>Sample data</span>
          </button>
        </div>
      </div>

      {/* Selected Test & Schedule Banner (Matching Images 3 & 4) */}
      {test && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Test</span>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <select
                  value={test.testId}
                  onChange={(e) => {
                    const found = tests.find((t) => t.testId === e.target.value);
                    if (found && onSelectTest) onSelectTest(found);
                  }}
                  className="rounded-xl border border-slate-200 bg-white py-1.5 pl-2.5 pr-8 text-xs font-bold text-slate-900 shadow-2xs focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {tests.map((t) => (
                    <option key={t.testId} value={t.testId}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status Badge */}
            <div className="mt-4 sm:mt-3">
              {useSampleData ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> Completed
                </span>
              ) : test.status === 'published' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <Calendar className="h-3.5 w-3.5" /> Scheduled
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Draft
                </span>
              )}
            </div>

            {/* Schedule Range */}
            <div className="mt-4 sm:mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <span>Schedule:</span>
              <span className="text-slate-900">
                {formatDisplayDate(test.startTime)} → {formatDisplayDate(test.endTime)}
              </span>
            </div>
          </div>

          {/* Switch Test button */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                const nextIdx = (tests.findIndex((t) => t.testId === test.testId) + 1) % tests.length;
                if (tests[nextIdx] && onSelectTest) onSelectTest(tests[nextIdx]);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5 text-slate-500" />
              <span>Switch Test</span>
            </button>
          </div>
        </div>
      )}

      {/* 4 Stat Cards Row (Matching Images 3 & 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Attempts */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Attempts</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {activeAttemptsList.length}
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Completed</div>
            <div className="text-2xl font-bold text-emerald-600 tabular-nums mt-0.5">
              {completedAttempts.length}
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <RotateCw className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">In Progress</div>
            <div className="text-2xl font-bold text-blue-600 tabular-nums mt-0.5">
              {inProgressAttempts.length}
            </div>
          </div>
        </div>

        {/* Average Score */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Average Score</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {averageScorePercent !== '—' ? `${averageScorePercent}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Row & Export (Matching Images 3 & 4) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate (name, ID, or email)"
            className="w-full rounded-xl border border-slate-200/80 bg-white pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 shadow-xs transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>

          {/* Export Results button */}
          {activeAttemptsList.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export Results</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Results Table or Empty State */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading attempts...</div>
        ) : filteredAttempts.length === 0 ? (
          /* Empty State (Matching Image 3) */
          <div>
            {/* Table Header to preserve structure as seen in Image 3 */}
            <div className="border-b border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs font-semibold text-slate-500 grid grid-cols-7">
              <span>Candidate</span>
              <span className="text-center">Attempt</span>
              <span className="text-center">Score</span>
              <span className="text-center">Percentage</span>
              <span className="text-center">Status</span>
              <span className="text-center">Submitted</span>
              <span className="text-center">Actions</span>
            </div>

            <div className="p-12 sm:p-16 text-center max-w-lg mx-auto">
              <div className="h-16 w-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <FileQuestion className="h-8 w-8" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                No attempts yet
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                This test is scheduled, but no candidate attempts have been recorded yet.
                Results will appear here once candidates start and submit their attempts.
              </p>
              <button
                type="button"
                onClick={() => setUseSampleData(true)}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <Info className="h-3.5 w-3.5" />
                <span>Load Sample Candidate Cohort</span>
              </button>
            </div>
          </div>
        ) : (
          /* Populated Candidates Table (Matching Image 4) */
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold">
                    <th className="py-3.5 px-4">Candidate</th>
                    <th className="py-3.5 px-4 text-center">Attempt</th>
                    <th className="py-3.5 px-4 text-center">Score</th>
                    <th className="py-3.5 px-4 text-center">Percentage</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Submitted</th>
                    <th className="py-3.5 px-4 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttempts.map((attempt) => {
                    const isCompleted = attempt.status !== 'in_progress';
                    const passPct = test?.passPercentage || 50;
                    const pct = attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : attempt.accuracy;
                    const isPassed = pct >= passPct;

                    return (
                      <tr key={attempt.attemptId} className="hover:bg-slate-50/60 transition-colors">
                        {/* Candidate Name & Avatar */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {getInitials(attempt.userName)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">
                                {attempt.userName}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {attempt.userEmail}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Attempt */}
                        <td className="py-3.5 px-4 text-center font-medium text-slate-700 tabular-nums">
                          1
                        </td>

                        {/* Score */}
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-800 tabular-nums">
                          {isCompleted ? `${attempt.score} / ${attempt.maxScore}` : '—'}
                        </td>

                        {/* Percentage */}
                        <td className="py-3.5 px-4 text-center font-bold text-blue-700 tabular-nums">
                          {isCompleted ? `${pct.toFixed(1)}%` : '—'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isCompleted ? (
                            isPassed ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                <Check className="h-3 w-3" /> Passed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                                <X className="h-3 w-3" /> Failed
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                              <RotateCw className="h-3 w-3 animate-spin" /> In Progress
                            </span>
                          )}
                        </td>

                        {/* Submitted */}
                        <td className="py-3.5 px-4 text-center text-slate-600 whitespace-nowrap">
                          {attempt.submittedAtIso ? formatDisplayDate(attempt.submittedAtIso) : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedAttempt(attempt)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-slate-700 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer font-medium"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination / Count Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <div>
                Showing 1–{filteredAttempts.length} of {activeAttemptsList.length} candidates
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled
                  className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="h-7 w-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  1
                </span>
                <button
                  type="button"
                  disabled
                  className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 disabled:opacity-50"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
