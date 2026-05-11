import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import FeedbackCard from "../components/FeedbackCard";
import Navbar from "../components/Navbar";
import SubmissionForm from "../components/SubmissionForm";
import DeadlineBadge from "../components/ui/DeadlineBadge";
import ProgressBar from "../components/ui/ProgressBar";
import { DELIVERABLES } from "../data/deliverables";
import { api, getApiErrorMessage } from "../services/api";
import { formatDateTime } from "../utils/dates";
import { SUBMISSION_EMAIL_FAILED_MESSAGE } from "../utils/emailUxMessages";

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
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }

  if (score >= 80) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (score >= 60) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-red-50 text-red-700 ring-red-200";
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

function getTimelineStatusMeta(status) {
  const meta = {
    locked: {
      label: "Locked",
      shortLabel: "Locked",
      icon: "🔒",
      badgeClass: "border-slate-200 bg-slate-100 text-slate-500",
      nodeClass: "border-slate-300 bg-white text-slate-400",
      lineClass: "bg-slate-200",
      cardClass: "border-slate-200 bg-white/75 opacity-75",
    },
    open: {
      label: "Open",
      shortLabel: "Ready",
      icon: null,
      badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-700",
      nodeClass:
        "border-cyan-400 bg-cyan-50 text-cyan-700 shadow-lg shadow-cyan-100 motion-safe:animate-pulse motion-reduce:animate-none",
      lineClass: "bg-gradient-to-b from-cyan-300 to-slate-200",
      cardClass:
        "border-cyan-300 bg-white ring-4 ring-cyan-100/70 shadow-md shadow-cyan-100",
    },
    submitted: {
      label: "AI evaluating",
      shortLabel: "Pending",
      icon: "⏳",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      nodeClass: "border-amber-400 bg-amber-50 text-amber-700",
      lineClass: "bg-gradient-to-b from-amber-300 to-slate-200",
      cardClass: "border-amber-200 bg-white",
    },
    graded: {
      label: "Evaluated",
      shortLabel: "Done",
      icon: "✓",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      nodeClass: "border-emerald-400 bg-emerald-50 text-emerald-700",
      lineClass: "bg-emerald-300",
      cardClass: "border-emerald-200 bg-white",
    },
    overdue: {
      label: "Overdue",
      shortLabel: "Overdue",
      icon: "!",
      badgeClass: "border-red-200 bg-red-50 text-red-700",
      nodeClass: "border-red-400 bg-red-50 text-red-700",
      lineClass: "bg-gradient-to-b from-red-300 to-slate-200",
      cardClass: "border-red-200 bg-white ring-4 ring-red-50",
    },
  };

  return meta[status] || meta.locked;
}

function getStepDelayStyle(index) {
  return {
    "--workspace-step-delay": `${Math.min(index * 90, 360)}ms`,
  };
}

function hasEmailDeliveryFailure(submissionResponse) {
  return (
    submissionResponse?.email_sent === false ||
    Boolean(submissionResponse?.email_error)
  );
}

function TimelineNode({ deliverable, status, isLast }) {
  const statusMeta = getTimelineStatusMeta(status);
  const isLocked = status === "locked";
  const isGraded = status === "graded";

  return (
    <div className="relative flex flex-col items-center">
      <div
        aria-label={`Deliverable ${deliverable.number}: ${statusMeta.label}`}
        className={`z-10 flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-sm font-black transition md:h-14 md:w-14 ${statusMeta.nodeClass}`}
      >
        {isLocked && <span aria-hidden="true">🔒</span>}

        {!isLocked && isGraded && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
        )}

        {!isLocked && !isGraded && statusMeta.icon && (
          <span aria-hidden="true">{statusMeta.icon}</span>
        )}

        {!isLocked && !isGraded && !statusMeta.icon && deliverable.number}
      </div>

      {!isLast && (
        <div
          aria-hidden="true"
          className={`absolute bottom-[-1.5rem] top-12 w-1 rounded-full md:top-14 ${statusMeta.lineClass}`}
        />
      )}
    </div>
  );
}

function TimelineInfoCard({ title, children }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <div className="mt-2">{children}</div>
    </div>
  );
}

