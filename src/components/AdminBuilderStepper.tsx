import { ArrowLeft, Settings2, FileQuestion } from 'lucide-react';

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 rounded-xl border border-slate-200 bg-white px-3.5 sm:px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Admin Studio</span>
        </button>
        {testTitle && (
          <span className="text-xs text-slate-500 truncate">
            {testTitle}
          </span>
        )}
      </div>

      <nav
        aria-label="Test creation steps"
        className="w-full sm:w-auto flex items-center gap-1.5 overflow-x-auto rounded-lg bg-slate-100 p-1"
      >
        <button
          type="button"
          onClick={() => onSelectStep(1)}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-md px-3 sm:px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeStep === 1
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span>1. Test Details &amp; Rules</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (canSwitchToStep2 || activeStep === 1) {
              onSelectStep(2);
            }
          }}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-md px-3 sm:px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeStep === 2
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileQuestion className="h-3.5 w-3.5" />
          <span>2. Question Builder &amp; AI</span>
        </button>
      </nav>
    </div>
  );
}
