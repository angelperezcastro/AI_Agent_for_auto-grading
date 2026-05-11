import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/ui/EmptyState";
import { api, getApiErrorMessage } from "../../services/api";

const emptySubjectForm = {
  name: "",
  description: "",
};

const emptyProjectForm = {
  name: "",
  description: "",
  topic: "",
};

function getProjectGmailAccountId(project) {
  return (
    project?.gmail_account_id ??
    project?.gmailAccountId ??
    project?.gmail_account?.id ??
    project?.gmailAccount?.id ??
    null
  );
}

function getGmailAccountEmail(accounts, gmailAccountId) {
  const account = accounts.find(
    (item) => Number(item.id) === Number(gmailAccountId)
  );

  return account?.account_email || account?.email || "Unknown Gmail account";
}

function normalizeNullableId(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function normalizeText(value) {
  const cleanValue = String(value || "").trim();
  return cleanValue.length > 0 ? cleanValue : null;
}

async function fetchSubjectsWithProjects() {
  const subjectsResponse = await api.get("/subjects");
  const subjects = Array.isArray(subjectsResponse.data)
    ? subjectsResponse.data
    : [];

  const subjectsWithProjects = await Promise.all(
    subjects.map(async (subject) => {
      const projectsResponse = await api.get(`/subjects/${subject.id}/projects`);
      const projects = Array.isArray(projectsResponse.data)
        ? projectsResponse.data
        : [];

      return {
        ...subject,
        projects,
      };
    })
  );

  return subjectsWithProjects;
}

async function fetchGmailAccounts() {
  const response = await api.get("/settings/gmail-accounts");
  return Array.isArray(response.data) ? response.data : [];
}

export default function ManagePage() {
  const [subjects, setSubjects] = useState([]);
  const [gmailAccounts, setGmailAccounts] = useState([]);

  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);
  const [projectForms, setProjectForms] = useState({});

  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);

  const [editingSubjectForm, setEditingSubjectForm] =
    useState(emptySubjectForm);
  const [editingProjectForm, setEditingProjectForm] =
    useState(emptyProjectForm);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const gmailAccountById = useMemo(() => {
    const map = new Map();

    gmailAccounts.forEach((account) => {
      map.set(Number(account.id), account);
    });

    return map;
  }, [gmailAccounts]);

  async function refreshProfessorData({ showFullLoading = false } = {}) {
    if (showFullLoading) {
      setLoading(true);
    }

    setError("");

    try {
      const [subjectsData, gmailAccountsData] = await Promise.all([
        fetchSubjectsWithProjects(),
        fetchGmailAccounts(),
      ]);

      setSubjects(subjectsData);
      setGmailAccounts(gmailAccountsData);
    } catch (err) {
      setError(
        getApiErrorMessage(err) || "Could not load professor management data."
      );
    } finally {
      if (showFullLoading) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    const timer = window.setTimeout(() => {
      async function initialFetch() {
        setLoading(true);
        setError("");

        try {
          const [subjectsData, gmailAccountsData] = await Promise.all([
            fetchSubjectsWithProjects(),
            fetchGmailAccounts(),
          ]);

          if (!isMounted) return;

          setSubjects(subjectsData);
          setGmailAccounts(gmailAccountsData);
        } catch (err) {
          if (!isMounted) return;

          setError(
            getApiErrorMessage(err) ||
              "Could not load professor management data."
          );
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      }

      initialFetch();
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, []);

  function updateProjectForm(subjectId, field, value) {
    setProjectForms((previous) => ({
      ...previous,
      [subjectId]: {
        ...(previous[subjectId] || emptyProjectForm),
        [field]: value,
      },
    }));
  }

  async function handleCreateSubject(event) {
    event.preventDefault();

    const name = subjectForm.name.trim();

    if (!name) {
      setError("Subject name is required.");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await api.post("/subjects", {
        name,
        description: normalizeText(subjectForm.description),
      });

      const createdSubject = response.data;

      setSubjects((previous) => [
        ...previous,
        {
          ...createdSubject,
          projects: [],
        },
      ]);

      setSubjectForm(emptySubjectForm);
    } catch (err) {
      setError(getApiErrorMessage(err) || "Could not create subject.");
    } finally {
      setActionLoading(false);
    }
  }

  function startEditSubject(subject) {
    setEditingSubjectId(subject.id);
    setEditingSubjectForm({
      name: subject.name || "",
      description: subject.description || "",
    });
  }

  async function handleUpdateSubject(subjectId) {
    const name = editingSubjectForm.name.trim();

    if (!name) {
      setError("Subject name is required.");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await api.put(`/subjects/${subjectId}`, {
        name,
        description: normalizeText(editingSubjectForm.description),
      });

      const updatedSubject = response.data;

      setSubjects((previous) =>
        previous.map((subject) => {
          if (Number(subject.id) !== Number(subjectId)) {
            return subject;
          }

          return {
            ...subject,
            ...updatedSubject,
            projects: subject.projects || [],
          };
        })
      );

      setEditingSubjectId(null);
      setEditingSubjectForm(emptySubjectForm);
    } catch (err) {
      setError(getApiErrorMessage(err) || "Could not update subject.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteSubject(subjectId) {
    const confirmed = window.confirm(
      "Delete this subject? This may also delete its projects."
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      await api.delete(`/subjects/${subjectId}`);

      setSubjects((previous) =>
        previous.filter((subject) => Number(subject.id) !== Number(subjectId))
      );

      if (Number(editingSubjectId) === Number(subjectId)) {
        setEditingSubjectId(null);
        setEditingSubjectForm(emptySubjectForm);
      }
    } catch (err) {
      setError(getApiErrorMessage(err) || "Could not delete subject.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateProject(event, subjectId) {
    event.preventDefault();

    const currentForm = projectForms[subjectId] || emptyProjectForm;
    const name = currentForm.name.trim();
    const topic = currentForm.topic.trim();

    if (!name) {
      setError("Project name is required.");
      return;
    }

    if (!topic) {
      setError("Project topic is required.");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await api.post(`/subjects/${subjectId}/projects`, {
        name,
        description: normalizeText(currentForm.description),
        topic,
        gmail_account_id: null,
      });

      const createdProject = response.data;

      setSubjects((previous) =>
        previous.map((subject) => {
          if (Number(subject.id) !== Number(subjectId)) {
            return subject;
          }

          return {
            ...subject,
            projects: [...(subject.projects || []), createdProject],
          };
        })
      );

      setProjectForms((previous) => ({
        ...previous,
        [subjectId]: emptyProjectForm,
      }));
    } catch (err) {
      setError(getApiErrorMessage(err) || "Could not create project.");
    } finally {
      setActionLoading(false);
    }
  }

  function startEditProject(project) {
    setEditingProjectId(project.id);
    setEditingProjectForm({
      name: project.name || "",
      description: project.description || "",
      topic: project.topic || "",
    });
  }

  async function handleUpdateProject(project) {
    const name = editingProjectForm.name.trim();
    const topic = editingProjectForm.topic.trim();

    if (!name) {
      setError("Project name is required.");
      return;
    }

    if (!topic) {
      setError("Project topic is required.");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await api.put(
        `/subjects/${project.subject_id}/projects/${project.id}`,
        {
          name,
          description: normalizeText(editingProjectForm.description),
          topic,
          gmail_account_id: getProjectGmailAccountId(project),
        }
      );

      const updatedProject = response.data;

      setSubjects((previous) =>
        previous.map((subject) => {
          if (Number(subject.id) !== Number(project.subject_id)) {
            return subject;
          }

          return {
            ...subject,
            projects: (subject.projects || []).map((item) =>
              Number(item.id) === Number(project.id)
                ? {
                    ...item,
                    ...updatedProject,
                  }
                : item
            ),
          };
        })
      );

      setEditingProjectId(null);
      setEditingProjectForm(emptyProjectForm);
    } catch (err) {
      setError(getApiErrorMessage(err) || "Could not update project.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteProject(project) {
    const confirmed = window.confirm("Delete this project?");

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      await api.delete(`/subjects/${project.subject_id}/projects/${project.id}`);

      setSubjects((previous) =>
        previous.map((subject) => {
          if (Number(subject.id) !== Number(project.subject_id)) {
            return subject;
          }

          return {
            ...subject,
            projects: (subject.projects || []).filter(
              (item) => Number(item.id) !== Number(project.id)
            ),
          };
        })
      );

      if (Number(editingProjectId) === Number(project.id)) {
        setEditingProjectId(null);
        setEditingProjectForm(emptyProjectForm);
      }
    } catch (err) {
      setError(getApiErrorMessage(err) || "Could not delete project.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssignGmail(project, rawValue) {
    const gmailAccountId = normalizeNullableId(rawValue);

    setActionLoading(true);
    setError("");

    try {
      const response = await api.patch(
        `/subjects/projects/${project.id}/gmail-account`,
        {
          gmail_account_id: gmailAccountId,
        }
      );

      const updatedProject = response.data;

      setSubjects((previous) =>
        previous.map((subject) => {
          if (Number(subject.id) !== Number(project.subject_id)) {
            return subject;
          }

          return {
            ...subject,
            projects: (subject.projects || []).map((item) =>
              Number(item.id) === Number(project.id)
                ? {
                    ...item,
                    ...updatedProject,
                    gmail_account_id: getProjectGmailAccountId(updatedProject),
                  }
                : item
            ),
          };
        })
      );

      await refreshProfessorData();
    } catch (err) {
      setError(
        getApiErrorMessage(err) || "Could not assign Gmail account to project."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function renderGmailStatus(project) {
    const accountId = getProjectGmailAccountId(project);

    if (!accountId) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-bold">Warning:</span> no Gmail account assigned.
        </div>
      );
    }

    const account = gmailAccountById.get(Number(accountId));

    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span className="font-bold">Assigned Gmail:</span>{" "}
        {account ? getGmailAccountEmail([account], accountId) : `Account #${accountId}`}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Loading professor management panel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 rounded-3xl bg-slate-900 p-8 text-white shadow-sm md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Professor Management
          </p>
          <h1 className="mt-2 text-3xl font-black">Subjects & Projects</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Create subjects, manage projects and assign the Gmail account used
            for project emails.
          </p>
        </div>

        <div className="rounded-2xl bg-white/10 px-5 py-4">
          <p className="text-sm text-slate-300">Connected Gmail accounts</p>
          <p className="text-2xl font-black">{gmailAccounts.length}</p>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Create Subject</h2>

        <form
          onSubmit={handleCreateSubject}
          className="mt-5 grid gap-4 md:grid-cols-[1fr_2fr_auto]"
        >
          <input
            value={subjectForm.name}
            onChange={(event) =>
              setSubjectForm((previous) => ({
                ...previous,
                name: event.target.value,
              }))
            }
            placeholder="Subject name"
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
          />

          <input
            value={subjectForm.description}
            onChange={(event) =>
              setSubjectForm((previous) => ({
                ...previous,
                description: event.target.value,
              }))
            }
            placeholder="Subject description"
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
          />

          <button
            type="submit"
            disabled={actionLoading}
            className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Create
          </button>
        </form>
      </section>

      <section className="space-y-6">
        {subjects.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No subjects yet"
            description="Create your first subject to organize projects, enroll students and route Gmail notifications correctly."
            actionLabel="Create a subject above"
            compact={false}
          />
        ) : (
          subjects.map((subject) => {
            const subjectProjects = subject.projects || [];
            const currentProjectForm =
              projectForms[subject.id] || emptyProjectForm;

            return (
              <article
                key={subject.id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  {editingSubjectId === subject.id ? (
                    <div className="grid flex-1 gap-3 md:grid-cols-2">
                      <input
                        value={editingSubjectForm.name}
                        onChange={(event) =>
                          setEditingSubjectForm((previous) => ({
                            ...previous,
                            name: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                      />

                      <input
                        value={editingSubjectForm.description}
                        onChange={(event) =>
                          setEditingSubjectForm((previous) => ({
                            ...previous,
                            description: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                      />
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">
                        {subject.name}
                      </h2>
                      <p className="mt-1 text-slate-500">
                        {subject.description || "No description provided."}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {editingSubjectId === subject.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateSubject(subject.id)}
                          disabled={actionLoading}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubjectId(null);
                            setEditingSubjectForm(emptySubjectForm);
                          }}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditSubject(subject)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSubject(subject.id)}
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                    Projects
                  </h3>

                  <form
                    onSubmit={(event) => handleCreateProject(event, subject.id)}
                    className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-3"
                  >
                    <input
                      value={currentProjectForm.name}
                      onChange={(event) =>
                        updateProjectForm(subject.id, "name", event.target.value)
                      }
                      placeholder="Project name"
                      className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                    />

                    <input
                      value={currentProjectForm.topic}
                      onChange={(event) =>
                        updateProjectForm(subject.id, "topic", event.target.value)
                      }
                      placeholder="Project topic"
                      className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                    />

                    <input
                      value={currentProjectForm.description}
                      onChange={(event) =>
                        updateProjectForm(
                          subject.id,
                          "description",
                          event.target.value
                        )
                      }
                      placeholder="Project description"
                      className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                    />

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60 md:col-span-3"
                    >
                      Add Project
                    </button>
                  </form>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {subjectProjects.length === 0 ? (
                      <EmptyState
                        icon="🧩"
                        title="No projects in this subject"
                        description="Add a project so students can enroll and start submitting deliverables."
                        actionLabel="Use the project form above"
                        compact
                        className="lg:col-span-2"
                      />
                    ) : (
                      subjectProjects.map((project) => (
                        <div
                          key={project.id}
                          className="rounded-2xl border border-slate-200 p-5"
                        >
                          {editingProjectId === project.id ? (
                            <div className="space-y-3">
                              <input
                                value={editingProjectForm.name}
                                onChange={(event) =>
                                  setEditingProjectForm((previous) => ({
                                    ...previous,
                                    name: event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                              />

                              <input
                                value={editingProjectForm.topic}
                                onChange={(event) =>
                                  setEditingProjectForm((previous) => ({
                                    ...previous,
                                    topic: event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                              />

                              <textarea
                                value={editingProjectForm.description}
                                onChange={(event) =>
                                  setEditingProjectForm((previous) => ({
                                    ...previous,
                                    description: event.target.value,
                                  }))
                                }
                                rows={3}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                              />

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateProject(project)}
                                  disabled={actionLoading}
                                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  Save
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProjectId(null);
                                    setEditingProjectForm(emptyProjectForm);
                                  }}
                                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h4 className="text-lg font-black text-slate-900">
                                    {project.name}
                                  </h4>
                                  <p className="mt-1 text-sm font-semibold text-slate-500">
                                    {project.topic || "No topic provided."}
                                  </p>
                                  <p className="mt-2 text-sm text-slate-500">
                                    {project.description ||
                                      "No description provided."}
                                  </p>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditProject(project)}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProject(project)}
                                    className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>

                              <div className="mt-5 space-y-3">
                                {renderGmailStatus(project)}

                                <select
                                  value={getProjectGmailAccountId(project) || ""}
                                  onChange={(event) =>
                                    handleAssignGmail(project, event.target.value)
                                  }
                                  disabled={actionLoading}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900 disabled:opacity-60"
                                >
                                  <option value="">
                                    No Gmail account assigned
                                  </option>

                                  {gmailAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.account_email || account.email}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}