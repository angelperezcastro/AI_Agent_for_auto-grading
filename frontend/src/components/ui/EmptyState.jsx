import { Link } from "react-router-dom";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function DefaultIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9" />
      <path d="M3 15h18" />
      <path d="M7 19h10" />
      <path d="M9 11h6" />
    </svg>
  );
}

function renderIcon(icon) {
  if (!icon) {
    return <DefaultIcon className="h-7 w-7" />;
  }

  if (typeof icon === "string") {
    return (
      <span aria-hidden="true" className="text-3xl leading-none">
        {icon}
      </span>
    );
  }

  return icon;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  to,
  className = "",
  compact = false,
}) {
  const hasAction = Boolean(actionLabel && (onAction || to));

  const actionClasses =
    "inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-200";

  return (
    <div
      className={cx(
        "rounded-3xl border border-dashed border-slate-300 bg-white text-center shadow-sm",
        compact ? "p-6" : "p-8 md:p-10",
        className
      )}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-slate-700 shadow-sm">
        {renderIcon(icon)}
      </div>

      <h3 className="mt-5 text-lg font-black text-slate-900">{title}</h3>

      {description && (
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}

      {hasAction && (
        <div className="mt-6">
          {to ? (
            <Link to={to} className={actionClasses}>
              {actionLabel}
            </Link>
          ) : (
            <button type="button" onClick={onAction} className={actionClasses}>
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}