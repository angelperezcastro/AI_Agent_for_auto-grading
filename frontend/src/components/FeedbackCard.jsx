import { useEffect, useMemo, useState } from "react";
import {
  getCriteriaForDeliverable,
  getCriterionMaxPoints,
  inferDeliverableNumberFromCriteria,
  normalizeCriterionName,
} from "../data/deliverables";

const SCORE_RING_RADIUS = 44;
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS;

function clampNumber(value, min, max) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.max(min, Math.min(max, numericValue));
}

function getCriteriaEntries(evaluation) {
  const criteria =
    evaluation?.criteria_breakdown ||
    evaluation?.criteria ||
    evaluation?.criteria_scores ||
    {};

  if (!criteria || typeof criteria !== "object") {
    return [];
  }

  return Object.entries(criteria).map(([name, value]) => ({
    name,
    value: Number(value),
  }));
}

function getExplicitDeliverableNumber(evaluation) {
  const possibleValues = [
    evaluation?.deliverable_number,
    evaluation?.submission_deliverable_number,
    evaluation?.submission?.deliverable_number,
    evaluation?.submission?.deliverableNumber,
  ];

  for (const value of possibleValues) {
    const numericValue = Number(value);

    if (Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 4) {
      return numericValue;
    }
  }

  return null;
}

function getAiScore(evaluation) {
  if (evaluation?.ai_score !== null && evaluation?.ai_score !== undefined) {
    return Number(evaluation.ai_score);
  }

  if (evaluation?.score !== null && evaluation?.score !== undefined) {
    return Number(evaluation.score);
  }

  return null;
}

function getOverrideScore(evaluation) {
  if (
    evaluation?.override_score !== null &&
    evaluation?.override_score !== undefined
  ) {
    return Number(evaluation.override_score);
  }

  return null;
}

function getOverrideComment(evaluation) {
  return (
    evaluation?.override_comment ||
    evaluation?.manual_comment ||
    evaluation?.professor_comment ||
    ""
  );
}

function getFinalScore(evaluation) {
  const overrideScore = getOverrideScore(evaluation);

  if (overrideScore !== null && overrideScore !== undefined) {
    return overrideScore;
  }

  return getAiScore(evaluation);
}

function getScoreTone(score) {
  if (score === null || score === undefined) {
    return {
      ring: "text-slate-400",
      badge: "bg-slate-100 text-slate-600 ring-slate-200",
      bar: "bg-slate-400",
      panel: "border-slate-200 bg-slate-50",
      label: "Not graded",
    };
  }

  if (score >= 80) {
    return {
      ring: "text-emerald-500",
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      bar: "bg-emerald-500",
      panel: "border-emerald-200 bg-emerald-50",
      label: "Strong result",
    };
  }

  if (score >= 60) {
    return {
      ring: "text-amber-500",
      badge: "bg-amber-50 text-amber-700 ring-amber-200",
      bar: "bg-amber-500",
      panel: "border-amber-200 bg-amber-50",
      label: "Needs refinement",
    };
  }

  return {
    ring: "text-red-500",
    badge: "bg-red-50 text-red-700 ring-red-200",
    bar: "bg-red-500",
    panel: "border-red-200 bg-red-50",
    label: "Needs major improvement",
  };
}

function resolveCriterionMaxPoints(criterionName, deliverableNumber, rawValue) {
  /*
    Robust max-point resolution:
    1. First, try an exact rubric match inside the inferred/explicit deliverable.
    2. Then, use the shared getCriterionMaxPoints helper.
    3. If the backend returns an unknown criterion, fall back to max(raw score, 100)
       so the UI never breaks and the progress bar remains bounded.
  */

  if (deliverableNumber !== null && deliverableNumber !== undefined) {
    const deliverableCriteria = getCriteriaForDeliverable(deliverableNumber);
    const normalizedCriterionName = normalizeCriterionName(criterionName);

    const exactCriterion = deliverableCriteria.find(
      (criterion) =>
        normalizeCriterionName(criterion.name) === normalizedCriterionName
    );

    if (
      exactCriterion?.maxPoints !== null &&
      exactCriterion?.maxPoints !== undefined
    ) {
      return {
        maxPoints: Number(exactCriterion.maxPoints),
        hasKnownMaxPoints: true,
      };
    }
  }

  const helperMaxPoints = getCriterionMaxPoints(
    criterionName,
    deliverableNumber
  );

  if (
    Number.isFinite(Number(helperMaxPoints)) &&
    Number(helperMaxPoints) > 0 &&
    Number(helperMaxPoints) !== 100
  ) {
    return {
      maxPoints: Number(helperMaxPoints),
      hasKnownMaxPoints: true,
    };
  }

  const safeRawValue = Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0;

  return {
    maxPoints: Math.max(100, safeRawValue, 1),
    hasKnownMaxPoints: false,
  };
}

function buildCriteriaRows(criteriaEntries, deliverableNumber) {
  return criteriaEntries.map((criterion) => {
    const rawValue = Number.isFinite(criterion.value) ? criterion.value : 0;
    const { maxPoints, hasKnownMaxPoints } = resolveCriterionMaxPoints(
      criterion.name,
      deliverableNumber,
      rawValue
    );

    const safeScore = clampNumber(rawValue, 0, maxPoints);
    const progressPercentage = clampNumber((safeScore / maxPoints) * 100, 0, 100);

    return {
      ...criterion,
      value: rawValue,
      safeScore,
      maxPoints,
      progressPercentage,
      hasKnownMaxPoints,
    };
  });
}

