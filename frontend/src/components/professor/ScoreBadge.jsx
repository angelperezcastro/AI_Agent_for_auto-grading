export default function ScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
        Pending
      </span>
    );
  }

  const numericScore = Number(score);

  let styles = "bg-red-100 text-red-700 border-red-200";

  if (numericScore >= 80) {
    styles = "bg-emerald-100 text-emerald-700 border-emerald-200";
  } else if (numericScore >= 50) {
    styles = "bg-amber-100 text-amber-700 border-amber-200";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${styles}`}
    >
      {numericScore}/100
    </span>
  );
}