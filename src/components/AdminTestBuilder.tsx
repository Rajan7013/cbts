import { useRef, useState } from 'react';
import { ArrowRight, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AdminBuilderStepper } from './AdminBuilderStepper';
import { generateId } from '../lib/dataService';
import type { TestExam, TestSection } from '../types';

interface AdminTestBuilderProps {
  initialTest: TestExam | null;
  createdByUid: string;
  onCancel: () => void;
  onSaveAndContinue: (test: TestExam) => Promise<void>;
}

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function AdminTestBuilder({
  initialTest,
  createdByUid,
  onCancel,
  onSaveAndContinue,
}: AdminTestBuilderProps) {
  const defaultStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const defaultEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [title, setTitle] = useState(initialTest?.title || '');
  const [description, setDescription] = useState(initialTest?.description || '');
  const [startLocal, setStartLocal] = useState(
    toLocalDatetimeInput(initialTest?.startTime || defaultStart)
  );
  const [endLocal, setEndLocal] = useState(
    toLocalDatetimeInput(initialTest?.endTime || defaultEnd)
  );
  const [durationMins, setDurationMins] = useState(initialTest?.durationMins ?? 20);
  const [totalQuestions, setTotalQuestions] = useState(initialTest?.totalQuestions ?? 6);
  const [passPercentage, setPassPercentage] = useState(initialTest?.passPercentage ?? 50);
  const [marksPerQuestionInput, setMarksPerQuestionInput] = useState(
    String(initialTest?.marksPerQuestion ?? 4)
  );
  const [negativeMarking, setNegativeMarking] = useState(initialTest?.negativeMarking ?? false);
  const [negativeMarkInput, setNegativeMarkInput] = useState(
    String(initialTest?.negativeMarking ? initialTest?.negativeMarkValue ?? 1 : 1)
  );
  const [maxStrikes, setMaxStrikes] = useState(initialTest?.maxStrikes ?? 3);
  const [maxAttempts, setMaxAttempts] = useState<number>(initialTest?.maxAttempts ?? 1);
  const [enforceFullscreen, setEnforceFullscreen] = useState(
    initialTest?.enforceFullscreen ?? true
  );
  const [detectTabSwitch, setDetectTabSwitch] = useState(initialTest?.detectTabSwitch ?? true);
  const [proctoringAIEnabled, setProctoringAIEnabled] = useState(
    initialTest?.proctoringAIEnabled ?? false
  );
  const [sections, setSections] = useState<TestSection[]>(
    initialTest?.sections?.length
      ? initialTest.sections
      : [
          { id: generateId('sec'), name: 'Section A: Core Concepts', questionCount: 3 },
          { id: generateId('sec'), name: 'Section B: Problem Solving', questionCount: 3 },
        ]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const sectionSum = sections.reduce((sum, s) => sum + (Number(s.questionCount) || 0), 0);
  const sectionsMatch = sectionSum === Number(totalQuestions);

  const parsedMarksPerQuestion = Number(marksPerQuestionInput);
  const effectiveMarks =
    Number.isFinite(parsedMarksPerQuestion) && parsedMarksPerQuestion >= 0.25
      ? Math.min(100, parsedMarksPerQuestion)
      : 4;
  const parsedNegValue = Number(negativeMarkInput);
  const effectiveNegativeMark =
    negativeMarking && Number.isFinite(parsedNegValue) && parsedNegValue >= 0
      ? Math.min(100, parsedNegValue)
      : 0;

  const handleAddSection = () => {
    setSections((prev) => [
      ...prev,
      { id: generateId('sec'), name: `Section ${prev.length + 1}`, questionCount: 1 },
    ]);
  };

  const handleRemoveSection = (id: string) => {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || title.trim().length < 2) {
      setError('Please enter a test name (at least 2 characters).');
      return;
    }
    if (!sectionsMatch) {
      setError(
        `Section question counts sum to ${sectionSum}, which must equal Total Questions (${totalQuestions}).`
      );
      return;
    }
    const startIso = new Date(startLocal).toISOString();
    const endIso = new Date(endLocal).toISOString();
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError('End date/time must be after Start date/time.');
      return;
    }

    if (!Number.isFinite(parsedMarksPerQuestion) || parsedMarksPerQuestion < 0.25 || parsedMarksPerQuestion > 100) {
      setError('Marks per question must be between 0.25 and 100.');
      return;
    }
    if (negativeMarking && (!Number.isFinite(parsedNegValue) || parsedNegValue < 0 || parsedNegValue > 100)) {
      setError('Negative marking penalty must be between 0 and 100.');
      return;
    }

    setSaving(true);
    try {
      const test: TestExam = {
        testId: initialTest?.testId || generateId('test'),
        title: title.trim(),
        description: description.trim(),
        createdBy: initialTest?.createdBy || createdByUid,
        startTime: startIso,
        endTime: endIso,
        durationMins: Math.max(1, Number(durationMins)),
        totalQuestions: Math.max(1, Number(totalQuestions)),
        passPercentage: Math.min(100, Math.max(0, Number(passPercentage))),
        marksPerQuestion: Math.round(effectiveMarks * 100) / 100,
        negativeMarking,
        negativeMarkValue: negativeMarking ? Math.round(effectiveNegativeMark * 100) / 100 : 0,
        maxStrikes: Math.max(0, Number(maxStrikes)),
        maxAttempts: Math.max(1, Number(maxAttempts) || 1),
        enforceFullscreen,
        detectTabSwitch,
        proctoringAIEnabled,
        status: initialTest?.status || 'draft',
        sections: sections.map((s) => ({
          id: s.id,
          name: s.name.trim() || 'Untitled Section',
          questionCount: Math.max(1, Number(s.questionCount) || 1),
        })),
      };
      await onSaveAndContinue(test);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save test configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <AdminBuilderStepper
        activeStep={1}
        testTitle={title.trim() || initialTest?.title}
        canSwitchToStep2={true}
        onBackToDashboard={onCancel}
        onSelectStep={(step) => {
          if (step === 2) {
            formRef.current?.requestSubmit();
          }
        }}
      />

      <div className="mt-6 border-b border-slate-200 pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          {initialTest ? 'Step 1: Edit Test Details, Dates & Rules' : 'Step 1: Create Test Details & Rules'}
        </h1>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-8">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">1. Basic Details</h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Test Name</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Physics & Circuits Midterm CBT"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description / Candidate Instructions
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe topics covered and scoring rules..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            2. Schedule, Duration &amp; Marking
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Start Date &amp; Time
              </label>
              <input
                type="datetime-local"
                required
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                End Date &amp; Time
              </label>
              <input
                type="datetime-local"
                required
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min={1}
                max={600}
                required
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Total Questions
              </label>
              <input
                type="number"
                min={1}
                max={300}
                required
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pass Percentage (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={passPercentage}
                onChange={(e) => setPassPercentage(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Marks per Question (Correct)
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 4].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMarksPerQuestionInput(String(preset))}
                        className={`rounded px-2 py-0.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                          Number(marksPerQuestionInput) === preset
                            ? 'bg-blue-700 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-emerald-700">+</span>
                  <input
                    type="number"
                    step="any"
                    min={0.25}
                    max={100}
                    required
                    value={marksPerQuestionInput}
                    onChange={(e) => setMarksPerQuestionInput(e.target.value)}
                    placeholder="4"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">marks</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={negativeMarking}
                      onChange={(e) => setNegativeMarking(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-700"
                    />
                    <span>Negative Marking (Wrong Answer)</span>
                  </label>
                  {negativeMarking && (
                    <div className="flex items-center gap-1">
                      {[0.25, 0.5, 1].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setNegativeMarkInput(String(preset))}
                          className={`rounded px-2 py-0.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                            Number(negativeMarkInput) === preset
                              ? 'bg-red-700 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          -{preset}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {negativeMarking ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-red-700">-</span>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      value={negativeMarkInput}
                      onChange={(e) => setNegativeMarkInput(e.target.value)}
                      placeholder="1"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">deducted</span>
                  </div>
                ) : (
                  <div className="py-1.5 text-xs text-slate-500">
                    Disabled — wrong answers receive 0 marks penalty.
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-600">
              Marking Summary:{' '}
              <span className="font-mono font-semibold text-emerald-700">
                +{effectiveMarks}
              </span>{' '}
              correct
              <span aria-hidden="true"> · </span>
              {negativeMarking ? (
                <span className="font-mono font-semibold text-red-700">
                  -{effectiveNegativeMark}
                </span>
              ) : (
                <span className="font-mono font-medium text-slate-600">0</span>
              )}{' '}
              wrong
              <span aria-hidden="true"> · </span>
              <span>Unattempted: 0</span>
              <span aria-hidden="true"> · </span>
              <span>
                Total Max Score:{' '}
                <strong className="font-mono text-slate-900">
                  {Math.round((Number(totalQuestions) || 0) * effectiveMarks * 100) / 100}
                </strong>
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                3. Sections &amp; Question Distribution
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Section counts must equal Total Questions ({totalQuestions}).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  sectionsMatch ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {sectionsMatch ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>
                  Sum: {sectionSum} / {totalQuestions}
                </span>
              </span>
              {!sectionsMatch && sectionSum > 0 && (
                <button
                  type="button"
                  onClick={() => setTotalQuestions(sectionSum)}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 whitespace-nowrap cursor-pointer"
                >
                  Set Total to {sectionSum}
                </button>
              )}
              <button
                type="button"
                onClick={handleAddSection}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Section</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {sections.map((sec, idx) => (
              <div key={sec.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
                <span className="w-5 text-xs font-mono text-slate-400 tabular-nums shrink-0">{idx + 1}.</span>
                <input
                  type="text"
                  required
                  value={sec.name}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((s) => (s.id === sec.id ? { ...s, name: e.target.value } : s))
                    )
                  }
                  placeholder="Section Name (e.g. Physics)"
                  className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                  <input
                    type="number"
                    min={1}
                    max={300}
                    required
                    value={sec.questionCount}
                    onChange={(e) =>
                      setSections((prev) =>
                        prev.map((s) =>
                          s.id === sec.id ? { ...s, questionCount: Number(e.target.value) } : s
                        )
                      )
                    }
                    className="w-20 rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-mono text-slate-900 text-right"
                  />
                  <span className="text-xs text-slate-500">Qs</span>
                  <button
                    type="button"
                    disabled={sections.length <= 1}
                    onClick={() => handleRemoveSection(sec.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            4. Anti-Cheat &amp; Proctoring Strike Settings
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={enforceFullscreen}
                onChange={(e) => setEnforceFullscreen(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">Enforce Fullscreen Mode</div>
                <div className="text-xs text-slate-500">
                  Exiting fullscreen triggers a strike and requires immediate re-entry.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={detectTabSwitch}
                onChange={(e) => setDetectTabSwitch(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Tab Switch &amp; Window Blur Detection
                </div>
                <div className="text-xs text-slate-500">
                  Switching tabs, minimizing browser, or Alt+Tab records a strike.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={proctoringAIEnabled}
                onChange={(e) => setProctoringAIEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  MediaPipe AI Face Proctoring
                </div>
                <div className="text-xs text-slate-500">
                  On-device webcam detection warns &amp; strikes if no face or multiple faces appear.
                </div>
              </div>
            </label>

            <div className="rounded-lg border border-slate-200 p-3.5">
              <label className="block text-sm font-semibold text-slate-900">
                Max Attempts Allowed Per Candidate
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value)))}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono text-slate-900"
                />
                <span className="text-xs text-slate-500">
                  {maxAttempts === 1
                    ? 'Single attempt only (strict exam mode)'
                    : `Candidates can re-attempt up to ${maxAttempts} times`}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3.5">
              <label className="block text-sm font-semibold text-slate-900">
                Max Strikes Before Auto-Submit
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={maxStrikes}
                  onChange={(e) => setMaxStrikes(Number(e.target.value))}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono text-slate-900"
                />
                <span className="text-xs text-slate-500">
                  {maxStrikes === 0
                    ? 'Auto-submit disabled (warnings only)'
                    : `Auto-submits exam at ${maxStrikes} strikes`}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer text-center"
          >
            Back to Studio
          </button>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            <span>{saving ? 'Saving Details…' : 'Save & Next: Question Builder'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
