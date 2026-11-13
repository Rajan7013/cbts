import { useRef, useState } from 'react';
import {
  ArrowRight,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Calendar,
  Layers,
  Shield,
  Clock,
  HelpCircle,
  Percent,
  Target,
  XCircle,
  Zap,
} from 'lucide-react';
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

function formatDateTimeDisplay(localStr: string): string {
  try {
    const d = new Date(localStr);
    if (isNaN(d.getTime())) return localStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return localStr;
  }
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
      { id: generateId('sec'), name: `Section ${String.fromCharCode(65 + prev.length)}`, questionCount: 1 },
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Stepper Bar */}
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

      {/* Main Title */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Step 1: Test Details &amp; Rules
        </h1>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Two Column Grid */}
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: 4 Form Cards */}
          <div className="lg:col-span-8 space-y-5">
            {/* Card 1: Basic Details */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h2 className="font-bold text-sm text-slate-900">1. Basic Details</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Test Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Physics & Circuits Midterm CBT"
                    className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
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
                    className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Schedule, Duration & Marking */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <h2 className="font-bold text-sm text-slate-900">2. Schedule, Duration &amp; Marking</h2>
              </div>

              {/* Row 1: Start and End Datetime */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Start Date &amp; Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startLocal}
                    onChange={(e) => setStartLocal(e.target.value)}
                    className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    End Date &amp; Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endLocal}
                    onChange={(e) => setEndLocal(e.target.value)}
                    className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* Row 2: Duration, Total Qs, Pass % */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Duration (Minutes) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={360}
                    required
                    value={durationMins}
                    onChange={(e) => setDurationMins(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Total Questions <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pass Percentage (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={passPercentage}
                    onChange={(e) => setPassPercentage(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all font-mono"
                  />
                </div>
              </div>

              {/* Row 3: Marking Rules Box */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Marks per Question (Correct)
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 4].map((pillVal) => (
                        <button
                          key={pillVal}
                          type="button"
                          onClick={() => setMarksPerQuestionInput(String(pillVal))}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                            effectiveMarks === pillVal
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          +{pillVal}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">+</span>
                    <input
                      type="number"
                      step="any"
                      min={0.25}
                      max={100}
                      value={marksPerQuestionInput}
                      onChange={(e) => setMarksPerQuestionInput(e.target.value)}
                      className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-hidden"
                    />
                    <span className="text-xs text-slate-500">marks</span>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={negativeMarking}
                      onChange={(e) => setNegativeMarking(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Negative Marking (Wrong Answer)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {negativeMarking
                      ? 'Enabled — incorrect answers deduct penalty marks.'
                      : 'Disabled — wrong answers receive 0 marks penalty.'}
                  </p>
                </div>
              </div>

              {/* Row 4: Marking Summary Bar */}
              <div className="text-[11px] text-slate-500 font-medium pt-1">
                Marking Summary:{' '}
                <span className="text-emerald-700 font-semibold">+{effectiveMarks} correct</span>{' '}
                ·{' '}
                <span className="text-slate-600">
                  {negativeMarking ? `-${effectiveNegativeMark} wrong` : '0 wrong'}
                </span>{' '}
                · Unattempted: 0 ·{' '}
                <span className="font-semibold text-slate-800">
                  Total Max Score: {effectiveMarks * totalQuestions}
                </span>
              </div>
            </div>

            {/* Card 3: Sections & Question Distribution */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-slate-500" />
                    <h2 className="font-bold text-sm text-slate-900">
                      3. Sections &amp; Question Distribution
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Section counts must equal Total Questions ({totalQuestions}).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      sectionsMatch
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Sum: {sectionSum} / {totalQuestions}</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Section</span>
                  </button>
                </div>
              </div>

              {/* Sections List */}
              <div className="space-y-2.5">
                {sections.map((section, idx) => (
                  <div
                    key={section.id}
                    className="flex items-center gap-2.5"
                  >
                    <span className="text-xs font-bold text-slate-400 w-5 text-right shrink-0">
                      {idx + 1}.
                    </span>

                    <input
                      type="text"
                      required
                      value={section.name}
                      onChange={(e) => {
                        const updated = [...sections];
                        updated[idx].name = e.target.value;
                        setSections(updated);
                      }}
                      placeholder="e.g. Section A: Core Concepts"
                      className="flex-1 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                    />

                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={section.questionCount}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          const updated = [...sections];
                          updated[idx].questionCount = val;
                          setSections(updated);
                        }}
                        className="w-16 rounded-xl border border-slate-200/80 bg-slate-50/60 px-2.5 py-2 text-xs font-mono font-bold text-slate-900 text-center focus:bg-white focus:border-blue-600 focus:outline-hidden"
                      />
                      <span className="text-xs text-slate-500 font-medium">Qs</span>
                    </div>

                    <button
                      type="button"
                      disabled={sections.length <= 1}
                      onClick={() => handleRemoveSection(section.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 cursor-pointer shrink-0 transition-colors"
                      title="Delete section"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 4: Anti-Cheat & Proctoring Strike Settings */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-500" />
                <h2 className="font-bold text-sm text-slate-900">
                  4. Anti-Cheat &amp; Proctoring Strike Settings
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fullscreen check */}
                <div className="rounded-xl border border-slate-200/70 p-3.5 space-y-1">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enforceFullscreen}
                      onChange={(e) => setEnforceFullscreen(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">
                        Enforce Fullscreen Mode
                      </span>
                      <span className="text-[11px] text-slate-500 leading-snug block">
                        Exiting fullscreen triggers a strike and requires immediate re-entry.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Tab Switch check */}
                <div className="rounded-xl border border-slate-200/70 p-3.5 space-y-1">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={detectTabSwitch}
                      onChange={(e) => setDetectTabSwitch(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">
                        Tab Switch &amp; Window Blur Detection
                      </span>
                      <span className="text-[11px] text-slate-500 leading-snug block">
                        Switching tabs, minimizing browser, or Alt+Tab records a strike.
                      </span>
                    </div>
                  </label>
                </div>

                {/* AI Proctoring check */}
                <div className="rounded-xl border border-slate-200/70 p-3.5 space-y-1">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proctoringAIEnabled}
                      onChange={(e) => setProctoringAIEnabled(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">
                        MediaPipe AI Face Proctoring
                      </span>
                      <span className="text-[11px] text-slate-500 leading-snug block">
                        On-device webcam detection warns &amp; strikes if no face or multiple faces appear.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Max Attempts */}
                <div className="rounded-xl border border-slate-200/70 p-3.5 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-900">
                    Max Attempts Allowed Per Candidate
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono font-bold text-slate-900 text-center focus:border-blue-600 focus:outline-hidden"
                    />
                    <span className="text-[11px] text-slate-500">
                      {maxAttempts === 1 ? 'Single attempt only (strict exam mode)' : `${maxAttempts} attempts allowed`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Max Strikes */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                  Max Strikes Before Auto-Submit
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={maxStrikes}
                    onChange={(e) => setMaxStrikes(Math.max(0, Number(e.target.value)))}
                    className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono font-bold text-slate-900 text-center focus:border-blue-600 focus:outline-hidden"
                  />
                  <span className="text-[11px] text-slate-500">
                    {maxStrikes === 0
                      ? 'Strikes disabled (audit log only)'
                      : `Auto-submits exam at ${maxStrikes} strikes.`}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-slate-200/90 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
              >
                Back to Tests
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer shadow-xs"
              >
                <span>{saving ? 'Saving…' : 'Save & Next: Question Builder'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Test Summary Card (Matches Mockup Right Card) */}
          <div className="lg:col-span-4 sticky top-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900">Test Summary</h3>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  A quick overview of your test configuration.
                </p>
              </div>

              {/* Rows List */}
              <div className="space-y-3 pt-2 text-xs divide-y divide-slate-100">
                {/* Test Name */}
                <div className="flex items-center justify-between pt-2 first:pt-0">
                  <span className="flex items-center gap-2 text-slate-500">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span>Test Name</span>
                  </span>
                  <span className="font-semibold text-slate-800 text-right truncate max-w-[140px]">
                    {title.trim() || '—'}
                  </span>
                </div>

                {/* Schedule */}
                <div className="flex items-start justify-between pt-2">
                  <span className="flex items-center gap-2 text-slate-500 shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Schedule</span>
                  </span>
                  <span className="font-medium text-slate-700 text-right text-[11px] ml-2">
                    {formatDateTimeDisplay(startLocal)} to {formatDateTimeDisplay(endLocal)}
                  </span>
                </div>

                {/* Duration */}
                <div className="flex items-center justify-between pt-2">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Duration</span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    {durationMins} minutes
                  </span>
                </div>

                {/* Total Questions */}
                <div className="flex items-center justify-between pt-2">
                  <span className="flex items-center gap-2 text-slate-500">
                    <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                    <span>Total Questions</span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    {totalQuestions}
                  </span>
                </div>

                {/* Pass Percentage */}
                <div className="flex items-center justify-between pt-2">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Percent className="h-3.5 w-3.5 text-slate-400" />
                    <span>Pass Percentage</span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    {passPercentage}%
                  </span>
                </div>

                {/* Marks per Correct */}
                <div className="flex items-center justify-between pt-2">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Target className="h-3.5 w-3.5 text-slate-400" />
                    <span>Marks per Correct</span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    +{effectiveMarks}
                  </span>
                </div>

                {/* Negative Marking */}
                <div className="flex items-center justify-between pt-2">
                  <span className="flex items-center gap-2 text-slate-500">
                    <XCircle className="h-3.5 w-3.5 text-slate-400" />
                    <span>Negative Marking</span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    {negativeMarking ? `-${effectiveNegativeMark}` : 'Disabled'}
                  </span>
                </div>

                {/* Sections */}
                <div className="flex items-center justify-between pt-2">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Layers className="h-3.5 w-3.5 text-slate-400" />
                    <span>Sections</span>
                  </span>
                  <span className="font-semibold text-slate-800 text-right truncate max-w-[150px]">
                    {sections.length} ({sections.map((s, i) => `${String.fromCharCode(65 + i)}: ${s.questionCount}`).join(', ')})
                  </span>
                </div>

                {/* Max Attempts */}
                <div className="flex items-center justify-between pt-2">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Shield className="h-3.5 w-3.5 text-slate-400" />
                    <span>Max Attempts</span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    {maxAttempts}
                  </span>
                </div>

                {/* Max Strikes */}
                <div className="flex items-center justify-between pt-2">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Zap className="h-3.5 w-3.5 text-slate-400" />
                    <span>Max Strikes</span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    {maxStrikes}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
