import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  getProfessorDashboardEnrollments,
  getProfessorSubjectsWithProjects,
} from "../../services/professorApi";
import { getApiErrorMessage } from "../../services/api";

function formatDate(value) {
  if (!value) return "No activity yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getProgressPercentage(row) {
  return Math.min(100, (Number(row.evaluated_count || 0) / 4) * 100);
}

function ScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return <StatusBadge status="pending" label="Pending" size="sm" />;
  }

  const numericScore = Number(score);

  let styles = "border-red-200 bg-red-50 text-red-700 ring-red-600/10";

  if (numericScore >= 80) {
    styles =
      "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-600/10";
  } else if (numericScore >= 50) {
    styles = "border-amber-200 bg-amber-50 text-amber-800 ring-amber-600/10";
  }

  return (
    <span
      aria-label={`Latest score: ${numericScore} out of 100`}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ring-1 ring-inset ${styles}`}
    >
      {numericScore}/100
    </span>
  );
}

function EmailStatusBadge({ failed, text }) {
  return (
    <StatusBadge
      status={failed ? "email_failed" : "email_ok"}
      label={text || (failed ? "Email failed" : "Emails OK")}
      size="sm"
    />
  );
}

function ProgressCell({ row }) {
  const progressPercentage = getProgressPercentage(row);

  return (
    <div className="min-w-40">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-black text-slate-900">
          {row.progress_label}
        </span>

        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
          Step {row.current_deliverable}
        </span>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`Progress for ${row.student_name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercentage)}
      >
        <div
          className="h-full rounded-full bg-slate-900 transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
}

function MobileEnrollmentCard({ row, onOpen }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(row);
        }
      }}
      className="group cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50/30 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-100"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Student
          </p>

          <h3 className="mt-1 truncate text-base font-black text-slate-900">
            {row.student_name}
          </h3>

          <p className="mt-1 truncate text-sm font-medium text-slate-500">
            {row.student_email}
          </p>
        </div>

        <StatusBadge status={row.status || "active"} size="sm" />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
          Project
        </p>

        <p className="mt-1 font-black text-slate-900">{row.project_name}</p>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {row.subject_name}
        </p>
      </div>

      <div className="mt-5">
        <ProgressCell row={row} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Score
          </p>
          <div className="mt-2">
            <ScoreBadge score={row.latest_score} />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Email
          </p>
          <div className="mt-2">
            <EmailStatusBadge
              failed={row.email_failed}
              text={row.email_status_text}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Last activity
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {formatDate(row.last_activity)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Open detail
        </span>

        <span
          aria-hidden="true"
          className="text-sm font-black text-cyan-700 transition group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </article>
  );
}

