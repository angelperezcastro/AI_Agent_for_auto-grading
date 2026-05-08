import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { DELIVERABLES } from "../data/deliverables";
import { api, getApiErrorMessage } from "../services/api";
import { formatDateTime, getDeadlineCountdown } from "../utils/dates";

function normalizeSubmissionList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.submissions)) {
    return data.submissions;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

function getEvaluation(submission) {
  return (
    submission?.evaluation ||
    submission?.evaluation_result ||
    submission?.latest_evaluation ||
    null
  );
}

function getScore(evaluation) {
  if (!evaluation) {
    return null;
  }

  if (
    evaluation.is_overridden &&
    evaluation.override_score !== null &&
    evaluation.override_score !== undefined
  ) {
    return evaluation.override_score;
  }

  if (
    evaluation.override_score !== null &&
    evaluation.override_score !== undefined
  ) {
    return evaluation.override_score;
  }

  if (evaluation.ai_score !== null && evaluation.ai_score !== undefined) {
    return evaluation.ai_score;
  }

  if (evaluation.score !== null && evaluation.score !== undefined) {
    return evaluation.score;
  }

  return null;
}

function getScoreClass(score) {
  if (score === null || score === undefined) {
    return "bg-slate-100 text-slate-600";
  }

  if (score >= 80) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (score >= 60) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-red-50 text-red-700 ring-red-200";
}

function getStatusClass(status) {
  const classes = {
    locked: "bg-slate-100 text-slate-500 border-slate-200",
    open: "bg-cyan-50 text-cyan-700 border-cyan-200",
    submitted: "bg-amber-50 text-amber-700 border-amber-200",
    graded: "bg-emerald-50 text-emerald-700 border-emerald-200",
    overdue: "bg-red-50 text-red-700 border-red-200",
  };

  return classes[status] || classes.locked;
}

function getTimelineStatus(deliverableNumber, submissionsByNumber) {
  const submission = submissionsByNumber[deliverableNumber];
  const previousSubmission = submissionsByNumber[deliverableNumber - 1];

  if (submission?.status === "overdue") {
    return "overdue";
  }

  if (submission && getEvaluation(submission)) {
    return "graded";
  }

  if (submission) {
    return "submitted";
  }

  if (deliverableNumber === 1) {
    return "open";
  }

  if (previousSubmission && getEvaluation(previousSubmission)) {
    return "open";
  }

  return "locked";
}

function getStepLineClass(status) {
  if (status === "graded") {
    return "bg-emerald-300";
  }

  if (status === "submitted") {
    return "bg-amber-300";
  }

  if (status === "open") {
    return "bg-cyan-300";
  }

  if (status === "overdue") {
    return "bg-red-300";
  }

  return "bg-slate-200";
}

function DeliverableStep({
  deliverable,
  status,
  submission,
  isLast,
  onWrite,
}) {
  const evaluation = getEvaluation(submission);
  const score = getScore(evaluation);
  const countdown = getDeadlineCountdown(submission?.deadline_at);
  const submittedAt = formatDateTime(submission?.submitted_at);
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const isLocked = status === "locked";
  const isOpen = status === "open";
  const isSubmitted = status === "submitted";
  const isGraded = status === "graded";
  const isOverdue = status === "overdue";

  let stepBorderClass = "border-slate-300 text-slate-400";

  if (isGraded) {
    stepBorderClass = "border-emerald-400 text-emerald-700";
  } else if (isOpen) {
    stepBorderClass = "border-cyan-400 text-cyan-700";
  } else if (isSubmitted) {
    stepBorderClass = "border-amber-400 text-amber-700";
  } else if (isOverdue) {
    stepBorderClass = "border-red-400 text-red-700";
  }

  return (
    <div className="relative flex gap-5">
      <div className="relative flex flex-col items-center">
        <div
          className={`z-10 flex h-12 w-12 items-center justify-center rounded-2xl border-2 bg-white text-sm font-bold ${stepBorderClass}`}
        >
          {isLocked ? "🔒" : deliverable.number}
        </div>

        {!isLast && (
          <div
            className={`absolute top-12 h-full w-1 rounded-full ${getStepLineClass(
              status
            )}`}
          />
        )}
      </div>

      <article className="mb-6 flex-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                Deliverable {deliverable.number} — {deliverable.name}
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${getStatusClass(
                  status
                )}`}
              >
                {statusLabel}
              </span>
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {deliverable.description}
            </p>
          </div>

          {isGraded && (
            <div
              className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-xl font-black ring-1 ${getScoreClass(
                score
              )}`}
            >
              {score ?? "—"}
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Submitted at
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {submission ? submittedAt : "Not submitted yet"}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Deadline
            </p>
            <p
              className={`mt-1 text-sm font-medium ${
                countdown.isOverdue ? "text-red-700" : "text-slate-700"
              }`}
            >
              {countdown.label}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Score
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {isGraded ? `${score ?? "—"}/100` : "Pending evaluation"}
            </p>
          </div>
        </div>

        {isLocked && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            🔒 {deliverable.lockedReason}
          </div>
        )}

        {isOpen && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-900">
                This deliverable is open.
              </p>
              <p className="mt-1 text-sm text-cyan-700">
                You can now write and submit this deliverable.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onWrite(deliverable.number)}
              className="rounded-2xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-800"
            >
              Write & Submit
            </button>
          </div>
        )}

        {isSubmitted && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⏳ Submitted. The AI evaluation is pending or being processed.
          </div>
        )}

        {isGraded && evaluation?.feedback && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-900">
              AI feedback available
            </p>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-emerald-800">
              {evaluation.feedback}
            </p>
          </div>
        )}

        {isOverdue && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            ⚠️ This deliverable is marked as overdue.
          </div>
        )}
      </article>
    </div>
  );
}

