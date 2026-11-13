import { useState } from 'react';
import { ArrowLeft, ShieldAlert, Maximize2, Clock, CheckSquare } from 'lucide-react';
import { MediaPipeProctor } from './MediaPipeProctor';
import type { TestAttempt, TestExam } from '../types';

interface ExamBriefingScreenProps {
  test: TestExam;
  resumingAttempt?: TestAttempt;
  onBack: () => void;
  onLaunchExam: () => void;
}

export function ExamBriefingScreen({
  test,
  resumingAttempt,
  onBack,
  onLaunchExam,
}: ExamBriefingScreenProps) {
  const [agreed, setAgreed] = useState(false);

  const handleEnterFullscreenAndStart = async () => {
    if (test.enforceFullscreen && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Browsers inside restricted iframes may block fullscreen; exam still runs cleanly
      }
    }
    onLaunchExam();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Tests</span>
      </button>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-8 space-y-5 sm:space-y-6">
        <div className="border-b border-slate-200 pb-4 sm:pb-5">
          <p className="text-xs font-semibold text-blue-700">
            {resumingAttempt ? 'Resume Interrupted Assessment' : 'Pre-Exam Briefing & Proctoring Check'}
          </p>
          <h1 className="mt-1 font-display text-xl sm:text-2xl font-bold text-slate-900">{test.title}</h1>
          {test.description && <p className="mt-2 text-xs sm:text-sm text-slate-600">{test.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-3.5">
            <div className="text-xs text-slate-500">Duration</div>
            <div className="mt-1 font-mono text-base sm:text-lg font-semibold text-slate-900 tabular-nums">
              {test.durationMins} min
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-3.5">
            <div className="text-xs text-slate-500">Questions</div>
            <div className="mt-1 font-mono text-base sm:text-lg font-semibold text-slate-900 tabular-nums">
              {test.totalQuestions}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-3.5">
            <div className="text-xs text-slate-500">Marking Scheme</div>
            <div className="mt-1 font-mono text-base sm:text-lg font-semibold text-slate-900 tabular-nums">
              +{test.marksPerQuestion ?? 4} / {test.negativeMarking ? `-${test.negativeMarkValue}` : '0'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {test.negativeMarking ? 'correct / wrong penalty' : 'no negative marking'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-3.5">
            <div className="text-xs text-slate-500">Strike Limit</div>
            <div className="mt-1 font-mono text-base sm:text-lg font-semibold text-red-700 tabular-nums">
              {test.maxStrikes === 0 ? 'Warnings Only' : `${test.maxStrikes} Strikes`}
            </div>
          </div>
        </div>

        {resumingAttempt && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <Clock className="h-5 w-5 text-amber-700 shrink-0" />
            <div>
              Resuming from saved state: <strong>{Math.floor(resumingAttempt.remainingSeconds / 60)}m {resumingAttempt.remainingSeconds % 60}s</strong> remaining and{' '}
              <strong>{resumingAttempt.strikeCount}</strong> strike(s) previously recorded.
            </div>
          </div>
        )}

        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900 mb-2">
            Section Breakdown
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {test.sections.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs"
              >
                <span className="font-medium text-slate-800">{s.name}</span>
                <span className="font-mono font-semibold text-slate-600 tabular-nums">
                  {s.questionCount} Qs
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-900">
            <ShieldAlert className="h-4 w-4 text-red-700" />
            <span>Anti-Cheat &amp; Strike Policy</span>
          </div>
          <ul className="list-disc pl-5 text-xs leading-relaxed text-red-900/90 space-y-1">
            {test.enforceFullscreen && (
              <li>
                <strong>Fullscreen Lock:</strong> Exiting fullscreen mode immediately logs 1 Strike
                and pauses interaction until you re-enter fullscreen.
              </li>
            )}
            {test.detectTabSwitch && (
              <li>
                <strong>Tab &amp; Window Monitor:</strong> Switching browser tabs, minimizing, or
                clicking outside the exam window logs 1 Strike.
              </li>
            )}
            {test.proctoringAIEnabled && (
              <li>
                <strong>MediaPipe AI Proctor:</strong> Looking away / leaving frame or having
                multiple faces visible for &gt;3.5 seconds logs 1 Strike.
              </li>
            )}
            <li>
              <strong>Auto-Submit Rule:</strong>{' '}
              {test.maxStrikes > 0
                ? `Reaching ${test.maxStrikes} strikes automatically locks and submits your exam.`
                : 'Violations are logged for review.'}
            </li>
            <li>
              <strong>Resume Guarantee:</strong> Every answer and timer tick saves continuously—if
              your connection drops, you can return and click Resume Test.
            </li>
          </ul>
        </div>

        {test.proctoringAIEnabled && <MediaPipeProctor active={true} />}

        <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-700"
          />
          <span className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
            <CheckSquare className="h-4 w-4 text-slate-500 hidden" />
            I understand the fullscreen proctoring and strike auto-submit rules and am ready to begin.
          </span>
        </label>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={!agreed}
            onClick={handleEnterFullscreenAndStart}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Maximize2 className="h-4 w-4" />
            <span>
              {resumingAttempt
                ? 'Enter Fullscreen & Resume Test'
                : 'Enter Fullscreen & Start Test'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
