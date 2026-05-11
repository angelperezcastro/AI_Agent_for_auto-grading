import { useEffect, useMemo, useRef, useState } from "react";
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
const OAUTH_POPUP_CHECK_INTERVAL_MS = 700;
const OAUTH_TOAST_VISIBLE_MS = 5200;

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

function getAccountById(gmailAccounts, rawId) {
  if (rawId === null || rawId === undefined || rawId === "") {
    return null;
  }

  return gmailAccounts.find((account) => Number(account.id) === Number(rawId));
}

function findConnectedAccountAfterOAuth(previousAccounts, nextAccounts, startedAt) {
  const previousByEmail = new Map(
    previousAccounts
      .filter((account) => account?.account_email)
      .map((account) => [account.account_email, account])
  );

  const startedAtMs = startedAt instanceof Date ? startedAt.getTime() : 0;

  const newAccount = nextAccounts.find((account) => {
    return account?.account_email && !previousByEmail.has(account.account_email);
  });

  if (newAccount) {
    return newAccount;
  }

  const recentlyCreatedAccount = nextAccounts.find((account) => {
    if (!account?.created_at) return false;

    const createdAt = new Date(account.created_at).getTime();

    if (Number.isNaN(createdAt)) return false;

    return createdAt >= startedAtMs - 2000;
  });

  if (recentlyCreatedAccount) {
    return recentlyCreatedAccount;
  }

  const reconnectedAccount = nextAccounts.find((account) => {
    if (!account?.account_email) return false;

    const previousAccount = previousByEmail.get(account.account_email);

    if (!previousAccount) return false;

    const previousStatus = getGmailAccountStatus(previousAccount);
    const nextStatus = getGmailAccountStatus(account);

    return previousStatus !== "connected" && nextStatus === "connected";
  });

  if (reconnectedAccount) {
    return reconnectedAccount;
  }

  return null;
}

