export default function EmailStatusBadge({ failed, text }) {
  if (failed) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
        <span>⚠</span>
        {text || "Email issue"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
      <span>✓</span>
      {text || "Emails OK"}
    </span>
  );
}