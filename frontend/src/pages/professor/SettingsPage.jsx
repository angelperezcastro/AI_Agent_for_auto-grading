import { useEffect, useMemo, useState } from "react";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  assignGmailAccountToProject,
  disconnectGmailAccount,
  getGmailAccounts,
  getGmailAuthorizationUrl,
  getSubjectsWithProjects,
  sendTestEmail,
  setDefaultGmailAccountForSubject,
} from "../../services/professorWeek5Api";

const RECENTLY_CONNECTED_HIGHLIGHT_MS = 4200;

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

function getGmailAccountStatus(account) {
  const rawStatus = String(
    account?.status ||
      account?.connection_status ||
      account?.gmail_status ||
      ""
  )
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (["connected", "expired", "inactive", "error"].includes(rawStatus)) {
    return rawStatus;
  }

  if (
    account?.email_error ||
    account?.last_error ||
    account?.error ||
    account?.connection_error
  ) {
    return "error";
  }

  if (
    account?.is_expired ||
    account?.token_expired ||
    account?.credentials_expired ||
    account?.needs_reauth
  ) {
    return "expired";
  }

  if (account?.is_active === false) {
    return "inactive";
  }

  return "connected";
}

function getStatusBadgeProps(status) {
  const map = {
    connected: {
      status: "gmail_connected",
      label: "Connected",
    },
    expired: {
      status: "gmail_expired",
      label: "Expired",
    },
    inactive: {
      status: "locked",
      label: "Inactive",
    },
    error: {
      status: "email_failed",
      label: "Error",
    },
  };

  return map[status] || map.connected;
}

function getStatusHelpText(status) {
  const map = {
    connected:
      "This Gmail account is ready to send notifications for your subjects and projects.",
    expired:
      "This account needs to be connected again before it can reliably send emails.",
    inactive:
      "This account is currently disabled and should not be used for active projects.",
    error:
      "There is a problem with this account. Try sending a test email or reconnect it.",
  };

  return map[status] || map.connected;
}

function getConnectionDotClass(status) {
  const map = {
    connected: "bg-emerald-500 shadow-emerald-500/40",
    expired: "bg-amber-500 shadow-amber-500/40",
    inactive: "bg-slate-400 shadow-slate-400/30",
    error: "bg-red-500 shadow-red-500/40",
  };

  return map[status] || map.connected;
}

function getAccountErrorMessage(account) {
  return (
    account?.email_error ||
    account?.last_error ||
    account?.error ||
    account?.connection_error ||
    ""
  );
}

function GmailAccountCard({
  account,
  isHighlighted,
  actionLoading,
  testingAccountId,
  onSendTestEmail,
  onDisconnect,
}) {
  const status = getGmailAccountStatus(account);
  const badgeProps = getStatusBadgeProps(status);
  const errorMessage = getAccountErrorMessage(account);
  const canSendTestEmail = status === "connected" && account.is_active !== false;
  const isTesting = testingAccountId === account.id;

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition duration-300",
        "hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md",
        "focus-within:ring-4 focus-within:ring-cyan-100",
        isHighlighted
          ? "border-cyan-300 ring-4 ring-cyan-100 motion-safe:animate-pulse"
          : "border-slate-200",
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className={[
          "absolute left-0 top-0 h-full w-1",
          status === "connected"
            ? "bg-emerald-500"
            : status === "expired"
              ? "bg-amber-500"
              : status === "error"
                ? "bg-red-500"
                : "bg-slate-300",
        ].join(" ")}
      />

      <div className="flex flex-col gap-5 pl-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              aria-label={`Connection status: ${badgeProps.label}`}
              className={[
                "inline-flex h-3 w-3 shrink-0 rounded-full shadow-lg",
                getConnectionDotClass(status),
              ].join(" ")}
            />

            <p className="truncate text-lg font-black text-slate-900">
              {account.account_email}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge
              status={badgeProps.status}
              label={badgeProps.label}
              size="sm"
            />

            {isHighlighted && (
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">
                Newly connected
              </span>
            )}
          </div>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            {getStatusHelpText(status)}
          </p>

          {errorMessage && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-black">Account warning</p>
              <p className="mt-1 leading-6">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => onSendTestEmail(account)}
            disabled={isTesting || actionLoading || !canSendTestEmail}
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isTesting ? "Sending..." : "Send Test Email"}
          </button>

          <button
            type="button"
            onClick={() => onDisconnect(account)}
            disabled={actionLoading || isTesting}
            className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-700 transition hover:-translate-y-0.5 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Connected
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {formatDate(account.created_at)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Subject default
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {account.subject_id ? `Subject #${account.subject_id}` : "None"}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Safe display
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            Credentials hidden
          </p>
        </div>
      </div>
    </article>
  );
}

export default function SettingsPage() {
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testingAccountId, setTestingAccountId] = useState(null);

  const [recentlyConnectedEmail, setRecentlyConnectedEmail] = useState("");
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

      setGmailAccounts(Array.isArray(accountsData) ? accountsData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
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

        setGmailAccounts(Array.isArray(accountsData) ? accountsData : []);
        setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
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
        setRecentlyConnectedEmail(data.account_email || "");

        loadSettings();

        window.setTimeout(() => {
          setRecentlyConnectedEmail("");
        }, RECENTLY_CONNECTED_HIGHLIGHT_MS);
      } else {
        setError(
          data.message ||
            "Gmail connection failed. Please try connecting the account again."
        );
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
      setError(
        err.message ||
          "Could not send the test email. Check that this Gmail account is still connected."
      );
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
            className="rounded-2xl bg-white px-6 py-3 text-sm font-black text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading ? "Opening..." : "Connect New Gmail Account"}
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
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
              Email sending
            </p>

            <h2 className="mt-2 text-xl font-black text-slate-900">
              Connected Gmail Accounts
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              These are the Gmail accounts available for sending student
              confirmations, professor notifications and feedback emails.
              Sensitive credentials and OAuth tokens are never displayed.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSettings}
            className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            Refresh
          </button>
        </div>

        {gmailAccounts.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h3 className="text-lg font-black text-slate-900">
              No Gmail accounts connected
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Connect your first Gmail account before assigning project senders.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {gmailAccounts.map((account) => (
              <GmailAccountCard
                key={account.id}
                account={account}
                isHighlighted={
                  recentlyConnectedEmail &&
                  account.account_email === recentlyConnectedEmail
                }
                actionLoading={actionLoading}
                testingAccountId={testingAccountId}
                onSendTestEmail={handleSendTestEmail}
                onDisconnect={handleDisconnect}
              />
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
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
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
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
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