import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import DeadlineBadge from "../components/ui/DeadlineBadge";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge from "../components/ui/StatusBadge";
import { DELIVERABLES } from "../data/deliverables";
import { api, getApiErrorMessage } from "../services/api";
import { formatDateTime } from "../utils/dates";
import { useAuth } from "../context/useAuth";

function normalizeList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.enrollments)) {
    return data.enrollments;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

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

function getFinalScore(evaluation) {
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

function addDays(value, days) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getSubmissionByDeliverable(submissions, deliverableNumber) {
  return submissions.find(
    (submission) => submission.deliverable_number === deliverableNumber
  );
}

function computeEnrollmentMetrics(enrollment, submissions) {
  const sortedSubmissions = [...submissions].sort(
    (a, b) => a.deliverable_number - b.deliverable_number
  );

  const evaluatedSubmissions = sortedSubmissions.filter((submission) =>
    Boolean(getEvaluation(submission))
  );

  const submittedCount = sortedSubmissions.length;
  const evaluatedCount = evaluatedSubmissions.length;

  let latestScore =
    enrollment.latest_score !== undefined && enrollment.latest_score !== null
      ? enrollment.latest_score
      : null;

  let latestSubmissionAt = enrollment.latest_submission_at || null;

  for (const submission of sortedSubmissions) {
    if (
      submission.submitted_at &&
      (!latestSubmissionAt ||
        new Date(submission.submitted_at) > new Date(latestSubmissionAt))
    ) {
      latestSubmissionAt = submission.submitted_at;
    }

    const evaluation = getEvaluation(submission);
    const score = getFinalScore(evaluation);

    if (score !== null && score !== undefined) {
      latestScore = score;
    }
  }

  let currentDeliverable =
    enrollment.next_deliverable ||
    enrollment.current_deliverable ||
    evaluatedCount + 1;

  if (currentDeliverable > 4) {
    currentDeliverable = 4;
  }

  const currentSubmission = getSubmissionByDeliverable(
    sortedSubmissions,
    currentDeliverable
  );

  let nextDeadline = null;
  let deadlineSource = "No active deadline yet";

  if (currentSubmission?.deadline_at) {
    nextDeadline = currentSubmission.deadline_at;
    deadlineSource = `Deliverable ${currentDeliverable} deadline`;
  } else if (currentDeliverable === 1 && enrollment.enrolled_at) {
    nextDeadline = addDays(enrollment.enrolled_at, 7);
    deadlineSource = "Estimated from enrollment date";
  } else {
    const previousSubmission = getSubmissionByDeliverable(
      sortedSubmissions,
      currentDeliverable - 1
    );
    const previousEvaluation = getEvaluation(previousSubmission);

    if (previousEvaluation?.evaluated_at) {
      nextDeadline = addDays(previousEvaluation.evaluated_at, 7);
      deadlineSource = `Estimated from Deliverable ${
        currentDeliverable - 1
      } evaluation`;
    }
  }

  const isComplete = evaluatedCount >= 4;

  return {
    submittedCount,
    evaluatedCount,
    latestScore,
    latestSubmissionAt,
    currentDeliverable,
    nextDeadline,
    deadlineSource,
    isComplete,
  };
}

function isDueThisWeek(deadline) {
  if (!deadline) {
    return false;
  }

  const date = new Date(deadline);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  return date >= now && date <= sevenDaysFromNow;
}

function getScoreBadgeClass(score) {
  if (score === null || score === undefined) {
    return "bg-slate-100 text-slate-500";
  }

  if (score >= 80) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (score >= 60) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-red-50 text-red-700";
}

function getStaggerStyle(index) {
  return {
    "--dashboard-card-delay": `${Math.min(index * 65, 360)}ms`,
  };
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="h-5 w-2/3 rounded bg-slate-100" />
          <div className="mt-4 h-4 w-1/2 rounded bg-slate-100" />
          <div className="mt-8 h-3 w-full rounded bg-slate-100" />
          <div className="mt-3 h-3 w-5/6 rounded bg-slate-100" />
          <div className="mt-8 h-10 w-full rounded-2xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function MetricCard({ title, value, index }) {
  return (
    <div
      className="dashboard-card-enter rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
      style={getStaggerStyle(index)}
    >
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function EnrollmentCard({ enrollment, index }) {
  const navigate = useNavigate();

  const metrics = enrollment.metrics;

  const deliverableMeta =
    DELIVERABLES.find(
      (deliverable) => deliverable.number === metrics.currentDeliverable
    ) || DELIVERABLES[0];

  const scoreText =
    metrics.latestScore !== null && metrics.latestScore !== undefined
      ? `${metrics.latestScore}/100`
      : "No score yet";

  function openWorkspace() {
    navigate(`/workspace/${enrollment.id}`);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openWorkspace}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          openWorkspace();
        }
      }}
      style={getStaggerStyle(index)}
      className="dashboard-card-enter group cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-100"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 group-hover:text-cyan-800">
            {enrollment.project_name ||
              enrollment.project?.name ||
              `Project #${enrollment.project_id}`}
          </h3>

          <p className="mt-1 text-sm font-medium text-slate-500">
            {enrollment.subject_name ||
              enrollment.subject?.name ||
              "Subject unavailable"}
          </p>
        </div>

        <StatusBadge
          status={enrollment.status || "active"}
          size="sm"
          className="uppercase tracking-wide"
        />
      </div>

      <div className="mt-6">
        <ProgressBar
          currentStep={metrics.currentDeliverable}
          totalSteps={4}
          status={`${metrics.evaluatedCount}/4 graded`}
        />

        <p className="mt-3 text-sm text-slate-500">
          Current deliverable:{" "}
          <span className="font-semibold text-slate-800">
            {metrics.isComplete ? "Completed" : deliverableMeta.shortName}
          </span>
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Latest score
          </p>

          <p
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-black ${getScoreBadgeClass(
              metrics.latestScore
            )}`}
          >
            {scoreText}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Next deadline
          </p>

          <div className="mt-2">
            <DeadlineBadge
              deadline_at={metrics.nextDeadline}
              status={enrollment.status}
              className="w-full justify-start"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500">
        {metrics.deadlineSource}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-5">
        <p className="text-sm text-slate-500">
          Last activity:{" "}
          <span className="font-semibold text-slate-700">
            {metrics.latestSubmissionAt
              ? formatDateTime(metrics.latestSubmissionAt)
              : "No submissions yet"}
          </span>
        </p>

        <span className="text-sm font-bold text-cyan-700 transition group-hover:translate-x-1">
          Open →
        </span>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const dueThisWeekCount = useMemo(() => {
    return enrollments.filter((enrollment) =>
      isDueThisWeek(enrollment.metrics?.nextDeadline)
    ).length;
  }, [enrollments]);

  const activeCount = useMemo(() => {
    return enrollments.filter(
      (enrollment) => String(enrollment.status).toLowerCase() === "active"
    ).length;
  }, [enrollments]);

  const averageScore = useMemo(() => {
    const scores = enrollments
      .map((enrollment) => enrollment.metrics?.latestScore)
      .filter((score) => score !== null && score !== undefined);

    if (scores.length === 0) {
      return null;
    }

    const total = scores.reduce((sum, score) => sum + Number(score), 0);
    return Math.round(total / scores.length);
  }, [enrollments]);

  async function fetchEnrollments({ silent = false } = {}) {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError("");

      const response = await api.get("/enrollments");
      const enrollmentList = normalizeList(response.data);

      const enrichedEnrollments = await Promise.all(
        enrollmentList.map(async (enrollment) => {
          try {
            const submissionsResponse = await api.get(
              `/enrollments/${enrollment.id}/submissions`
            );

            const submissions = normalizeSubmissionList(
              submissionsResponse.data
            );

            return {
              ...enrollment,
              submissions,
              metrics: computeEnrollmentMetrics(enrollment, submissions),
            };
          } catch {
            return {
              ...enrollment,
              submissions: [],
              metrics: computeEnrollmentMetrics(enrollment, []),
            };
          }
        })
      );

      setEnrollments(enrichedEnrollments);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      try {
        setError("");

        const response = await api.get("/enrollments");
        const enrollmentList = normalizeList(response.data);

        const enrichedEnrollments = await Promise.all(
          enrollmentList.map(async (enrollment) => {
            try {
              const submissionsResponse = await api.get(
                `/enrollments/${enrollment.id}/submissions`
              );

              const submissions = normalizeSubmissionList(
                submissionsResponse.data
              );

              return {
                ...enrollment,
                submissions,
                metrics: computeEnrollmentMetrics(enrollment, submissions),
              };
            } catch {
              return {
                ...enrollment,
                submissions: [],
                metrics: computeEnrollmentMetrics(enrollment, []),
              };
            }
          })
        );

        if (!ignore) {
          setEnrollments(enrichedEnrollments);
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

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="mb-8 overflow-hidden rounded-3xl bg-slate-900 text-white shadow-sm">
          <div className="grid gap-8 p-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-cyan-200">
                Student dashboard
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight">
                Welcome{user?.full_name ? `, ${user.full_name}` : ""}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Track your active projects, deadlines, submissions and AI
                feedback from one place. Open a project to continue its
                sequential deliverable workflow.
              </p>
            </div>

            <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10">
              <p className="text-sm font-semibold text-slate-300">
                Due this week
              </p>

              <p className="mt-2 text-5xl font-black text-white">
                {dueThisWeekCount}
              </p>

              <p className="mt-2 text-sm text-slate-300">
                {dueThisWeekCount === 1
                  ? "deliverable due in the next 7 days"
                  : "deliverables due in the next 7 days"}
              </p>
            </div>
          </div>
        </section>

        {!loading && !error && (
          <section className="mb-8 grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Active enrollments"
              value={activeCount}
              index={0}
            />

            <MetricCard
              title="Average latest score"
              value={averageScore !== null ? `${averageScore}/100` : "—"}
              index={1}
            />

            <MetricCard
              title="Total projects"
              value={enrollments.length}
              index={2}
            />
          </section>
        )}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">My projects</h2>
            <p className="mt-1 text-sm text-slate-500">
              Click any card to open the workspace.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fetchEnrollments({ silent: true })}
              disabled={refreshing}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              to="/browse"
              className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700"
            >
              Browse subjects
            </Link>
          </div>
        </div>

        {loading && <DashboardSkeleton />}

        {!loading && error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && enrollments.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h3 className="text-lg font-black text-slate-900">
              No active enrollments yet
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Browse available subjects and enroll in a project to start the
              deliverable workflow.
            </p>

            <Link
              to="/browse"
              className="mt-6 inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Browse subjects
            </Link>
          </div>
        )}

        {!loading && !error && enrollments.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            {enrollments.map((enrollment, index) => (
              <EnrollmentCard
                key={enrollment.id}
                enrollment={enrollment}
                index={index + 3}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}