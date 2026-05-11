import { formatDateTime } from "../../utils/dates";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function parseDeadline(deadlineAt) {
  if (!deadlineAt) {
    return null;
  }

  const date = new Date(deadlineAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getRelativeDeadlineLabel(deadline) {
  if (!deadline) {
    return "No deadline";
  }

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Overdue";
  }

  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }

  return `${hours}h left`;
}

function getDeadlineState(deadline, status) {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === "overdue") {
    return "overdue";
  }

  if (!deadline) {
    return "neutral";
  }

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "overdue";
  }

  if (diffMs <= FORTY_EIGHT_HOURS_MS) {
    return "soon";
  }

  return "neutral";
}

function getBadgeClassName(deadlineState) {
  if (deadlineState === "overdue") {
    return "border-red-200 bg-red-50 text-red-700 ring-red-100";
  }

  if (deadlineState === "soon") {
    return "border-amber-200 bg-amber-50 text-amber-800 ring-amber-100 motion-safe:animate-pulse motion-reduce:animate-none";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 ring-slate-100";
}

function getDotClassName(deadlineState) {
  if (deadlineState === "overdue") {
    return "bg-red-500";
  }

  if (deadlineState === "soon") {
    return "bg-amber-500";
  }

  return "bg-slate-400";
}

function getStateLabel(deadlineState) {
  if (deadlineState === "overdue") {
    return "Deadline overdue";
  }

  if (deadlineState === "soon") {
    return "Deadline soon";
  }

  return "Deadline on track";
}

export default function DeadlineBadge({
  deadline_at,
  deadlineAt,
  status,
  className = "",
  showAbsoluteDate = true,
}) {
  const resolvedDeadline = deadline_at ?? deadlineAt;
  const deadline = parseDeadline(resolvedDeadline);
  const deadlineState = getDeadlineState(deadline, status);
  const relativeLabel =
    deadlineState === "overdue" ? "Overdue" : getRelativeDeadlineLabel(deadline);
  const absoluteLabel = deadline ? formatDateTime(deadline) : null;
  const stateLabel = getStateLabel(deadlineState);

  return (
    <div
      aria-label={
        absoluteLabel
          ? `${stateLabel}. ${relativeLabel}. Due on ${absoluteLabel}.`
          : `${stateLabel}. ${relativeLabel}.`
      }
      title={absoluteLabel || relativeLabel}
      className={[
        "inline-flex max-w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold ring-1 transition",
        getBadgeClassName(deadlineState),
        className,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={["h-2.5 w-2.5 shrink-0 rounded-full", getDotClassName(deadlineState)].join(
          " "
        )}
      />

      <span className="min-w-0">
        <span className="block truncate">{relativeLabel}</span>

        {showAbsoluteDate && absoluteLabel && (
          <span className="mt-0.5 block truncate text-xs font-medium opacity-75">
            {absoluteLabel}
          </span>
        )}
      </span>
    </div>
  );
}