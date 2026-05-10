import { api, getApiErrorMessage } from "./api";

function extractData(response) {
  return response?.data ?? response;
}

function normalizeNullableId(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function raiseApiError(error, fallbackMessage) {
  const message = getApiErrorMessage(error) || fallbackMessage;
  const finalError = new Error(message);
  finalError.originalError = error;
  throw finalError;
}

/* =========================================================
   STUDENT DETAIL
   ========================================================= */

export async function getProfessorEnrollmentDetail(enrollmentId) {
  try {
    const response = await api.get(
      `/professor/enrollments/${enrollmentId}/detail`
    );

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not load student detail.");
  }
}

export async function overrideEvaluation(evaluationId, payload) {
  try {
    const response = await api.patch(`/evaluations/${evaluationId}/override`, {
      override_score: Number(payload.override_score),
      override_comment: payload.override_comment,
    });

    return extractData(response);
  } catch {
    try {
      const response = await api.post(`/evaluations/${evaluationId}/override`, {
        override_score: Number(payload.override_score),
        override_comment: payload.override_comment,
      });

      return extractData(response);
    } catch (postError) {
      raiseApiError(postError, "Could not override evaluation.");
    }
  }
}

/* =========================================================
   SETTINGS / GMAIL
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

export async function disconnectGmailAccount(gmailAccountId) {
  try {
    const response = await api.delete(
      `/settings/gmail-accounts/${gmailAccountId}`
    );

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not disconnect Gmail account.");
  }
}

export async function sendTestEmail(gmailAccountId) {
  try {
    const response = await api.post(
      `/settings/gmail-accounts/${gmailAccountId}/test`
    );

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not send test email.");
  }
}

export async function getGmailAuthorizationUrl() {
  try {
    const response = await api.get("/auth/gmail/authorize", {
      params: {
        return_url: true,
      },
    });

    const data = extractData(response);

    if (!data.authorization_url) {
      throw new Error("Backend did not return an authorization URL.");
    }

    return data.authorization_url;
  } catch (error) {
    raiseApiError(error, "Could not start Gmail authorization.");
  }
}

export async function getSubjectsWithProjects() {
  try {
    const subjectsResponse = await api.get("/subjects");
    const subjects = Array.isArray(subjectsResponse.data)
      ? subjectsResponse.data
      : [];

    const subjectsWithProjects = await Promise.all(
      subjects.map(async (subject) => {
        const projectsResponse = await api.get(
          `/subjects/${subject.id}/projects`
        );

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
  } catch (error) {
    raiseApiError(error, "Could not load subject/project assignments.");
  }
}

export async function assignGmailAccountToProject(projectId, gmailAccountId) {
  try {
    const response = await api.patch(
      `/subjects/projects/${projectId}/gmail-account`,
      {
        gmail_account_id: normalizeNullableId(gmailAccountId),
      }
    );

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not assign Gmail account to project.");
  }
}

export async function setDefaultGmailAccountForSubject(
  gmailAccountId,
  subjectId
) {
  try {
    const response = await api.post(
      `/settings/gmail-accounts/${gmailAccountId}/set-default`,
      {
        subject_id: Number(subjectId),
      }
    );

    return extractData(response);
  } catch (error) {
    raiseApiError(error, "Could not assign default Gmail account to subject.");
  }
}