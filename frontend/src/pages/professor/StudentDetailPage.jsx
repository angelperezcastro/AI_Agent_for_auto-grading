import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import {
  getProfessorEnrollmentDetail,
  overrideEvaluation,
} from "../../services/professorWeek5Api";

const DELIVERABLES = [
  {
    number: 1,
    name: "Research + Motivation Letter",
  },
  {
    number: 2,
    name: "User Requirements List",
  },
  {
    number: 3,
    name: "Target Group Questions",
  },
  {
    number: 4,
    name: "Updated Requirements List",
  },
];

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeEmailType(type) {
  const value = String(type || "");

  if (value === "professor_notification") {
    return "Professor notification";
  }

  if (value === "override_feedback") {
    return "Override feedback";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getEffectiveScore(evaluation) {
  if (!evaluation) return null;

  if (evaluation.is_overridden && evaluation.override_score !== null) {
    return evaluation.override_score;
  }

  return evaluation.ai_score;
}

function ScoreBadge({ evaluation }) {
  const score = getEffectiveScore(evaluation);

  if (score === null || score === undefined) {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
        Pending
      </span>
    );
  }

  let style = "border-red-200 bg-red-100 text-red-700";

  if (score >= 80) {
    style = "border-emerald-200 bg-emerald-100 text-emerald-700";
  } else if (score >= 50) {
    style = "border-amber-200 bg-amber-100 text-amber-700";
  }

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${style}`}>
      {score}/100
    </span>
  );
}

function EmailStatusItem({ label, sent }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
        sent
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <span className="mr-2">{sent ? "✓" : "—"}</span>
      {label}
    </div>
  );
}

function EmailHistory({ logs }) {
  const [isOpen, setIsOpen] = useState(false);
  const safeLogs = Array.isArray(logs) ? logs : [];
  const failedCount = safeLogs.filter((log) => log.error_message).length;

  return (
    <section className="rounded-2xl border border-slate-200">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            Email History
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {safeLogs.length} email event{safeLogs.length === 1 ? "" : "s"}
            {failedCount > 0 ? ` · ${failedCount} failed` : ""}
          </p>
        </div>

        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-5">
          {safeLogs.length === 0 ? (
            <EmptyState
              icon="✉️"
              title="No email logs yet"
              description="No confirmation, feedback or notification email has been recorded for this submission yet."
              compact
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Recipient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Gmail Account
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Sent At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {safeLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-4 text-sm font-bold text-slate-900">
                        {normalizeEmailType(log.email_type)}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {log.recipient_email}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {log.gmail_account_used || "—"}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(log.sent_at)}
                      </td>

                      <td className="px-4 py-4">
                        {log.error_message ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                            Failed: {log.error_message}
                          </div>
                        ) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            Sent
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CriteriaBreakdown({ criteria }) {
  const entries = Object.entries(criteria || {});

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No criteria breakdown available"
        description="The evaluation exists, but the AI did not return criterion-level scores for this deliverable."
        compact
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
              Criterion
            </th>
            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
              Score
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {entries.map(([criterion, value]) => (
            <tr key={criterion}>
              <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                {criterion}
              </td>
              <td className="px-4 py-3 text-sm font-black text-slate-900">
                {String(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverridePanel({ evaluation, onSaved }) {
  const [score, setScore] = useState(
    evaluation?.override_score ?? evaluation?.ai_score ?? ""
  );
  const [comment, setComment] = useState(evaluation?.override_comment || "");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave(event) {
    event.preventDefault();

    setLocalError("");
    setSuccess("");

    const numericScore = Number(score);

    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      setLocalError("Score must be a number between 0 and 100.");
      return;
    }

    if (!comment.trim() || comment.trim().length < 5) {
      setLocalError("Override comment is required.");
      return;
    }

    setSaving(true);

    try {
      await overrideEvaluation(evaluation.id, {
        override_score: numericScore,
        override_comment: comment.trim(),
      });

      setSuccess("Override saved. Override feedback email sent to student.");
      await onSaved();
    } catch (error) {
      setLocalError(error.message || "Could not save override.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
    >
      <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
        Override Score
      </h4>

      <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr_auto]">
        <input
          type="number"
          min="0"
          max="100"
          value={score}
          onChange={(event) => setScore(event.target.value)}
          placeholder="0-100"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-slate-900"
        />

        <input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Required professor comment"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-slate-900"
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Override"}
        </button>
      </div>

      {localError && (
        <p className="mt-3 text-sm font-semibold text-red-600">{localError}</p>
      )}

      {success && (
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          {success}
        </p>
      )}
    </form>
  );
}

function DeliverableCard({ deliverable, onRefresh }) {
  const meta = DELIVERABLES.find(
    (item) => item.number === deliverable.deliverable_number
  );
  const evaluation = deliverable.evaluation;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
            Deliverable {deliverable.deliverable_number}
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">
            {meta?.name || "Deliverable"}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Status: {deliverable.status}
          </p>
        </div>

        <ScoreBadge evaluation={evaluation} />
      </div>

      {!deliverable.submitted ? (
        <div className="mt-6">
          <EmptyState
            icon="📝"
            title="No submission yet"
            description="The student has not submitted this deliverable. Once submitted, the text, AI feedback and email history will appear here."
            compact
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Submitted at
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {formatDate(deliverable.submitted_at)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Deadline
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {formatDate(deliverable.deadline_at)}
              </p>
            </div>
          </div>

          <section>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
              Submission Text
            </h3>
            <div className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
              {deliverable.content}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
              Email Delivery
            </h3>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <EmailStatusItem
                label="Confirmation sent"
                sent={deliverable.confirmation_email_sent}
              />
              <EmailStatusItem
                label="Feedback sent"
                sent={deliverable.feedback_email_sent}
              />
              <EmailStatusItem
                label="Override feedback sent"
                sent={deliverable.override_feedback_email_sent}
              />
            </div>

            {deliverable.email_failed && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                Email issue detected:{" "}
                {deliverable.email_error || "Check email logs."}
              </div>
            )}
          </section>

          <EmailHistory logs={deliverable.email_logs} />

          {evaluation ? (
            <section className="space-y-5">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                  AI Evaluation
                </h3>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-5">
                    <p className="text-sm font-semibold text-slate-500">
                      AI Score
                    </p>
                    <p className="mt-1 text-3xl font-black text-slate-900">
                      {evaluation.ai_score}/100
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-5">
                    <p className="text-sm font-semibold text-slate-500">
                      Effective Score
                    </p>
                    <p className="mt-1 text-3xl font-black text-slate-900">
                      {getEffectiveScore(evaluation)}/100
                    </p>
                  </div>
                </div>

                {evaluation.is_overridden && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                    <p className="font-black">Professor override applied</p>
                    <p className="mt-1">
                      AI Score: {evaluation.ai_score}/100 → Professor Score:{" "}
                      {evaluation.override_score}/100
                    </p>
                    <p className="mt-2">{evaluation.override_comment}</p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                  Criteria Breakdown
                </h3>
                <div className="mt-3">
                  <CriteriaBreakdown criteria={evaluation.criteria_breakdown} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                  Feedback
                </h3>
                <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                  {evaluation.feedback}
                </div>
              </div>

              <OverridePanel evaluation={evaluation} onSaved={onRefresh} />
            </section>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
              Evaluation is still pending.
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function StudentDetailPage() {
  const { enrollmentId } = useParams();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  async function loadDetail() {
    setPageError("");

    try {
      const data = await getProfessorEnrollmentDetail(enrollmentId);
      setDetail(data);
    } catch (error) {
      setPageError(error.message || "Could not load student detail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setPageError("");

      try {
        const data = await getProfessorEnrollmentDetail(enrollmentId);

        if (active) {
          setDetail(data);
        }
      } catch (error) {
        if (active) {
          setPageError(error.message || "Could not load student detail.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [enrollmentId]);

  const progressLabel = useMemo(() => {
    if (!detail) return "0/4";

    const evaluated = detail.deliverables.filter(
      (item) => item.evaluation
    ).length;

    return `${evaluated}/4`;
  }, [detail]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Loading student detail...</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
        <p className="font-bold">{pageError}</p>
        <Link
          to="/professor/dashboard"
          className="mt-4 inline-flex rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const safeDeliverables = Array.isArray(detail.deliverables)
    ? detail.deliverables
    : [];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <Link
          to="/professor/dashboard"
          className="text-sm font-semibold text-slate-300 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-6 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Student Detail
            </p>
            <h1 className="mt-2 text-3xl font-black">{detail.student_name}</h1>
            <p className="mt-2 text-slate-300">{detail.student_email}</p>
            <p className="mt-4 text-slate-300">
              {detail.subject_name} · {detail.project_name}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Topic: {detail.project_topic}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 px-6 py-5">
            <p className="text-sm text-slate-300">Progress</p>
            <p className="mt-1 text-3xl font-black">{progressLabel}</p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {safeDeliverables.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No submissions available"
            description="This enrollment does not have any deliverable records yet. Once the student submits work, it will appear here."
            compact={false}
          />
        ) : (
          safeDeliverables.map((deliverable) => (
            <DeliverableCard
              key={deliverable.deliverable_number}
              deliverable={deliverable}
              onRefresh={loadDetail}
            />
          ))
        )}
      </section>
    </div>
  );
}