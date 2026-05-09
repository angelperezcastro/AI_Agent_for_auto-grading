export default function StatusBadge({ status }) {
  const normalizedStatus = String(status || "").toLowerCase();

  const styles =
    normalizedStatus === "overdue"
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-emerald-100 text-emerald-700 border-emerald-200";

  const label = normalizedStatus === "overdue" ? "Overdue" : "Active";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}
    >
      {label}
    </span>
  );
}