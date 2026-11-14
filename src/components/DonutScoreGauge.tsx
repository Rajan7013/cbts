interface DonutScoreGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function DonutScoreGauge({
  percentage,
  size = 76,
  strokeWidth = 7,
  className = '',
}: DonutScoreGaugeProps) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(0, Math.round(percentage)), 100);
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
        {/* Background track circle */}
        <circle
          cx="36"
          cy="36"
          r={radius}
          className="stroke-slate-200"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Active progress arc */}
        <circle
          cx="36"
          cy="36"
          r={radius}
          className="stroke-blue-600 transition-all duration-700 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {/* Centered Percentage Label matching Images 2, 3, 4, 5 */}
      <span className="absolute font-display font-bold text-xs sm:text-sm text-slate-800">
        {clampedPct}%
      </span>
    </div>
  );
}
