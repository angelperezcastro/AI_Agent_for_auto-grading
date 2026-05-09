import { api, getApiErrorMessage } from "./api";

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

function extractData(response) {
  return response?.data ?? response;
}

function normalizeGmailAccountId(gmailAccountId) {
  if (
    gmailAccountId === null ||
    gmailAccountId === undefined ||
    gmailAccountId === ""
  ) {
    return null;
  }

  return Number(gmailAccountId);
}

function raiseApiError(error, fallbackMessage) {
  const message = getApiErrorMessage(error) || fallbackMessage;
  const finalError = new Error(message);
  finalError.originalError = error;
  throw finalError;
}

/* =========================================================
   NORMALIZERS USED BY MANAGE PAGE
   ========================================================= */

export function getProjectGmailAccountId(project) {
  return (
    project?.gmail_account_id ??
    project?.gmailAccountId ??
    project?.gmail_account?.id ??
    project?.gmailAccount?.id ??
    null
  );
}

export function getGmailAccountEmail(accountOrAccounts, gmailAccountId = null) {
  let account = accountOrAccounts;

  if (Array.isArray(accountOrAccounts)) {
    account = accountOrAccounts.find(
      (item) => Number(item.id) === Number(gmailAccountId)
    );
  }

  return (
    account?.account_email ||
    account?.email ||
    account?.gmail ||
    account?.gmail_email ||
    "Unknown Gmail account"
  );
}

/* =========================================================
   SUBJECTS
   Backend real endpoints:
   GET    /subjects
   POST   /subjects
   PUT    /subjects/{subject_id}
   DELETE /subjects/{subject_id}
   ========================================================= */

export async function getProfessorSubjects() {
  try {
    const response = await api.get("/subjects");
    const data = extractData(response);

    return Array.isArray(data) ? data : [];
  } catch (error) {
    raiseApiError(error, "Could not load subjects.");
  }
}

export async function createSubject(payload) {
  try {
    const response = await api.post("/subjects", {
      name: payload.name,
      description: payload.description || null,
    });

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not create subject.");
  }
}

export async function updateSubject(subjectId, payload) {
  try {
    const response = await api.put(`/subjects/${subjectId}`, {
      name: payload.name,
      description: payload.description || null,
    });

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not update subject.");
  }
}

export async function deleteSubject(subjectId) {
  try {
    const response = await api.delete(`/subjects/${subjectId}`);
    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not delete subject.");
  }
}

/* =========================================================
   PROJECTS
   Backend real endpoints:
   GET    /subjects/{subject_id}/projects
   POST   /subjects/{subject_id}/projects
   PUT    /subjects/{subject_id}/projects/{project_id}
   DELETE /subjects/{subject_id}/projects/{project_id}
   ========================================================= */

export async function getProjectsForSubject(subjectId) {
  try {
    const response = await api.get(`/subjects/${subjectId}/projects`);
    const data = extractData(response);

    return Array.isArray(data) ? data : [];
  } catch (error) {
    raiseApiError(error, "Could not load projects.");
  }
}

export async function getProfessorSubjectsWithProjects() {
  const subjects = await getProfessorSubjects();

  const hydratedSubjects = await Promise.all(
    subjects.map(async (subject) => {
      try {
        const projects = await getProjectsForSubject(subject.id);

        return {
          ...subject,
          projects: Array.isArray(projects) ? projects : [],
        };
      } catch {
        return {
          ...subject,
          projects: [],
        };
      }
    })
  );

  return hydratedSubjects;
}

export async function createProject(subjectId, payload) {
  try {
    const response = await api.post(`/subjects/${subjectId}/projects`, {
      name: payload.name,
      description: payload.description || null,
      topic: payload.topic,
      gmail_account_id:
        payload.gmail_account_id === undefined
          ? null
          : normalizeGmailAccountId(payload.gmail_account_id),
    });

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not create project.");
  }
}

export async function updateProject(subjectId, projectId, payload) {
  try {
    const response = await api.put(
      `/subjects/${subjectId}/projects/${projectId}`,
      {
        name: payload.name,
        description: payload.description || null,
        topic: payload.topic,
        gmail_account_id:
          payload.gmail_account_id === undefined
            ? undefined
            : normalizeGmailAccountId(payload.gmail_account_id),
      }
    );

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not update project.");
  }
}

export async function deleteProject(subjectId, projectId) {
  try {
    const response = await api.delete(
      `/subjects/${subjectId}/projects/${projectId}`
    );

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not delete project.");
  }
}

/* =========================================================
   GMAIL ACCOUNTS
   Backend real endpoints:
   GET   /settings/gmail-accounts
   PATCH /subjects/projects/{project_id}/gmail-account
   ========================================================= */

export async function getGmailAccounts() {
  try {
    const response = await api.get("/settings/gmail-accounts");
    const data = extractData(response);

    return Array.isArray(data) ? data : [];
  } catch (error) {
    raiseApiError(error, "Could not load Gmail accounts.");
  }
}

export async function assignGmailAccountToProject(projectId, gmailAccountId) {
  try {
    const response = await api.patch(
      `/subjects/projects/${projectId}/gmail-account`,
      {
        gmail_account_id: normalizeGmailAccountId(gmailAccountId),
      }
    );

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not assign Gmail account to project.");
  }
}

/* =========================================================
   PROFESSOR DASHBOARD
   ========================================================= */

export async function getProfessorDashboardEnrollments() {
  try {
    const response = await api.get("/professor/dashboard/enrollments");
    const data = extractData(response);

    return Array.isArray(data) ? data : [];
  } catch (error) {
    raiseApiError(error, "Could not load professor dashboard.");
  }
}