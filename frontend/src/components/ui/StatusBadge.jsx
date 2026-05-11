const STATUS_ALIASES = {
  graded: "evaluated",
  done: "evaluated",
  completed: "completed",

  evaluating: "pending",
  ai_evaluating: "pending",
  in_progress: "pending",

  email_error: "email_failed",
  email_issue: "email_failed",
  email_delivery_failed: "email_failed",

  override: "override_applied",
  overridden: "override_applied",

  gmail_ok: "gmail_connected",
  gmail_active: "gmail_connected",
  gmail_valid: "gmail_connected",

  gmail_disconnected: "gmail_expired",
  gmail_invalid: "gmail_expired",

  ready: "open",
};

const STATUS_CONFIG = {
  evaluated: {
    label: "Evaluated",
    icon: CheckIcon,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 ring-emerald-600/10",
  },
  completed: {
    label: "Completed",
    icon: CheckIcon,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 ring-emerald-600/10",
  },
  submitted: {
    label: "Submitted",
    icon: SendIcon,
    className: "border-sky-200 bg-sky-50 text-sky-800 ring-sky-600/10",
  },
  pending: {
    label: "Pending",
    icon: PendingDot,
    className:
      "border-amber-200 bg-amber-50 text-amber-900 ring-amber-600/10",
  },
  overdue: {
    label: "Overdue",
    icon: AlertTriangleIcon,
    className: "border-red-300 bg-red-50 text-red-800 ring-red-600/10",
  },
  email_failed: {
    label: "Email failed",
    icon: MailWarningIcon,
    className:
      "border-orange-300 bg-orange-50 text-orange-900 ring-orange-600/10",
  },
  email_ok: {
    label: "Emails OK",
    icon: MailCheckIcon,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 ring-emerald-600/10",
  },
  override_applied: {
    label: "Override applied",
    icon: OverrideIcon,
    className:
      "border-violet-200 bg-violet-50 text-violet-800 ring-violet-600/10",
  },
  gmail_connected: {
    label: "Gmail connected",
    icon: MailCheckIcon,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 ring-emerald-600/10",
  },
  gmail_expired: {
    label: "Gmail expired",
    icon: AlertTriangleIcon,
    className:
      "border-amber-300 bg-amber-50 text-amber-900 ring-amber-600/10",
  },
  locked: {
    label: "Locked",
    icon: LockIcon,
    className: "border-slate-200 bg-slate-100 text-slate-600 ring-slate-500/10",
  },
  active: {
    label: "Active",
    icon: ActivityIcon,
    className: "border-cyan-200 bg-cyan-50 text-cyan-800 ring-cyan-600/10",
  },
  open: {
    label: "Ready",
    icon: SparkIcon,
    className: "border-cyan-200 bg-cyan-50 text-cyan-800 ring-cyan-600/10",
  },
  dropped: {
    label: "Dropped",
    icon: MinusCircleIcon,
    className: "border-slate-200 bg-slate-100 text-slate-600 ring-slate-500/10",
  },
  unknown: {
    label: "Unknown",
    icon: InfoIcon,
    className: "border-slate-200 bg-white text-slate-600 ring-slate-500/10",
  },
};

const SIZE_CLASSES = {
  sm: "px-2.5 py-1 text-xs gap-1.5",
  md: "px-3 py-1.5 text-sm gap-2",
  lg: "px-4 py-2 text-sm gap-2",
};

const ICON_SIZE_CLASSES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizeStatus(status) {
  const rawStatus = String(status || "unknown")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  return STATUS_ALIASES[rawStatus] || rawStatus;
}

function humanizeStatus(status) {
  return String(status || "Unknown")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StatusBadge({
  status,
  label,
  size = "sm",
  showIcon = true,
  className = "",
  title,
}) {
  const normalizedStatus = normalizeStatus(status);
  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.unknown;
  const Icon = config.icon;
  const resolvedLabel = label || config.label || humanizeStatus(status);
  const resolvedSize = SIZE_CLASSES[size] ? size : "sm";

  return (
    <span
      title={title || resolvedLabel}
      aria-label={`Status: ${resolvedLabel}`}
      className={cx(
        "inline-flex w-fit shrink-0 items-center rounded-full border font-black leading-none ring-1 ring-inset",
        "transition-colors duration-200",
        SIZE_CLASSES[resolvedSize],
        config.className,
        className
      )}
    >
      {showIcon && Icon && (
        <Icon
          aria-hidden="true"
          className={ICON_SIZE_CLASSES[resolvedSize]}
        />
      )}

      <span>{resolvedLabel}</span>
    </span>
  );
}

function SvgIcon({ className, children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

function CheckIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </SvgIcon>
  );
}

function SendIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </SvgIcon>
  );
}

function AlertTriangleIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </SvgIcon>
  );
}

function MailWarningIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 6h16a2 2 0 0 1 2 2v3.5" />
      <path d="M22 8 12 14 2 8" />
      <path d="M2 8v8a2 2 0 0 0 2 2h9" />
      <path d="M18 14v3" />
      <path d="M18 21h.01" />
    </SvgIcon>
  );
}

function MailCheckIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 6h16a2 2 0 0 1 2 2v4" />
      <path d="M22 8 12 14 2 8" />
      <path d="M2 8v8a2 2 0 0 0 2 2h9" />
      <path d="m16 19 2 2 4-5" />
    </SvgIcon>
  );
}

function OverrideIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </SvgIcon>
  );
}

function LockIcon(props) {
  return (
    <SvgIcon {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </SvgIcon>
  );
}

function ActivityIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M22 12h-4l-3 8L9 4l-3 8H2" />
    </SvgIcon>
  );
}

function SparkIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M13 2 4 14h7l-1 8 10-13h-7Z" />
    </SvgIcon>
  );
}

function MinusCircleIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </SvgIcon>
  );
}

function InfoIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </SvgIcon>
  );
}

function PendingDot({ className = "", ...props }) {
  return (
    <span
      {...props}
      className={cx("relative inline-flex", className)}
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-30 motion-safe:animate-ping motion-reduce:animate-none" />
      <span className="relative inline-flex h-full w-full rounded-full bg-current" />
    </span>
  );
}