import { useMemo, useState } from 'react';
import {
  ClipboardList,
  BarChart2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  FileText,
  Info,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  History,
  Layers,
  Grid,
  ChevronDown,
  Hash,
  LogOut,
} from 'lucide-react';
import { DonutScoreGauge } from './DonutScoreGauge';
import { MathText } from './MathText';
import { QuestionImage } from './QuestionImage';
import type { TestAttempt, TestExam, TestQuestion, UserProfile } from '../types';

interface ExamResultsScreenProps {
  test: TestExam;
  questions: TestQuestion[];
  attempt: TestAttempt;
  allAttempts?: TestAttempt[];
  user?: UserProfile;
  onSelectAttempt?: (att: TestAttempt) => void;
  onRetakeTest?: () => void;
  onBackToDashboard: () => void;
  onSwitchToAdmin?: () => void;
  onSignOut?: () => void;
  initialMode?: 'summary' | 'review';
}

export function ExamResultsScreen({
  test,
  questions,
  attempt,
  allAttempts,
  user,
  onSelectAttempt,
  onRetakeTest,
  onBackToDashboard,
  onSwitchToAdmin,
  onSignOut,
  initialMode = 'summary',
}: ExamResultsScreenProps) {
  const [mode, setMode] = useState<'summary' | 'review'>(initialMode);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showMobileNavigator, setShowMobileNavigator] = useState(false);

  const isAdmin = user?.role === 'admin';

  const percentage =
    attempt.maxScore > 0 ? Math.max(0, Math.round((attempt.score / attempt.maxScore) * 100)) : 0;
  const passed = percentage >= (test.passPercentage || 50);

  const totalQuestions =
    test.totalQuestions || questions.length || 10;
  const answeredCount = (attempt.correctCount || 0) + (attempt.wrongCount || 0);
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  const currentQ: TestQuestion | undefined = questions[currentQuestionIndex];
  const currentResp = currentQ ? attempt.responses[currentQ.questionId] : undefined;
  const userSelectedOptId = currentResp?.selectedOptionId;

  const currentAttemptNumber = attempt.attemptNumber || 1;
  const maxAttempts = test.maxAttempts || 1;

  // Sorted attempts by attemptNumber ascending
  const sortedAttempts = useMemo(() => {
    if (!allAttempts || allAttempts.length === 0) return [attempt];
    const map = new Map<string, TestAttempt>();
    allAttempts.forEach((a) => map.set(a.attemptId, a));
    map.set(attempt.attemptId, attempt);
    const list = Array.from(map.values());
    list.sort((a, b) => (a.attemptNumber || 1) - (b.attemptNumber || 1));
    return list;
  }, [allAttempts, attempt]);

  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');

  // Effective sections inferred from test.sections or questions
  const effectiveSections = useMemo(() => {
    if (test.sections && test.sections.length > 0) {
      return test.sections;
    }
    const uniqueIds = Array.from(new Set(questions.map((q) => q.sectionId || 'default')));
    return uniqueIds.map((id, idx) => ({
      id,
      name: id === 'default' ? 'General Section' : `Section ${idx + 1}`,
      questionCount: questions.filter((q) => (q.sectionId || 'default') === id).length,
    }));
  }, [test.sections, questions]);

  // Section-by-section breakdown statistics
  const sectionStats = useMemo(() => {
    return effectiveSections.map((sec) => {
      const isSingle = effectiveSections.length === 1;
      const questionIndices: number[] = [];
      const secQuestions: TestQuestion[] = [];

      questions.forEach((q, idx) => {
        if (isSingle || (q.sectionId || 'default') === sec.id) {
          questionIndices.push(idx);
          secQuestions.push(q);
        }
      });

      const firstQuestionIndex = questionIndices.length > 0 ? questionIndices[0] : 0;
      let correct = 0;
      let wrong = 0;
      let unanswered = 0;
      let score = 0;
      let maxScore = 0;

      secQuestions.forEach((q) => {
        const resp = attempt.responses[q.questionId];
        const marks = Number(q.marks) || test.marksPerQuestion || 4;
        maxScore += marks;
        if (!resp || !resp.selectedOptionId) {
          unanswered++;
        } else if (resp.selectedOptionId === q.correctOptionId) {
          correct++;
          score += marks;
        } else {
          wrong++;
          if (test.negativeMarking) {
            score -= Number(test.negativeMarkValue) || 0;
          }
        }
      });

      const accuracy = maxScore > 0 ? Math.max(0, Math.round((score / maxScore) * 100)) : 0;

      return {
        section: sec,
        totalQuestions: secQuestions.length,
        questionIndices,
        firstQuestionIndex,
        correct,
        wrong,
        unanswered,
        score,
        maxScore,
        accuracy,
      };
    });
  }, [effectiveSections, questions, attempt.responses, test.marksPerQuestion, test.negativeMarking, test.negativeMarkValue]);

  const currentSection = useMemo(() => {
    if (!currentQ) return effectiveSections[0];
    return (
      effectiveSections.find((s) => s.id === (currentQ.sectionId || 'default')) || effectiveSections[0]
    );
  }, [effectiveSections, currentQ]);

  // Filtered question indices based on selected section tab
  const filteredQuestionIndices = useMemo(() => {
    if (selectedSectionFilter === 'all') {
      return questions.map((_, idx) => idx);
    }
    const sec = sectionStats.find((s) => s.section.id === selectedSectionFilter);
    return sec && sec.questionIndices.length > 0 ? sec.questionIndices : questions.map((_, idx) => idx);
  }, [selectedSectionFilter, sectionStats, questions]);

  // Horizontal Question Strip visible sliding window (9 numbers around current)
  const visiblePageNumbers = useMemo(() => {
    const list = filteredQuestionIndices;
    if (list.length <= 9) return list;
    const currentPos = list.indexOf(currentQuestionIndex);
    const pos = currentPos >= 0 ? currentPos : 0;
    const half = 4;
    let start = Math.max(0, pos - half);
    let end = Math.min(list.length, start + 9);
    if (end - start < 9) {
      start = Math.max(0, end - 9);
    }
    return list.slice(start, end);
  }, [filteredQuestionIndices, currentQuestionIndex]);

  // Status for the currently viewed question
  const isCurrentAnswered = Boolean(currentResp?.selectedOptionId);
  const isCurrentCorrect = isCurrentAnswered && currentResp?.selectedOptionId === currentQ?.correctOptionId;
  const isCurrentWrong = isCurrentAnswered && currentResp?.selectedOptionId !== currentQ?.correctOptionId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#dce7f8] via-[#eef3fb] to-[#e4ecf9] p-3 sm:p-6 lg:p-8 flex flex-col font-sans select-none pb-24 md:pb-8">
      {/* Top Bar matching Images 1, 2, 3, 4, 5 (Desktop persistent, clean on mobile) */}
      <div
        className={`w-full max-w-7xl mx-auto flex items-center justify-between pb-3 sm:pb-4 px-1 shrink-0 ${
          mode === 'review' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 sm:h-9 w-8 sm:w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
            EP
          </div>
          <span className="font-bold text-slate-900 text-sm">ExamPulse</span>
          <span className="text-slate-300">|</span>
          <span className="font-bold text-slate-800 text-sm">My Results</span>
        </div>

        {/* Right side: Student Profile + Log Out button */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 border border-slate-200/80 shadow-2xs">
            <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
              {(user?.displayName || user?.email || 'R').slice(0, 1).toUpperCase()}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </div>

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Container Card matching Images 1, 2, 3, 4, 5 */}
      <div className="w-full max-w-7xl mx-auto rounded-3xl border border-white/90 bg-white/80 shadow-xl shadow-blue-900/5 backdrop-blur-xl flex flex-col md:flex-row overflow-hidden min-h-[82vh] flex-1">
        {/* Left Sidebar on Desktop */}
        <aside className="hidden md:flex md:w-60 lg:w-64 border-r border-slate-100 bg-white/60 p-4 sm:p-5 flex-col justify-between shrink-0">
          <nav className="space-y-2">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-all cursor-pointer"
            >
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span>Available Tests</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('summary')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold bg-blue-100/70 text-blue-700 shadow-2xs transition-all cursor-pointer"
            >
              <BarChart2 className="h-4 w-4 shrink-0" />
              <span>My Results</span>
            </button>
          </nav>

          {/* Bottom Back to Admin Studio if Admin & Sign Out */}
          <div className="space-y-2 pt-4 border-t border-slate-100 mt-auto">
            {isAdmin && onSwitchToAdmin && (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="w-full inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer p-2 rounded-xl hover:bg-white/70"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                <span>Back to Admin Studio</span>
              </button>
            )}

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4 shrink-0 text-rose-500" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </aside>

        {/* Right Main Content Area */}
        <main className="flex-1 p-3.5 sm:p-7 lg:p-8 pb-32 md:pb-8 overflow-y-auto bg-white/40">
          {/* ======================================================== */}
          {/* VIEW 1: YOUR RESULT SUMMARY (Matching Image 2)           */}
          {/* ======================================================== */}
          {mode === 'summary' && (
            <div className="space-y-6">
              {/* Header Title with Right Pill matching Image 2 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    Your result
                  </h1>
                  {/* Test Title & Status Badge */}
                  <div className="flex flex-wrap items-center gap-2.5 mt-2">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      {test.title}
                    </h2>
                    <span className="text-slate-300">|</span>
                    {passed ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-0.5 text-xs font-semibold">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Passed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-3 py-0.5 text-xs font-semibold">
                        <X className="h-3.5 w-3.5 text-rose-600" />
                        <span>Failed</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Attempt # Pill on right matching Image 2 */}
                <div className="shrink-0 self-start sm:self-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 px-3.5 py-1 text-xs font-semibold">
                    <Info className="h-3.5 w-3.5 text-purple-600" />
                    <span>
                      Attempt #{currentAttemptNumber} of {maxAttempts}
                    </span>
                  </span>
                </div>
              </div>

              {/* Multi-Attempt Switcher Tabs (shows all attempts when candidate has taken 2+ attempts) */}
              {sortedAttempts.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-700">
                      Switch Attempt ({sortedAttempts.length} of {maxAttempts}):
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {sortedAttempts.map((att) => {
                      const isSelected = att.attemptId === attempt.attemptId;
                      const attPct =
                        att.maxScore > 0 ? Math.max(0, Math.round((att.score / att.maxScore) * 100)) : 0;
                      const attPassed = attPct >= (test.passPercentage || 50);
                      return (
                        <button
                          key={att.attemptId}
                          type="button"
                          onClick={() => {
                            if (onSelectAttempt && !isSelected) {
                              onSelectAttempt(att);
                            }
                          }}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold shadow-xs ring-2 ring-blue-400/40'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                          }`}
                        >
                          <span>Attempt #{att.attemptNumber || 1}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : attPassed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {attPct}%
                          </span>
                          {isSelected && <span className="text-[10px] opacity-85">(Active)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Grid: Score Card + Results Summary matching Reference Design */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Score Summary Card */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 block">Score</span>
                    <div className="font-display font-bold text-2xl sm:text-3xl text-slate-900 leading-tight">
                      {attempt.score} / {attempt.maxScore}
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      ({percentage}%)
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1">
                      Passing score: {test.passPercentage || 50}%
                    </div>
                  </div>

                  <DonutScoreGauge percentage={percentage} size={84} strokeWidth={8} />
                </div>

                {/* Results Summary Card matching Reference Design */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-3">
                  <span className="text-xs font-bold text-slate-900 block">
                    Results summary
                  </span>

                  <div className="space-y-2">
                    {/* Correct */}
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 text-slate-700">
                        <div className="h-5 w-5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-medium">Correct</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {attempt.correctCount || 0}
                      </span>
                    </div>

                    {/* Incorrect */}
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 text-slate-700">
                        <div className="h-5 w-5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
                          <X className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-medium">Incorrect</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {attempt.wrongCount || 0}
                      </span>
                    </div>

                    {/* Unanswered */}
                    <div className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2.5 text-slate-700">
                        <div className="h-5 w-5 rounded-md border border-slate-300 bg-white flex items-center justify-center" />
                        <span className="font-medium">Unanswered</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {unansweredCount}
                      </span>
                    </div>

                    {/* Answered Highlighted Row */}
                    <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-blue-50/80 border border-blue-100/90 text-blue-900 font-semibold mt-1.5">
                      <div className="flex items-center gap-2 text-blue-700">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span>Answered</span>
                      </div>
                      <span className="font-mono font-bold text-blue-900">
                        {answeredCount} of {totalQuestions}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Marking Scheme Callout Banner */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-center gap-2.5 text-xs text-blue-800">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  Marking scheme: +{test.marksPerQuestion || 1} marks for each correct answer,{' '}
                  {test.negativeMarking ? `-${test.negativeMarkValue}` : '0'} marks for a wrong answer.
                </span>
              </div>

              {/* ======================================================== */}
              {/* SECTION-BY-SECTION PERFORMANCE & QUICK JUMP              */}
              {/* ======================================================== */}
              {effectiveSections.length > 1 && (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-display text-base sm:text-lg font-bold text-slate-900">
                          Section Performance
                        </h3>
                        <p className="text-xs text-slate-500">
                          Jump straight into review for any section or explore accuracy section-by-section.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl self-start sm:self-center">
                      {effectiveSections.length} Sections · {questions.length} Questions
                    </span>
                  </div>

                  <div className="space-y-3">
                    {sectionStats.map((stat) => {
                      const cleanSecName = stat.section.name.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '');
                      return (
                        <div
                          key={stat.section.id}
                          className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-2.5 hover:border-blue-300 transition-colors shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 truncate">
                                {cleanSecName}
                              </h4>
                              <p className="text-[11px] sm:text-xs text-slate-500">
                                {stat.totalQuestions} Questions · Max: {stat.maxScore} pts
                              </p>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                              {stat.accuracy}%
                            </span>
                          </div>

                          {/* Row with 3 pills on left and Review button on right matching Reference Screenshot */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2.5 py-1 text-[11px] font-semibold">
                                {stat.correct} Correct
                              </span>
                              <span className="bg-purple-50 text-purple-700 border border-purple-100 rounded-lg px-2.5 py-1 text-[11px] font-semibold">
                                {stat.wrong} Wrong
                              </span>
                              <span className="bg-slate-50 text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-semibold">
                                {stat.unanswered} Blank
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setCurrentQuestionIndex(stat.firstQuestionIndex);
                                setSelectedSectionFilter(stat.section.id);
                                setMode('review');
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs shrink-0"
                            >
                              <span>Review</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* ALL ATTEMPTS BREAKDOWN & SCORE HISTORY TABLE             */}
              {/* ======================================================== */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-blue-600" />
                      <h3 className="font-display text-base sm:text-lg font-bold text-slate-900">
                        All Attempts History ({sortedAttempts.length} of {maxAttempts})
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Scores, accuracy, and question answers for each of your test attempts.
                    </p>
                  </div>

                  {maxAttempts > sortedAttempts.length && onRetakeTest && (
                    <div>
                      <button
                        type="button"
                        onClick={onRetakeTest}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-xs font-bold text-blue-700 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Retake Test ({maxAttempts - sortedAttempts.length} left)</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3.5 whitespace-nowrap">Attempt</th>
                        <th className="py-3 px-3 whitespace-nowrap">Submitted At</th>
                        <th className="hidden sm:table-cell py-3 px-3 whitespace-nowrap">Score</th>
                        <th className="hidden sm:table-cell py-3 px-3 whitespace-nowrap">Percentage</th>
                        <th className="hidden sm:table-cell py-3 px-3 whitespace-nowrap">Correct / Wrong / Blank</th>
                        <th className="hidden sm:table-cell py-3 px-3 whitespace-nowrap">Status</th>
                        <th className="hidden sm:table-cell py-3 px-3.5 whitespace-nowrap text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedAttempts.map((att) => {
                        const isCurrent = att.attemptId === attempt.attemptId;
                        const attPct =
                          att.maxScore > 0 ? Math.max(0, Math.round((att.score / att.maxScore) * 100)) : 0;
                        const attPassed = attPct >= (test.passPercentage || 50);
                        const totalQ = test.totalQuestions || questions.length || 10;
                        const ans = (att.correctCount || 0) + (att.wrongCount || 0);
                        const unans = Math.max(0, totalQ - ans);
                        const dateStr = att.submittedAtIso || att.lastActiveAtIso || att.startedAtIso;
                        const dObj = dateStr ? new Date(dateStr) : null;
                        const formattedDate = dObj && !isNaN(dObj.getTime())
                          ? dObj.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }) +
                            ' · ' +
                            dObj.toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Recently';

                        return (
                          <tr
                            key={att.attemptId}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isCurrent ? 'bg-blue-50/40 font-semibold' : ''
                            }`}
                          >
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <span className="font-display font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                                  Attempt #{att.attemptNumber || 1}
                                </span>
                                {isCurrent && (
                                  <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 whitespace-nowrap">
                                    Active
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-medium font-sans">
                              {formattedDate}
                            </td>
                            <td className="hidden sm:table-cell py-3 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                              {att.score} / {att.maxScore}
                            </td>
                            <td className="hidden sm:table-cell py-3 px-3 whitespace-nowrap font-mono font-bold">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
                                  attPassed ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
                                }`}
                              >
                                {attPct}%
                              </span>
                            </td>
                            <td className="hidden sm:table-cell py-3 px-3 whitespace-nowrap font-mono text-xs">
                              <span className="text-emerald-600 font-bold">{att.correctCount || 0} ✓</span>
                              <span className="text-slate-300 mx-1">|</span>
                              <span className="text-purple-600 font-bold">{att.wrongCount || 0} ✕</span>
                              <span className="text-slate-300 mx-1">|</span>
                              <span className="text-slate-500">{unans} –</span>
                            </td>
                            <td className="hidden sm:table-cell py-3 px-3 whitespace-nowrap">
                              {attPassed ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                  <Check className="h-3 w-3" /> Passed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                  <X className="h-3 w-3" /> Failed
                                </span>
                              )}
                            </td>
                            <td className="hidden sm:table-cell py-3 px-3.5 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-2 justify-end whitespace-nowrap">
                                {!isCurrent && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectAttempt?.(att)}
                                    className="px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                                  >
                                    View Score
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isCurrent) {
                                      onSelectAttempt?.(att);
                                    }
                                    setCurrentQuestionIndex(0);
                                    setMode('review');
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                                >
                                  <FileText className="h-3 w-3" />
                                  <span>Review Answers</span>
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

              {/* Bottom Action Bar matching Image 2 */}
              <div className="hidden sm:flex flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to My Results</span>
                </button>

                <div className="flex items-center gap-2">
                  {onRetakeTest && currentAttemptNumber < maxAttempts && (
                    <button
                      type="button"
                      onClick={onRetakeTest}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Retake Test</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentQuestionIndex(0);
                      setMode('review');
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Review answers</span>
                  </button>
                </div>
              </div>

              {/* Sticky Bottom Action Bar on Mobile for Summary Mode */}
              <div
                className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-4 py-2.5 shadow-2xl flex items-center gap-3"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
              >
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Tests</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentQuestionIndex(0);
                    setMode('review');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Review Answers</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: ANSWER REVIEW (Matching Images 3 & 4)            */}
          {/* ======================================================== */}
          {mode === 'review' && currentQ && (
            <div className="space-y-4 sm:space-y-6">
              {/* Mobile Compact Sticky Top Bar for Answer Review */}
              <div className="md:hidden sticky -top-3.5 sm:-top-7 z-20 -mx-3.5 sm:-mx-7 -mt-3.5 sm:-mt-7 mb-3 bg-white/95 backdrop-blur-md px-3.5 py-2.5 border-b border-slate-200/90 flex items-center justify-between gap-2 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setMode('summary')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50/90 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Result</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Q {currentQuestionIndex + 1} of {questions.length}
                  </span>
                  <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-full">
                    Att #{currentAttemptNumber}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMobileNavigator(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <span>Grid</span>
                </button>
              </div>

              {/* Desktop Header Title with Subtitle & Back to Result matching Images 3 & 4 */}
              <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    Answer review
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <span className="font-display text-base font-bold text-slate-900">
                      {test.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMode('summary')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Back to result</span>
                    </button>
                  </div>
                </div>

                {/* Attempt # Pill on right */}
                <div className="shrink-0 self-start sm:self-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 px-3.5 py-1 text-xs font-semibold">
                    <Info className="h-3.5 w-3.5 text-purple-600" />
                    <span>
                      Attempt #{currentAttemptNumber} of {maxAttempts}
                    </span>
                  </span>
                </div>
              </div>

              {/* Attempt Switcher in Review mode if 2+ attempts */}
              {sortedAttempts.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-700">
                      Reviewing Attempt ({sortedAttempts.length} of {maxAttempts}):
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {sortedAttempts.map((att) => {
                      const isSelected = att.attemptId === attempt.attemptId;
                      const attPct =
                        att.maxScore > 0 ? Math.max(0, Math.round((att.score / att.maxScore) * 100)) : 0;
                      const attPassed = attPct >= (test.passPercentage || 50);
                      return (
                        <button
                          key={att.attemptId}
                          type="button"
                          onClick={() => {
                            if (onSelectAttempt && !isSelected) {
                              onSelectAttempt(att);
                            }
                          }}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold shadow-xs ring-2 ring-blue-400/40'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                          }`}
                        >
                          <span>Attempt #{att.attemptNumber || 1}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : attPassed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {attPct}%
                          </span>
                          {isSelected && <span className="text-[10px] opacity-85">(Active)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* SECTION SWITCHER TABS (Jump to any section)              */}
              {/* ======================================================== */}
              {effectiveSections.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">Sections:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedSectionFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedSectionFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span>All Sections ({questions.length})</span>
                    </button>
                    {sectionStats.map((stat) => {
                      const isFilterSelected = selectedSectionFilter === stat.section.id;
                      const isCurSec = currentSection.id === stat.section.id;
                      const cleanName = stat.section.name.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '');
                      return (
                        <button
                          key={stat.section.id}
                          type="button"
                          onClick={() => {
                            setSelectedSectionFilter(stat.section.id);
                            setCurrentQuestionIndex(stat.firstQuestionIndex);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                            isFilterSelected
                              ? 'bg-blue-600 text-white font-bold shadow-xs ring-2 ring-blue-400/40'
                              : isCurSec
                              ? 'bg-blue-50 text-blue-700 border border-blue-300 font-bold'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                          }`}
                        >
                          <span>{cleanName}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                              isFilterSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            {stat.correct}/{stat.totalQuestions} ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* HORIZONTAL CBT QUESTION STRIP & DIRECT QUESTION JUMPER   */}
              {/* ======================================================== */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                {/* Left: Previous, Page Numbers, Next */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
                  <button
                    type="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
                    className="h-8 w-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs transition-colors shrink-0 shadow-2xs"
                    title="Previous Question"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {visiblePageNumbers.map((idx) => {
                    const q = questions[idx];
                    const resp = attempt.responses[q?.questionId];
                    const isCur = idx === currentQuestionIndex;
                    const isAns = Boolean(resp?.selectedOptionId);
                    const isCor = isAns && resp?.selectedOptionId === q?.correctOptionId;
                    const isWr = isAns && resp?.selectedOptionId !== q?.correctOptionId;

                    let btnBg = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60';
                    if (isCor) {
                      btnBg = 'bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700';
                    } else if (isWr) {
                      btnBg = 'bg-purple-600 text-white border border-purple-600 hover:bg-purple-700';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentQuestionIndex(idx)}
                        className={`h-8 min-w-8 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${btnBg} ${
                          isCur ? 'ring-2 ring-blue-600 shadow-xs ring-offset-1 font-extrabold scale-105' : ''
                        }`}
                        title={`Jump to Question ${idx + 1}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentQuestionIndex === questions.length - 1}
                    onClick={() => setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
                    className="h-8 w-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs transition-colors shrink-0 shadow-2xs"
                    title="Next Question"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Right: Quick Jump Select Dropdown */}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap hidden sm:inline flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 text-blue-600" />
                    <span>Jump to Question:</span>
                  </span>
                  <div className="relative">
                    <select
                      value={currentQuestionIndex}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setCurrentQuestionIndex(idx);
                        const q = questions[idx];
                        if (q?.sectionId && selectedSectionFilter !== 'all' && selectedSectionFilter !== q.sectionId) {
                          setSelectedSectionFilter('all');
                        }
                      }}
                      className="h-8 pl-3 pr-8 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-blue-500 appearance-none shadow-2xs"
                    >
                      {questions.map((q, idx) => {
                        const resp = attempt.responses[q.questionId];
                        const isAns = Boolean(resp?.selectedOptionId);
                        const isCor = isAns && resp?.selectedOptionId === q.correctOptionId;
                        const isWr = isAns && resp?.selectedOptionId !== q.correctOptionId;
                        const sym = isCor ? '✓ Correct' : isWr ? '✕ Incorrect' : '– Blank';
                        const secObj = effectiveSections.find((s) => s.id === (q.sectionId || 'default'));
                        const secTag = secObj ? `${secObj.name.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '').slice(0, 10)} · ` : '';
                        return (
                          <option key={q.questionId} value={idx}>
                            Q{idx + 1}: {secTag}({sym})
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Two-Column Grid: Left 70% Question, Right 30% Navigator matching Images 3 & 4 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column (Question Area) */}
                <div className="lg:col-span-8 rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-7 shadow-xs space-y-4 sm:space-y-5">
                  {/* Question Header: Section tag + Counter + Status pill */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-bold shadow-2xs">
                        <Layers className="h-3.5 w-3.5 text-blue-600" />
                        <span>{currentSection.name.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '')}</span>
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      {isCurrentCorrect && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full">
                          <Check className="h-3.5 w-3.5" /> Correct (+{currentQ.marks || test.marksPerQuestion || 4} marks)
                        </span>
                      )}
                      {isCurrentWrong && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-0.5 rounded-full">
                          <X className="h-3.5 w-3.5" /> Incorrect ({test.negativeMarking ? `-${test.negativeMarkValue}` : '0'} marks)
                        </span>
                      )}
                      {!isCurrentAnswered && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-0.5 rounded-full">
                          – Unanswered (0 marks)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Stem with LaTeX support */}
                  <div className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                    <MathText text={currentQ.questionText} />
                  </div>

                  {/* Question Reference Diagram if present */}
                  {(currentQ.questionImageUrl || currentQ.imageUrl) && (
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-3 overflow-hidden shadow-2xs">
                      <QuestionImage
                        src={currentQ.questionImageUrl || currentQ.imageUrl}
                        alt={`Question ${currentQuestionIndex + 1} diagram`}
                        className="w-full max-h-64 sm:max-h-96 object-contain rounded-xl"
                        allowZoom={true}
                      />
                    </div>
                  )}

                  {/* 4 Options matching Images 3 & 4 */}
                  <div className="space-y-3 pt-1">
                    {currentQ.options.map((opt) => {
                      const isCorrect = opt.id === currentQ.correctOptionId;
                      const isUserChoice = opt.id === userSelectedOptId;

                      // Exact styling states matching Images 3 & 4
                      let containerStyle = 'border-slate-200 bg-white text-slate-800';
                      let radioStyle = 'border-slate-300 bg-white';
                      let isRadioFilled = false;

                      if (isCorrect && isUserChoice) {
                        // Candidate was correct (Image 4 Option B)
                        containerStyle = 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-semibold';
                        radioStyle = 'border-emerald-600 bg-emerald-500';
                        isRadioFilled = true;
                      } else if (isCorrect && !isUserChoice) {
                        // Correct answer (Image 3 Option C)
                        containerStyle = 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-semibold';
                        radioStyle = 'border-emerald-500 bg-white';
                      } else if (isUserChoice && !isCorrect) {
                        // Candidate was incorrect (Image 3 Option B)
                        containerStyle = 'border-purple-300 bg-purple-50/70 text-purple-950 font-semibold';
                        radioStyle = 'border-purple-600 bg-purple-600';
                        isRadioFilled = true;
                      }

                      const rawText = (opt.text || '').trim();
                      const isPlaceholder = /^see\s*(structural\s*formula\s*in\s*)?option[a-d]?imageurl\.?$/i.test(rawText);
                      const displayText = isPlaceholder ? '' : rawText;

                      return (
                        <div
                          key={opt.id}
                          className={`rounded-2xl border p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${containerStyle}`}
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            {/* Radio circle */}
                            <div
                              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${radioStyle}`}
                            >
                              {isRadioFilled && (
                                <div className="h-2 w-2 rounded-full bg-white" />
                              )}
                            </div>

                            {/* Option Text & Option Image */}
                            <div className="flex-1 min-w-0">
                              {displayText && (
                                <div className="text-xs sm:text-sm min-w-0 leading-relaxed font-medium">
                                  <MathText text={displayText} />
                                </div>
                              )}

                              {/* Option image if present */}
                              {opt.imageUrl && (
                                <div className={`${displayText ? 'mt-2.5' : ''} inline-block`}>
                                  <QuestionImage
                                    src={opt.imageUrl}
                                    alt={`Option ${opt.id} diagram`}
                                    className="max-h-24 sm:max-h-36 w-auto rounded-xl object-contain border border-slate-200/80 p-1.5 bg-white shadow-2xs"
                                    allowZoom={true}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Badges matching Images 3 & 4 */}
                          <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center pl-8 sm:pl-0">
                            {/* If User Answered Correctly (Both badges shown side-by-side in Image 4) */}
                            {isCorrect && isUserChoice && (
                              <>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-[11px] font-bold">
                                  <Check className="h-3 w-3" />
                                  <span>Your answer</span>
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-[11px] font-bold">
                                  <Check className="h-3 w-3" />
                                  <span>Correct answer</span>
                                </span>
                              </>
                            )}

                            {/* If User Answered Incorrectly (Image 3 Option B) */}
                            {isUserChoice && !isCorrect && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 px-3 py-1 text-[11px] font-bold">
                                <X className="h-3 w-3" />
                                <span>Your answer (Incorrect)</span>
                              </span>
                            )}

                            {/* If Correct Answer not picked (Image 3 Option C) */}
                            {isCorrect && !isUserChoice && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-[11px] font-bold">
                                <Check className="h-3 w-3" />
                                <span>Correct answer</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Box matching Images 3 & 4 */}
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                      <Info className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>Explanation</span>
                    </div>

                    <div className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                      <MathText text={currentQ.shortExplanation || 'No explanation provided.'} />
                    </div>

                    {/* Solution Diagram if present */}
                    {(currentQ.solutionImageUrl || currentQ.solution?.imageUrl) && (
                      <div className="pt-2">
                        <QuestionImage
                          src={currentQ.solutionImageUrl || currentQ.solution?.imageUrl}
                          alt="Solution diagram"
                          className="max-h-56 sm:max-h-72 w-auto rounded-xl object-contain border border-slate-200/80 p-1.5 bg-white shadow-2xs"
                          allowZoom={true}
                        />
                      </div>
                    )}
                  </div>

                  {/* Bottom Navigation Buttons matching Images 3 & 4 (Desktop view) */}
                  <div className="hidden sm:flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Previous Question</span>
                    </button>

                    <button
                      type="button"
                      disabled={currentQuestionIndex === questions.length - 1}
                      onClick={() => setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-xs"
                    >
                      <span>Next Question</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right Column: Score Card & Question Navigator matching Images 3 & 4 */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Score Card with Donut Gauge */}
                  <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          Score
                        </span>
                        <div className="font-display font-bold text-2xl text-slate-900 leading-tight">
                          {attempt.score} / {attempt.maxScore}
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          ({percentage}%)
                        </span>
                      </div>
                      <DonutScoreGauge percentage={percentage} size={74} strokeWidth={7} />
                    </div>

                    {/* Breakdown counts */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <div className="h-4 w-4 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                          <span>Correct</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          {attempt.correctCount || 0}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <div className="h-4 w-4 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
                            <X className="h-3 w-3" />
                          </div>
                          <span>Incorrect</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          {attempt.wrongCount || 0}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <div className="h-4 w-4 rounded border border-slate-300 bg-white" />
                          <span>Unanswered</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          {unansweredCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Question Navigator matching Images 3 & 4 */}
                  <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-900 block">
                        Question navigator
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        {filteredQuestionIndices.length} {selectedSectionFilter === 'all' ? 'total' : 'in section'}
                      </span>
                    </div>

                    {/* Section Filter Pills */}
                    {effectiveSections.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedSectionFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            selectedSectionFilter === 'all'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          All ({questions.length})
                        </button>
                        {effectiveSections.map((sec) => {
                          const isSel = selectedSectionFilter === sec.id;
                          const cleanName = sec.name.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '');
                          const count = questions.filter((q) => (q.sectionId || 'default') === sec.id).length;
                          return (
                            <button
                              key={sec.id}
                              type="button"
                              onClick={() => {
                                setSelectedSectionFilter(sec.id);
                                const secStat = sectionStats.find((s) => s.section.id === sec.id);
                                if (secStat) setCurrentQuestionIndex(secStat.firstQuestionIndex);
                              }}
                              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                isSel
                                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {cleanName} ({count})
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Grid of buttons 1..N */}
                    <div className="max-h-[320px] sm:max-h-[380px] overflow-y-auto pr-1 grid grid-cols-5 gap-2">
                      {filteredQuestionIndices.map((idx) => {
                        const q = questions[idx];
                        if (!q) return null;
                        const isCurrent = idx === currentQuestionIndex;
                        const resp = attempt.responses[q.questionId];
                        const isUserAnswered = Boolean(resp?.selectedOptionId);
                        const isUserCorrect = isUserAnswered && resp?.selectedOptionId === q.correctOptionId;
                        const isUserWrong = isUserAnswered && resp?.selectedOptionId !== q.correctOptionId;

                        let btnStyle = 'border border-blue-200 bg-blue-50/50 text-blue-800';
                        let symbol = '–';

                        if (isUserCorrect) {
                          btnStyle = 'border border-emerald-300 bg-emerald-50/80 text-emerald-800';
                          symbol = '✓';
                        } else if (isUserWrong) {
                          btnStyle = 'border border-purple-300 bg-purple-50/80 text-purple-800';
                          symbol = '✕';
                        }

                        return (
                          <button
                            key={q.questionId}
                            type="button"
                            onClick={() => setCurrentQuestionIndex(idx)}
                            className={`h-11 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all cursor-pointer ${btnStyle} ${
                              isCurrent ? 'ring-2 ring-blue-600 shadow-xs ring-offset-1 font-extrabold scale-105' : 'hover:opacity-90'
                            }`}
                            title={`Jump to Question ${idx + 1}`}
                          >
                            <span className="leading-none">{idx + 1}</span>
                            <span className="text-[10px] leading-tight font-extrabold mt-0.5">
                              {symbol}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend matching Images 3 & 4 */}
                    <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px] font-semibold text-slate-600">
                      <div className="flex items-center gap-1.5 text-emerald-800">
                        <span>✓</span>
                        <span>Correct ({attempt.correctCount || 0})</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-purple-800">
                        <span>✕</span>
                        <span>Incorrect ({attempt.wrongCount || 0})</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-blue-700">
                        <span>–</span>
                        <span>Unanswered ({unansweredCount})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation for Answer Review */}
      {mode === 'review' && (
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-4 pt-2.5 shadow-2xl flex items-center justify-between gap-3"
          style={{ paddingBottom: 'max(1.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))' }}
        >
          <button
            type="button"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileNavigator(true)}
            className="h-10 px-4 rounded-2xl border border-blue-200 bg-blue-50/90 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
          >
            <span>{currentQuestionIndex + 1} / {questions.length}</span>
          </button>

          <button
            type="button"
            disabled={currentQuestionIndex === questions.length - 1}
            onClick={() => setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-colors"
          >
            <span>Next</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      )}

      {/* Mobile Bottom Bar for Summary Mode */}
      {mode === 'summary' && (
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-4 pt-2.5 shadow-2xl flex items-center justify-between gap-3"
          style={{ paddingBottom: 'max(1.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))' }}
        >
          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to Tests</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentQuestionIndex(0);
              setMode('review');
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span>Review answers</span>
          </button>
        </div>
      )}

      {/* Mobile Question Navigator Drawer / Modal */}
      {showMobileNavigator && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end">
          <div
            className="fixed inset-0"
            onClick={() => setShowMobileNavigator(false)}
          />
          <div className="relative bg-white rounded-t-3xl p-5 shadow-2xl max-h-[80vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">Question Navigator</h3>
                <span className="text-[11px] text-slate-500">Tap any question or section to jump</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileNavigator(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Section Filter Pills */}
            {effectiveSections.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedSectionFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    selectedSectionFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  All ({questions.length})
                </button>
                {effectiveSections.map((sec) => {
                  const isSel = selectedSectionFilter === sec.id;
                  const cleanSecName = sec.name.replace(/^(?:section\s*[a-z0-9]*\s*:\s*)/i, '');
                  const count = questions.filter((q) => (q.sectionId || 'default') === sec.id).length;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setSelectedSectionFilter(sec.id);
                        const secStat = sectionStats.find((s) => s.section.id === sec.id);
                        if (secStat) setCurrentQuestionIndex(secStat.firstQuestionIndex);
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        isSel
                          ? 'bg-blue-600 text-white font-bold shadow-2xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cleanSecName} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="overflow-y-auto max-h-[50vh] grid grid-cols-5 gap-2.5 py-1">
              {filteredQuestionIndices.map((idx) => {
                const q = questions[idx];
                if (!q) return null;
                const isCurrent = idx === currentQuestionIndex;
                const resp = attempt.responses[q.questionId];
                const isUserAnswered = Boolean(resp?.selectedOptionId);
                const isUserCorrect = isUserAnswered && resp?.selectedOptionId === q.correctOptionId;
                const isUserWrong = isUserAnswered && resp?.selectedOptionId !== q.correctOptionId;

                let btnStyle = 'border border-blue-200 bg-blue-50/50 text-blue-800';
                let symbol = '–';

                if (isUserCorrect) {
                  btnStyle = 'border border-emerald-300 bg-emerald-50/80 text-emerald-800';
                  symbol = '✓';
                } else if (isUserWrong) {
                  btnStyle = 'border border-purple-300 bg-purple-50/80 text-purple-800';
                  symbol = '✕';
                }

                return (
                  <button
                    key={q.questionId}
                    type="button"
                    onClick={() => {
                      setCurrentQuestionIndex(idx);
                      setShowMobileNavigator(false);
                    }}
                    className={`h-12 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all cursor-pointer ${btnStyle} ${
                      isCurrent ? 'ring-2 ring-blue-600 shadow-xs' : 'hover:opacity-90'
                    }`}
                  >
                    <span className="leading-none">{idx + 1}</span>
                    <span className="text-[10px] leading-tight font-extrabold mt-0.5">
                      {symbol}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-around text-xs font-semibold">
              <span className="text-emerald-700">✓ Correct ({attempt.correctCount || 0})</span>
              <span className="text-purple-700">✕ Incorrect ({attempt.wrongCount || 0})</span>
              <span className="text-blue-700">– Unanswered ({unansweredCount})</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