function OAuthConnectionToast({ toast, onDismiss }) {
  if (!toast) return null;

  const isSuccess = toast.type === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-md motion-safe:animate-[gmailToastIn_240ms_ease-out]"
    >
      <style>
        {`
          @keyframes gmailToastIn {
            from {
              opacity: 0;
              transform: translateY(-10px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes gmailCheckPop {
            0% {
              opacity: 0;
              transform: scale(0.75);
            }
            70% {
              opacity: 1;
              transform: scale(1.12);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>

      <div
        className={[
          "overflow-hidden rounded-3xl border bg-white p-4 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5",
          isSuccess ? "border-emerald-200" : "border-amber-200",
        ].join(" ")}
      >
        <div className="flex gap-4">
          <div
            className={[
              "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              isSuccess
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700",
            ].join(" ")}
          >
            {isSuccess && (
              <span
                aria-hidden="true"
                className="absolute inline-flex h-10 w-10 rounded-full bg-emerald-400 opacity-20 motion-safe:animate-ping motion-reduce:animate-none"
              />
            )}

            {isSuccess ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative h-6 w-6 motion-safe:animate-[gmailCheckPop_280ms_ease-out]"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={[
                "text-sm font-black",
                isSuccess ? "text-emerald-900" : "text-amber-900",
              ].join(" ")}
            >
              {toast.message}
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              {isSuccess
                ? "The account list has been refreshed and the account is ready to use."
                : "No Gmail account was connected. You can start the connection again."}
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            ×
          </button>
        </div>
      </div>
    </div>
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
          ? "border-cyan-300 ring-4 ring-cyan-100 motion-safe:animate-pulse motion-reduce:animate-none"
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

function AssignmentArrow() {
  return (
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </div>
  );
}

function AssignedAccountPanel({ account }) {
  if (!account) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-800"
          >
            !
          </span>

          <div>
            <p className="text-sm font-black text-amber-900">
              No Gmail account assigned
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              Emails may not be sent from this subject or project until a Gmail
              account is selected.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const accountStatus = getGmailAccountStatus(account);
  const badgeProps = getStatusBadgeProps(accountStatus);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={[
                "h-2.5 w-2.5 shrink-0 rounded-full shadow-lg",
                getConnectionDotClass(accountStatus),
              ].join(" ")}
            />

            <p className="truncate text-sm font-black text-emerald-950">
              {account.account_email}
            </p>
          </div>

          <p className="mt-1 text-xs leading-5 text-emerald-800">
            This Gmail account will be used for email notifications.
          </p>
        </div>

        <StatusBadge
          status={badgeProps.status}
          label={badgeProps.label}
          size="sm"
        />
      </div>
    </div>
  );
}

function AccountSelect({
  value,
  gmailAccounts,
  disabled,
  onChange,
  label,
  allowEmpty = true,
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>

      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition hover:border-slate-300 focus:border-slate-900 focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {allowEmpty && <option value="">No Gmail account assigned</option>}

        {gmailAccounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.account_email}
          </option>
        ))}
      </select>
    </label>
  );
}

function AssignmentRow({
  type,
  title,
  subtitle,
  assignedAccount,
  selectedValue,
  gmailAccounts,
  disabled,
  onChange,
}) {
  const isSubject = type === "subject";

  return (
    <article
      className={[
        "rounded-3xl border bg-white p-5 shadow-sm transition duration-200",
        assignedAccount
          ? "border-slate-200 hover:border-cyan-200 hover:shadow-md"
          : "border-amber-200 ring-1 ring-amber-100",
      ].join(" ")}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)] lg:items-center">
        <div className="min-w-0">
          <p
            className={[
              "text-xs font-black uppercase tracking-[0.18em]",
              isSubject ? "text-cyan-700" : "text-slate-400",
            ].join(" ")}
          >
            {isSubject ? "Subject" : "Project"}
          </p>

          <h3 className="mt-1 truncate text-base font-black text-slate-900">
            {title}
          </h3>

          {subtitle && (
            <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
          )}
        </div>

        <AssignmentArrow />

        <div className="min-w-0 space-y-3">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Gmail Account
            </p>

            <AssignedAccountPanel account={assignedAccount} />
          </div>

          <AccountSelect
            value={selectedValue}
            gmailAccounts={gmailAccounts}
            disabled={disabled}
            onChange={onChange}
            label={`Change Gmail account for ${title}`}
          />
        </div>
      </div>
    </article>
  );
}

function GmailAssignmentsSection({
  subjects,
  gmailAccounts,
  accountsBySubjectId,
  actionLoading,
  onAssignSubjectDefault,
  onAssignProject,
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
              Sender routing
            </p>

            <h2 className="mt-2 text-xl font-black text-slate-900">
              Gmail Account Assignments
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Choose which Gmail account sends emails for each subject and
              project. A connected account means student confirmations,
              professor notifications and feedback emails can be sent.
            </p>
          </div>

          <div className="w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
            {gmailAccounts.length} Gmail{" "}
            {gmailAccounts.length === 1 ? "account" : "accounts"} available
          </div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="p-10 text-center">
          <h3 className="text-lg font-black text-slate-900">
            No subjects available
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Create a subject before assigning Gmail accounts.
          </p>
        </div>
      ) : (
        <div className="space-y-6 bg-slate-50/70 p-4 md:p-6">
          {subjects.map((subject) => {
            const subjectDefault =
              accountsBySubjectId?.get?.(Number(subject.id)) || null;

            return (
              <section
                key={subject.id}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
              >
                <div className="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                      Subject group
                    </p>

                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      {subject.name}
                    </h3>
                  </div>

                  <p className="text-sm font-semibold text-slate-500">
                    {(subject.projects || []).length}{" "}
                    {(subject.projects || []).length === 1
                      ? "project"
                      : "projects"}
                  </p>
                </div>

                <div className="space-y-4">
                  <AssignmentRow
                    type="subject"
                    title={subject.name}
                    subtitle="Default sender for this subject."
                    assignedAccount={subjectDefault}
                    selectedValue={subjectDefault?.id || ""}
                    gmailAccounts={gmailAccounts}
                    disabled={actionLoading || gmailAccounts.length === 0}
                    onChange={(value) =>
                      onAssignSubjectDefault(subject.id, value)
                    }
                  />

                  {(subject.projects || []).length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                      <p className="text-sm font-semibold text-slate-500">
                        No projects in this subject.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(subject.projects || []).map((project) => {
                        const projectAccountId =
                          getProjectGmailAccountId(project);
                        const projectAccount = getAccountById(
                          gmailAccounts,
                          projectAccountId
                        );

                        return (
                          <AssignmentRow
                            key={project.id}
                            type="project"
                            title={project.name}
                            subtitle={project.topic}
                            assignedAccount={projectAccount}
                            selectedValue={projectAccount?.id || ""}
                            gmailAccounts={gmailAccounts}
                            disabled={
                              actionLoading || gmailAccounts.length === 0
                            }
                            onChange={(value) => onAssignProject(project, value)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testingAccountId, setTestingAccountId] = useState(null);
  const [oauthConnecting, setOauthConnecting] = useState(false);

  const [recentlyConnectedEmail, setRecentlyConnectedEmail] = useState("");
  const [oauthToast, setOauthToast] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const oauthPopupRef = useRef(null);
  const oauthMonitorRef = useRef(null);
  const oauthToastTimerRef = useRef(null);
  const oauthCompletedRef = useRef(false);
  const oauthStartedAtRef = useRef(null);
  const oauthPreviousAccountsRef = useRef([]);

  const accountsBySubjectId = useMemo(() => {
    const map = new Map();

    gmailAccounts.forEach((account) => {
      if (account.subject_id !== null && account.subject_id !== undefined) {
        map.set(Number(account.subject_id), account);
      }
    });

    return map;
  }, [gmailAccounts]);

  function clearOAuthMonitor() {
    if (oauthMonitorRef.current) {
      window.clearInterval(oauthMonitorRef.current);
      oauthMonitorRef.current = null;
    }
  }

  function showOAuthToast(type, message) {
    if (oauthToastTimerRef.current) {
      window.clearTimeout(oauthToastTimerRef.current);
      oauthToastTimerRef.current = null;
    }

    setOauthToast({
      id: Date.now(),
      type,
      message,
    });

    oauthToastTimerRef.current = window.setTimeout(() => {
      setOauthToast(null);
      oauthToastTimerRef.current = null;
    }, OAUTH_TOAST_VISIBLE_MS);
  }

  function markRecentlyConnected(email) {
    setRecentlyConnectedEmail(email || "");

    window.setTimeout(() => {
      setRecentlyConnectedEmail("");
    }, RECENTLY_CONNECTED_HIGHLIGHT_MS);
  }

  async function loadSettings() {
    setError("");

    try {
      const [accountsData, subjectsData] = await Promise.all([
        getGmailAccounts(),
        getSubjectsWithProjects(),
      ]);

      const safeAccounts = Array.isArray(accountsData) ? accountsData : [];
      const safeSubjects = Array.isArray(subjectsData) ? subjectsData : [];

      setGmailAccounts(safeAccounts);
      setSubjects(safeSubjects);

      return {
        accounts: safeAccounts,
        subjects: safeSubjects,
      };
    } catch (err) {
      setError(err.message || "Could not load settings.");

      return {
        accounts: null,
        subjects: null,
      };
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

      oauthCompletedRef.current = true;
      clearOAuthMonitor();
      setOauthConnecting(false);

      if (data.success) {
        setSuccess("Gmail account connected successfully");
        showOAuthToast("success", "Gmail account connected successfully");
        markRecentlyConnected(data.account_email || "");

        loadSettings();
      } else {
        setError(
          data.message ||
            "Gmail connection was not completed. Please try connecting the account again."
        );
        showOAuthToast("warning", "Gmail connection was not completed");
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearOAuthMonitor();

      if (oauthToastTimerRef.current) {
        window.clearTimeout(oauthToastTimerRef.current);
      }
    };
  }, []);

  function startOAuthPopupMonitor() {
    clearOAuthMonitor();

    oauthMonitorRef.current = window.setInterval(async () => {
      const popup = oauthPopupRef.current;

      if (!popup || !popup.closed) {
        return;
      }

      clearOAuthMonitor();
      setOauthConnecting(false);

      if (oauthCompletedRef.current) {
        return;
      }

      const { accounts } = await loadSettings();

      const connectedAccount = findConnectedAccountAfterOAuth(
        oauthPreviousAccountsRef.current,
        accounts || [],
        oauthStartedAtRef.current
      );

      if (connectedAccount) {
        oauthCompletedRef.current = true;
        setSuccess("Gmail account connected successfully");
        showOAuthToast("success", "Gmail account connected successfully");
        markRecentlyConnected(connectedAccount.account_email || "");
        return;
      }

      setError("Gmail connection was not completed.");
      showOAuthToast("warning", "Gmail connection was not completed");
    }, OAUTH_POPUP_CHECK_INTERVAL_MS);
  }

  async function handleConnectGmail() {
    setActionLoading(true);
    setOauthConnecting(true);
    setError("");
    setSuccess("");
    setOauthToast(null);

    oauthCompletedRef.current = false;
    oauthStartedAtRef.current = new Date();
    oauthPreviousAccountsRef.current = gmailAccounts;

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

      oauthPopupRef.current = popup;
      startOAuthPopupMonitor();

      setSuccess(
        "Gmail authorization window opened. Complete the Google step in the popup."
      );
    } catch (err) {
      setOauthConnecting(false);
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
      <OAuthConnectionToast
        toast={oauthToast}
        onDismiss={() => setOauthToast(null)}
      />

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
            disabled={actionLoading || oauthConnecting}
            className="rounded-2xl bg-white px-6 py-3 text-sm font-black text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {oauthConnecting
              ? "Waiting for Gmail..."
              : actionLoading
                ? "Opening..."
                : "Connect New Gmail Account"}
          </button>
        </div>
      </section>

      {oauthConnecting && (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-sm font-semibold text-cyan-800">
          Gmail authorization is in progress. Complete the Google popup to finish
          the connection.
        </div>
      )}

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
                  Boolean(recentlyConnectedEmail) &&
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

      <GmailAssignmentsSection
        subjects={subjects}
        gmailAccounts={gmailAccounts}
        accountsBySubjectId={accountsBySubjectId}
        actionLoading={actionLoading}
        onAssignSubjectDefault={handleAssignSubjectDefault}
        onAssignProject={handleAssignProject}
      />
    </div>
  );
}