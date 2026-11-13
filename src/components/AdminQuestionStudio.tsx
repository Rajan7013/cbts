import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ImagePlus,
  Trash2,
  Plus,
  CheckCircle2,
  Globe,
  X,
  Loader2,
  Wand2,
  FileJson,
  Upload,
  Download,
  Eye,
  EyeOff,
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AdminBuilderStepper } from './AdminBuilderStepper';
import { MathText } from './MathText';
import { QuestionPreviewModal } from './QuestionPreviewModal';
import {
  configureGlobalKatexEngine,
  GLOBAL_KATEX_DELIMITERS,
  GLOBAL_KATEX_MACROS,
  renderKatexInContainer,
} from '../lib/katexConfig';
import {
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
  onPublishTest: () => Promise<void>;
  onApplyDefaultMarksToAll?: (marks: number) => Promise<void>;
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

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Configure KaTeX globally for AdminQuestionStudio and all question-bank previews
configureGlobalKatexEngine({
  delimiters: GLOBAL_KATEX_DELIMITERS,
  macros: GLOBAL_KATEX_MACROS,
  throwOnError: false,
  strict: false,
  trust: false,
});

function hasRichFormatting(text: string): boolean {
  return /(\$|\\\(|\\\[|\[(?:tex|latex)\]|\*\*|`|\*[^\s*]|\^[A-Za-z0-9({-]|[A-Za-z]{1,2}_[A-Za-z0-9{]|\\[A-Za-z]+|(?<![A-Za-z0-9])[mTvuFRqVIPnkxyrh][0-9](?![0-9.]))/.test(
    text
  );
}

function formatVersionTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Just now';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getVersionSourceBadge(source: QuestionVersionSource): {
  label: string;
  classes: string;
} {
  switch (source) {
    case 'before_gemini_edit':
      return {
        label: 'Before Gemini',
        classes: 'border-amber-200 bg-amber-50 text-amber-800',
      };
    case 'gemini_edit':
      return {
        label: 'Gemini Edit',
        classes: 'border-blue-200 bg-blue-50 text-blue-800',
      };
    case 'revert':
      return {
        label: 'Reverted',
        classes: 'border-purple-200 bg-purple-50 text-purple-800',
      };
    case 'initial':
      return {
        label: 'Initial',
        classes: 'border-slate-200 bg-slate-100 text-slate-700',
      };
    case 'manual_save':
    default:
      return {
        label: 'Saved Edit',
        classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      };
  }
}

export function AdminQuestionStudio({
  test,
  questions,
  initialQuestionId,
  onBack,
  onEditTestDetails,
  onSaveQuestion,
  onLoadQuestionVersions,
  onRecordQuestionVersion,
  onDeleteQuestion,
  onPublishTest,
  onApplyDefaultMarksToAll,
}: AdminQuestionStudioProps) {
  const defaultMarks = test.marksPerQuestion ?? 4;

  const [activeSectionId, setActiveSectionId] = useState<string>(
    test.sections[0]?.id || 'default'
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const [questionText, setQuestionText] = useState('');
  const [questionImageUrl, setQuestionImageUrl] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>(
    OPTION_IDS.map((id) => ({ id, text: '', imageUrl: '' }))
  );
  const [correctOptionId, setCorrectOptionId] = useState<OptionId>('A');
  const [shortExplanation, setShortExplanation] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [marks, setMarks] = useState<number>(defaultMarks);

  const [savingQ, setSavingQ] = useState(false);
  const [syncingMarks, setSyncingMarks] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<'question' | OptionId | null>(null);
  const [completingAi, setCompletingAi] = useState(false);
  const [writingSolution, setWritingSolution] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [previewTargetId, setPreviewTargetId] = useState<string | null | undefined>(undefined);

  // Version History state (Firestore-backed for saved questions + instant local snapshots for pre-Gemini edits)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [revertingVersionId, setRevertingVersionId] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [remoteVersionsByQ, setRemoteVersionsByQ] = useState<Record<string, QuestionVersion[]>>(
    {}
  );
  const [localVersionsByQ, setLocalVersionsByQ] = useState<Record<string, QuestionVersion[]>>({});
  const [lastAiEditLabel, setLastAiEditLabel] = useState<string | null>(null);
  const [lastUndoVersion, setLastUndoVersion] = useState<QuestionVersion | null>(null);

  // Gemini AI Bulk Generator state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiCount, setAiCount] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState('Medium');
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [aiImageBase64, setAiImageBase64] = useState<string | undefined>(undefined);
  const [aiImageMime, setAiImageMime] = useState<string | undefined>(undefined);
  const [aiAttachImage, setAiAttachImage] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiDrafts, setAiDrafts] = useState<GeneratedQuestionDraft[]>([]);

  // JSON Import & Gemini Completion state
  const [showJsonPanel, setShowJsonPanel] = useState(true);
  const [showRawJsonEditor, setShowRawJsonEditor] = useState(false);
  const [isDraggingJson, setIsDraggingJson] = useState(false);
  const [autoGenerateOnUpload, setAutoGenerateOnUpload] = useState(true);
  const [jsonInputText, setJsonInputText] = useState('');
  const [jsonFileName, setJsonFileName] = useState<string | null>(null);
  const [jsonTargetCount, setJsonTargetCount] = useState(5);
  const [importingJsonMode, setImportingJsonMode] = useState<
    'parse_only' | 'complete_with_gemini' | null
  >(null);
  const [jsonSummaryInfo, setJsonSummaryInfo] = useState<string | null>(null);

  const qImgInputRef = useRef<HTMLInputElement | null>(null);
  const aiImgInputRef = useRef<HTMLInputElement | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const draftsPreviewRef = useRef<HTMLDivElement | null>(null);
  const studioContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    configureGlobalKatexEngine({
      delimiters: GLOBAL_KATEX_DELIMITERS,
      macros: GLOBAL_KATEX_MACROS,
      throwOnError: false,
      strict: false,
      trust: false,
    });
    renderKatexInContainer(studioContainerRef.current);
  }, [questions, aiDrafts, activeSectionId, editingId, showLivePreview]);

  useEffect(() => {
    if (test.sections.length > 0 && !test.sections.some((s) => s.id === activeSectionId)) {
      setActiveSectionId(test.sections[0].id);
    }
  }, [test.sections, activeSectionId]);

  useEffect(() => {
    if (!editingId) {
      setMarks(defaultMarks);
    }
  }, [defaultMarks, editingId]);

  useEffect(() => {
    if (initialQuestionId) {
      const target = questions.find((q) => q.questionId === initialQuestionId);
      if (target) {
        loadQuestionIntoEditor(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestionId]);

  const activeSection = test.sections.find((s) => s.id === activeSectionId) || test.sections[0];
  const sectionQuestions = questions.filter((q) => q.sectionId === activeSectionId);
  const editingSectionIndex = editingId
    ? sectionQuestions.findIndex((q) => q.questionId === editingId)
    : -1;

  const activeVersionKey = editingId || '__new__';

  const fetchVersionsForQuestion = async (questionId: string) => {
    if (!onLoadQuestionVersions) return;
    setLoadingVersions(true);
    try {
      const list = await onLoadQuestionVersions(questionId);
      setRemoteVersionsByQ((prev) => ({ ...prev, [questionId]: list }));
    } catch {
      // Non-blocking history fetch
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    if (editingId && onLoadQuestionVersions) {
      fetchVersionsForQuestion(editingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const activeVersions: QuestionVersion[] = (() => {
    const combined = [
      ...(localVersionsByQ[activeVersionKey] || []),
      ...(editingId ? remoteVersionsByQ[editingId] || [] : []),
    ];
    const seen = new Set<string>();
    return combined
      .filter((v) => {
        if (seen.has(v.versionId)) return false;
        seen.add(v.versionId);
        return true;
      })
      .sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime());
  })();

  const captureCurrentEditorSnapshot = (
    source: QuestionVersionSource,
    summary: string
  ): QuestionVersion | null => {
    const hasContent =
      Boolean(questionText.trim()) ||
      Boolean(questionImageUrl.trim()) ||
      options.some((o) => Boolean(o.text.trim()) || Boolean(o.imageUrl?.trim())) ||
      Boolean(shortExplanation.trim()) ||
      steps.some((s) => Boolean(s.trim()));

    if (!hasContent) return null;

    const cleanOpts = OPTION_IDS.map((id) => {
      const found = options.find((o) => o.id === id);
      return {
        id,
        text: found?.text.trim() || (found?.imageUrl ? `Option ${id}` : ''),
        ...(found?.imageUrl?.trim() ? { imageUrl: found.imageUrl.trim() } : {}),
      };
    });

    const snapshot: QuestionVersion = {
      versionId: generateId('ver_local'),
      questionId: editingId || '__new__',
      testId: test.testId,
      sectionId: activeSectionId,
      source,
      summary,
      questionText:
        questionText.trim() ||
        (questionImageUrl.trim() ? 'Refer to the diagram/image below.' : 'Question'),
      ...(questionImageUrl.trim() ? { questionImageUrl: questionImageUrl.trim() } : {}),
      options: cleanOpts,
      correctOptionId,
      shortExplanation: shortExplanation.trim(),
      stepByStepSolution: steps.map((s) => s.trim()).filter(Boolean),
      marks: Math.min(100, Math.max(0.25, Number(marks) || defaultMarks)),
      createdAtIso: new Date().toISOString(),
      isLocalOnly: !editingId,
    };

    const key = editingId || '__new__';
    setLocalVersionsByQ((prev) => ({
      ...prev,
      [key]: [snapshot, ...(prev[key] || [])].slice(0, 25),
    }));

    if (editingId && onRecordQuestionVersion) {
      const existingQ = questions.find((q) => q.questionId === editingId);
      const qPayload: TestQuestion = {
        questionId: editingId,
        testId: test.testId,
        testStatus: test.status,
        sectionId: activeSectionId,
        orderIndex: existingQ ? existingQ.orderIndex : questions.length,
        questionText: snapshot.questionText,
        ...(snapshot.questionImageUrl ? { questionImageUrl: snapshot.questionImageUrl } : {}),
        options: OPTION_IDS.map((id) => {
          const o = snapshot.options.find((item) => item.id === id);
          return {
            id,
            text: o?.text || `Option ${id}`,
            ...(o?.imageUrl ? { imageUrl: o.imageUrl } : {}),
          };
        }),
        correctOptionId: snapshot.correctOptionId,
        shortExplanation: snapshot.shortExplanation,
        stepByStepSolution: snapshot.stepByStepSolution,
        marks: snapshot.marks,
      };
      onRecordQuestionVersion(qPayload, source, summary)
        .then((savedVer) => {
          setRemoteVersionsByQ((prev) => ({
            ...prev,
            [editingId]: [savedVer, ...(prev[editingId] || [])],
          }));
          setLocalVersionsByQ((prev) => ({
            ...prev,
            [key]: (prev[key] || []).filter((item) => item.versionId !== snapshot.versionId),
          }));
        })
        .catch(() => {});
    }

    return snapshot;
  };

  const resetForm = () => {
    setEditingId(null);
    setQuestionText('');
    setQuestionImageUrl('');
    setOptions(OPTION_IDS.map((id) => ({ id, text: '', imageUrl: '' })));
    setCorrectOptionId('A');
    setShortExplanation('');
    setSteps(['']);
    setMarks(defaultMarks);
    setLastAiEditLabel(null);
    setLastUndoVersion(null);
    setExpandedVersionId(null);
  };

  const loadQuestionIntoEditor = (q: TestQuestion) => {
    setActiveSectionId(q.sectionId);
    setEditingId(q.questionId);
    setQuestionText(q.questionText);
    setQuestionImageUrl(q.questionImageUrl || '');
    setOptions(
      OPTION_IDS.map((id) => {
        const found = q.options.find((o) => o.id === id);
        return { id, text: found?.text || '', imageUrl: found?.imageUrl || '' };
      })
    );
    setCorrectOptionId(q.correctOptionId);
    setShortExplanation(q.shortExplanation || '');
    setSteps(q.stepByStepSolution?.length ? q.stepByStepSolution : ['']);
    setMarks(q.marks ?? defaultMarks);
    setErrorMsg(null);
    setStatusMsg(null);
    setLastAiEditLabel(null);
    setLastUndoVersion(null);
    setExpandedVersionId(null);
  };

  const handleRevertToVersion = async (v: QuestionVersion) => {
    setErrorMsg(null);
    setStatusMsg(null);
    setRevertingVersionId(v.versionId);

    try {
      // Preserve current unsaved state locally before reverting so nothing is lost
      if (
        questionText.trim() !== v.questionText.trim() ||
        shortExplanation.trim() !== v.shortExplanation.trim() ||
        correctOptionId !== v.correctOptionId
      ) {
        captureCurrentEditorSnapshot(
          lastAiEditLabel ? 'gemini_edit' : 'manual_save',
          'Snapshot taken before reverting'
        );
      }

      setActiveSectionId(v.sectionId || activeSectionId);
      setQuestionText(v.questionText);
      setQuestionImageUrl(v.questionImageUrl || '');
      setOptions(
        OPTION_IDS.map((id) => {
          const found = v.options.find((o) => o.id === id);
          return { id, text: found?.text || '', imageUrl: found?.imageUrl || '' };
        })
      );
      setCorrectOptionId(OPTION_IDS.includes(v.correctOptionId) ? v.correctOptionId : 'A');
      setShortExplanation(v.shortExplanation || '');
      setSteps(v.stepByStepSolution?.length ? v.stepByStepSolution : ['']);
      setMarks(v.marks ?? defaultMarks);
      setLastAiEditLabel(null);
      setLastUndoVersion(null);

      if (editingId) {
        const existingQ = questions.find((q) => q.questionId === editingId);
        const revertedQ: TestQuestion = {
          questionId: editingId,
          testId: test.testId,
          testStatus: test.status,
          sectionId: v.sectionId || activeSectionId,
          orderIndex: existingQ ? existingQ.orderIndex : questions.length,
          questionText: v.questionText,
          ...(v.questionImageUrl ? { questionImageUrl: v.questionImageUrl } : {}),
          options: OPTION_IDS.map((id) => {
            const found = v.options.find((o) => o.id === id);
            return {
              id,
              text: found?.text || (found?.imageUrl ? `Option ${id}` : `Option ${id}`),
              ...(found?.imageUrl ? { imageUrl: found.imageUrl } : {}),
            };
          }),
          correctOptionId: OPTION_IDS.includes(v.correctOptionId) ? v.correctOptionId : 'A',
          shortExplanation: v.shortExplanation || '',
          stepByStepSolution: v.stepByStepSolution || [],
          marks: Math.min(100, Math.max(0.25, Number(v.marks) || defaultMarks)),
        };
        const sourceBadge = getVersionSourceBadge(v.source).label;
        await onSaveQuestion(revertedQ, {
          versionSource: 'revert',
          versionSummary: `Reverted to ${sourceBadge} (${formatVersionTimestamp(v.createdAtIso)})`,
        });
        await fetchVersionsForQuestion(editingId);
        setStatusMsg(
          `Reverted Q${editingSectionIndex + 1} to "${sourceBadge}" (${formatVersionTimestamp(v.createdAtIso)}) and saved.`
        );
      } else {
        setStatusMsg(
          `Restored draft question to "${getVersionSourceBadge(v.source).label}" (${formatVersionTimestamp(v.createdAtIso)}).`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to revert to selected version.');
    } finally {
      setRevertingVersionId(null);
    }
  };

  const handlePrevQuestion = () => {
    if (sectionQuestions.length === 0) return;
    if (editingSectionIndex === -1) {
      loadQuestionIntoEditor(sectionQuestions[sectionQuestions.length - 1]);
    } else if (editingSectionIndex > 0) {
      loadQuestionIntoEditor(sectionQuestions[editingSectionIndex - 1]);
    }
  };

  const handleNextQuestion = () => {
    if (editingSectionIndex === -1) return;
    if (editingSectionIndex < sectionQuestions.length - 1) {
      loadQuestionIntoEditor(sectionQuestions[editingSectionIndex + 1]);
    } else {
      resetForm();
      setStatusMsg('Ready to add a new question.');
    }
  };

  const handleUploadImage = async (file: File, target: 'question' | OptionId) => {
    setUploadingTarget(target);
    setErrorMsg(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploadedUrl = await uploadImageDataUrl(dataUrl, file.name || `${target}.png`);
      if (target === 'question') {
        setQuestionImageUrl(uploadedUrl);
      } else {
        setOptions((prev) =>
          prev.map((o) => (o.id === target ? { ...o, imageUrl: uploadedUrl } : o))
        );
      }
      setStatusMsg(
        target === 'question'
          ? 'Question image uploaded.'
          : `Option ${target} image uploaded.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handlePasteImageEvent = (
    e: React.ClipboardEvent,
    target: 'question' | OptionId | 'ai_panel'
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          if (target === 'ai_panel') {
            handleAiImagePick(file);
          } else {
            handleUploadImage(file, target);
          }
          return;
        }
      }
    }
  };

  const handleAiImagePick = async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        setAiImagePreview(dataUrl);
        setAiImageMime(match[1]);
        setAiImageBase64(match[2]);
      }
    } catch {
      setErrorMsg('Could not read uploaded textbook/diagram image.');
    }
  };

  const saveCurrentQuestionInternal = async (advanceToNext: boolean) => {
    setErrorMsg(null);
    setStatusMsg(null);

    if (!questionText.trim() && !questionImageUrl.trim()) {
      setErrorMsg('Enter question text or upload a question image.');
      return;
    }

    const cleanOptions = options.map((o) => ({
      id: o.id,
      text: o.text.trim() || (o.imageUrl ? `Option ${o.id}` : ''),
      ...(o.imageUrl?.trim() ? { imageUrl: o.imageUrl.trim() } : {}),
    }));

    if (cleanOptions.some((o) => !o.text && !o.imageUrl)) {
      setErrorMsg(
        'All 4 options (A, B, C, D) need text or an image—or click "Generate Options, Answer & Solution with Gemini" to fill them automatically.'
      );
      return;
    }

    setSavingQ(true);
    try {
      const existingQ = editingId ? questions.find((q) => q.questionId === editingId) : null;
      const resolvedStem =
        questionText.trim() || 'Refer to the diagram/image below and choose the correct option.';
      const newQ: TestQuestion = {
        questionId: editingId || generateId('q'),
        testId: test.testId,
        testStatus: test.status,
        sectionId: activeSectionId,
        orderIndex: existingQ ? existingQ.orderIndex : questions.length,
        questionText: resolvedStem,
        ...(questionImageUrl.trim() ? { questionImageUrl: questionImageUrl.trim() } : {}),
        options: cleanOptions,
        correctOptionId,
        shortExplanation: shortExplanation.trim(),
        stepByStepSolution: steps.map((s) => s.trim()).filter(Boolean),
        marks: Math.min(100, Math.max(0.25, Number(marks) || defaultMarks)),
      };
      await onSaveQuestion(
        newQ,
        lastAiEditLabel
          ? {
              versionSource: 'gemini_edit',
              versionSummary: `Saved after Gemini (${lastAiEditLabel})`,
            }
          : {
              versionSource: editingId ? 'manual_save' : 'initial',
              versionSummary: editingId ? 'Saved manual update' : 'Initial saved version',
            }
      );

      if (editingId) {
        await fetchVersionsForQuestion(editingId);
      } else {
        // Clear local unsaved draft versions once promoted to a saved question
        setLocalVersionsByQ((prev) => {
          const next = { ...prev };
          delete next.__new__;
          return next;
        });
      }

      if (editingId && advanceToNext) {
        if (editingSectionIndex >= 0 && editingSectionIndex < sectionQuestions.length - 1) {
          loadQuestionIntoEditor(sectionQuestions[editingSectionIndex + 1]);
          setStatusMsg('Question updated. Loaded next question.');
        } else {
          resetForm();
          setStatusMsg('Question updated. Ready to add next question.');
        }
      } else {
        setStatusMsg(editingId ? 'Question updated.' : 'Question saved. Ready for next question.');
        resetForm();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save question.');
    } finally {
      setSavingQ(false);
    }
  };

  const handleSaveCurrentQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCurrentQuestionInternal(false);
  };

  /**
   * Multimodal Gemini AI completion:
   * Inspects questionText + questionImageUrl + option texts + option images (A/B/C/D)
   * and returns/fills questionText (if empty), 4 options, correctOptionId, shortExplanation, & steps.
   */
  const handleCompleteWithGemini = async () => {
    if (!questionText.trim() && !questionImageUrl.trim()) {
      setErrorMsg(
        'Enter a question or upload/paste a question image first so Gemini can generate options, correct answer, and solution.'
      );
      return;
    }
    setCompletingAi(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const preGeminiSnapshot = captureCurrentEditorSnapshot(
        'before_gemini_edit',
        'Before Gemini: Generate Options, Answer & Solution'
      );

      const result = await generateSolutionWithAI({
        questionText: questionText.trim(),
        questionImageUrl: questionImageUrl.trim() || undefined,
        options,
        mode: 'complete_all',
      });
      if (!questionText.trim() && result.questionText) {
        setQuestionText(result.questionText);
      }
      setOptions((prev) =>
        OPTION_IDS.map((id) => {
          const prevOpt = prev.find((p) => p.id === id);
          const aiOpt = result.options.find((o) => o.id === id);
          return {
            id,
            text: prevOpt?.text.trim() ? prevOpt.text : aiOpt?.text || '',
            imageUrl: prevOpt?.imageUrl || '',
          };
        })
      );
      setCorrectOptionId(result.correctOptionId);
      setShortExplanation(result.shortExplanation);
      setSteps(result.stepByStepSolution.length ? result.stepByStepSolution : ['']);
      setLastAiEditLabel('Options, Answer & Solution');
      setLastUndoVersion(preGeminiSnapshot);
      setStatusMsg(
        `Gemini analyzed the question${questionImageUrl ? ' & image' : ''} and filled options, Answer (${result.correctOptionId}), and step-by-step solution.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gemini AI completion failed.');
    } finally {
      setCompletingAi(false);
    }
  };

  const handleAutoWriteSolutionOnly = async () => {
    if (!questionText.trim() && !questionImageUrl.trim()) {
      setErrorMsg('Enter question text or upload a question image first.');
      return;
    }
    setWritingSolution(true);
    setErrorMsg(null);
    try {
      const preGeminiSnapshot = captureCurrentEditorSnapshot(
        'before_gemini_edit',
        'Before Gemini: Write Solution Only'
      );

      const result = await generateSolutionWithAI({
        questionText: questionText.trim(),
        questionImageUrl: questionImageUrl.trim() || undefined,
        options,
        correctOptionId,
        mode: 'solution_only',
      });
      setShortExplanation(result.shortExplanation);
      setSteps(result.stepByStepSolution.length ? result.stepByStepSolution : ['']);
      setLastAiEditLabel('Solution Only');
      setLastUndoVersion(preGeminiSnapshot);
      setStatusMsg('Short explanation & step-by-step solution generated by Gemini.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gemini solution generation failed.');
    } finally {
      setWritingSolution(false);
    }
  };

  const handleGenerateAiQuestions = async () => {
    setGeneratingAi(true);
    setErrorMsg(null);
    try {
      const drafts = await generateQuestionsWithAI({
        topicOrNotes: aiNotes,
        sectionName: activeSection?.name || 'General',
        count: aiCount,
        difficulty: aiDifficulty,
        imageBase64: aiImageBase64,
        imageMimeType: aiImageMime,
        attachImageAsQuestion: Boolean(aiImageBase64 && aiAttachImage),
      });
      setAiDrafts(drafts);
      if (drafts.length > 0) {
        setTimeout(() => {
          draftsPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate questions with Gemini.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleRunJsonImport = async (
    mode: 'parse_only' | 'complete_with_gemini',
    overrideText?: string
  ) => {
    const payload = (overrideText ?? jsonInputText).trim();
    if (!payload) {
      setErrorMsg('Upload a .json file or paste JSON content first.');
      return;
    }

    setImportingJsonMode(mode);
    setErrorMsg(null);
    setStatusMsg(null);
    setJsonSummaryInfo(null);

    try {
      const result = await importQuestionsFromJson({
        jsonTextOrData: payload,
        sectionName: activeSection?.name || 'General',
        mode,
        count: jsonTargetCount,
      });

      setAiDrafts(result.questions);
      if (result.questions.length > 0) {
        setTimeout(() => {
          draftsPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }

      if (mode === 'parse_only') {
        if (!result.parsedAsArray) {
          setJsonSummaryInfo(
            'Structured question array not found—click "Complete / Generate with Gemini" to generate full MCQs directly from this JSON.'
          );
        } else if (result.incompleteCount > 0) {
          setJsonSummaryInfo(
            `Loaded ${result.questions.length} item(s). ${result.incompleteCount} item(s) have missing fields (stem, options, answer, or solution)—click "Complete / Generate with Gemini" to finish them.`
          );
        } else {
          setJsonSummaryInfo(
            `Parsed ${result.questions.length} complete question(s) from JSON. Review below and add to ${activeSection?.name}.`
          );
        }
      } else {
        setJsonSummaryInfo(
          `Gemini generated & completed ${result.questions.length} MCQ(s) with options, answers, and step-by-step solutions while preserving attached images.`
        );
        setStatusMsg(
          `Prepared ${result.questions.length} complete question(s) from JSON via Gemini.`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process JSON questions.');
    } finally {
      setImportingJsonMode(null);
    }
  };

  const handleJsonFileUpload = async (file: File) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const text = await file.text();
      // Validate & parse JSON immediately before sending to backend / Gemini
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (parseErr) {
        setJsonFileName(file.name);
        setJsonInputText(text);
        setShowRawJsonEditor(true);
        setErrorMsg(
          `Invalid JSON in "${file.name}": ${
            parseErr instanceof Error ? parseErr.message : 'Syntax error'
          }`
        );
        return;
      }

      const itemCount = Array.isArray(parsed)
        ? parsed.length
        : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as Record<string, unknown>).questions)
        ? ((parsed as Record<string, unknown>).questions as unknown[]).length
        : null;

      setJsonFileName(file.name);
      setJsonInputText(text);
      setJsonSummaryInfo(
        itemCount !== null
          ? `Parsed "${file.name}" (${itemCount} item${itemCount === 1 ? '' : 's'}). ${
              autoGenerateOnUpload ? 'Sending to Gemini AI for completion & preview…' : ''
            }`
          : `Parsed "${file.name}" as structured JSON data. ${
              autoGenerateOnUpload ? 'Sending to Gemini AI to generate MCQs…' : ''
            }`
      );

      await handleRunJsonImport(
        autoGenerateOnUpload ? 'complete_with_gemini' : 'parse_only',
        text
      );
    } catch {
      setErrorMsg('Could not read the selected JSON file.');
    }
  };

  const handleDownloadSampleJson = () => {
    const sample = {
      questions: [
        {
          questionText:
            'A convex lens has a focal length of 20 cm. At what distance from the lens should an object be placed to form a real, inverted image of the same size?',
          questionImageUrl: '',
          options: [
            { id: 'A', text: '10 cm', imageUrl: '' },
            { id: 'B', text: '20 cm', imageUrl: '' },
            { id: 'C', text: '40 cm', imageUrl: '' },
            { id: 'D', text: '80 cm', imageUrl: '' },
          ],
          correctOptionId: 'C',
          shortExplanation:
            'A convex lens forms a real, inverted image of identical size when the object is placed at 2F (40 cm).',
          stepByStepSolution: [
            'Given focal length f = +20 cm.',
            'For magnification m = -1 (same size, real & inverted), object distance u = -2f.',
            'Therefore u = -40 cm, meaning 40 cm in front of the lens.',
          ],
        },
        {
          question:
            'What happens to the resistance of a copper wire if its length is doubled while keeping volume constant? (Leave options/solution blank for Gemini to complete)',
        },
      ],
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exampulse_questions_template.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleLoadDraftIntoEditor = (d: GeneratedQuestionDraft) => {
    setEditingId(null);
    setQuestionText(d.questionText || '');
    setQuestionImageUrl(d.questionImageUrl || '');
    setOptions(
      OPTION_IDS.map((id, idx) => {
        const matched = d.options.find((o) => o.id === id) || d.options[idx];
        return {
          id,
          text: matched?.text || '',
          imageUrl: matched?.imageUrl || '',
        };
      })
    );
    setCorrectOptionId(OPTION_IDS.includes(d.correctOptionId) ? d.correctOptionId : 'A');
    setShortExplanation(d.shortExplanation || '');
    setSteps(d.stepByStepSolution?.length ? d.stepByStepSolution : ['']);
    setMarks(d.marks ?? defaultMarks);
    setStatusMsg('Loaded draft into the Question Editor below so you can inspect or fine-tune it.');
    setErrorMsg(null);
  };

  const handleAddDraftsToTest = async (draftsToAdd: GeneratedQuestionDraft[]) => {
    setSavingQ(true);
    setErrorMsg(null);
    try {
      let idx = questions.length;
      for (const d of draftsToAdd) {
        const cleanOptions: QuestionOption[] = OPTION_IDS.map((optId, optIdx) => {
          const matched = d.options.find((o) => o.id === optId) || d.options[optIdx];
          const optImg = matched?.imageUrl?.trim();
          const optText = matched?.text?.trim() || `Option ${optId}`;
          return {
            id: optId,
            text: optText,
            ...(optImg ? { imageUrl: optImg } : {}),
          };
        });

        const stem =
          d.questionText.trim() ||
          (d.questionImageUrl
            ? 'Refer to the diagram/image below and choose the correct option.'
            : 'Question');

        const q: TestQuestion = {
          questionId: generateId('q'),
          testId: test.testId,
          testStatus: test.status,
          sectionId: activeSectionId,
          orderIndex: idx++,
          questionText: stem,
          ...(d.questionImageUrl ? { questionImageUrl: d.questionImageUrl } : {}),
          options: cleanOptions,
          correctOptionId: OPTION_IDS.includes(d.correctOptionId) ? d.correctOptionId : 'A',
          shortExplanation: d.shortExplanation || '',
          stepByStepSolution: Array.isArray(d.stepByStepSolution) ? d.stepByStepSolution : [],
          marks: d.marks ?? defaultMarks,
        };
        await onSaveQuestion(q);
      }
      setAiDrafts((prev) => prev.filter((item) => !draftsToAdd.includes(item)));
      setStatusMsg(
        `Added ${draftsToAdd.length} question(s) to ${activeSection?.name}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save drafted questions.');
    } finally {
      setSavingQ(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setErrorMsg(null);
    try {
      await onPublishTest();
      setStatusMsg('Test published and visible to candidates.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to publish test.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div ref={studioContainerRef} className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <AdminBuilderStepper
        activeStep={2}
        testTitle={test.title}
        canSwitchToStep2={true}
        onBackToDashboard={onBack}
        onSelectStep={(step) => {
          if (step === 1) onEditTestDetails();
        }}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Step 2: Question Builder &amp; Gemini AI Studio
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {test.title} · Questions: {questions.length} / {test.totalQuestions} · Window:{' '}
            {formatDateShort(test.startTime)}–{formatDateShort(test.endTime)} · Duration:{' '}
            {test.durationMins} min · Marking: +{defaultMarks} /{' '}
            {test.negativeMarking ? `-${test.negativeMarkValue}` : '0'} · Max Strikes:{' '}
            {test.maxStrikes}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onEditTestDetails}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back: Edit Details &amp; Dates</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowJsonPanel((v) => !v);
              setShowAiPanel(false);
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showJsonPanel
                ? 'border-indigo-300 bg-indigo-100 text-indigo-900'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileJson className="h-4 w-4 text-indigo-700" />
            <span>{showJsonPanel ? 'Hide JSON Importer' : 'Import JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAiPanel((v) => !v);
              setShowJsonPanel(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-blue-700" />
            <span>{showAiPanel ? 'Hide Bulk AI Generator' : 'Bulk Generate with Gemini'}</span>
          </button>

          <button
            type="button"
            disabled={
              questions.length === 0 && !questionText.trim() && !questionImageUrl.trim()
            }
            onClick={() =>
              setPreviewTargetId(
                editingId ||
                  (questionText.trim() || questionImageUrl.trim()
                    ? '__editor_draft__'
                    : questions[0]?.questionId || null)
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="h-4 w-4 text-blue-700" />
            <span>Preview Questions</span>
          </button>

          <button
            type="button"
            disabled={publishing || questions.length === 0}
            onClick={handlePublish}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="h-4 w-4" />
            <span>
              {publishing
                ? 'Publishing…'
                : test.status === 'published'
                ? 'Published (Live)'
                : 'Publish Test'}
            </span>
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {test.sections.map((sec) => {
          const countInSec = questions.filter((q) => q.sectionId === sec.id).length;
          const isActive = sec.id === activeSectionId;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => {
                setActiveSectionId(sec.id);
                resetForm();
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {sec.name} ({countInSec}/{sec.questionCount})
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}
      {statusMsg && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
          {lastUndoVersion && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={revertingVersionId !== null}
                onClick={() => handleRevertToVersion(lastUndoVersion)}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Undo Gemini Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHistoryPanel(true)}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 cursor-pointer"
              >
                <History className="h-3.5 w-3.5" />
                <span>History ({activeVersions.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Gemini AI Bulk Question & Solution Synthesizer Panel */}
      {showAiPanel && (
        <div
          onPaste={(e) => handlePasteImageEvent(e, 'ai_panel')}
          className="mt-6 rounded-xl border border-blue-200 bg-white p-4 sm:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-700" />
                <span>Gemini AI Bulk Question, Options &amp; Solution Synthesizer</span>
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Enter notes or upload/paste a textbook diagram or question sheet image to generate complete MCQs for{' '}
                <strong>{activeSection?.name}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAiPanel(false)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Topic, Syllabus Notes, or Raw Problem Text (you can also paste an image here with Ctrl+V)
              </label>
              <textarea
                rows={4}
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                placeholder="e.g., Snell's law refraction through prisms, critical angle, or paste a diagram/question image..."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="lg:col-span-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Questions</label>
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} MCQs
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <input
                  ref={aiImgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAiImagePick(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => aiImgInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <ImagePlus className="h-4 w-4 text-blue-700" />
                  <span>{aiImagePreview ? 'Change Uploaded Image' : 'Upload Diagram / Question Image'}</span>
                </button>
                {aiImagePreview && (
                  <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-center justify-between">
                      <img
                        src={aiImagePreview}
                        alt="Uploaded reference notes"
                        referrerPolicy="no-referrer"
                        className="h-12 w-20 rounded object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAiImagePreview(null);
                          setAiImageBase64(undefined);
                          setAiImageMime(undefined);
                        }}
                        className="text-xs text-red-600 hover:underline px-2 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiAttachImage}
                        onChange={(e) => setAiAttachImage(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                      />
                      <span>Attach this image on generated question(s)</span>
                    </label>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={generatingAi}
                onClick={handleGenerateAiQuestions}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
              >
                {generatingAi ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>{generatingAi ? 'Generating MCQs…' : 'Generate Questions & Solutions'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Question Importer & Gemini Generator Panel */}
      {showJsonPanel && (
        <div className="mt-6 rounded-xl border border-indigo-200 bg-white p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileJson className="h-4 w-4 text-indigo-700" />
                <span>Upload JSON File &amp; Generate Preview with Gemini</span>
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Upload or drop a <code>.json</code> file containing questions, images, options, solutions, or raw notes. ExamPulse parses the JSON, sends it to Gemini AI, and previews generated questions for{' '}
                <strong>{activeSection?.name}</strong> before saving to Firestore.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSampleJson}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Sample JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setShowJsonPanel(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                title="Hide JSON Upload Area"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <input
            ref={jsonFileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleJsonFileUpload(file);
              e.target.value = '';
            }}
          />

          {/* Drag-and-Drop JSON File Upload Area */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (importingJsonMode === null) jsonFileInputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && importingJsonMode === null) {
                e.preventDefault();
                jsonFileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingJson(true);
            }}
            onDragLeave={() => setIsDraggingJson(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingJson(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleJsonFileUpload(file);
            }}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
              isDraggingJson
                ? 'border-indigo-500 bg-indigo-50/70'
                : 'border-slate-300 bg-slate-50/60 hover:border-indigo-400 hover:bg-indigo-50/30'
            }`}
          >
            <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
              {importingJsonMode !== null ? (
                <Loader2 className="h-7 w-7 animate-spin text-indigo-700" />
              ) : (
                <Upload className="h-7 w-7 text-indigo-700" />
              )}
              <div className="text-sm font-semibold text-slate-900">
                {importingJsonMode === 'complete_with_gemini'
                  ? 'Sending parsed JSON to Gemini AI…'
                  : importingJsonMode === 'parse_only'
                  ? 'Parsing JSON questions…'
                  : jsonFileName
                  ? `Uploaded: ${jsonFileName} (click or drop another .json file to replace)`
                  : 'Drop a .json file here, or click to browse'}
              </div>
              <p className="text-xs text-slate-500">
                Supports structured question arrays, embedded base64 or /uploads/ images, partial items, or raw topic/syllabus JSON.
              </p>
            </div>
          </div>

          {/* Upload Behavior & Raw JSON Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerateOnUpload}
                  onChange={(e) => setAutoGenerateOnUpload(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-700"
                />
                <span>Auto-send uploaded JSON to Gemini AI for completion &amp; generation</span>
              </label>

              <div className="flex items-center gap-2 text-slate-600">
                <span>Raw notes count:</span>
                <select
                  value={jsonTargetCount}
                  onChange={(e) => setJsonTargetCount(Number(e.target.value))}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900"
                >
                  {[3, 5, 8, 10, 12, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} MCQs
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRawJsonEditor((v) => !v)}
              className="font-semibold text-indigo-700 hover:underline cursor-pointer"
            >
              {showRawJsonEditor ? 'Hide Raw JSON Editor' : 'Paste / Edit Raw JSON'}
            </button>
          </div>

          {showRawJsonEditor && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                JSON Content (supports arrays, &#123;&quot;questions&quot;: [...]&#125;, URLs or base64 data:image/* on question &amp; options, or raw topic JSON)
              </label>
              <textarea
                rows={7}
                value={jsonInputText}
                onChange={(e) => setJsonInputText(e.target.value)}
                placeholder={`{\n  "questions": [\n    {\n      "questionText": "...",\n      "questionImageUrl": "/uploads/... or data:image/png;base64,...",\n      "options": [{"id": "A", "text": "..."}, ...],\n      "correctOptionId": "A",\n      "shortExplanation": "...",\n      "stepByStepSolution": ["..."]\n    }\n  ]\n}`}
                className="w-full rounded-lg border border-slate-300 bg-slate-50/40 px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          {jsonSummaryInfo && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-xs text-indigo-950">
              {jsonSummaryInfo}
            </div>
          )}

          {jsonInputText.trim().length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setJsonInputText('');
                  setJsonFileName(null);
                  setJsonSummaryInfo(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Clear JSON
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={importingJsonMode !== null}
                  onClick={() => handleRunJsonImport('parse_only')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {importingJsonMode === 'parse_only' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileJson className="h-3.5 w-3.5 text-indigo-700" />
                  )}
                  <span>
                    {importingJsonMode === 'parse_only' ? 'Parsing JSON…' : 'Preview JSON Only'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={importingJsonMode !== null}
                  onClick={() => handleRunJsonImport('complete_with_gemini')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {importingJsonMode === 'complete_with_gemini' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {importingJsonMode === 'complete_with_gemini'
                      ? 'Generating with Gemini…'
                      : 'Generate / Complete with Gemini'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shared Imported / Gemini-Generated Drafts Preview Grid */}
      {aiDrafts.length > 0 && (
        <div
          ref={draftsPreviewRef}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-900">
                Draft Questions Preview ({aiDrafts.length})
              </span>
              <p className="text-xs text-slate-500">
                Inspect questions, diagrams, option images, explanations, and step-by-step solutions before adding to{' '}
                <strong>{activeSection?.name}</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setAiDrafts([])}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
              >
                Clear Drafts
              </button>
              <button
                type="button"
                disabled={savingQ}
                onClick={() => handleAddDraftsToTest(aiDrafts)}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                Add All to {activeSection?.name}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {aiDrafts.map((d, idx) => {
              const isIncomplete =
                !d.questionText.trim() ||
                d.options.some((o) => !o.text.trim() && !o.imageUrl) ||
                !d.shortExplanation.trim() ||
                !d.stepByStepSolution?.length;

              return (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>
                        Draft #{idx + 1} · Answer: {d.correctOptionId} · {d.marks ?? defaultMarks}m ·{' '}
                        {d.stepByStepSolution?.length || 0} steps ·{' '}
                        <span className={isIncomplete ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                          {isIncomplete ? 'Partial' : 'Complete'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAiDrafts((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                        }
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Discard Draft"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {d.questionImageUrl && (
                      <img
                        src={d.questionImageUrl}
                        alt={`Draft ${idx + 1} diagram`}
                        referrerPolicy="no-referrer"
                        className="max-h-40 rounded border border-slate-200 bg-white object-contain p-1"
                      />
                    )}

                    <div className="text-slate-900 text-sm leading-relaxed">
                      {d.questionText ? (
                        <MathText text={d.questionText} />
                      ) : (
                        <span className="text-amber-700 italic">Missing question stem</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-700">
                      {d.options.map((o) => (
                        <div
                          key={o.id}
                          className={`rounded px-2.5 py-2 space-y-1 leading-relaxed ${
                            o.id === d.correctOptionId
                              ? 'bg-emerald-100 font-semibold text-emerald-900'
                              : 'bg-white border border-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            <span className="font-mono shrink-0">{o.id})</span>
                            {o.text ? (
                              <MathText text={o.text} inline className="min-w-0" />
                            ) : (
                              <span className="italic text-amber-700">[Blank option]</span>
                            )}
                          </div>
                          {o.imageUrl && (
                            <img
                              src={o.imageUrl}
                              alt={`Draft ${idx + 1} option ${o.id}`}
                              referrerPolicy="no-referrer"
                              className="h-14 rounded border border-slate-200 bg-white object-contain p-0.5"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2 text-slate-700 leading-relaxed">
                      <div>
                        <strong className="text-slate-900">Short Explanation:</strong>{' '}
                        {d.shortExplanation ? (
                          <MathText text={d.shortExplanation} inline />
                        ) : (
                          <span className="italic text-amber-700">Not provided yet</span>
                        )}
                      </div>

                      {d.stepByStepSolution && d.stepByStepSolution.length > 0 && (
                        <div className="border-t border-slate-100 pt-2">
                          <strong className="text-slate-900">Step-by-Step Solution:</strong>
                          <ol className="mt-1 list-decimal list-inside space-y-1 text-slate-600">
                            {d.stepByStepSolution.map((step, sIdx) => (
                              <li key={sIdx}>
                                <MathText text={step} inline />
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleLoadDraftIntoEditor(d)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      Edit in Form
                    </button>
                    <button
                      type="button"
                      disabled={savingQ}
                      onClick={() => handleAddDraftsToTest([d])}
                      className="rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                    >
                      Add Question
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Editor + Question Sidebar */}
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <form onSubmit={handleSaveCurrentQuestion} className="lg:col-span-8 space-y-5 min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {editingId
                    ? `Editing Q${editingSectionIndex + 1} · ${activeSection?.name}`
                    : `New Question #${sectionQuestions.length + 1} · ${activeSection?.name}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add text or images for the question and options, then let Gemini solve &amp; generate missing options or steps.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={
                    questions.length === 0 && !questionText.trim() && !questionImageUrl.trim()
                  }
                  onClick={() =>
                    setPreviewTargetId(
                      editingId ||
                        (questionText.trim() || questionImageUrl.trim()
                          ? '__editor_draft__'
                          : questions[0]?.questionId || null)
                    )
                  }
                  title="Open Full Candidate Question Preview"
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showHistoryPanel;
                    setShowHistoryPanel(next);
                    if (next && editingId) {
                      fetchVersionsForQuestion(editingId);
                    }
                  }}
                  title="View Version History & Revert Gemini Edits"
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    showHistoryPanel
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  <span>History ({activeVersions.length})</span>
                </button>
                <button
                  type="button"
                  disabled={
                    sectionQuestions.length === 0 ||
                    (editingSectionIndex === 0)
                  }
                  onClick={handlePrevQuestion}
                  title="Previous Question"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Prev Q</span>
                </button>
                <button
                  type="button"
                  disabled={!editingId}
                  onClick={handleNextQuestion}
                  title="Next Question"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                >
                  <span>Next Q</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Q</span>
                  </button>
                )}
              </div>
            </div>

            {/* Version History & Revert Panel */}
            {showHistoryPanel && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-amber-700" />
                      <span>
                        Question Version History (
                        {editingId
                          ? `Q${editingSectionIndex + 1}`
                          : 'Unsaved Draft'}
                        )
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Pre-Gemini snapshots and saved revisions are tracked automatically so you can inspect and revert any Gemini AI or manual edit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHistoryPanel(false)}
                    className="rounded p-1 text-slate-400 hover:bg-amber-100 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {loadingVersions ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading version history…</span>
                  </div>
                ) : activeVersions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-amber-200 bg-white px-4 py-3 text-xs text-slate-500">
                    No previous versions recorded for this question yet. Snapshots are created automatically whenever you run Gemini AI or save edits.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {activeVersions.map((v, vIdx) => {
                      const badge = getVersionSourceBadge(v.source);
                      const isExpanded = expandedVersionId === v.versionId;
                      return (
                        <div
                          key={v.versionId}
                          className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-2"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${badge.classes}`}
                                >
                                  {badge.label}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {formatVersionTimestamp(v.createdAtIso)}
                                </span>
                                {vIdx === 0 && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    · Latest
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-medium text-slate-700">
                                {v.summary} · Answer: {v.correctOptionId} · +{v.marks}m ·{' '}
                                {v.stepByStepSolution.length} steps
                              </div>
                              <div className="text-slate-600 line-clamp-2">
                                <MathText text={v.questionText} inline />
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedVersionId(isExpanded ? null : v.versionId)
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    <span>Hide</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    <span>Inspect</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={revertingVersionId !== null}
                                onClick={() => handleRevertToVersion(v)}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                              >
                                {revertingVersionId === v.versionId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                                <span>
                                  {revertingVersionId === v.versionId
                                    ? 'Reverting…'
                                    : editingId
                                    ? 'Revert & Save'
                                    : 'Restore'}
                                </span>
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-slate-100 pt-2.5 space-y-2 text-slate-700">
                              <div className="text-xs leading-relaxed text-slate-900">
                                <MathText text={v.questionText} />
                              </div>
                              {v.questionImageUrl && (
                                <img
                                  src={v.questionImageUrl}
                                  alt="Historical question diagram"
                                  referrerPolicy="no-referrer"
                                  className="max-h-32 rounded border border-slate-200 object-contain p-1"
                                />
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {v.options.map((opt) => (
                                  <div
                                    key={opt.id}
                                    className={`rounded border px-2 py-1.5 ${
                                      opt.id === v.correctOptionId
                                        ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900'
                                        : 'border-slate-200 bg-slate-50'
                                    }`}
                                  >
                                    <span className="font-mono mr-1">{opt.id})</span>
                                    <MathText text={opt.text} inline />
                                  </div>
                                ))}
                              </div>
                              {v.shortExplanation && (
                                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">
                                  <strong className="text-slate-900">Explanation: </strong>
                                  <MathText text={v.shortExplanation} inline />
                                </div>
                              )}
                              {v.stepByStepSolution.length > 0 && (
                                <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-600 pl-1">
                                  {v.stepByStepSolution.map((st, stIdx) => (
                                    <li key={stIdx}>
                                      <MathText text={st} inline />
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Question Text & Paste-to-Upload */}
            <div onPaste={(e) => handlePasteImageEvent(e, 'question')}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Question Stem (or upload / paste a question image below)
                </label>
                <span className="text-[11px] text-slate-400">
                  Supports Ctrl+V image paste
                </span>
              </div>
              <textarea
                rows={3}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Type the question here (supports Markdown **bold**, *italic*, `code` and LaTeX $E = mc^2$, $$...$$, \(...\), \[...\]), OR upload/paste an image..."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              {questionText.trim().length > 0 && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1">
                    Stem Real-Time Preview (Markdown &amp; KaTeX)
                  </div>
                  <MathText text={questionText} className="text-sm leading-relaxed" />
                </div>
              )}
            </div>

            {/* Question Image Upload & URL */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={qImgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file, 'question');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingTarget !== null}
                  onClick={() => qImgInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                >
                  {uploadingTarget === 'question' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-700" />
                  ) : (
                    <ImagePlus className="h-4 w-4 text-blue-700" />
                  )}
                  <span>
                    {uploadingTarget === 'question'
                      ? 'Uploading…'
                      : questionImageUrl
                      ? 'Replace Question Image'
                      : 'Upload Question Diagram / Image'}
                  </span>
                </button>
                <input
                  type="text"
                  value={questionImageUrl}
                  onChange={(e) => setQuestionImageUrl(e.target.value)}
                  placeholder="Or paste image URL (/uploads/...)"
                  className="flex-1 min-w-[160px] w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"
                />
                {questionImageUrl && (
                  <button
                    type="button"
                    onClick={() => setQuestionImageUrl('')}
                    className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              {questionImageUrl && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <img
                    src={questionImageUrl}
                    alt="Question diagram preview"
                    referrerPolicy="no-referrer"
                    className="max-h-56 rounded object-contain mx-auto"
                  />
                </div>
              )}
            </div>

            {/* Multimodal Gemini AI Complete Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3">
              <div className="text-xs text-blue-950">
                <div className="font-semibold">Gemini Multimodal Question Assistant</div>
                <div className="text-blue-800/80 mt-0.5">
                  Reads your question text, question diagram, and any option text/images to generate missing options, pick the correct answer, and write the full solution.
                </div>
              </div>
              <button
                type="button"
                disabled={completingAi || (!questionText.trim() && !questionImageUrl.trim())}
                onClick={handleCompleteWithGemini}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {completingAi ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                <span>
                  {completingAi
                    ? 'Solving with Gemini…'
                    : 'Generate Options, Answer & Solution'}
                </span>
              </button>
            </div>

            {/* 4 Options with text + optional option images */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Options
              </label>

              {options.map((opt) => (
                <div
                  key={opt.id}
                  onPaste={(e) => handlePasteImageEvent(e, opt.id)}
                  className={`rounded-lg border p-3 transition-colors ${
                    correctOptionId === opt.id
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOptionId === opt.id}
                      onChange={() => setCorrectOptionId(opt.id)}
                      className="h-4 w-4 text-emerald-700 cursor-pointer shrink-0"
                    />
                    <span className="font-mono text-xs font-semibold text-slate-600 w-4 shrink-0">
                      {opt.id}
                    </span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((o) =>
                            o.id === opt.id ? { ...o, text: e.target.value } : o
                          )
                        )
                      }
                      placeholder={`Option ${opt.id} text (or upload/paste option image)...`}
                      className="flex-1 min-w-[180px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <label className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0 ml-auto sm:ml-0">
                      {uploadingTarget === opt.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" />
                      ) : (
                        <ImagePlus className="h-3.5 w-3.5" />
                      )}
                      <span>{opt.imageUrl ? 'Change Img' : 'Img'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file, opt.id);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {hasRichFormatting(opt.text) && (
                    <div className="mt-2 ml-0 sm:ml-8 flex items-baseline gap-2 rounded border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs text-slate-800">
                      <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                        Preview:
                      </span>
                      <MathText text={opt.text} inline className="min-w-0 leading-relaxed" />
                    </div>
                  )}
                  {opt.imageUrl && (
                    <div className="mt-2 ml-0 sm:ml-8 flex items-center gap-3">
                      <img
                        src={opt.imageUrl}
                        alt={`Option ${opt.id} preview`}
                        referrerPolicy="no-referrer"
                        className="h-20 rounded border border-slate-200 object-contain bg-white p-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setOptions((prev) =>
                            prev.map((o) => (o.id === opt.id ? { ...o, imageUrl: '' } : o))
                          )
                        }
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Remove image
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Short Explanation & Step-by-Step Solution */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  Short Explanation &amp; Step-by-Step Solution
                </label>
                <button
                  type="button"
                  disabled={writingSolution || completingAi}
                  onClick={handleAutoWriteSolutionOnly}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap cursor-pointer"
                >
                  {writingSolution ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{writingSolution ? 'Writing…' : 'Write Solution Only with Gemini'}</span>
                </button>
              </div>

              <div>
                <input
                  type="text"
                  value={shortExplanation}
                  onChange={(e) => setShortExplanation(e.target.value)}
                  placeholder="1–2 sentence concise explanation shown immediately in review..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                {hasRichFormatting(shortExplanation) && (
                  <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1.5">Preview:</span>
                    <MathText text={shortExplanation} inline />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Step-by-Step Solution (Optional numbered steps)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSteps((prev) => [...prev, ''])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>

                {steps.map((step, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-xs font-mono text-slate-400 tabular-nums">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) =>
                          setSteps((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))
                        }
                        placeholder={`Step ${idx + 1} explanation...`}
                        className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        disabled={steps.length <= 1}
                        onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {hasRichFormatting(step) && (
                      <div className="ml-0 sm:ml-8 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                        <span className="text-[11px] font-semibold text-slate-400 mr-1.5">
                          Step {idx + 1}:
                        </span>
                        <MathText text={step} inline />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Real-Time Complete Question Entry Preview (Markdown & KaTeX) */}
            <div className="border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-700" />
                  <span className="text-xs font-semibold text-slate-900">
                    Real-Time Candidate Preview (Markdown &amp; KaTeX)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLivePreview((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {showLivePreview ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Hide Full Preview</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Show Full Preview</span>
                    </>
                  )}
                </button>
              </div>

              {showLivePreview && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 text-xs font-mono text-slate-500">
                    <span>
                      {editingId
                        ? `Question ${editingSectionIndex + 1} · ${activeSection?.name}`
                        : `New Question #${sectionQuestions.length + 1} · ${activeSection?.name}`}
                      {' · '}+{marks} Marks
                      {test.negativeMarking ? ` / -${test.negativeMarkValue} Negative` : ''}
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      Correct Answer: {correctOptionId}
                    </span>
                  </div>

                  {questionText.trim() || questionImageUrl.trim() ? (
                    <>
                      {questionText.trim() ? (
                        <MathText
                          text={questionText}
                          className="text-[15.5px] leading-[1.75] text-slate-900"
                        />
                      ) : (
                        <p className="text-sm italic text-slate-500">
                          Refer to the diagram/image below and choose the correct option.
                        </p>
                      )}

                      {questionImageUrl.trim() && (
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <img
                            src={questionImageUrl}
                            alt="Question diagram live preview"
                            referrerPolicy="no-referrer"
                            className="max-h-56 mx-auto object-contain"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs italic text-slate-400">
                      Start typing a question, options, or solution above to verify Markdown and KaTeX formulas in real time.
                    </p>
                  )}

                  {options.some((o) => o.text.trim() || o.imageUrl?.trim()) && (
                    <div
                      className={
                        options.every(
                          (o) =>
                            !o.imageUrl?.trim() &&
                            o.text.trim().length <= 55 &&
                            !/\$\$|\\\[|\\\\\[|\\begin\{|\n/.test(o.text)
                        )
                          ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2'
                          : 'space-y-2.5'
                      }
                    >
                      {options.map((opt) => {
                        const isCorrect = opt.id === correctOptionId;
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm ${
                              isCorrect
                                ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
                                : 'border-slate-200 bg-white text-slate-800'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-mono font-bold ${
                                isCorrect
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-300 text-slate-600'
                              }`}
                            >
                              {opt.id}
                            </span>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {opt.text.trim() ? (
                                <MathText
                                  text={opt.text}
                                  inline
                                  className="block leading-relaxed"
                                />
                              ) : opt.imageUrl ? (
                                <span className="text-xs italic text-slate-400">
                                  Option {opt.id} (image)
                                </span>
                              ) : (
                                <span className="text-xs italic text-slate-400">Empty option</span>
                              )}
                              {opt.imageUrl?.trim() && (
                                <img
                                  src={opt.imageUrl}
                                  alt={`Option ${opt.id} live preview`}
                                  referrerPolicy="no-referrer"
                                  className="max-h-24 rounded border border-slate-200 bg-white object-contain p-1"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(shortExplanation.trim() || steps.some((s) => s.trim())) && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs space-y-2 text-slate-700 leading-relaxed">
                      {shortExplanation.trim() && (
                        <div>
                          <span className="font-semibold text-slate-900">Short Explanation: </span>
                          <MathText text={shortExplanation} inline />
                        </div>
                      )}
                      {steps.some((s) => s.trim()) && (
                        <div
                          className={
                            shortExplanation.trim() ? 'border-t border-slate-100 pt-2' : ''
                          }
                        >
                          <div className="font-semibold text-slate-900 mb-1">
                            Step-by-Step Solution:
                          </div>
                          <ol className="list-decimal list-inside space-y-1 text-slate-700">
                            {steps
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((step, idx) => (
                                <li key={idx}>
                                  <MathText text={step} inline />
                                </li>
                              ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Clear / Reset Form
              </button>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                {editingId && (
                  <button
                    type="button"
                    disabled={savingQ}
                    onClick={() => saveCurrentQuestionInternal(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60 whitespace-nowrap cursor-pointer flex-1 sm:flex-initial"
                  >
                    <span>{savingQ ? 'Saving…' : 'Update & Next Q'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingQ}
                  className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap cursor-pointer flex-1 sm:flex-initial text-center"
                >
                  {savingQ ? 'Saving…' : editingId ? 'Update Question' : 'Save & Add Next'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Sidebar Question List */}
        <aside className="lg:col-span-4 space-y-4 min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                {activeSection?.name} Questions ({sectionQuestions.length})
              </h3>
              {onApplyDefaultMarksToAll &&
                questions.some((q) => q.marks !== defaultMarks) && (
                  <button
                    type="button"
                    disabled={syncingMarks}
                    onClick={async () => {
                      setSyncingMarks(true);
                      setErrorMsg(null);
                      try {
                        await onApplyDefaultMarksToAll(defaultMarks);
                        setMarks(defaultMarks);
                        setStatusMsg(`Updated all questions to +${defaultMarks} marks.`);
                      } catch (err) {
                        setErrorMsg(
                          err instanceof Error ? err.message : 'Failed to sync marks across questions.'
                        );
                      } finally {
                        setSyncingMarks(false);
                      }
                    }}
                    className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {syncingMarks ? 'Syncing…' : `Sync all to +${defaultMarks}m`}
                  </button>
                )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Click any item to edit or inspect diagrams and solutions.
            </p>

            {sectionQuestions.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                No questions in this section yet. Add manually, paste an image, or generate with Gemini AI.
              </div>
            ) : (
              <div className="mt-4 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {sectionQuestions.map((q, idx) => {
                  const optImgCount = q.options.filter((o) => Boolean(o.imageUrl)).length;
                  return (
                    <div
                      key={q.questionId}
                      className={`rounded-lg border p-3 transition-colors ${
                        editingId === q.questionId
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => loadQuestionIntoEditor(q)}
                          className="text-left flex-1 cursor-pointer"
                        >
                          <div className="text-xs font-mono font-semibold text-slate-500">
                            Q{idx + 1} · Answer: {q.correctOptionId} · {q.marks}m
                            {q.questionImageUrl ? ' · Q Img' : ''}
                            {optImgCount > 0 ? ` · ${optImgCount} Opt Img` : ''}
                          </div>
                          <div className="mt-1 text-xs text-slate-800 line-clamp-2">
                            <MathText text={q.questionText} inline />
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewTargetId(q.questionId)}
                            title="Preview Question"
                            className="p-1 text-slate-400 hover:text-blue-700 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingId === q.questionId) resetForm();
                              onDeleteQuestion(q.questionId);
                            }}
                            title="Delete Question"
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Bottom Wizard Navigation Bar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 sm:px-5 py-4">
        <button
          type="button"
          onClick={onEditTestDetails}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer w-full sm:w-auto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back: Edit Test Name, Dates &amp; Rules</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 sm:flex-initial rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer text-center"
          >
            Save &amp; Exit to Admin Studio
          </button>
          <button
            type="button"
            disabled={publishing || questions.length === 0}
            onClick={handlePublish}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{test.status === 'published' ? 'Published (Live)' : 'Publish & Go Live'}</span>
          </button>
        </div>
      </div>

      {previewTargetId !== undefined && (() => {
        const hasLiveDraft = Boolean(
          questionText.trim() ||
            questionImageUrl.trim() ||
            options.some((o) => o.text.trim() || o.imageUrl?.trim())
        );
        const liveDraftQ: TestQuestion | null = hasLiveDraft
          ? {
              questionId: editingId || '__editor_draft__',
              testId: test.testId,
              testStatus: test.status,
              sectionId: activeSectionId,
              orderIndex:
                editingId
                  ? questions.find((item) => item.questionId === editingId)?.orderIndex ??
                    questions.length
                  : questions.length,
              questionText:
                questionText.trim() ||
                (questionImageUrl.trim()
                  ? 'Refer to the diagram/image below and choose the correct option.'
                  : 'Question'),
              ...(questionImageUrl.trim() ? { questionImageUrl: questionImageUrl.trim() } : {}),
              options: OPTION_IDS.map((id) => {
                const found = options.find((o) => o.id === id);
                return {
                  id,
                  text: found?.text.trim() || (found?.imageUrl ? `Option ${id}` : `Option ${id}`),
                  ...(found?.imageUrl?.trim() ? { imageUrl: found.imageUrl.trim() } : {}),
                };
              }),
              correctOptionId,
              shortExplanation: shortExplanation.trim(),
              stepByStepSolution: steps.map((s) => s.trim()).filter(Boolean),
              marks: Math.min(100, Math.max(0.25, Number(marks) || defaultMarks)),
            }
          : null;

        const previewQuestions: TestQuestion[] = editingId
          ? questions.map((item) =>
              item.questionId === editingId && liveDraftQ ? liveDraftQ : item
            )
          : liveDraftQ
          ? [...questions, liveDraftQ]
          : questions;

        return (
          <QuestionPreviewModal
            test={test}
            questions={previewQuestions}
            initialQuestionId={previewTargetId}
            onClose={() => setPreviewTargetId(undefined)}
            onEditQuestion={(q) => {
              if (q.questionId !== '__editor_draft__') {
                loadQuestionIntoEditor(q);
              }
            }}
          />
        );
      })()}
    </div>
  );
}
