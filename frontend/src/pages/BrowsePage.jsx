import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api, getApiErrorMessage } from "../services/api";

function normalizeList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.subjects)) {
    return data.subjects;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

function getProjectListFromSubject(subject) {
  if (Array.isArray(subject?.projects)) {
    return subject.projects;
  }

  if (Array.isArray(subject?.project_list)) {
    return subject.project_list;
  }

  return [];
}

function Toast({ message, type = "success", onClose }) {
  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className={`fixed right-5 top-5 z-50 max-w-sm rounded-2xl border px-5 py-4 shadow-lg ${styles}`}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-bold opacity-70 hover:opacity-100"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function SubjectCard({
  subject,
  expanded,
  projects,
  loadingProjects,
  enrollingProjectId,
  onToggle,
  onEnroll,
}) {
  const projectCount = projects.length;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-6 text-left transition hover:bg-slate-50"
      >
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-lg font-bold text-cyan-700">
              {subject.name?.charAt(0)?.toUpperCase() || "S"}
            </span>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {subject.name || `Subject #${subject.id}`}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {projectCount > 0
                  ? `${projectCount} project${projectCount === 1 ? "" : "s"} available`
                  : "Click to load projects"}
              </p>
            </div>
          </div>

          {subject.description && (
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
              {subject.description}
            </p>
          )}
        </div>

        <span className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600">
          {expanded ? "Collapse" : "Expand"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-6">
          {loadingProjects && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Loading projects...
            </div>
          )}

          {!loadingProjects && projects.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
              <p className="font-semibold text-slate-800">
                No projects available for this subject yet.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                A professor needs to create projects before students can enroll.
              </p>
            </div>
          )}

          {!loadingProjects && projects.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {project.name || `Project #${project.id}`}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-cyan-700">
                        {project.topic || "No topic provided"}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      Project
                    </span>
                  </div>

                  {project.description && (
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {project.description}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={enrollingProjectId === project.id}
                    onClick={() => onEnroll(project.id)}
                    className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {enrollingProjectId === project.id
                      ? "Enrolling..."
                      : "Enroll"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function BrowsePage() {
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);
  const [projectsBySubject, setProjectsBySubject] = useState({});
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingProjectsBySubject, setLoadingProjectsBySubject] = useState({});
  const [enrollingProjectId, setEnrollingProjectId] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [subjects]);

  useEffect(() => {
    async function fetchSubjects() {
      try {
        setError("");

        const response = await api.get("/subjects");
        const subjectList = normalizeList(response.data);

        setSubjects(subjectList);

        const initialProjectsBySubject = {};

        for (const subject of subjectList) {
          const embeddedProjects = getProjectListFromSubject(subject);

          if (embeddedProjects.length > 0) {
            initialProjectsBySubject[subject.id] = embeddedProjects;
          }
        }

        setProjectsBySubject(initialProjectsBySubject);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoadingSubjects(false);
      }
    }

    fetchSubjects();
  }, []);

  async function fetchProjectsForSubject(subjectId) {
    if (projectsBySubject[subjectId]) {
      return;
    }

    setLoadingProjectsBySubject((current) => ({
      ...current,
      [subjectId]: true,
    }));

    try {
      const response = await api.get(`/subjects/${subjectId}/projects`);
      const projects = normalizeList(response.data);

      setProjectsBySubject((current) => ({
        ...current,
        [subjectId]: projects,
      }));
    } catch (err) {
      setToast({
        type: "error",
        message: getApiErrorMessage(err),
      });

      setProjectsBySubject((current) => ({
        ...current,
        [subjectId]: [],
      }));
    } finally {
      setLoadingProjectsBySubject((current) => ({
        ...current,
        [subjectId]: false,
      }));
    }
  }

  async function handleToggleSubject(subjectId) {
    const nextExpandedId = expandedSubjectId === subjectId ? null : subjectId;

    setExpandedSubjectId(nextExpandedId);

    if (nextExpandedId !== null) {
      await fetchProjectsForSubject(subjectId);
    }
  }

  async function handleEnroll(projectId) {
    setEnrollingProjectId(projectId);

    try {
      const response = await api.post("/enrollments", {
        project_id: projectId,
      });

      const enrollmentId =
        response.data?.id ||
        response.data?.enrollment_id ||
        response.data?.enrollment?.id;

      if (!enrollmentId) {
        throw new Error("Enrollment created, but no enrollment ID was returned.");
      }

      setToast({
        type: "success",
        message: "Enrolled! Check your email for confirmation.",
      });

      setTimeout(() => {
        navigate(`/workspace/${enrollmentId}`);
      }, 700);
    } catch (err) {
      setToast({
        type: "error",
        message: getApiErrorMessage(err),
      });
    } finally {
      setEnrollingProjectId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="mb-8 rounded-3xl bg-slate-900 p-8 text-white">
          <p className="text-sm font-semibold text-cyan-200">
            Student enrollment
          </p>
          <h1 className="mt-2 text-3xl font-bold">Browse subjects</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Choose a subject, review its available projects, and enroll in one
            active project. After enrolling, you will access the deliverable
            workspace for that project.
          </p>
        </section>

        {loadingSubjects && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Loading subjects...
          </div>
        )}

        {!loadingSubjects && error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loadingSubjects && !error && sortedSubjects.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              No subjects available
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              A professor must create subjects and projects before students can
              enroll.
            </p>
          </div>
        )}

        {!loadingSubjects && !error && sortedSubjects.length > 0 && (
          <div className="space-y-5">
            {sortedSubjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                expanded={expandedSubjectId === subject.id}
                projects={projectsBySubject[subject.id] || []}
                loadingProjects={Boolean(loadingProjectsBySubject[subject.id])}
                enrollingProjectId={enrollingProjectId}
                onToggle={() => handleToggleSubject(subject.id)}
                onEnroll={handleEnroll}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}