import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trash2,
  Plus,
  CheckCircle2,
  X,
  FileJson,
  Upload,
  Download,
  Eye,
  Sliders,
  FileQuestion,
  FileText,
  Clock,
  Layers,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  Send,
  GraduationCap,
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Maximize2,
  ImagePlus,
  Radio,
  ExternalLink,
  Edit3,
  ClipboardPaste,
} from 'lucide-react';
import { MathText } from './MathText';
import { QuestionImage } from './QuestionImage';
import { processAndUploadImage } from '../lib/imageUtils';
import {
  generateDiagramWithAI,
  generateQuestionsWithAI,
  generateSolutionWithAI,
  importQuestionsFromJson,
  uploadImageDataUrl,
  type GeneratedQuestionDraft,
} from '../lib/api';
import { generateId, type SaveQuestionOptions } from '../lib/dataService';
import type {
  OptionId,
  QuestionOption,
  QuestionVersion,
  QuestionVersionSource,
  TestExam,
  TestQuestion,
  TestSection,
} from '../types';

interface AdminQuestionStudioProps {
  test: TestExam;
  questions: TestQuestion[];
  initialQuestionId?: string | null;
  onBack: () => void;
  onEditTestDetails: () => void;
  onSaveQuestion: (q: TestQuestion, options?: SaveQuestionOptions) => Promise<void>;
  onLoadQuestionVersions?: (questionId: string) => Promise<QuestionVersion[]>;
  onRecordQuestionVersion?: (
    q: TestQuestion,
    source: QuestionVersionSource,
    summary: string
  ) => Promise<QuestionVersion>;
  onDeleteQuestion: (questionId: string) => Promise<void>;
  onPublishTest: (overrides?: Partial<TestExam>) => Promise<void>;
  onUpdateTest?: (updated: Partial<TestExam>) => Promise<void>;
  onApplyDefaultMarksToAll?: (marks: number) => Promise<void>;
  onSwitchToCandidateView?: () => void;
}

const OPTION_IDS: OptionId[] = ['A', 'B', 'C', 'D'];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function formatDateTimeDisplay(iso: string): string {
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

function formatSafeErrorMessage(err: unknown, fallback: string = 'An error occurred'): string {
  if (!err) return fallback;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith('{') && (msg.includes('"error"') || msg.includes('"authInfo"') || msg.includes('"userId"'))) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error && typeof parsed.error === 'string' && !parsed.error.includes('{')) {
        return parsed.error;
      }
    } catch {
      // fallback
    }
    return fallback;
  }
  return msg;
}

type StudioViewMode =
  | 'editor'
  | 'json_import'
  | 'json_review'
  | 'gemini_generate'
  | 'gemini_review'
  | 'test_preview'
  | 'published_success';

