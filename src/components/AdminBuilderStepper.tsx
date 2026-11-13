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
  testTitle: _testTitle,
  canSwitchToStep2,
  onBackToDashboard,
  onSelectStep,
}: AdminBuilderStepperProps) {
  return (
    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-h-[44px]">
      {/* Left: Back to Tests button */}
      <button
        type="button"
        onClick={onBackToDashboard}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Tests</span>
      </button>

      {/* Center: Centered Step Navigation Pills */}
      <nav
        aria-label="Test creation steps"
        className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-1 rounded-xl bg-slate-100/90 p-1 border border-slate-200/70 shadow-xs"
      >
        <button
          type="button"
          onClick={() => onSelectStep(1)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeStep === 1
              ? 'bg-white text-blue-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
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
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeStep === 2
              ? 'bg-white text-blue-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileQuestion className="h-3.5 w-3.5" />
          <span>2. Question Builder &amp; AI</span>
        </button>
      </nav>

      {/* Right spacer to ensure exact center alignment */}
      <div className="hidden sm:block w-[120px] shrink-0" />
    </div>
  );
}