export default function WorkspacePage() {
  const { enrollmentId } = useParams();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submissionsByNumber = useMemo(() => {
    return submissions.reduce((acc, submission) => {
      acc[submission.deliverable_number] = submission;
      return acc;
    }, {});
  }, [submissions]);

  const currentOpenDeliverable = useMemo(() => {
    for (const deliverable of DELIVERABLES) {
      const status = getTimelineStatus(deliverable.number, submissionsByNumber);

      if (status === "open") {
        return deliverable.number;
      }
    }

    return null;
  }, [submissionsByNumber]);

  const progress = useMemo(() => {
    const gradedCount = DELIVERABLES.filter((deliverable) => {
      const status = getTimelineStatus(deliverable.number, submissionsByNumber);
      return status === "graded";
    }).length;

    return {
      gradedCount,
      percentage: Math.round((gradedCount / DELIVERABLES.length) * 100),
    };
  }, [submissionsByNumber]);

  async function refreshWorkspace() {
    setRefreshing(true);

    try {
      const response = await api.get(
        `/enrollments/${enrollmentId}/submissions`
      );
      const normalizedSubmissions = normalizeSubmissionList(response.data);

      setSubmissions(normalizedSubmissions);
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadWorkspace() {
      try {
        const response = await api.get(
          `/enrollments/${enrollmentId}/submissions`
        );
        const normalizedSubmissions = normalizeSubmissionList(response.data);

        if (!ignore) {
          setSubmissions(normalizedSubmissions);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(getApiErrorMessage(err));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      ignore = true;
    };
  }, [enrollmentId]);

  function handleWrite(deliverableNumber) {
    setNotice(
      `Deliverable ${deliverableNumber} is ready. The full submission form will be implemented in the next Week 4 block.`
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/dashboard"
            className="text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            ← Back to dashboard
          </Link>

          <button
            type="button"
            onClick={refreshWorkspace}
            disabled={refreshing}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <section className="mb-8 rounded-3xl bg-slate-900 p-8 text-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-200">
                Enrollment #{enrollmentId}
              </p>
              <h1 className="mt-2 text-3xl font-bold">Student workspace</h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Complete the four deliverables in strict order. The next step is
                unlocked only after the previous one has been evaluated.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-5">
              <p className="text-sm text-slate-300">Graded progress</p>
              <p className="mt-1 text-3xl font-black">
                {progress.gradedCount}/4
              </p>
              <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {notice && (
          <div className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-sm font-medium text-cyan-800">
            {notice}
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Loading workspace...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <section className="rounded-3xl border border-slate-200 bg-slate-100/60 p-5">
            <div className="mb-5 flex flex-col gap-2 px-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Deliverable timeline
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current open deliverable:{" "}
                  <span className="font-semibold text-slate-800">
                    {currentOpenDeliverable
                      ? `Deliverable ${currentOpenDeliverable}`
                      : "None"}
                  </span>
                </p>
              </div>

              <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600">
                Sequential locking enabled
              </p>
            </div>

            <div>
              {DELIVERABLES.map((deliverable, index) => {
                const submission = submissionsByNumber[deliverable.number];
                const status = getTimelineStatus(
                  deliverable.number,
                  submissionsByNumber
                );

                return (
                  <DeliverableStep
                    key={deliverable.number}
                    deliverable={deliverable}
                    status={status}
                    submission={submission}
                    isLast={index === DELIVERABLES.length - 1}
                    onWrite={handleWrite}
                  />
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}