export function AdminQuestionStudio({
  test,
  questions,
  initialQuestionId,
  onBack,
  onEditTestDetails,
  onSaveQuestion,
  onDeleteQuestion,
  onPublishTest,
  onUpdateTest,
  onSwitchToCandidateView,
}: AdminQuestionStudioProps) {
  const defaultMarks = test.marksPerQuestion ?? 4;

  const [sections, setSections] = useState<TestSection[]>(
    test.sections?.length
      ? test.sections
      : [{ id: generateId('sec'), name: 'Section A: General', questionCount: 1 }]
  );

  useEffect(() => {
    if (test.sections?.length) {
      setSections(test.sections);
    }
  }, [test.sections]);

  const [activeSectionId, setActiveSectionId] = useState<string>(
    test.sections[0]?.id || 'default'
  );

  useEffect(() => {
    if (!sections.some((s) => s.id === activeSectionId) && sections[0]) {
      setActiveSectionId(sections[0].id);
    }
  }, [sections, activeSectionId]);

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  const handleCreateSection = async () => {
    const trimmed = newSectionName.trim() || `Section ${String.fromCharCode(65 + sections.length)}`;
    const newSec: TestSection = {
      id: generateId('sec'),
      name: trimmed,
      questionCount: 1,
    };
    const updated = [...sections, newSec];
    setSections(updated);
    setActiveSectionId(newSec.id);
    setIsAddingSection(false);
    setNewSectionName('');
    if (onUpdateTest) {
      const sum = updated.reduce((acc, s) => acc + (Number(s.questionCount) || 0), 0);
      await onUpdateTest({
        sections: updated,
        totalQuestions: Math.max(1, sum),
      });
    }
  };

  const handleStartRenameSection = (sec: TestSection) => {
    setEditingSectionId(sec.id);
    setEditingSectionName(sec.name);
  };

  const handleSaveRenameSection = async (secId: string) => {
    const trimmed = editingSectionName.trim();
    if (!trimmed) {
      setEditingSectionId(null);
      return;
    }
    const updated = sections.map((s) => (s.id === secId ? { ...s, name: trimmed } : s));
    setSections(updated);
    setEditingSectionId(null);
    if (onUpdateTest) {
      await onUpdateTest({ sections: updated });
    }
  };

  const handleDeleteSection = async (secId: string) => {
    if (sections.length <= 1) {
      setErrorMsg('A test must have at least one section.');
      return;
    }
    const target = sections.find((s) => s.id !== secId);
    const updated = sections.filter((s) => s.id !== secId);
    setSections(updated);
    if (activeSectionId === secId && target) {
      setActiveSectionId(target.id);
    }
    if (onUpdateTest) {
      const sum = updated.reduce((acc, s) => acc + (Number(s.questionCount) || 0), 0);
      await onUpdateTest({
        sections: updated,
        totalQuestions: Math.max(1, sum),
      });
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);

  // Main view mode
  const [viewMode, setViewMode] = useState<StudioViewMode>('editor');

  // Form Fields
  const [questionText, setQuestionText] = useState('');
  const [questionImageUrl, setQuestionImageUrl] = useState('');
  const [solutionImageUrl, setSolutionImageUrl] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>(
    OPTION_IDS.map((id) => ({ id, text: '', imageUrl: '' }))
  );
  const [correctOptionId, setCorrectOptionId] = useState<OptionId>('A');
  const [shortExplanation, setShortExplanation] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [marks, setMarks] = useState<number>(defaultMarks);
  const [showStepsAccordion, setShowStepsAccordion] = useState(false);

  const [savingQ, setSavingQ] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<'question' | 'solution' | OptionId | null>(null);
  const [activeOptionUploadTarget, setActiveOptionUploadTarget] = useState<OptionId | null>(null);
  const optFileInputRef = useRef<HTMLInputElement>(null);
  const solImgInputRef = useRef<HTMLInputElement>(null);
  const [generatingWithAi, setGeneratingWithAi] = useState(false);
  const [generatingDiagram, setGeneratingDiagram] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bulk Gemini AI state
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState('Medium');
  const [aiTargetSectionId, setAiTargetSectionId] = useState<string>(
    test.sections[0]?.id || 'default'
  );
  const [aiDrafts, setAiDrafts] = useState<GeneratedQuestionDraft[]>([]);
  const [reviewedDraftIndexes, setReviewedDraftIndexes] = useState<Record<number, boolean>>({});

  // JSON Import state
  const [jsonInputText, setJsonInputText] = useState('');
  const [jsonFileName, setJsonFileName] = useState<string | null>(null);
  const [jsonUseGemini, setJsonUseGemini] = useState(false);
  const [jsonTargetCount, setJsonTargetCount] = useState(6);
  const [importingJson, setImportingJson] = useState(false);
  const [jsonDrafts, setJsonDrafts] = useState<GeneratedQuestionDraft[]>([]);

  // Preview Candidate-Style Test state
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);

  const qImgInputRef = useRef<HTMLInputElement | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Active section's questions
  const sectionQuestions = questions.filter((q) => q.sectionId === activeSectionId);
  const currentSection = sections.find((s) => s.id === activeSectionId) || sections[0];
  const currentQuestionIndex = sectionQuestions.findIndex((q) => q.questionId === editingId);

  // Load existing question into form
  const loadQuestionIntoEditor = (q: TestQuestion) => {
    setEditingId(q.questionId);
    setQuestionText(q.questionText || q.stem || '');
    setQuestionImageUrl(q.questionImageUrl || q.imageUrl || '');
    setSolutionImageUrl(q.solutionImageUrl || q.solution?.imageUrl || '');
    setOptions(
      OPTION_IDS.map((id) => {
        const found = q.options.find((o) => o.id === id);
        return found ? { ...found } : { id, text: '', imageUrl: '' };
      })
    );
    setCorrectOptionId(q.correctOptionId || 'A');
    setShortExplanation(q.shortExplanation || q.solution?.shortExplanation || '');
    const loadedSteps = q.stepByStepSolution?.length
      ? q.stepByStepSolution
      : q.solution?.steps?.length
      ? q.solution.steps
      : [''];
    setSteps(loadedSteps);
    setMarks(q.marks ?? defaultMarks);
    if (loadedSteps.filter(Boolean).length) setShowStepsAccordion(true);
    setViewMode('editor');
  };

  // Reset form to blank new question
  const resetFormToNewQuestion = (sectionId?: string) => {
    setEditingId(null);
    setQuestionText('');
    setQuestionImageUrl('');
    setSolutionImageUrl('');
    setOptions(OPTION_IDS.map((id) => ({ id, text: '', imageUrl: '' })));
    setCorrectOptionId('A');
    setShortExplanation('');
    setSteps(['']);
    setMarks(defaultMarks);
    setShowStepsAccordion(false);
    if (sectionId) setActiveSectionId(sectionId);
    setViewMode('editor');
  };

  // Initialize with initialQuestionId if provided
  useEffect(() => {
    if (initialQuestionId) {
      const found = questions.find((q) => q.questionId === initialQuestionId);
      if (found) {
        if (found.sectionId) setActiveSectionId(found.sectionId);
        loadQuestionIntoEditor(found);
      }
    } else if (questions.length > 0 && !editingId) {
      // Default to first question
      loadQuestionIntoEditor(questions[0]);
    }
  }, [initialQuestionId]);

  // Insert markdown helper into textarea
  const insertMarkdown = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const nextVal = el.value.slice(0, start) + replacement + el.value.slice(end);
    setQuestionText(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4));
    }, 0);
  };

  // Handle single question save
  const handleSaveCurrentQuestion = async (advanceToNext: boolean = false) => {
    setErrorMsg(null);
    if (!questionText.trim() && !questionImageUrl.trim()) {
      setErrorMsg('Please enter a question stem or upload an image.');
      return;
    }
    const hasEmptyOption = options.some((o) => !o.text.trim() && !o.imageUrl?.trim());
    if (hasEmptyOption) {
      setErrorMsg('Please enter text or an image for all 4 options (A, B, C, D).');
      return;
    }

    setSavingQ(true);
    try {
      const qId = editingId || generateId('q');
      const safeText = questionText.trim();
      const safeImg = questionImageUrl.trim() || undefined;
      const safeSolImg = solutionImageUrl.trim() || undefined;
      const safeShort = shortExplanation.trim() || 'No explanation provided.';
      const safeSteps = steps.map((s) => s.trim()).filter(Boolean);

      const question: TestQuestion = {
        questionId: qId,
        testId: test.testId,
        testStatus: test.status || 'draft',
        sectionId: activeSectionId,
        orderIndex: questions.length + 1,
        questionText: safeText || (safeImg ? 'Refer to the diagram below.' : 'Question'),
        questionImageUrl: safeImg,
        solutionImageUrl: safeSolImg,
        options: options.map((o) => ({
          id: o.id,
          text: (o.text || '').trim(),
          imageUrl: o.imageUrl?.trim() || undefined,
        })),
        correctOptionId,
        shortExplanation: safeShort,
        stepByStepSolution: safeSteps,
        marks,
        stem: safeText || (safeImg ? 'Refer to the diagram below.' : 'Question'),
        imageUrl: safeImg,
        solution: {
          shortExplanation: safeShort,
          imageUrl: safeSolImg,
          steps: safeSteps,
        },
        order: questions.length + 1,
      };

      await onSaveQuestion(question);
      setEditingId(qId);
      setStatusMsg('Question saved successfully.');
      setTimeout(() => setStatusMsg(null), 3000);

      if (advanceToNext) {
        // Find next question in section or create blank
        const currentIdx = sectionQuestions.findIndex((q) => q.questionId === qId);
        if (currentIdx !== -1 && currentIdx < sectionQuestions.length - 1) {
          loadQuestionIntoEditor(sectionQuestions[currentIdx + 1]);
        } else {
          resetFormToNewQuestion(activeSectionId);
        }
      }
    } catch (err) {
      setErrorMsg(formatSafeErrorMessage(err, 'Failed to save question.'));
    } finally {
      setSavingQ(false);
    }
  };

  // Single Question AI Generator (Options, Answer & Solution)
  const handleGenerateOptionsAndSolutionWithAi = async () => {
    if (!questionText.trim() && !questionImageUrl) {
      setErrorMsg('Please enter question stem or diagram first so Gemini can analyze it.');
      return;
    }
    setErrorMsg(null);
    setGeneratingWithAi(true);
    try {
      const res = await generateSolutionWithAI(test, {
        stem: questionText.trim(),
        imageUrl: questionImageUrl || undefined,
        options,
      });

      if (res.options?.length) {
        setOptions(
          OPTION_IDS.map((id, idx) => ({
            id,
            text: res.options?.[idx]?.text || options[idx]?.text || '',
            imageUrl: options[idx]?.imageUrl || '',
          }))
        );
      }
      if (res.correctOptionId) {
        setCorrectOptionId(res.correctOptionId);
      }
      if (res.shortExplanation) {
        setShortExplanation(res.shortExplanation);
      }
      if (res.steps?.length) {
        setSteps(res.steps);
        setShowStepsAccordion(true);
      }
      setStatusMsg('Gemini generated options, correct answer, and solution steps!');
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err) {
      setErrorMsg(formatSafeErrorMessage(err, 'AI generation failed.'));
    } finally {
      setGeneratingWithAi(false);
    }
  };

  // Bulk Gemini Generate
  const handleBulkGenerateWithGemini = async () => {
    if (!aiTopic.trim()) {
      setErrorMsg('Please enter a topic or syllabus excerpt.');
      return;
    }
    setErrorMsg(null);
    setGeneratingWithAi(true);
    try {
      const targetSec = test.sections.find((s) => s.id === aiTargetSectionId);
      const drafts = await generateQuestionsWithAI(test, {
        notes: aiTopic.trim(),
        count: aiCount,
        sectionName: targetSec?.name,
        difficulty: aiDifficulty,
      });
      setAiDrafts(drafts);
      setReviewedDraftIndexes({});
      setViewMode('gemini_review');
    } catch (err) {
      setErrorMsg(formatSafeErrorMessage(err, 'Bulk AI generation failed.'));
    } finally {
      setGeneratingWithAi(false);
    }
  };

  // Add reviewed AI drafts to section
  const handleAddReviewedAiDrafts = async () => {
    setSavingQ(true);
    try {
      for (let i = 0; i < aiDrafts.length; i++) {
        const draft = aiDrafts[i];
        const draftText = draft.stem || 'Question';
        const draftImg = draft.imageUrl || (draft as any).questionImageUrl || undefined;
        const draftSolImg = (draft as any).solutionImageUrl || draft.solution?.imageUrl || undefined;
        const draftShort = draft.solution?.shortExplanation || '';
        const draftSteps = draft.solution?.steps || [];
        const newQ: TestQuestion = {
          questionId: generateId('q'),
          testId: test.testId,
          testStatus: test.status || 'draft',
          sectionId: aiTargetSectionId,
          orderIndex: questions.length + i + 1,
          questionText: draftText,
          questionImageUrl: draftImg,
          solutionImageUrl: draftSolImg,
          options: draft.options.map((o) => ({
            id: o.id,
            text: o.text || '',
            imageUrl: o.imageUrl,
          })),
          correctOptionId: draft.correctOptionId || 'A',
          shortExplanation: draftShort,
          stepByStepSolution: draftSteps,
          marks: defaultMarks,
          stem: draftText,
          imageUrl: draftImg,
          order: questions.length + i + 1,
          solution: {
            shortExplanation: draftShort,
            imageUrl: draftSolImg,
            steps: draftSteps,
          },
        };
        await onSaveQuestion(newQ);
      }
      setActiveSectionId(aiTargetSectionId);
      setViewMode('editor');
      setStatusMsg(`Successfully added ${aiDrafts.length} questions from Gemini!`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setErrorMsg(formatSafeErrorMessage(err, 'Failed to save generated questions.'));
    } finally {
      setSavingQ(false);
    }
  };

  // JSON Generate Preview
  const handleGenerateJsonPreview = async () => {
    if (!jsonInputText.trim()) {
      setErrorMsg('Please drop a .json file or paste JSON content.');
      return;
    }
    setErrorMsg(null);
    setImportingJson(true);
    try {
      const targetSec = test.sections.find((s) => s.id === activeSectionId);
      const parsed = await importQuestionsFromJson(test, {
        rawJson: jsonInputText.trim(),
        completeWithAI: jsonUseGemini,
        targetCount: jsonTargetCount,
        targetSectionName: targetSec?.name,
      });
      setJsonDrafts(parsed);
      setViewMode('json_review');
    } catch (err) {
      setErrorMsg(formatSafeErrorMessage(err, 'Failed to parse JSON.'));
    } finally {
      setImportingJson(false);
    }
  };

  // Add reviewed JSON drafts to section
  const handleAddReviewedJsonDrafts = async () => {
    setSavingQ(true);
    try {
      for (let i = 0; i < jsonDrafts.length; i++) {
        const draft = jsonDrafts[i];
        const draftText = draft.stem || 'Question';
        const draftImg = draft.imageUrl || (draft as any).questionImageUrl || undefined;
        const draftSolImg = (draft as any).solutionImageUrl || draft.solution?.imageUrl || undefined;
        const draftShort = draft.solution?.shortExplanation || '';
        const draftSteps = draft.solution?.steps || [];
        const newQ: TestQuestion = {
          questionId: generateId('q'),
          testId: test.testId,
          testStatus: test.status || 'draft',
          sectionId: activeSectionId,
          orderIndex: questions.length + i + 1,
          questionText: draftText,
          questionImageUrl: draftImg,
          solutionImageUrl: draftSolImg,
          options: draft.options.map((o) => ({
            id: o.id,
            text: o.text || '',
            imageUrl: o.imageUrl,
          })),
          correctOptionId: draft.correctOptionId || 'A',
          shortExplanation: draftShort,
          stepByStepSolution: draftSteps,
          marks: defaultMarks,
          stem: draftText,
          imageUrl: draftImg,
          order: questions.length + i + 1,
          solution: {
            shortExplanation: draftShort,
            imageUrl: draftSolImg,
            steps: draftSteps,
          },
        };
        await onSaveQuestion(newQ);
      }
      setViewMode('editor');
      setStatusMsg(`Successfully added ${jsonDrafts.length} questions from JSON!`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setErrorMsg(formatSafeErrorMessage(err, 'Failed to save imported questions.'));
    } finally {
      setSavingQ(false);
    }
  };

  // Handle Publish Test
  const handleConfirmPublish = async () => {
    setPublishing(true);
    try {
      const updatedSections = sections.map((s) => {
        const count = questions.filter((q) => q.sectionId === s.id).length;
        return {
          ...s,
          questionCount: Math.max(1, count || s.questionCount || 1),
        };
      });
      if (onUpdateTest) {
        await onUpdateTest({
          totalQuestions: Math.max(1, questions.length),
          sections: updatedSections,
        });
      }
      await onPublishTest({
        totalQuestions: Math.max(1, questions.length),
        sections: updatedSections,
      });
      setShowPublishModal(false);
      setViewMode('published_success');
    } catch (err) {
      setErrorMsg(formatSafeErrorMessage(err, 'Failed to publish test.'));
    } finally {
      setPublishing(false);
    }
  };

  const handleGenerateDiagramWithAi = async (target: 'question' | 'solution' | OptionId = 'question') => {
    const prompt = window.prompt(
      'Enter diagram prompt for Gemini (e.g. "Wheatstone bridge circuit with 4 resistors and galvanometer", "Inclined plane with 2kg block at 30 degrees", "Optics ray diagram with convex lens"):',
      target === 'solution'
        ? (shortExplanation.slice(0, 160) || 'Solution diagram')
        : (questionText.slice(0, 160) || 'Physics circuit diagram')
    );
    if (!prompt) return;
    setGeneratingDiagram(true);
    setErrorMsg(null);
    try {
      const res = await generateDiagramWithAI({ prompt, topic: currentSection?.name || 'Science' });
      if (target === 'question') {
        setQuestionImageUrl(res.dataUrl);
      } else if (target === 'solution') {
        setSolutionImageUrl(res.dataUrl);
      } else {
        setOptions((prev) =>
          prev.map((o) => (o.id === target ? { ...o, imageUrl: res.dataUrl } : o))
        );
      }
    } catch (err) {
      setErrorMsg(formatSafeErrorMessage(err, 'Failed to generate diagram with Gemini.'));
    } finally {
      setGeneratingDiagram(false);
    }
  };

  // Image Upload helper with Firebase Storage & client-side canvas optimization (100% resilient on Vercel)
  const handleUploadImage = async (file: File, target: 'question' | 'solution' | OptionId) => {
    setUploadingTarget(target);
    setErrorMsg(null);
    try {
      const storagePath = `test-media/${test.testId}/${editingId || 'new'}_${target}_${Date.now()}`;
      const url = await processAndUploadImage(file, storagePath);
      if (target === 'question') {
        setQuestionImageUrl(url);
      } else if (target === 'solution') {
        setSolutionImageUrl(url);
      } else {
        setOptions((prev) =>
          prev.map((o) => (o.id === target ? { ...o, imageUrl: url } : o))
        );
      }
    } catch (err) {
      setErrorMsg(formatSafeErrorMessage(err, 'Failed to process image.'));
    } finally {
      setUploadingTarget(null);
    }
  };

  const handlePasteImageFromClipboard = async (target: 'question' | 'solution' | OptionId = 'question') => {
    setErrorMsg(null);
    try {
      if (!navigator.clipboard?.read) {
        setErrorMsg('Clipboard reading is not supported by this browser. Use Upload Image or paste in the editor.');
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `pasted_${target}.png`, { type: imageType });
          await handleUploadImage(file, target);
          return;
        }
      }
      setErrorMsg('No image found in clipboard. Please copy an image first.');
    } catch {
      setErrorMsg('Clipboard permission was denied or no image was found in clipboard.');
    }
  };

  const canPublish = questions.length >= 1;
  const isAllSectionsComplete = canPublish;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* 1. Top Stepper Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-h-[44px]">
        <button
          type="button"
          onClick={onEditTestDetails}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Test Details</span>
        </button>

        {/* Center: Title and Subtitle */}
        <div className="text-center sm:absolute sm:left-1/2 sm:-translate-x-1/2 min-w-0">
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Question Builder &amp; AI
          </h1>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Create, generate and manage questions with AI assistance.
          </p>
        </div>

        {/* Right: Step Navigation Pills */}
        <nav aria-label="Creation steps" className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onEditTestDetails}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-xs"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>1. Test Details &amp; Rules</span>
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 shadow-xs">
            <FileQuestion className="h-3.5 w-3.5" />
            <span>2. Question Builder &amp; AI</span>
          </div>
        </nav>
      </div>

      {/* 2. Test Info Metadata Strip */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-3 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900 min-w-0">
          <FileText className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="truncate">Test: {test.title}</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-slate-600 font-medium">
          <span className="flex items-center gap-1.5 font-bold text-slate-900">
            <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
            <span>{questions.length} Questions</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{test.durationMins} Minutes</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <span>+{defaultMarks} Marks per Correct</span>
          </span>
        </div>
      </div>

      {/* 3. Section Selector & Global Action Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Section Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 flex-1 min-w-0">
          {sections.map((sec) => {
            const count = questions.filter((q) => q.sectionId === sec.id).length;
            const isActive = activeSectionId === sec.id;
            const isEditing = editingSectionId === sec.id;

            return isEditing ? (
              <div
                key={sec.id}
                className="flex items-center gap-1 bg-white border border-blue-300 rounded-xl px-2 py-1 shadow-xs shrink-0"
              >
                <input
                  type="text"
                  value={editingSectionName}
                  onChange={(e) => setEditingSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRenameSection(sec.id);
                    if (e.key === 'Escape') setEditingSectionId(null);
                  }}
                  autoFocus
                  className="text-xs px-1.5 py-0.5 rounded border border-slate-200 font-semibold text-slate-800 w-32 focus:outline-hidden focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleSaveRenameSection(sec.id)}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                  title="Save name"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSectionId(null)}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                  title="Cancel"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                key={sec.id}
                className={`group inline-flex items-center rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border shrink-0 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-blue-200/70 font-bold shadow-xs'
                    : 'bg-white border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveSectionId(sec.id);
                    const firstQ = questions.find((q) => q.sectionId === sec.id);
                    if (firstQ) loadQuestionIntoEditor(firstQ);
                    else resetFormToNewQuestion(sec.id);
                  }}
                  className="px-3.5 py-2 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{sec.name}</span>
                  <span className="opacity-80 font-mono text-[11px] bg-slate-100/90 group-hover:bg-slate-200/80 px-1.5 py-0.5 rounded-md">
                    {count} Qs
                  </span>
                </button>
                {isActive && (
                  <div className="flex items-center pr-1.5 gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRenameSection(sec);
                      }}
                      className="p-1 text-blue-600 hover:bg-blue-100/70 rounded transition-colors cursor-pointer"
                      title="Rename section"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    {sections.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSection(sec.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="Delete section"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isAddingSection ? (
            <div className="flex items-center gap-1 bg-white border border-blue-300 rounded-xl px-2 py-1 shadow-xs shrink-0">
              <input
                type="text"
                placeholder="Section name..."
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSection();
                  if (e.key === 'Escape') setIsAddingSection(false);
                }}
                autoFocus
                className="text-xs px-2 py-1 rounded border border-slate-200 font-semibold text-slate-800 w-36 focus:outline-hidden focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleCreateSection}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                title="Create section"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsAddingSection(false)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewSectionName(`Section ${String.fromCharCode(65 + sections.length)}`);
                setIsAddingSection(true);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/40 transition-colors cursor-pointer shrink-0"
              title="Add a new section"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Section</span>
            </button>
          )}
        </div>

        {/* Right: Global Actions (Import JSON, Bulk Gemini, Preview, Publish) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('json_import')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer shadow-xs ${
              viewMode === 'json_import' || viewMode === 'json_review'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            <span>Import JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('gemini_generate')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer shadow-xs ${
              viewMode === 'gemini_generate' || viewMode === 'gemini_review'
                ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span>Bulk Generate with Gemini</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPreviewQuestionIndex(0);
              setViewMode('test_preview');
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer shadow-xs ${
              viewMode === 'test_preview'
                ? 'bg-slate-900 border-slate-900 text-white font-bold'
                : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            <span>Preview</span>
          </button>

          <button
            type="button"
            disabled={!canPublish || publishing}
            onClick={() => setShowPublishModal(true)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-xs ${
              canPublish
                ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
            title={canPublish ? 'Publish this test' : 'Add at least 1 question before publishing'}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Publish Test</span>
          </button>
        </div>
      </div>

      {/* Status & Error Alerts */}
      {statusMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 flex items-center justify-between">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 1: Manual Question Editor (Images 1, 2, 3)     */}
      {/* ======================================================== */}
      {viewMode === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Question Editor Form */}
          <div className="lg:col-span-8 space-y-5">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              {/* Question Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="font-bold text-sm text-slate-900">
                    Question {currentQuestionIndex !== -1 ? currentQuestionIndex + 1 : sectionQuestions.length + 1}
                  </span>

                  {/* Previous / Next Stepper */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      disabled={currentQuestionIndex <= 0}
                      onClick={() => loadQuestionIntoEditor(sectionQuestions[currentQuestionIndex - 1])}
                      className="p-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                      title="Previous Question"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={currentQuestionIndex === -1 || currentQuestionIndex >= sectionQuestions.length - 1}
                      onClick={() => loadQuestionIntoEditor(sectionQuestions[currentQuestionIndex + 1])}
                      className="p-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                      title="Next Question"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value="mcq_single"
                    disabled
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    <option value="mcq_single">Multiple Choice (Single Correct)</option>
                  </select>

                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this question?')) {
                          onDeleteQuestion(editingId);
                          resetFormToNewQuestion(activeSectionId);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Question Stem & Toolbar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Question Stem <span className="text-red-500">*</span>
                </label>

                {/* Markdown Formatting Toolbar */}
                <div className="rounded-t-xl border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 flex flex-wrap items-center gap-1 text-slate-600 text-xs">
                  <span className="font-semibold text-[11px] text-slate-500 mr-1">Markdown ▾</span>
                  <div className="h-3.5 w-px bg-slate-200 mx-1" />
                  <button type="button" onClick={() => insertMarkdown('**', '**')} className="p-1 hover:bg-slate-200 rounded" title="Bold"><Bold className="h-3 w-3" /></button>
                  <button type="button" onClick={() => insertMarkdown('*', '*')} className="p-1 hover:bg-slate-200 rounded" title="Italic"><Italic className="h-3 w-3" /></button>
                  <button type="button" onClick={() => insertMarkdown('`', '`')} className="p-1 hover:bg-slate-200 rounded" title="Code"><Code className="h-3 w-3" /></button>
                  <div className="h-3.5 w-px bg-slate-200 mx-1" />
                  <button type="button" onClick={() => insertMarkdown('# ')} className="p-1 hover:bg-slate-200 rounded text-[11px] font-bold" title="H1">H1</button>
                  <button type="button" onClick={() => insertMarkdown('## ')} className="p-1 hover:bg-slate-200 rounded text-[11px] font-bold" title="H2">H2</button>
                  <button type="button" onClick={() => insertMarkdown('### ')} className="p-1 hover:bg-slate-200 rounded text-[11px] font-bold" title="H3">H3</button>
                  <div className="h-3.5 w-px bg-slate-200 mx-1" />
                  <button type="button" onClick={() => insertMarkdown('- ')} className="p-1 hover:bg-slate-200 rounded" title="Bullet List"><List className="h-3 w-3" /></button>
                  <button type="button" onClick={() => insertMarkdown('1. ')} className="p-1 hover:bg-slate-200 rounded" title="Numbered List"><ListOrdered className="h-3 w-3" /></button>
                  <div className="h-3.5 w-px bg-slate-200 mx-1" />
                  <button type="button" onClick={() => insertMarkdown('$', '$')} className="px-1.5 py-0.5 hover:bg-slate-200 rounded text-[11px] font-mono font-bold" title="LaTeX Equation">
                    <span className="text-blue-600 italic">f(x)</span> LaTeX
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  rows={4}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  onPaste={async (e) => {
                    const items = e.clipboardData?.items;
                    if (items) {
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].type.startsWith('image/')) {
                          const file = items[i].getAsFile();
                          if (file) {
                            e.preventDefault();
                            await handleUploadImage(file, 'question');
                            return;
                          }
                        }
                      }
                    }
                  }}
                  placeholder="Enter the question here... (Markdown and LaTeX supported)&#10;&#10;e.g., What is the equivalent resistance? $R_{eq} = \frac{R_1 R_2}{R_1 + R_2}$"
                  className="w-full rounded-b-xl border border-t-0 border-slate-200/80 bg-white p-3.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 font-mono"
                />
                <div className="text-right text-[10px] text-slate-400 mt-1">
                  {questionText.length} / 5000
                </div>
              </div>

              {/* Upload Image & Gemini Assistant Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    ref={qImgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, 'question');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => qImgInputRef.current?.click()}
                    disabled={uploadingTarget === 'question'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                  >
                    <ImagePlus className="h-3.5 w-3.5 text-slate-500" />
                    <span>{uploadingTarget === 'question' ? 'Uploading…' : 'Upload Image'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePasteImageFromClipboard('question')}
                    disabled={uploadingTarget === 'question'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5 text-slate-500" />
                    <span>Paste Image</span>
                  </button>

                  <button
                    type="button"
                    disabled={generatingDiagram}
                    onClick={() => handleGenerateDiagramWithAi('question')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 cursor-pointer shadow-xs transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                    <span>{generatingDiagram ? 'Drawing diagram…' : 'Generate Diagram with Gemini'}</span>
                  </button>

                  {questionImageUrl && (
                    <button
                      type="button"
                      onClick={() => setQuestionImageUrl('')}
                      className="text-[11px] text-red-600 hover:underline cursor-pointer"
                    >
                      Remove Diagram
                    </button>
                  )}
                </div>

                {/* Gemini AI Complete Option Button */}
                <button
                  type="button"
                  disabled={generatingWithAi}
                  onClick={handleGenerateOptionsAndSolutionWithAi}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  <span>{generatingWithAi ? 'Gemini generating…' : 'Generate Options, Answer & Solution with Gemini'}</span>
                </button>
              </div>

              {/* Diagram Preview if attached */}
              {questionImageUrl && (
                <QuestionImage src={questionImageUrl} alt="Question diagram" />
              )}

              {/* Answer Options */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Answer Options <span className="text-red-500">*</span>
                </label>

                {/* Hidden file input for options */}
                <input
                  ref={optFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && activeOptionUploadTarget) {
                      handleUploadImage(file, activeOptionUploadTarget);
                    }
                    e.target.value = '';
                  }}
                />

                {options.map((opt) => (
                  <div key={opt.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {opt.id}
                      </span>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOptions((prev) => prev.map((o) => (o.id === opt.id ? { ...o, text: val } : o)));
                        }}
                        placeholder={`Enter option ${opt.id}...`}
                        className="flex-1 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500 font-mono"
                      />

                      {/* Add Image Button matching Image 7 */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveOptionUploadTarget(opt.id);
                          optFileInputRef.current?.click();
                        }}
                        disabled={uploadingTarget === opt.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs shrink-0"
                        title={`Attach image for Option ${opt.id}`}
                      >
                        <ImagePlus className="h-3.5 w-3.5 text-slate-500" />
                        <span>{uploadingTarget === opt.id ? 'Uploading…' : opt.imageUrl ? 'Change Image' : 'Add Image'}</span>
                      </button>

                      {/* Radio select for correct answer */}
                      <button
                        type="button"
                        onClick={() => setCorrectOptionId(opt.id)}
                        className="p-1 cursor-pointer shrink-0"
                        title={`Mark ${opt.id} as correct`}
                      >
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          correctOptionId === opt.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}>
                          {correctOptionId === opt.id && <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                        </div>
                      </button>
                    </div>

                    {/* Option Image Thumbnail if present */}
                    {opt.imageUrl && (
                      <div className="ml-10 flex items-center gap-2">
                        <div className="relative group inline-block rounded-lg border border-slate-200 bg-white p-1">
                          <img
                            src={opt.imageUrl}
                            alt={`Option ${opt.id} attachment`}
                            className="h-16 w-auto max-w-xs rounded object-contain"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setOptions((prev) =>
                                prev.map((o) => (o.id === opt.id ? { ...o, imageUrl: '' } : o))
                              )
                            }
                            className="absolute -top-2 -right-2 rounded-full bg-red-600 p-0.5 text-white hover:bg-red-700 shadow-xs cursor-pointer"
                            title="Remove image"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-400">Option {opt.id} diagram attached</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Correct Answer Dropdown */}
              <div className="flex items-center gap-2 pt-1">
                <label className="text-xs font-semibold text-slate-700">
                  Correct Answer <span className="text-red-500">*</span>
                </label>
                <select
                  value={correctOptionId}
                  onChange={(e) => setCorrectOptionId(e.target.value as OptionId)}
                  className="rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-hidden cursor-pointer"
                >
                  {OPTION_IDS.map((id) => (
                    <option key={id} value={id}>Option {id}</option>
                  ))}
                </select>
              </div>

              {/* Explanation Textarea & Solution Diagram */}
              <div className="pt-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Explanation (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={solImgInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(file, 'solution');
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => solImgInputRef.current?.click()}
                      disabled={uploadingTarget === 'solution'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                    >
                      <ImagePlus className="h-3 w-3 text-slate-500" />
                      <span>{uploadingTarget === 'solution' ? 'Uploading…' : solutionImageUrl ? 'Change Diagram' : 'Upload Solution Diagram'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePasteImageFromClipboard('solution')}
                      disabled={uploadingTarget === 'solution'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                    >
                      <ClipboardPaste className="h-3 w-3 text-slate-500" />
                      <span>Paste Diagram</span>
                    </button>
                    {solutionImageUrl && (
                      <button
                        type="button"
                        onClick={() => setSolutionImageUrl('')}
                        className="text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        Remove Diagram
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={shortExplanation}
                  onChange={(e) => setShortExplanation(e.target.value)}
                  placeholder="Brief explanation for the correct answer (shown after the test)..."
                  className="w-full rounded-xl border border-slate-200/80 bg-white p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                />

                {solutionImageUrl && (
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">Solution Diagram Preview:</div>
                    <QuestionImage src={solutionImageUrl} alt="Solution diagram" />
                  </div>
                )}
              </div>

              {/* Solution Steps Accordion */}
              <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowStepsAccordion(!showStepsAccordion)}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <span className="font-mono text-blue-600 font-bold">f(x)</span>
                    <span>Add Solution Step (Optional)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStepsAccordion(true);
                      setSteps([...steps, '']);
                    }}
                    className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    + Add Step
                  </button>
                </div>

                {showStepsAccordion && (
                  <div className="mt-3 space-y-2">
                    {steps.map((st, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 w-5">{i + 1}.</span>
                        <input
                          type="text"
                          value={st}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSteps(steps.map((s, idx) => (idx === i ? val : s)));
                          }}
                          placeholder={`Step ${i + 1} derivation (LaTeX supported)...`}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-blue-500"
                        />
                        {steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}
                            className="p-1 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onEditTestDetails}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                >
                  Back to Test Details
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingQ}
                    onClick={() => handleSaveCurrentQuestion(false)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer shadow-xs"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={savingQ}
                    onClick={() => handleSaveCurrentQuestion(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer shadow-xs"
                  >
                    <span>{savingQ ? 'Saving…' : 'Save & Add Next'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Questions in Section & Candidate Live Preview */}
          <div className="lg:col-span-4 space-y-5 sticky top-6">
            {/* Card 1: Questions in Section */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">Questions in Section</h3>
                    <p className="text-[10px] text-slate-400">{currentSection?.name}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  {sectionQuestions.length} Questions
                </span>
              </div>

              {/* Slot list */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {sectionQuestions.map((q, idx) => (
                  <div
                    key={q.questionId}
                    onClick={() => loadQuestionIntoEditor(q)}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                      editingId === q.questionId
                        ? 'bg-blue-50/80 border-blue-200 text-blue-800 font-semibold'
                        : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold shrink-0">Q{idx + 1}</span>
                      <span className="truncate">{q.stem || 'Untitled Question'}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">
                      Draft
                    </span>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => resetFormToNewQuestion(activeSectionId)}
                  className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Question {sectionQuestions.length + 1}</span>
                </button>
              </div>
            </div>

            {/* Card 2: Candidate Preview */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">Candidate Preview</h3>
                    <p className="text-[10px] text-slate-400">How this question will look to candidates.</p>
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="space-y-3 text-xs">
                <div className="font-bold text-slate-900">
                  Q{currentQuestionIndex !== -1 ? currentQuestionIndex + 1 : 1}.
                </div>

                <div className="text-slate-800 break-words">
                  {questionText ? (
                    <MathText text={questionText} />
                  ) : (
                    <span className="text-slate-400 italic">Enter question stem to preview...</span>
                  )}
                </div>

                {questionImageUrl && (
                  <QuestionImage src={questionImageUrl} alt="Question preview" allowZoom={false} className="max-h-36" />
                )}

                {/* Radio options preview */}
                <div className="space-y-2 pt-1">
                  {options.map((opt) => (
                    <div
                      key={opt.id}
                      className="p-2 rounded-lg border border-slate-200/80 bg-slate-50/50 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center shrink-0" />
                        <span className="font-bold text-slate-700">{opt.id}.</span>
                        <span className="text-slate-800 truncate">
                          {opt.text ? <MathText text={opt.text} /> : <span className="text-slate-400">—</span>}
                        </span>
                      </div>
                      {opt.imageUrl && (
                        <div className="pl-6">
                          <img
                            src={opt.imageUrl}
                            alt={`Option ${opt.id} preview`}
                            className="max-h-20 rounded border border-slate-200 bg-white object-contain p-0.5"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Solution Preview if entered */}
                {(shortExplanation || solutionImageUrl) && (
                  <div className="mt-3 p-2.5 rounded-lg border border-blue-100 bg-blue-50/50 space-y-1.5">
                    <span className="font-bold text-blue-900 text-[11px] block">Solution &amp; Explanation Preview:</span>
                    {shortExplanation && <MathText text={shortExplanation} />}
                    {solutionImageUrl && (
                      <QuestionImage src={solutionImageUrl} alt="Solution preview" allowZoom={false} className="max-h-24" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 2: JSON Import (Image 4)                       */}
      {/* ======================================================== */}
      {viewMode === 'json_import' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Manual Editor</span>
          </button>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">Import questions from JSON or Markdown</h2>
            <p className="text-xs text-slate-500 mt-1">
              Upload a .json, .md, or .txt file, or paste your questions in JSON or Markdown format. We'll parse the content and show a live preview for your review before adding to this section.
            </p>
          </div>

          {/* 2-Column Drop & Paste */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Drag & Drop File */}
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <Upload className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-xs font-bold text-slate-800">Drag and drop your .json or .md file here</p>
              <p className="text-[11px] text-slate-500 mt-0.5">or choose a file from your computer</p>

              <input
                ref={jsonFileInputRef}
                type="file"
                accept=".json,.md,.txt,.markdown"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setJsonFileName(file.name);
                    const txt = await file.text();
                    setJsonInputText(txt);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => jsonFileInputRef.current?.click()}
                className="mt-3 px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs cursor-pointer"
              >
                Browse files
              </button>
              <span className="text-[10px] text-slate-400 mt-2">Supports .json, .md, and .txt files.</span>
            </div>

            {/* Paste JSON / Markdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Paste / Edit JSON or Markdown</label>
              <textarea
                rows={8}
                value={jsonInputText}
                onChange={(e) => setJsonInputText(e.target.value)}
                placeholder="Paste your JSON or Markdown notes here... (e.g. ## Question 1, A) 6 N, B) 5 N... or JSON format)"
                className="w-full rounded-2xl border border-slate-200/80 bg-white p-3.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Options: Gemini toggle & target count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={jsonUseGemini}
                onChange={(e) => setJsonUseGemini(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Use Gemini to complete missing content (optional)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Fills in gaps (e.g., options, explanations) using Gemini, based on your JSON.
                </span>
              </div>
            </label>

            <button
              type="button"
              disabled={importingJson}
              onClick={handleGenerateJsonPreview}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer shadow-xs"
            >
              <Sparkles className="h-4 w-4" />
              <span>{importingJson ? 'Parsing JSON…' : 'Generate preview'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 3: JSON Review (Image 5)                       */}
      {/* ======================================================== */}
      {viewMode === 'json_review' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
          <button
            type="button"
            onClick={() => setViewMode('json_import')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to import</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Review imported questions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review, edit, and confirm the imported questions before adding them to this section.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✔ {jsonDrafts.length} ready
              </span>
            </div>
          </div>

          {/* List of imported questions */}
          <div className="space-y-4">
            {jsonDrafts.map((draft, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200/80 p-4 space-y-3 bg-slate-50/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">Q{idx + 1}.</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      Ready
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-800">
                  <MathText text={draft.stem} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {draft.options.map((o) => (
                    <div key={o.id} className="flex items-center gap-1.5 text-slate-700">
                      <span className="font-bold">{o.id}.</span>
                      <span><MathText text={o.text} /></span>
                    </div>
                  ))}
                </div>

                <div className="text-xs font-semibold text-emerald-700 pt-1">
                  Correct answer: <span className="font-bold font-mono">{draft.correctOptionId}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setViewMode('json_import')}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Back to import
            </button>

            <button
              type="button"
              disabled={savingQ}
              onClick={handleAddReviewedJsonDrafts}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs sm:text-sm hover:bg-blue-700 cursor-pointer shadow-xs"
            >
              <Sparkles className="h-4 w-4" />
              <span>{savingQ ? 'Saving…' : 'Add reviewed questions to section'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 4: Gemini AI Bulk Generator (Image 6)          */}
      {/* ======================================================== */}
      {viewMode === 'gemini_generate' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to question editor</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h2 className="font-display text-xl font-bold text-slate-900">Generate questions with Gemini</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Use Google Gemini to create multiple high-quality questions for this test.
            </p>
          </div>

          {/* Fields */}
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Topic or syllabus <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Describe the topic(s), learning objectives, or paste a syllabus excerpt for question generation.&#10;&#10;e.g., Newton's laws of motion, friction, force and acceleration. Include conceptual and numerical questions."
                className="w-full rounded-2xl border border-slate-200/80 bg-white p-3.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target section</label>
                <select
                  value={aiTargetSectionId}
                  onChange={(e) => setAiTargetSectionId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  {test.sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Number of questions</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAiCount(Math.max(1, aiCount - 1))}
                    className="h-8 w-8 rounded-lg border border-slate-200 bg-white font-bold text-slate-600"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-xs w-8 text-center">{aiCount}</span>
                  <button
                    type="button"
                    onClick={() => setAiCount(Math.min(10, aiCount + 1))}
                    className="h-8 w-8 rounded-lg border border-slate-200 bg-white font-bold text-slate-600"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Difficulty</label>
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                  {['Easy', 'Medium', 'Hard'].map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setAiDifficulty(diff)}
                      className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        aiDifficulty === diff
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={generatingWithAi}
              onClick={handleBulkGenerateWithGemini}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs sm:text-sm hover:bg-blue-700 disabled:opacity-60 cursor-pointer shadow-xs mt-2"
            >
              <Sparkles className="h-4 w-4" />
              <span>{generatingWithAi ? 'Gemini generating questions…' : 'Generate Questions'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 5: Gemini AI Review (Image 7)                  */}
      {/* ======================================================== */}
      {viewMode === 'gemini_review' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
          <button
            type="button"
            onClick={() => setViewMode('gemini_generate')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to generation</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Review Gemini-generated questions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review, edit and confirm the AI-generated questions for this section before saving.
              </p>
            </div>
            <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {aiDrafts.length} generated
            </div>
          </div>

          {/* List of drafts */}
          <div className="space-y-4">
            {aiDrafts.map((draft, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200/80 p-5 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">Q{idx + 1}.</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5 text-blue-600" />
                      Generated by Gemini
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiDrafts(aiDrafts.filter((_, i) => i !== idx))}
                    className="text-xs text-red-600 hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>

                <div className="text-xs text-slate-900 font-medium">
                  <MathText text={draft.stem} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  {draft.options.map((o) => (
                    <div key={o.id} className="flex items-center gap-2 text-slate-700">
                      <div className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px]">
                        {o.id}
                      </div>
                      <span><MathText text={o.text} /></span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
                  <span className="font-bold">Suggested correct answer:</span> Option {draft.correctOptionId}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setViewMode('gemini_generate')}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Back to generation
            </button>

            <button
              type="button"
              disabled={savingQ}
              onClick={handleAddReviewedAiDrafts}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs sm:text-sm hover:bg-blue-700 cursor-pointer shadow-xs"
            >
              <Check className="h-4 w-4" />
              <span>{savingQ ? 'Saving…' : 'Add reviewed questions to section'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 6: Candidate Test Preview (Image 8)            */}
      {/* ======================================================== */}
      {viewMode === 'test_preview' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to question builder</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPublishModal(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs sm:text-sm hover:bg-blue-700 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Publish Test</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (8 cols): Question Preview */}
            <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900">Test Preview</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {test.status}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  Candidate-style view of the test
                </span>
              </div>

              {questions.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">No questions added yet.</div>
              ) : (
                (() => {
                  const q = questions[previewQuestionIndex] || questions[0];
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900">
                          Question {previewQuestionIndex + 1} of {questions.length}
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                          Section: {test.sections.find((s) => s.id === q.sectionId)?.name || 'Default'}
                        </span>
                      </div>

                      <div className="text-sm text-slate-900 font-medium">
                        <MathText text={q.stem} />
                      </div>

                      {q.imageUrl && (
                        <img src={q.imageUrl} alt="diagram" className="max-h-56 rounded-xl object-contain border" />
                      )}

                      <div className="space-y-2 pt-2">
                        {q.options.map((opt) => (
                          <div
                            key={opt.id}
                            className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
                          >
                            <div className="h-4 w-4 rounded-full border border-slate-300" />
                            <span className="font-bold text-xs text-slate-700">{opt.id}.</span>
                            <span className="text-xs text-slate-900"><MathText text={opt.text} /></span>
                          </div>
                        ))}
                      </div>

                      {/* Stepper buttons */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={previewQuestionIndex <= 0}
                          onClick={() => setPreviewQuestionIndex((i) => Math.max(0, i - 1))}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                        >
                          ← Previous
                        </button>
                        <span className="text-xs text-slate-500 font-medium">
                          {previewQuestionIndex + 1} of {questions.length}
                        </span>
                        <button
                          type="button"
                          disabled={previewQuestionIndex >= questions.length - 1}
                          onClick={() => setPreviewQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 cursor-pointer shadow-xs"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Right Column (4 cols): Test Overview & Question Navigator */}
            <div className="lg:col-span-4 space-y-5 sticky top-6">
              {/* Test Overview */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Test Overview</h4>
                <div className="flex justify-between text-slate-600">
                  <span>Duration:</span>
                  <span className="font-semibold text-slate-800">{test.durationMins} Minutes</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Questions:</span>
                  <span className="font-semibold text-slate-800">{test.totalQuestions}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Marks per Correct:</span>
                  <span className="font-semibold text-slate-800">+{defaultMarks}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Negative Marking:</span>
                  <span className="font-semibold text-slate-800">{test.negativeMarking ? 'Yes' : 'No'}</span>
                </div>
              </div>

              {/* Question Navigator */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
                <h4 className="font-bold text-xs text-slate-900">Question Navigator</h4>
                <div className="grid grid-cols-6 gap-2">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPreviewQuestionIndex(i)}
                      className={`h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                        previewQuestionIndex === i
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Completion Checklist */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3 text-xs">
                <h4 className="font-bold text-slate-900">Admin Completion Checklist</h4>
                {sections.map((sec) => {
                  const count = questions.filter((q) => q.sectionId === sec.id).length;
                  const isDone = count > 0;
                  return (
                    <div key={sec.id} className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 ${isDone ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span className={isDone ? 'text-slate-800 font-semibold' : 'text-slate-500'}>
                        {sec.name}: {count} questions added
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 7: Test Published Success Screen (Image 10)    */}
      {/* ======================================================== */}
      {viewMode === 'published_success' && (
        <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
            <Check className="h-8 w-8 stroke-[3]" />
          </div>

          <div>
            <h2 className="font-display text-3xl font-bold text-slate-900">Test published successfully</h2>
            <p className="text-xs text-slate-500 mt-1">
              Your assessment is now live and candidate attempts will be proctored during the scheduled window.
            </p>
          </div>

          {/* Test Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs text-left space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base text-slate-900">
                <FileText className="h-5 w-5 text-blue-600" />
                <span>{test.title}</span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                Scheduled
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px]">Questions</span>
                <span className="font-bold text-slate-900">{test.totalQuestions} Questions</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Duration</span>
                <span className="font-bold text-slate-900">{test.durationMins} Minutes</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Marking</span>
                <span className="font-bold text-slate-900">+{defaultMarks} Correct</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Negative</span>
                <span className="font-bold text-slate-900">{test.negativeMarking ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 flex items-center justify-between">
              <span className="text-slate-500 font-semibold">Assessment Window:</span>
              <span className="font-mono font-bold text-slate-800">
                {formatDateTimeDisplay(test.startTime)} → {formatDateTimeDisplay(test.endTime)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setPreviewQuestionIndex(0);
                setViewMode('test_preview');
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer shadow-xs"
            >
              <Eye className="h-4 w-4" />
              <span>View test</span>
            </button>

            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Tests</span>
            </button>

            {onSwitchToCandidateView && (
              <button
                type="button"
                onClick={onSwitchToCandidateView}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs sm:text-sm hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                <GraduationCap className="h-4 w-4" />
                <span>Candidate View</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PUBLISH CONFIRMATION MODAL (Image 9)                     */}
      {/* ======================================================== */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-slate-950/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Send className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">Publish this test?</h3>
              <p className="text-xs text-slate-500 mt-1">
                You're about to publish this test and make it available to candidates during the scheduled window below. Please review the details and confirm.
              </p>
            </div>

            {/* Test Summary Card inside Modal */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>{test.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Draft</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                <span>{questions.length} Questions</span>
                <span>{test.durationMins} Minutes</span>
                <span>+{defaultMarks} per Correct</span>
                <span>{test.negativeMarking ? 'Negative Marking' : 'No Negative Marking'}</span>
              </div>

              <div className="text-[11px] text-slate-600 border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-700">Scheduled Window:</span>
                <div className="font-mono mt-0.5 font-bold text-slate-800">
                  {formatDateTimeDisplay(test.startTime)} → {formatDateTimeDisplay(test.endTime)}
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-800">
              The test will be available during its scheduled window.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={publishing}
                onClick={handleConfirmPublish}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs sm:text-sm hover:bg-blue-700 disabled:opacity-60 cursor-pointer shadow-xs"
              >
                <Check className="h-4 w-4" />
                <span>{publishing ? 'Publishing…' : 'Confirm & Publish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