export default function ProfessorDashboard() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [subjectFilter, setSubjectFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function refreshDashboard() {
    setRefreshing(true);
    setError("");

    try {
      const [dashboardRows, subjectRows] = await Promise.all([
        getProfessorDashboardEnrollments(),
        getProfessorSubjectsWithProjects(),
      ]);

      setRows(Array.isArray(dashboardRows) ? dashboardRows : []);
      setSubjects(Array.isArray(subjectRows) ? subjectRows : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialDashboard() {
      try {
        const [dashboardRows, subjectRows] = await Promise.all([
          getProfessorDashboardEnrollments(),
          getProfessorSubjectsWithProjects(),
        ]);

        if (!isMounted) return;

        setRows(Array.isArray(dashboardRows) ? dashboardRows : []);
        setSubjects(Array.isArray(subjectRows) ? subjectRows : []);
      } catch (err) {
        if (!isMounted) return;
        setError(getApiErrorMessage(err));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadInitialDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const availableProjects = useMemo(() => {
    if (!subjectFilter) {
      return subjects.flatMap((subject) => subject.projects || []);
    }

    const selectedSubject = subjects.find(
      (subject) => String(subject.id) === String(subjectFilter)
    );

    return selectedSubject?.projects || [];
  }, [subjects, subjectFilter]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSubject = subjectFilter
        ? String(row.subject_id) === String(subjectFilter)
        : true;

      const matchesProject = projectFilter
        ? String(row.project_id) === String(projectFilter)
        : true;

      return matchesSubject && matchesProject;
    });
  }, [rows, subjectFilter, projectFilter]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const overdue = filteredRows.filter((row) => row.status === "overdue").length;
    const emailIssues = filteredRows.filter((row) => row.email_failed).length;

    const scoredRows = filteredRows.filter(
      (row) => row.latest_score !== null && row.latest_score !== undefined
    );

    const averageScore =
      scoredRows.length === 0
        ? null
        : Math.round(
            scoredRows.reduce((sum, row) => sum + Number(row.latest_score), 0) /
              scoredRows.length
          );

    return {
      total,
      overdue,
      emailIssues,
      averageScore,
    };
  }, [filteredRows]);

  function handleSubjectFilterChange(value) {
    setSubjectFilter(value);
    setProjectFilter("");
  }

  function openStudentDetail(row) {
    navigate(`/professor/student/${row.enrollment_id}`);
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Loading professor dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Professor Dashboard
        </p>

        <h1 className="mt-2 text-3xl font-black">Student Progress</h1>

        <p className="mt-3 max-w-3xl text-slate-300">
          Monitor all student enrollments across your subjects and projects.
          Track deliverable progress, latest scores, activity and email delivery
          issues.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Enrollments</p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {stats.total}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Average Score</p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {stats.averageScore === null ? "—" : `${stats.averageScore}/100`}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Overdue</p>
          <p className="mt-2 text-3xl font-black text-red-600">
            {stats.overdue}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Email Issues</p>
          <p className="mt-2 text-3xl font-black text-amber-600">
            {stats.emailIssues}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="professor-dashboard-subject-filter"
              className="text-sm font-bold text-slate-700"
            >
              Subject
            </label>

            <select
              id="professor-dashboard-subject-filter"
              value={subjectFilter}
              onChange={(event) =>
                handleSubjectFilterChange(event.target.value)
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
            >
              <option value="">All subjects</option>

              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="professor-dashboard-project-filter"
              className="text-sm font-bold text-slate-700"
            >
              Project
            </label>

            <select
              id="professor-dashboard-project-filter"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
            >
              <option value="">All projects</option>

              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={refreshDashboard}
              disabled={refreshing}
              className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh Dashboard"}
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                Supervision
              </p>

              <h2 className="mt-2 text-xl font-black text-slate-900">
                Enrollments
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Click a row to open the student detail view.
              </p>
            </div>

            <p className="w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
              {filteredRows.length} visible
            </p>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="text-lg font-black text-slate-900">
              No enrollments found
            </h3>

            <p className="mt-2 text-slate-500">
              There are no students matching the current filters.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 bg-slate-50/70 p-4 lg:hidden">
              {filteredRows.map((row) => (
                <MobileEnrollmentCard
                  key={row.enrollment_id}
                  row={row}
                  onOpen={openStudentDetail}
                />
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full border-separate border-spacing-0">
                <caption className="sr-only">
                  Professor dashboard enrollments table
                </caption>

                <thead>
                  <tr className="bg-slate-50">
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                    >
                      Student
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                    >
                      Project
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                    >
                      Progress
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                    >
                      Latest Score
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                    >
                      Last Activity
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                    >
                      Email Status
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                    >
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.enrollment_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openStudentDetail(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openStudentDetail(row);
                        }
                      }}
                      className="group cursor-pointer outline-none transition duration-200 hover:bg-cyan-50/40 focus:bg-cyan-50/50"
                    >
                      <td className="border-b border-slate-100 border-l-4 border-l-transparent px-6 py-5 align-middle transition-colors group-hover:border-l-cyan-500 group-focus:border-l-cyan-600">
                        <div className="max-w-56">
                          <p className="truncate font-black text-slate-900">
                            {row.student_name}
                          </p>

                          <p className="mt-1 truncate text-sm font-medium text-slate-500">
                            {row.student_email}
                          </p>
                        </div>
                      </td>

                      <td className="border-b border-slate-100 px-6 py-5 align-middle">
                        <div className="max-w-64">
                          <p className="truncate font-black text-slate-900">
                            {row.project_name}
                          </p>

                          <p className="mt-1 truncate text-sm font-medium text-slate-500">
                            {row.subject_name}
                          </p>
                        </div>
                      </td>

                      <td className="border-b border-slate-100 px-6 py-5 align-middle">
                        <ProgressCell row={row} />
                      </td>

                      <td className="border-b border-slate-100 px-6 py-5 align-middle">
                        <ScoreBadge score={row.latest_score} />
                      </td>

                      <td className="border-b border-slate-100 px-6 py-5 align-middle">
                        <p className="whitespace-nowrap text-sm font-semibold text-slate-600">
                          {formatDate(row.last_activity)}
                        </p>
                      </td>

                      <td className="border-b border-slate-100 px-6 py-5 align-middle">
                        <EmailStatusBadge
                          failed={row.email_failed}
                          text={row.email_status_text}
                        />
                      </td>

                      <td className="border-b border-slate-100 px-6 py-5 align-middle">
                        <StatusBadge status={row.status || "active"} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}