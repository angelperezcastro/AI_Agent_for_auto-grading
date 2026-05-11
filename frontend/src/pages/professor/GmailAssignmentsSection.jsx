import StatusBadge from "../../../components/ui/StatusBadge";

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

function getAccountById(gmailAccounts, rawId) {
  if (rawId === null || rawId === undefined || rawId === "") {
    return null;
  }

  return gmailAccounts.find(
    (account) => Number(account.id) === Number(rawId)
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
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40"
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
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
              {subtitle}
            </p>
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

export default function GmailAssignmentsSection({
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
                            selectedValue={projectAccountId || ""}
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