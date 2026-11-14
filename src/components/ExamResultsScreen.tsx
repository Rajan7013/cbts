import { useState } from 'react';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#dce7f8] via-[#eef3fb] to-[#e4ecf9] p-3 sm:p-6 lg:p-8 flex flex-col font-sans select-none">
      {/* Top Bar matching Images 1, 2, 3, 4, 5 (Desktop persistent, clean on mobile) */}
      <div
        className={`w-full max-w-7xl mx-auto flex items-center gap-2.5 pb-3 sm:pb-4 px-1 shrink-0 ${
          mode === 'review' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="h-8 sm:h-9 w-8 sm:w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
          EP
        </div>
        <span className="font-bold text-slate-900 text-sm">ExamPulse</span>
        <span className="text-slate-300">|</span>
        <span className="font-bold text-slate-800 text-sm">My Results</span>
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
        <main className="flex-1 p-3.5 sm:p-7 lg:p-8 pb-24 md:pb-8 overflow-y-auto bg-white/40">
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

              {/* Top 2-Column Grid: Score Card + Question Breakdown matching Image 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Card: Score Summary */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500 block">Score</span>
                    <div className="font-display font-bold text-2xl sm:text-3xl text-slate-900 leading-tight">
                      {attempt.score} / {attempt.maxScore}
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      ({percentage}%)
                    </div>
                    <div className="text-[11px] text-slate-400 pt-2">
                      Passing score: {test.passPercentage}%
                    </div>
                  </div>

                  <DonutScoreGauge percentage={percentage} size={88} strokeWidth={8} />
                </div>

                {/* Right Card: Question Breakdown matching Image 2 */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-3">
                  <span className="text-xs font-semibold text-slate-700 block">
                    Question breakdown
                  </span>

                  <div className="space-y-2">
                    {/* Correct */}
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-700">
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
                      <div className="flex items-center gap-2 text-slate-700">
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
                      <div className="flex items-center gap-2 text-slate-700">
                        <div className="h-5 w-5 rounded-md border border-slate-300 bg-white flex items-center justify-center" />
                        <span className="font-medium">Unanswered</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {unansweredCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Card: Attempt Summary matching Image 2 */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                <span className="text-xs font-semibold text-slate-700 block">
                  Attempt summary
                </span>

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
                        {answeredCount}
                      </span>
                    </div>
                  </div>

                  {/* Unanswered */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl border-2 border-slate-300 flex items-center justify-center shrink-0" />
                    <div>
                      <span className="text-[11px] text-slate-500 block">Unanswered</span>
                      <span className="font-display font-bold text-base text-slate-900">
                        {unansweredCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Marking scheme line */}
                <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                  <Info className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>
                    Marking scheme: +{test.marksPerQuestion || 4} marks for each correct answer,{' '}
                    {test.negativeMarking ? `-${test.negativeMarkValue}` : '0'} marks for a wrong answer.
                  </span>
                </div>
              </div>

              {/* Bottom Action Bar matching Image 2 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
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

              {/* Two-Column Grid: Left 70% Question, Right 30% Navigator matching Images 3 & 4 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column (Question Area) */}
                <div className="lg:col-span-8 rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-7 shadow-xs space-y-4 sm:space-y-5">
                  {/* Question Counter (Desktop) */}
                  <div className="hidden md:block text-xs font-bold text-slate-800">
                    Question {currentQuestionIndex + 1} of {questions.length}
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
                              <div className="text-xs sm:text-sm min-w-0 leading-relaxed font-medium">
                                <MathText text={opt.text} />
                              </div>

                              {/* Option image if present */}
                              {opt.imageUrl && (
                                <div className="mt-2.5">
                                  <QuestionImage
                                    src={opt.imageUrl}
                                    alt={`Option ${opt.id} diagram`}
                                    className="max-h-36 sm:max-h-48 w-auto rounded-xl object-contain border border-slate-200/80 p-1.5 bg-white shadow-2xs"
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
                    <span className="text-xs font-bold text-slate-900 block">
                      Question navigator
                    </span>

                    {/* Grid of buttons 1..N */}
                    <div className="grid grid-cols-5 gap-2">
                      {questions.map((q, idx) => {
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
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-4 py-2.5 flex items-center justify-between gap-3 shadow-xl">
          <button
            type="button"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileNavigator(true)}
            className="h-10 px-3.5 rounded-xl border border-blue-200 bg-blue-50/90 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
          >
            <span>{currentQuestionIndex + 1} / {questions.length}</span>
          </button>

          <button
            type="button"
            disabled={currentQuestionIndex === questions.length - 1}
            onClick={() => setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-colors"
          >
            <span>Next</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Mobile Bottom Bar for Summary Mode */}
      {mode === 'summary' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-4 py-2.5 flex items-center justify-between gap-3 shadow-xl">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Tests</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentQuestionIndex(0);
              setMode('review');
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
          >
            <FileText className="h-4 w-4" />
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
                <span className="text-[11px] text-slate-500">Tap any question to jump</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileNavigator(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[50vh] grid grid-cols-5 gap-2.5 py-1">
              {questions.map((q, idx) => {
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
