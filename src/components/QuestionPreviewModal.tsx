import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  X,
  ZoomIn,
} from 'lucide-react';
import { MathText } from './MathText';
import { QuestionImage } from './QuestionImage';
import type { OptionId, TestExam, TestQuestion } from '../types';

interface QuestionPreviewModalProps {
  test: TestExam;
  questions: TestQuestion[];
  initialQuestionId?: string | null;
  onClose: () => void;
  onEditQuestion?: (question: TestQuestion) => void;
}

export function QuestionPreviewModal({
  test,
  questions,
  initialQuestionId,
  onClose,
  onEditQuestion,
}: QuestionPreviewModalProps) {
  const orderedQuestions = useMemo(() => {
    const sectionOrder = new Map<string, number>();
    test.sections.forEach((s, idx) => sectionOrder.set(s.id, idx));
    return [...questions].sort((a, b) => {
      const sa = sectionOrder.get(a.sectionId) ?? 999;
      const sb = sectionOrder.get(b.sectionId) ?? 999;
      if (sa !== sb) return sa - sb;
      return a.orderIndex - b.orderIndex;
    });
  }, [questions, test.sections]);

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (initialQuestionId) {
      const idx = orderedQuestions.findIndex((q) => q.questionId === initialQuestionId);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const [showAnswer, setShowAnswer] = useState(true);
  const [testSelectedByQ, setTestSelectedByQ] = useState<Record<string, OptionId | null>>({});
  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (currentIndex >= orderedQuestions.length && orderedQuestions.length > 0) {
      setCurrentIndex(orderedQuestions.length - 1);
    }
  }, [orderedQuestions.length, currentIndex]);

  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0 });
  }, [currentIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomImgUrl) setZoomImgUrl(null);
        else onClose();
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((i) => Math.min(orderedQuestions.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orderedQuestions.length, onClose, zoomImgUrl]);

  const currentQ = orderedQuestions[currentIndex];
  const activeSection = test.sections.find((s) => s.id === currentQ?.sectionId);

  const sectionMap = useMemo(() => {
    const map: Record<string, Array<{ q: TestQuestion; globalIdx: number }>> = {};
    test.sections.forEach((s) => {
      map[s.id] = [];
    });
    orderedQuestions.forEach((q, idx) => {
      if (!map[q.sectionId]) map[q.sectionId] = [];
      map[q.sectionId].push({ q, globalIdx: idx });
    });
    return map;
  }, [orderedQuestions, test.sections]);

  const useTwoColOptions = Boolean(
    currentQ &&
      currentQ.options.every(
        (o) =>
          !o.imageUrl?.trim() &&
          o.text.trim().length <= 55 &&
          !/\$\$|\\\[|\\\\\[|\\begin\{|\n/.test(o.text)
      )
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-2 sm:p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95vh] sm:max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-200 bg-white px-3.5 py-3 sm:px-5 sm:py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-700 shrink-0" />
              <h2 className="font-display text-base font-bold text-slate-900 truncate">
                Question Preview · {test.title}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {orderedQuestions.length} question{orderedQuestions.length === 1 ? '' : 's'} ·{' '}
              Duration: {test.durationMins} min · Marking: +{test.marksPerQuestion ?? 4} /{' '}
              {test.negativeMarking ? `-${test.negativeMarkValue}` : '0'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAnswer((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                showAnswer
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {showAnswer ? (
                <>
                  <Eye className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Answer &amp; Solution: Visible</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                  <span>Answer &amp; Solution: Hidden (Candidate View)</span>
                </>
              )}
            </button>

            {currentQ && onEditQuestion && (
              <button
                type="button"
                onClick={() => {
                  onEditQuestion(currentQ);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Question</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Close Preview (Esc)"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Section Switcher Strip */}
        {test.sections.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3.5 sm:px-5 py-2.5">
            {test.sections.map((sec) => {
              const items = sectionMap[sec.id] || [];
              const isActive = sec.id === currentQ?.sectionId;
              return (
                <button
                  key={sec.id}
                  type="button"
                  disabled={items.length === 0}
                  onClick={() => {
                    if (items.length > 0) setCurrentIndex(items[0].globalIdx);
                  }}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {sec.name} ({items.length})
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        {orderedQuestions.length === 0 ? (
          <div className="flex-1 p-10 text-center text-sm text-slate-500">
            No questions have been added to this test yet. Add or import questions in Question Studio to preview them here.
          </div>
        ) : (
          <div ref={scrollBodyRef} className="flex-1 overflow-y-auto p-3.5 sm:p-5">
            <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-12">
              {/* Main Question Card */}
              <div className="lg:col-span-8 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs font-mono text-slate-500">
                    <span>
                      Question {currentIndex + 1} of {orderedQuestions.length}
                      {activeSection ? ` · ${activeSection.name}` : ''}
                    </span>
                    <span>
                      +{currentQ.marks} Marks
                      {test.negativeMarking ? ` / -${test.negativeMarkValue} Negative` : ''}
                    </span>
                  </div>

                  <MathText
                    text={currentQ.questionText}
                    className="text-[15.5px] leading-[1.75] text-slate-900"
                  />

                  {(currentQ.questionImageUrl || currentQ.imageUrl) && (
                    <QuestionImage
                      src={currentQ.questionImageUrl || currentQ.imageUrl}
                      alt={`Question ${currentIndex + 1} diagram`}
                    />
                  )}

                  {/* Options A–D */}
                  <div
                    className={
                      useTwoColOptions ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'space-y-3'
                    }
                  >
                    {currentQ.options.map((opt) => {
                      const isCorrect = opt.id === currentQ.correctOptionId;
                      const isTestSelected = testSelectedByQ[currentQ.questionId] === opt.id;
                      const showGreen = showAnswer && isCorrect;
                      const showWrongPicked = showAnswer && isTestSelected && !isCorrect;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setTestSelectedByQ((prev) => ({
                              ...prev,
                              [currentQ.questionId]:
                                prev[currentQ.questionId] === opt.id ? null : opt.id,
                            }))
                          }
                          className={`w-full text-left flex items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors cursor-pointer ${
                            showGreen
                              ? 'border-emerald-400 bg-emerald-50/70 text-emerald-950'
                              : showWrongPicked
                              ? 'border-red-300 bg-red-50/60 text-red-900'
                              : isTestSelected
                              ? 'border-blue-500 bg-blue-50/60 text-slate-900'
                              : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50/70'
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-mono font-bold ${
                              showGreen
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : showWrongPicked
                                ? 'border-red-500 bg-red-500 text-white'
                                : isTestSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 text-slate-600'
                            }`}
                          >
                            {opt.id}
                          </span>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <MathText
                                text={opt.text}
                                inline
                                className="leading-relaxed"
                              />
                              {showGreen && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              )}
                            </div>
                            {opt.imageUrl && (
                              <QuestionImage
                                src={opt.imageUrl}
                                alt={`Option ${opt.id}`}
                                className="max-h-28"
                                allowZoom={false}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Answer Key & Step-by-Step Solution (when visible) */}
                  {showAnswer && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2.5 text-slate-700 leading-relaxed">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-emerald-800">
                          Correct Answer: Option {currentQ.correctOptionId}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Click any option above to test candidate selection state
                        </span>
                      </div>

                      {currentQ.shortExplanation && (
                        <div>
                          <span className="font-semibold text-slate-900">Short Explanation: </span>
                          <MathText text={currentQ.shortExplanation} inline />
                        </div>
                      )}

                      {(currentQ.solutionImageUrl || currentQ.solution?.imageUrl) && (
                        <div className="pt-2">
                          <div className="text-[11px] font-semibold text-slate-600 mb-1">Solution Diagram:</div>
                          <QuestionImage
                            src={currentQ.solutionImageUrl || currentQ.solution?.imageUrl}
                            alt="Solution diagram"
                          />
                        </div>
                      )}

                      {currentQ.stepByStepSolution?.length > 0 && (
                        <div className="border-t border-slate-200 pt-2.5">
                          <div className="font-semibold text-slate-900 mb-1">
                            Step-by-Step Solution:
                          </div>
                          <ol className="list-decimal list-inside space-y-1 text-slate-700">
                            {currentQ.stepByStepSolution.map((step, sIdx) => {
                              const cleanStep =
                                step
                                  .replace(/^(?:step\s*)?\d+[\.\):\s-]\s*/i, '')
                                  .replace(/^[-*•]\s*/, '')
                                  .trim() || step;
                              return (
                                <li key={sIdx}>
                                  <MathText text={cleanStep} inline />
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Prev / Next Navigation */}
                <div className="flex items-center justify-between gap-2.5">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 sm:px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    disabled={currentIndex >= orderedQuestions.length - 1}
                    onClick={() =>
                      setCurrentIndex((i) => Math.min(orderedQuestions.length - 1, i + 1))
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 sm:px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Right Question Palette Sidebar */}
              <aside className="lg:col-span-4 lg:sticky lg:top-0 lg:self-start">
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      Question Palette
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Jump to any question (Left / Right arrow keys supported)
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                    {test.sections.map((sec) => {
                      const items = sectionMap[sec.id] || [];
                      if (items.length === 0) return null;
                      return (
                        <div key={sec.id} className="space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            {sec.name} ({items.length})
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {items.map(({ q, globalIdx }) => {
                              const isCurrent = globalIdx === currentIndex;
                              return (
                                <button
                                  key={q.questionId}
                                  type="button"
                                  onClick={() => setCurrentIndex(globalIdx)}
                                  className={`h-9 rounded-lg border font-mono text-xs font-semibold transition-colors cursor-pointer ${
                                    isCurrent
                                      ? 'border-blue-700 bg-blue-700 text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                                  }`}
                                >
                                  {globalIdx + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>

      {/* Image Zoom Overlay */}
      {zoomImgUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-6"
          onClick={() => setZoomImgUrl(null)}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomImgUrl(null)}
              className="absolute -top-10 right-0 inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
            <img
              src={zoomImgUrl}
              alt="Zoomed question diagram"
              referrerPolicy="no-referrer"
              className="max-h-[85vh] rounded-lg bg-white p-2 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
