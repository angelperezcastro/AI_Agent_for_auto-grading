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

function getScoreColor(score) {
  if (score >= 80) {
    return {
      wrapper: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      bar: "bg-emerald-500",
    };
  }

  if (score >= 60) {
    return {
      wrapper: "bg-amber-50 text-amber-700 ring-amber-200",
      bar: "bg-amber-500",
    };
  }

  return {
    wrapper: "bg-red-50 text-red-700 ring-red-200",
    bar: "bg-red-500",
  };
}

function getAiScore(evaluation) {
  if (evaluation?.ai_score !== null && evaluation?.ai_score !== undefined) {
    return evaluation.ai_score;
  }

  if (evaluation?.score !== null && evaluation?.score !== undefined) {
    return evaluation.score;
  }

  return null;
}

function getFinalScore(evaluation) {
  if (
    evaluation?.is_overridden &&
    evaluation?.override_score !== null &&
    evaluation?.override_score !== undefined
  ) {
    return evaluation.override_score;
  }

  if (
    evaluation?.override_score !== null &&
    evaluation?.override_score !== undefined
  ) {
    return evaluation.override_score;
  }

  return getAiScore(evaluation);
}

export default function FeedbackCard({ evaluation }) {
  if (!evaluation) {
    return null;
  }

  const aiScore = getAiScore(evaluation);
  const finalScore = getFinalScore(evaluation);
  const isOverridden =
    evaluation.is_overridden ||
    (evaluation.override_score !== null &&
      evaluation.override_score !== undefined);

  const scoreColors = getScoreColor(finalScore ?? aiScore ?? 0);
  const criteriaEntries = getCriteriaEntries(evaluation);

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">
            AI evaluation
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-900">
            In-platform feedback
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            This feedback was also sent to your email. The platform keeps it
            available here so you can review it while continuing your project.
          </p>
        </div>

        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-2xl font-black ring-1 ${scoreColors.wrapper}`}
        >
          {finalScore ?? "—"}
        </div>
      </div>

      {isOverridden && (
        <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-bold text-indigo-900">
            Score updated by your professor
          </p>

          <p className="mt-1 text-sm text-indigo-800">
            AI Score:{" "}
            <span className="font-black">{aiScore ?? "—"}</span>
            {" → "}
            Professor Score:{" "}
            <span className="font-black">{finalScore ?? "—"}</span>
          </p>

          {evaluation.override_comment && (
            <p className="mt-3 text-sm leading-6 text-indigo-800">
              {evaluation.override_comment}
            </p>
          )}
        </div>
      )}

      {criteriaEntries.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Criteria breakdown
          </h4>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full border-collapse bg-white text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Criterion</th>
                  <th className="w-32 px-4 py-3 font-bold">Score</th>
                  <th className="w-48 px-4 py-3 font-bold">Progress</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {criteriaEntries.map((criterion) => {
                  const safeValue = Number.isFinite(criterion.value)
                    ? Math.max(0, Math.min(100, criterion.value))
                    : 0;

                  return (
                    <tr key={criterion.name}>
                      <td className="px-4 py-4 font-medium text-slate-800">
                        {criterion.name}
                      </td>

                      <td className="px-4 py-4 font-bold text-slate-700">
                        {criterion.value}
                      </td>

                      <td className="px-4 py-4">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${scoreColors.bar}`}
                            style={{ width: `${safeValue}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {evaluation.feedback && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Full feedback
          </h4>

          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
            {evaluation.feedback}
          </p>
        </div>
      )}
    </section>
  );
}