function DeliverableStep({
  deliverable,
  status,
  submission,
  isLast,
  index,
  onWrite,
}) {
  const evaluation = getEvaluation(submission);
  const score = getScore(evaluation);
  const submittedAt = formatDateTime(submission?.submitted_at);
  const statusMeta = getTimelineStatusMeta(status);

  const isLocked = status === "locked";
  const isOpen = status === "open";
  const isSubmitted = status === "submitted";
  const isGraded = status === "graded";
  const isOverdue = status === "overdue";

  return (
    <li
      className="workspace-timeline-step-enter relative flex gap-4 md:gap-5"
      style={getStepDelayStyle(index)}
    >
      <TimelineNode deliverable={deliverable} status={status} isLast={isLast} />

      <article
        className={`mb-6 flex-1 rounded-3xl border p-5 shadow-sm transition duration-200 md:p-6 ${statusMeta.cardClass}`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Deliverable {deliverable.number}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-black text-slate-900">
                {deliverable.name}
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
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
          <TimelineInfoCard title="Submitted at">
            <p className="text-sm font-medium text-slate-700">
              {submission ? submittedAt : "Not submitted yet"}
            </p>
          </TimelineInfoCard>

          <TimelineInfoCard title="Deadline">
            <DeadlineBadge
              deadline_at={submission?.deadline_at}
              status={status}
              className="w-full justify-start"
            />
          </TimelineInfoCard>

          <TimelineInfoCard title="Score">
            {isGraded ? (
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-black ring-1 ${getScoreClass(
                  score
                )}`}
              >
                {score ?? "—"}/100
              </span>
            ) : (
              <p className="text-sm font-medium text-slate-700">
                {isSubmitted
                  ? "Pending AI evaluation"
                  : isOpen
                    ? "Ready for submission"
                    : isOverdue
                      ? "Unavailable"
                      : "Locked"}
              </p>
            )}
          </TimelineInfoCard>
        </div>

        {isLocked && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5">
                🔒
              </span>

              <div>
                <p className="font-bold text-slate-700">Locked deliverable</p>
                <p className="mt-1 leading-6">{deliverable.lockedReason}</p>
              </div>
            </div>
          </div>
        )}

        {isOpen && (
          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-cyan-950">
                This deliverable is open.
              </p>
              <p className="mt-1 text-sm leading-6 text-cyan-700">
                You can now write and submit this deliverable. Once submitted,
                the AI evaluator will process it automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onWrite(deliverable)}
              className="inline-flex items-center justify-center rounded-2xl bg-cyan-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-200"
            >
              Write & Submit
            </button>
          </div>
        )}

        {isSubmitted && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5">
                ⏳
              </span>

              <div>
                <p className="font-black">Pending AI evaluation</p>
                <p className="mt-1 leading-6">
                  Your deliverable was submitted successfully. The AI feedback
                  and score will appear here once the evaluation is complete.
                </p>
              </div>
            </div>
          </div>
        )}

        {isOverdue && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5">
                ⚠️
              </span>

              <div>
                <p className="font-black">This deliverable is overdue.</p>
                <p className="mt-1 leading-6">
                  The professor will see this deliverable marked as overdue in
                  the supervision dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        {isGraded && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5">
                ✓
              </span>

              <div>
                <p className="font-black">Feedback available</p>
                <p className="mt-1 leading-6">
                  The AI evaluation has been completed. Review the feedback
                  below before continuing with the next deliverable.
                </p>
              </div>
            </div>
          </div>
        )}

        {isGraded && <FeedbackCard evaluation={evaluation} />}
      </article>
    </li>
  );
}

export default function WorkspacePage() {
  const { enrollmentId } = useParams();

  const [submissions, setSubmissions] = useState([]);
  const [activeDeliverable, setActiveDeliverable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

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

  function handleWrite(deliverable) {
    setNotice("");
    setNoticeType("success");
    setActiveDeliverable(deliverable);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmitted(submissionResponse) {
    if (hasEmailDeliveryFailure(submissionResponse)) {
      setNotice(SUBMISSION_EMAIL_FAILED_MESSAGE);
      setNoticeType("warning");
    } else {
      setNotice(
        "Submitted! The AI is now evaluating your work. You will receive your score and feedback by email within 1–2 minutes."
      );
      setNoticeType("success");
    }

    await refreshWorkspace();

    setTimeout(async () => {
      await refreshWorkspace();
    }, 2500);
  }

  const noticeClass =
    noticeType === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {activeDeliverable && (
        <SubmissionForm
          enrollmentId={enrollmentId}
          deliverable={activeDeliverable}
          onCancel={() => setActiveDeliverable(null)}
          onSubmitted={handleSubmitted}
        />
      )}

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/dashboard"
            className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            ← Back to dashboard
          </Link>

          <button
            type="button"
            onClick={refreshWorkspace}
            disabled={refreshing}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <section className="mb-8 overflow-hidden rounded-3xl bg-slate-900 text-white shadow-sm">
          <div className="grid gap-8 p-8 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="text-sm font-semibold text-cyan-200">
                Enrollment #{enrollmentId}
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight">
                Student workspace
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Complete the four deliverables in strict order. Each step
                unlocks only after the previous one has been evaluated.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/10">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-300">Graded progress</p>

                  <p className="mt-1 text-3xl font-black">
                    {progress.gradedCount}/4
                  </p>
                </div>

                <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-100">
                  Sequential
                </span>
              </div>

              <ProgressBar
                currentStep={currentOpenDeliverable || progress.gradedCount}
                totalSteps={4}
                status={`${progress.gradedCount}/4 graded`}
                className="mt-4 [&_p]:text-slate-200 [&_span]:text-slate-300 [&_[role=progressbar]]:bg-white/10"
              />
            </div>
          </div>
        </section>

        {notice && (
          <div
            className={`mb-6 rounded-2xl border px-5 py-4 text-sm font-medium ${noticeClass}`}
          >
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
          <section className="rounded-3xl border border-slate-200 bg-slate-100/70 p-4 shadow-sm md:p-6">
            <div className="mb-6 flex flex-col gap-3 px-1 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                  Academic timeline
                </p>

                <h2 className="mt-2 text-xl font-black text-slate-900">
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

              <p className="inline-flex w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                Sequential locking enabled
              </p>
            </div>

            <ol className="relative">
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
                    index={index}
                    onWrite={handleWrite}
                  />
                );
              })}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}