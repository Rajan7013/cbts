import { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Eye,
  RotateCcw,
  BookOpen,
  Info,
} from 'lucide-react';
import { MathText } from './MathText';
import { QuestionImage } from './QuestionImage';
import { importDocumentExamWithAI, type DocumentExamImportResult } from '../lib/api';
import { generateId } from '../lib/dataService';
import type { OptionId, QuestionOption, TestExam, TestQuestion, TestSection } from '../types';

interface AiDocumentImporterModalProps {
  currentTest?: TestExam | null;
  onClose: () => void;
  onImportComplete: (
    testData: {
      title: string;
      description: string;
      sections: TestSection[];
      questions: TestQuestion[];
    },
    publishImmediately: boolean
  ) => Promise<void>;
}

export function AiDocumentImporterModal({
  currentTest,
  onClose,
  onImportComplete,
}: AiDocumentImporterModalProps) {
  // Step 1: Upload, Step 2: Preview & Section Reordering
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  // Upload inputs
  const [testTitle, setTestTitle] = useState(
    currentTest?.title || 'MECEE BL Model Entrance Exam (Model: XIII)'
  );
  const [testDescription, setTestDescription] = useState(
    currentTest?.description || 'Competitive medical entrance examination model test with Zoology, Botany, Chemistry, Physics, and MAT sections.'
  );
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const [useLocalSample, setUseLocalSample] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Extracted data for Pre-Publish Preview
  const [extractedSections, setExtractedSections] = useState<TestSection[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<TestQuestion[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>('all');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleStartProcessing = async () => {
    if (!useLocalSample && !questionFile) {
      setError('Please upload at least the Question booklet PDF/document, or select the sample booklet.');
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStep('Reading document pages and extracting text/images…');

    try {
      let questionDocBase64: string | undefined;
      let questionDocMimeType: string | undefined;
      let solutionDocBase64: string | undefined;
      let solutionDocMimeType: string | undefined;

      if (!useLocalSample && questionFile) {
        questionDocBase64 = await fileToBase64(questionFile);
        questionDocMimeType = questionFile.type || 'application/pdf';
      }

      if (!useLocalSample && solutionFile) {
        solutionDocBase64 = await fileToBase64(solutionFile);
        solutionDocMimeType = solutionFile.type || 'application/pdf';
      }

      setLoadingStep('AI analyzing sections, converting formulas to KaTeX LaTeX, and pairing answer keys…');

      const result: DocumentExamImportResult = await importDocumentExamWithAI({
        questionDocBase64,
        questionDocMimeType,
        solutionDocBase64,
        solutionDocMimeType,
        testTitle,
        useLocalSample,
      });

      if (!result.questions || result.questions.length === 0) {
        throw new Error('AI could not identify questions in the provided document. Check format.');
      }

      // Build TestSections
      const createdSections: TestSection[] = (result.sections || []).map((sec, idx) => ({
        id: `sec_${idx + 1}_${Date.now()}`,
        name: sec.name || `Section ${idx + 1}`,
        questionCount: sec.questionCount || 0,
      }));

      // Fallback if no sections were parsed
      if (createdSections.length === 0) {
        createdSections.push({
          id: `sec_1_${Date.now()}`,
          name: 'General',
          questionCount: result.questions.length,
        });
      }

      // Build full TestQuestions
      const testId = currentTest?.testId || `test_${Date.now()}`;
      const mappedQuestions: TestQuestion[] = result.questions.map((q, idx) => {
        // Find matching section
        const matchingSec =
          createdSections.find(
            (s) => s.name.toLowerCase().trim() === (q.sectionName || '').toLowerCase().trim()
          ) || createdSections[0];

        const optionIds: OptionId[] = ['A', 'B', 'C', 'D'];
        const formattedOptions: QuestionOption[] = optionIds.map((optId) => {
          const match = q.options.find((o) => o.id?.toUpperCase() === optId);
          return {
            id: optId,
            text: match ? match.text : `Option ${optId}`,
            imageUrl: match?.imageUrl,
          };
        });

        const correctId: OptionId = ['A', 'B', 'C', 'D'].includes(q.correctOptionId?.toUpperCase())
          ? (q.correctOptionId.toUpperCase() as OptionId)
          : 'A';

        return {
          questionId: `q_${Date.now()}_${idx + 1}`,
          testId,
          testStatus: 'draft',
          sectionId: matchingSec.id,
          orderIndex: idx + 1,
          questionText: q.questionText || `Question ${idx + 1}`,
          questionImageUrl: q.questionImageUrl,
          options: formattedOptions,
          correctOptionId: correctId,
          shortExplanation: q.shortExplanation || '',
          stepByStepSolution: Array.isArray(q.stepByStepSolution) ? q.stepByStepSolution : [],
          marks: q.marks || 1,
        };
      });

      // Recalculate question counts per section
      const finalizedSections = createdSections.map((sec) => ({
        ...sec,
        questionCount: mappedQuestions.filter((q) => q.sectionId === sec.id).length,
      }));

      setTestTitle(result.title || testTitle);
      setTestDescription(result.description || testDescription);
      setExtractedSections(finalizedSections);
      setExtractedQuestions(mappedQuestions);
      setActiveSectionId('all');
      setStep('preview');
    } catch (err: any) {
      setError(err?.message || 'Failed to process document with AI.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Section Move Up & Down handlers
  const handleMoveSection = (secId: string, direction: 'up' | 'down') => {
    const idx = extractedSections.findIndex((s) => s.id === secId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= extractedSections.length) return;

    const updated = [...extractedSections];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setExtractedSections(updated);
  };

  // Section Rename
  const handleRenameSection = (secId: string, newName: string) => {
    if (!newName.trim()) return;
    setExtractedSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, name: newName.trim() } : s))
    );
  };

  // Move Question to another section
  const handleMoveQuestionSection = (questionId: string, targetSectionId: string) => {
    setExtractedQuestions((prev) =>
      prev.map((q) => (q.questionId === questionId ? { ...q, sectionId: targetSectionId } : q))
    );
    // Recount
    setExtractedSections((prev) =>
      prev.map((s) => {
        const count = extractedQuestions.filter((q) =>
          q.questionId === questionId ? targetSectionId === s.id : q.sectionId === s.id
        ).length;
        return { ...s, questionCount: count };
      })
    );
  };

  // Delete question
  const handleDeleteQuestion = (questionId: string) => {
    const updated = extractedQuestions.filter((q) => q.questionId !== questionId);
    setExtractedQuestions(updated);
    setExtractedSections((prev) =>
      prev.map((s) => ({
        ...s,
        questionCount: updated.filter((q) => q.sectionId === s.id).length,
      }))
    );
  };

  // Commit and finish
  const handleCommit = async (publishImmediately: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await onImportComplete(
        {
          title: testTitle,
          description: testDescription,
          sections: extractedSections,
          questions: extractedQuestions,
        },
        publishImmediately
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save imported assessment.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered questions for preview
  const visibleQuestions =
    activeSectionId === 'all'
      ? extractedQuestions
      : extractedQuestions.filter((q) => q.sectionId === activeSectionId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base sm:text-lg text-slate-900 leading-tight">
                AI Question & Solution PDF Importer
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically parse scanned/digital booklets, auto-create sections, preserve KaTeX formulas, and verify answers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-700 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50">
          {/* ======================================================== */}
          {/* STEP 1: UPLOAD & INGESTION OPTIONS                       */}
          {/* ======================================================== */}
          {step === 'upload' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Test Information */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span>Target Exam Details</span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Exam Title
                    </label>
                    <input
                      type="text"
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      placeholder="e.g. MECEE BL Model Entrance Exam (Model: XIII)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Exam Description
                    </label>
                    <textarea
                      rows={2}
                      value={testDescription}
                      onChange={(e) => setTestDescription(e.target.value)}
                      placeholder="Enter exam description or syllabus details..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Upload Dropzones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Question Booklet */}
                <div className="bg-white rounded-2xl border-2 border-dashed border-blue-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">1. Question Booklet (PDF / DOCX)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {questionFile ? questionFile.name : 'Contains question stems, diagrams, and options A-D'}
                    </div>
                  </div>

                  <input
                    type="file"
                    id="questionFileInput"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setQuestionFile(e.target.files[0]);
                        setUseLocalSample(false);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="questionFileInput"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold cursor-pointer transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{questionFile ? 'Change Question PDF' : 'Upload Questions PDF'}</span>
                  </label>
                </div>

                {/* 2. Solution / Answer Key Booklet */}
                <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">2. Hints & Solutions / Answer Key</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {solutionFile ? solutionFile.name : 'Optional separate booklet for answers & derivations'}
                    </div>
                  </div>

                  <input
                    type="file"
                    id="solutionFileInput"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setSolutionFile(e.target.files[0]);
                        setUseLocalSample(false);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="solutionFileInput"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold cursor-pointer transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{solutionFile ? 'Change Solution PDF' : 'Upload Solutions PDF'}</span>
                  </label>
                </div>
              </div>

              {/* Local Sample Booklet Shortcut */}
              <div className="bg-gradient-to-r from-blue-50 via-white to-purple-50 rounded-2xl border border-blue-200/80 p-4 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                    SET A
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Fast-Track: Use Local MECEE BL Model XIII Booklets
                    </span>
                    <span className="text-[11px] text-slate-600 block">
                      Instantly loads your local <code>DOC-20260921-WA0011.pdf</code> & <code>DOC-20260921-WA0012.pdf</code> files.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUseLocalSample(true);
                    setQuestionFile(null);
                    setSolutionFile(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                    useLocalSample
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  {useLocalSample ? 'Selected ✓' : 'Select Local Sample'}
                </button>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleStartProcessing}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>{loadingStep || 'Processing Booklets…'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Extract & Generate Pre-Publish Preview →</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: PRE-PUBLISH INTERACTIVE PREVIEW & ADJUSTMENTS     */}
          {/* ======================================================== */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary Bar */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">{testTitle}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                      {extractedQuestions.length} Questions Extracted
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                      {extractedSections.length} Sections
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Re-upload</span>
                  </button>
                </div>
              </div>

              {/* Section Management Strip (Move Up, Move Down, Adjust) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Sections Management (Reorder Up/Down & Rename)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Use arrows to adjust section appearance order
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveSectionId('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      activeSectionId === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Questions ({extractedQuestions.length})
                  </button>

                  {extractedSections.map((sec, idx) => {
                    const isSelected = activeSectionId === sec.id;
                    return (
                      <div
                        key={sec.id}
                        className={`inline-flex items-center rounded-xl text-xs font-semibold border transition-all shrink-0 ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 border-blue-200/70 font-bold shadow-2xs'
                            : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveSectionId(sec.id)}
                          className="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{sec.name}</span>
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {sec.questionCount}
                          </span>
                        </button>

                        {/* Move Up / Move Down buttons */}
                        <div className="flex items-center pr-1.5 gap-0.5 border-l border-slate-200/60 pl-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveSection(sec.id, 'up');
                            }}
                            className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-100/70 rounded disabled:opacity-20 cursor-pointer transition-colors"
                            title="Move section left/up"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === extractedSections.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveSection(sec.id, 'down');
                            }}
                            className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-100/70 rounded disabled:opacity-20 cursor-pointer transition-colors"
                            title="Move section right/down"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Questions List for Pre-Publish Verification */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                  <span>
                    Showing {visibleQuestions.length} Questions in Preview
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    Equations rendered via KaTeX • Answers highlighted in green
                  </span>
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {visibleQuestions.map((q, idx) => {
                    const sec = extractedSections.find((s) => s.id === q.sectionId);
                    const isEditing = editingQuestionId === q.questionId;

                    return (
                      <div
                        key={q.questionId}
                        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3.5 transition-all"
                      >
                        {/* Header line: Question #, Section Badge & Actions */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
                              Q{idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              Section: <strong className="text-slate-800">{sec?.name || 'General'}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Move Section Selector */}
                            <select
                              value={q.sectionId}
                              onChange={(e) => handleMoveQuestionSection(q.questionId, e.target.value)}
                              className="text-[11px] font-semibold text-slate-600 bg-slate-100/80 rounded-lg px-2 py-1 border border-slate-200 focus:outline-hidden cursor-pointer"
                              title="Assign to another section"
                            >
                              {extractedSections.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Move to {s.name}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.questionId)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Remove question"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Question Stem with KaTeX */}
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                          <MathText text={q.questionText} />
                        </div>

                        {/* Question Diagram if present */}
                        {q.questionImageUrl && (
                          <div className="rounded-xl border border-slate-200/80 p-1.5 max-w-sm">
                            <QuestionImage src={q.questionImageUrl} alt={`Q${idx + 1} diagram`} />
                          </div>
                        )}

                        {/* 4 Options Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt) => {
                            const isCorrect = opt.id === q.correctOptionId;
                            return (
                              <div
                                key={opt.id}
                                className={`rounded-xl border p-2.5 text-xs flex items-center justify-between gap-2 ${
                                  isCorrect
                                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-semibold'
                                    : 'bg-slate-50/70 border-slate-200/80 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                  }`}>
                                    {opt.id}
                                  </span>
                                  <div className="min-w-0">
                                    <MathText text={opt.text} />
                                  </div>
                                </div>

                                {isCorrect && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                    Correct ✓
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Solution & Explanation */}
                        {q.shortExplanation && (
                          <div className="rounded-xl bg-blue-50/50 border border-blue-100/80 p-3 text-xs space-y-1">
                            <span className="font-bold text-blue-900 block flex items-center gap-1">
                              <Info className="h-3.5 w-3.5 text-blue-600" />
                              <span>Explanation & Solution:</span>
                            </span>
                            <div className="text-slate-700 leading-relaxed">
                              <MathText text={q.shortExplanation} />
                            </div>
                            {q.stepByStepSolution && q.stepByStepSolution.length > 0 && (
                              <ul className="list-disc list-inside space-y-0.5 text-slate-600 pt-1">
                                {q.stepByStepSolution.map((st, sIdx) => (
                                  <li key={sIdx}>
                                    <MathText text={st} />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Actions: Save as Draft OR Publish Immediately */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  ← Back to Upload
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleCommit(false)}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 disabled:opacity-40 cursor-pointer shadow-xs transition-colors"
                  >
                    Save as Draft in Studio
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleCommit(true)}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white disabled:opacity-40 cursor-pointer shadow-md transition-colors"
                  >
                    {saving ? 'Publishing…' : 'Approve & Publish Exam Now ✓'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
