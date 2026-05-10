import { useEffect, useMemo, useState } from "react";
import {
  assignGmailAccountToProject,
  disconnectGmailAccount,
  getGmailAccounts,
  getGmailAuthorizationUrl,
  getSubjectsWithProjects,
  sendTestEmail,
  setDefaultGmailAccountForSubject,
} from "../../services/professorWeek5Api";

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

function getProjectGmailAccountId(project) {
  return (
    project?.gmail_account_id ??
    project?.gmailAccountId ??
    project?.gmail_account?.id ??
    project?.gmailAccount?.id ??
    null
  );
}

export default function SettingsPage() {
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testingAccountId, setTestingAccountId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const accountsBySubjectId = useMemo(() => {
    const map = new Map();

    gmailAccounts.forEach((account) => {
      if (account.subject_id !== null && account.subject_id !== undefined) {
        map.set(Number(account.subject_id), account);
      }
    });

    return map;
  }, [gmailAccounts]);

  async function loadSettings() {
    setError("");

    try {
      const [accountsData, subjectsData] = await Promise.all([
        getGmailAccounts(),
        getSubjectsWithProjects(),
      ]);

      setGmailAccounts(accountsData);
      setSubjects(subjectsData);
    } catch (err) {
      setError(err.message || "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const [accountsData, subjectsData] = await Promise.all([
          getGmailAccounts(),
          getSubjectsWithProjects(),
        ]);

        if (!active) return;

        setGmailAccounts(accountsData);
        setSubjects(subjectsData);
      } catch (err) {
        if (active) {
          setError(err.message || "Could not load settings.");
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
  }, []);

  useEffect(() => {
    function handleMessage(event) {
      const data = event.data;

      if (!data || data.type !== "GMAIL_CONNECTED") {
        return;
      }

      if (data.success) {
        setSuccess(`Gmail account connected: ${data.account_email}`);
        loadSettings();
      } else {
        setError(data.message || "Gmail connection failed.");
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  async function handleConnectGmail() {
    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const authorizationUrl = await getGmailAuthorizationUrl();

      const width = 720;
      const height = 760;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authorizationUrl,
        "gmail-oauth",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        throw new Error("Popup blocked. Allow popups and try again.");
      }

      setSuccess("Gmail authorization window opened.");
    } catch (err) {
      setError(err.message || "Could not open Gmail authorization.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisconnect(account) {
    const confirmed = window.confirm(
      `Disconnect ${account.account_email}? Projects using this account may show email warnings until reassigned.`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      await disconnectGmailAccount(account.id);
      setSuccess(`Disconnected ${account.account_email}.`);
      await loadSettings();
    } catch (err) {
      setError(err.message || "Could not disconnect Gmail account.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendTestEmail(account) {
    setTestingAccountId(account.id);
    setError("");
    setSuccess("");

    try {
      const result = await sendTestEmail(account.id);

      setSuccess(
        `Test email sent from ${result.gmail_account_used} to ${result.recipient_email}.`
      );
    } catch (err) {
      setError(err.message || "Could not send test email.");
    } finally {
      setTestingAccountId(null);
    }
  }

  async function handleAssignProject(project, rawValue) {
    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      await assignGmailAccountToProject(project.id, rawValue || null);
      setSuccess(`Gmail assignment updated for project "${project.name}".`);
      await loadSettings();
    } catch (err) {
      setError(err.message || "Could not assign Gmail account.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssignSubjectDefault(subjectId, rawValue) {
    if (!rawValue) {
      setError("Clearing a subject default is not supported by the current backend.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const selectedAccount = gmailAccounts.find(
        (account) => Number(account.id) === Number(rawValue)
      );

      await setDefaultGmailAccountForSubject(rawValue, subjectId);
      setSuccess(
        `Default Gmail account updated for subject: ${
          selectedAccount?.account_email || "selected account"
        }.`
      );
      await loadSettings();
    } catch (err) {
      setError(err.message || "Could not assign default Gmail account.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Loading Gmail settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Professor Settings
        </p>

        <div className="mt-2 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-black">Gmail Account Management</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Connect Gmail accounts, test them and assign them to subjects or
              projects.
            </p>
          </div>

          <button
            type="button"
            onClick={handleConnectGmail}
            disabled={actionLoading}
            className="rounded-2xl bg-white px-6 py-3 text-sm font-black text-slate-900 hover:bg-slate-100 disabled:opacity-60"
          >
            Connect New Gmail Account
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Connected Gmail Accounts
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Send a test email before assigning an account to a live project.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSettings}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>

        {gmailAccounts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <h3 className="text-lg font-black text-slate-900">
              No Gmail accounts connected
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Connect your first Gmail account before assigning project senders.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {gmailAccounts.map((account) => (
              <article
                key={account.id}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-slate-900">
                      {account.account_email}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Connected at {formatDate(account.created_at)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${
                      account.is_active
                        ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                        : "border-red-200 bg-red-100 text-red-700"
                    }`}
                  >
                    {account.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Subject default:{" "}
                    <span className="font-semibold text-slate-700">
                      {account.subject_id
                        ? `Subject #${account.subject_id}`
                        : "None"}
                    </span>
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSendTestEmail(account)}
                      disabled={
                        testingAccountId === account.id ||
                        actionLoading ||
                        !account.is_active
                      }
                      className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                    >
                      {testingAccountId === account.id
                        ? "Sending..."
                        : "Send Test Email"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDisconnect(account)}
                      disabled={actionLoading || testingAccountId === account.id}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-black text-slate-900">
            Account Assignments
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Assign a default Gmail account to each subject and a specific Gmail
            account to each project.
          </p>
        </div>

        {subjects.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No subjects available.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {subjects.map((subject) => {
              const subjectDefault = accountsBySubjectId.get(Number(subject.id));

              return (
                <div key={subject.id} className="p-6">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Subject
                      </p>
                      <h3 className="mt-1 text-xl font-black text-slate-900">
                        {subject.name}
                      </h3>
                    </div>

                    <select
                      value={subjectDefault?.id || ""}
                      onChange={(event) =>
                        handleAssignSubjectDefault(subject.id, event.target.value)
                      }
                      disabled={actionLoading || gmailAccounts.length === 0}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900 disabled:opacity-60"
                    >
                      <option value="">No subject default</option>

                      {gmailAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.account_email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                            Project
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                            Topic
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                            Gmail Account
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(subject.projects || []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-6 text-center text-sm text-slate-500"
                            >
                              No projects in this subject.
                            </td>
                          </tr>
                        ) : (
                          subject.projects.map((project) => (
                            <tr key={project.id}>
                              <td className="px-4 py-4 text-sm font-bold text-slate-900">
                                {project.name}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-500">
                                {project.topic}
                              </td>
                              <td className="px-4 py-4">
                                <select
                                  value={getProjectGmailAccountId(project) || ""}
                                  onChange={(event) =>
                                    handleAssignProject(project, event.target.value)
                                  }
                                  disabled={
                                    actionLoading || gmailAccounts.length === 0
                                  }
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900 disabled:opacity-60"
                                >
                                  <option value="">No project account</option>

                                  {gmailAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.account_email}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}