function ScoreRing({ score, isOverridden }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  const safeScore =
    score !== null && score !== undefined ? clampNumber(score, 0, 100) : null;

  const scoreForRing = safeScore ?? 0;
  const strokeDashoffset =
    SCORE_RING_CIRCUMFERENCE -
    (animatedScore / 100) * SCORE_RING_CIRCUMFERENCE;

  const tone = getScoreTone(safeScore);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setAnimatedScore(scoreForRing);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [scoreForRing]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative h-36 w-36 shrink-0"
        aria-label={
          safeScore !== null
            ? `Final score ${safeScore} out of 100`
            : "Score not available"
        }
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 120 120"
          className="h-full w-full -rotate-90"
        >
          <circle
            cx="60"
            cy="60"
            r={SCORE_RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-slate-100"
          />

          <circle
            cx="60"
            cy="60"
            r={SCORE_RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={SCORE_RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            className={`motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out motion-reduce:transition-none ${tone.ring}`}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-3xl font-black tracking-tight text-slate-900">
            {safeScore !== null ? safeScore : "—"}
            <span className="text-base font-black text-slate-400">/100</span>
          </p>

          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            {isOverridden ? "Final score" : "AI score"}
          </p>
        </div>
      </div>

      <span
        className={`mt-3 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ${tone.badge}`}
      >
        {tone.label}
      </span>
    </div>
  );
}

function CriteriaProgressBars({ criteriaRows, mounted, scoreTone }) {
  if (criteriaRows.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Criteria breakdown
          </h4>

          <p className="mt-1 text-sm text-slate-500">
            Each bar shows the score obtained for that criterion.
          </p>
        </div>

        <span className="text-xs font-semibold text-slate-400">
          {criteriaRows.length} criteria evaluated
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {criteriaRows.map((criterion, index) => (
          <article
            key={`${criterion.name}-${index}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h5 className="break-words text-sm font-black text-slate-900">
                  {criterion.name}
                </h5>

                {!criterion.hasKnownMaxPoints && (
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Rubric maximum not detected. Progress is displayed against a
                    safe 100-point scale.
                  </p>
                )}
              </div>

              <span
                className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${scoreTone.badge}`}
              >
                {criterion.hasKnownMaxPoints
                  ? `${criterion.safeScore}/${criterion.maxPoints}`
                  : `${criterion.safeScore}`}
              </span>
            </div>

            <div className="mt-4">
              <div
                className="h-3 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label={`${criterion.name}: ${criterion.safeScore} out of ${criterion.maxPoints}`}
                aria-valuemin={0}
                aria-valuemax={criterion.maxPoints}
                aria-valuenow={criterion.safeScore}
              >
                <div
                  className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out motion-reduce:transition-none ${scoreTone.bar}`}
                  style={{
                    width: mounted ? `${criterion.progressPercentage}%` : "0%",
                    transitionDelay: `${Math.min(index * 80, 320)}ms`,
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-400">
                  0
                </span>

                <span className="text-xs font-black text-slate-500">
                  {Math.round(criterion.progressPercentage)}%
                </span>

                <span className="text-xs font-semibold text-slate-400">
                  {criterion.maxPoints}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackCard({ evaluation }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const criteriaEntries = useMemo(
    () => getCriteriaEntries(evaluation),
    [evaluation]
  );

  if (!evaluation) {
    return null;
  }

  const aiScore = getAiScore(evaluation);
  const overrideScore = getOverrideScore(evaluation);
  const finalScore = getFinalScore(evaluation);
  const isOverridden =
    evaluation.is_overridden ||
    (overrideScore !== null && overrideScore !== undefined);

  const overrideComment = getOverrideComment(evaluation);
  const scoreTone = getScoreTone(finalScore ?? aiScore);

  const deliverableNumber =
    getExplicitDeliverableNumber(evaluation) ||
    inferDeliverableNumberFromCriteria(criteriaEntries);

  const criteriaRows = buildCriteriaRows(criteriaEntries, deliverableNumber);

  return (
    <section
      className={[
        "mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition md:p-6",
        mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        "motion-safe:duration-500 motion-safe:ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
      ].join(" ")}
      aria-label="AI evaluation feedback"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_180px] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">
            AI evaluation
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-900">
            In-platform feedback
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            This feedback remains available in the platform so you can review it
            while continuing your project. Email is used as a notification layer.
          </p>

          {isOverridden && (
            <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm font-black text-indigo-950">
                Score updated by your professor
              </p>

              <p className="mt-2 text-sm leading-6 text-indigo-800">
                AI Score:{" "}
                <span className="font-black">{aiScore ?? "—"}/100</span>
                <span aria-hidden="true"> → </span>
                Professor Score:{" "}
                <span className="font-black">{finalScore ?? "—"}/100</span>
              </p>

              {overrideComment && (
                <div className="mt-3 rounded-xl border border-indigo-200 bg-white/70 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide text-indigo-500">
                    Professor comment
                  </p>

                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-indigo-900">
                    {overrideComment}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`rounded-3xl border p-4 ${scoreTone.panel}`}>
          <ScoreRing score={finalScore} isOverridden={isOverridden} />
        </div>
      </div>

      <CriteriaProgressBars
        criteriaRows={criteriaRows}
        mounted={mounted}
        scoreTone={scoreTone}
      />

      {evaluation.feedback && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Original AI feedback
          </h4>

          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
            {evaluation.feedback}
          </p>
        </div>
      )}
    </section>
  );
}