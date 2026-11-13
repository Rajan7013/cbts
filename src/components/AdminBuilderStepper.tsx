import { ArrowLeft, Sliders, FileQuestion } from 'lucide-react';

interface AdminBuilderStepperProps {
  activeStep: 1 | 2;
  testTitle?: string;
  canSwitchToStep2: boolean;
  onBackToDashboard: () => void;
  onSelectStep: (step: 1 | 2) => void;
}

export function AdminBuilderStepper({
  activeStep,
  testTitle,
  canSwitchToStep2,
  onBackToDashboard,
  onSelectStep,
}: AdminBuilderStepperProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-xs">
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Tests</span>
        </button>

        <div className="min-w-0">
          <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
            {testTitle ? `Edit: ${testTitle}` : 'Create a new test'}
          </h2>
          <p className="text-xs text-slate-500 truncate hidden sm:block">
            Set up test details, schedule, marking, sections, and proctoring rules.
          </p>
        </div>
      </div>

      <nav
        aria-label="Test creation steps"
        className="flex items-center gap-2 overflow-x-auto"
      >
        <button
          type="button"
          onClick={() => onSelectStep(1)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeStep === 1
              ? 'border border-blue-200 bg-blue-50 text-blue-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border border-transparent'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>1. Test Details &amp; Rules</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (canSwitchToStep2 || activeStep === 1) {
              onSelectStep(2);
            }
          }}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeStep === 2
              ? 'border border-blue-200 bg-blue-50 text-blue-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border border-transparent'
          }`}
        >
          <FileQuestion className="h-3.5 w-3.5" />
          <span>2. Question Builder &amp; AI</span>
        </button>
      </nav>
    </div>
  );
}
