import { useEffect, useMemo, useState } from "react";

function clampNumber(value, min, max) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return min;
  }

  return Math.min(Math.max(numericValue, min), max);
}

function getStatusLabel(status) {
  if (!status) {
    return null;
  }

  return String(status)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim();
}

export default function ProgressBar({
  currentStep,
  totalSteps = 4,
  status,
  className = "",
}) {
  const safeTotalSteps = Math.max(Number(totalSteps) || 4, 1);
  const safeCurrentStep = clampNumber(currentStep, 0, safeTotalSteps);
  const percentage = useMemo(() => {
    return Math.round((safeCurrentStep / safeTotalSteps) * 100);
  }, [safeCurrentStep, safeTotalSteps]);

  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const statusLabel = getStatusLabel(status);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setAnimatedPercentage(percentage);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [percentage]);

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">
          Step {safeCurrentStep} of {safeTotalSteps}
        </p>

        <div className="flex items-center gap-2">
          {statusLabel && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              {statusLabel}
            </span>
          )}

          <span className="text-sm font-semibold text-slate-500">
            {percentage}%
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={`Student progress: step ${safeCurrentStep} of ${safeTotalSteps}`}
        aria-valuemin={0}
        aria-valuemax={safeTotalSteps}
        aria-valuenow={safeCurrentStep}
        className="h-3 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-400 motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out motion-reduce:transition-none"
          style={{ width: `${animatedPercentage}%` }}
        />
      </div>
    </div>
  );
}