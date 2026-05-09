import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function ScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
        Pending
      </span>
    );
  }

  const numericScore = Number(score);

  let styles = "border-red-200 bg-red-100 text-red-700";

  if (numericScore >= 80) {
    styles = "border-emerald-200 bg-emerald-100 text-emerald-700";
  } else if (numericScore >= 50) {
    styles = "border-amber-200 bg-amber-100 text-amber-700";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${styles}`}
    >
      {numericScore}/100
    </span>
  );
}

function EmailStatusBadge({ failed, text }) {
  if (failed) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
        <span aria-hidden="true">⚠</span>
        {text || "Email issue"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
      <span aria-hidden="true">✓</span>
      {text || "Emails OK"}
    </span>
  );
}

function StatusBadge({ status }) {
  const normalizedStatus = String(status || "").toLowerCase();

  const styles =
    normalizedStatus === "overdue"
      ? "border-red-200 bg-red-100 text-red-700"
      : "border-emerald-200 bg-emerald-100 text-emerald-700";

  const label = normalizedStatus === "overdue" ? "Overdue" : "Active";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}
    >
      {label}
    </span>
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
            <label className="text-sm font-bold text-slate-700">Subject</label>
            <select
              value={subjectFilter}
              onChange={(event) =>
                handleSubjectFilterChange(event.target.value)
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900"
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
            <label className="text-sm font-bold text-slate-700">Project</label>
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900"
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
              className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh Dashboard"}
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-black text-slate-900">
            Enrollments Table
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Click a row to open the professor student detail view later.
          </p>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Student
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Project
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Progress
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Latest Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Last Activity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Email Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRows.map((row) => (
                  <tr
                    key={row.enrollment_id}
                    onClick={() =>
                      navigate(`/professor/student/${row.enrollment_id}`)
                    }
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-6 py-5">
                      <div>
                        <p className="font-bold text-slate-900">
                          {row.student_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {row.student_email}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div>
                        <p className="font-bold text-slate-900">
                          {row.project_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {row.subject_name}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="min-w-32">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-900">
                            {row.progress_label}
                          </span>
                          <span className="text-slate-500">
                            Step {row.current_deliverable}
                          </span>
                        </div>

                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-slate-900"
                            style={{
                              width: `${Math.min(
                                100,
                                (Number(row.evaluated_count || 0) / 4) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <ScoreBadge score={row.latest_score} />
                    </td>

                    <td className="px-6 py-5 text-sm font-semibold text-slate-600">
                      {formatDate(row.last_activity)}
                    </td>

                    <td className="px-6 py-5">
                      <EmailStatusBadge
                        failed={row.email_failed}
                        text={row.email_status_text}
                      />
                    </td>

                    <td className="px-6 py-5">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
