function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function SkeletonBlock({
  className = "",
  rounded = "rounded-xl",
}) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "bg-slate-100 motion-safe:animate-pulse motion-reduce:animate-none",
        rounded,
        className
      )}
    />
  );
}

export function CardSkeleton({ className = "", dense = false }) {
  return (
    <div
      role="status"
      aria-label="Loading card"
      className={cx(
        "rounded-3xl border border-slate-200 bg-white shadow-sm",
        dense ? "p-5" : "p-6",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="mt-3 h-6 w-3/4" />
          <SkeletonBlock className="mt-3 h-4 w-1/2" />
        </div>

        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </div>

      <SkeletonBlock className="mt-7 h-3 w-full rounded-full" />
      <SkeletonBlock className="mt-3 h-3 w-5/6 rounded-full" />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="mt-3 h-8 w-24 rounded-full" />
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-3 h-8 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 6,
  className = "",
}) {
  return (
    <div
      role="status"
      aria-label="Loading table"
      className={cx(
        "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      <div className="border-b border-slate-200 px-6 py-5">
        <SkeletonBlock className="h-5 w-48" />
        <SkeletonBlock className="mt-3 h-4 w-72" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-6 py-4">
                  <SkeletonBlock className="h-3 w-24" />
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, columnIndex) => (
                  <td key={columnIndex} className="px-6 py-5">
                    <SkeletonBlock
                      className={cx(
                        "h-4",
                        columnIndex === 0 || columnIndex === 1
                          ? "w-40"
                          : "w-24"
                      )}
                    />
                    {(columnIndex === 0 || columnIndex === 1) && (
                      <SkeletonBlock className="mt-2 h-3 w-28" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WorkspaceTimelineSkeleton({ steps = 4, className = "" }) {
  return (
    <section
      role="status"
      aria-label="Loading workspace timeline"
      className={cx(
        "rounded-3xl border border-slate-200 bg-slate-100/70 p-4 shadow-sm md:p-6",
        className
      )}
    >
      <div className="mb-6 flex flex-col gap-3 px-1 md:flex-row md:items-center md:justify-between">
        <div>
          <SkeletonBlock className="h-3 w-36" />
          <SkeletonBlock className="mt-3 h-6 w-56" />
          <SkeletonBlock className="mt-3 h-4 w-72" />
        </div>

        <SkeletonBlock className="h-9 w-48 rounded-full" />
      </div>

      <ol className="space-y-6">
        {Array.from({ length: steps }).map((_, index) => (
          <li key={index} className="flex gap-4 md:gap-5">
            <div className="flex flex-col items-center">
              <SkeletonBlock className="h-12 w-12 rounded-2xl md:h-14 md:w-14" />
              {index < steps - 1 && (
                <SkeletonBlock className="mt-3 h-24 w-1 rounded-full" />
              )}
            </div>

            <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <SkeletonBlock className="h-3 w-28" />
                  <SkeletonBlock className="mt-3 h-6 w-64" />
                  <SkeletonBlock className="mt-4 h-4 w-full" />
                  <SkeletonBlock className="mt-2 h-4 w-5/6" />
                </div>

                <SkeletonBlock className="h-16 w-16 rounded-full" />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <SkeletonBlock className="h-20 rounded-2xl" />
                <SkeletonBlock className="h-20 rounded-2xl" />
                <SkeletonBlock className="h-20 rounded-2xl" />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FeedbackSkeleton({ className = "" }) {
  return (
    <div
      role="status"
      aria-label="Loading feedback"
      className={cx(
        "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="mt-3 h-7 w-56" />
        </div>

        <SkeletonBlock className="h-14 w-14 rounded-full" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <SkeletonBlock className="h-24 rounded-2xl" />
        <SkeletonBlock className="h-24 rounded-2xl" />
      </div>

      <SkeletonBlock className="mt-6 h-4 w-full" />
      <SkeletonBlock className="mt-3 h-4 w-11/12" />
      <SkeletonBlock className="mt-3 h-4 w-10/12" />
      <SkeletonBlock className="mt-3 h-4 w-8/12" />
    </div>
  );
}

export function GmailAccountSkeleton({ className = "" }) {
  return (
    <article
      role="status"
      aria-label="Loading Gmail account"
      className={cx(
        "relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <SkeletonBlock className="absolute left-0 top-0 h-full w-1 rounded-none" />

      <div className="flex flex-col gap-5 pl-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-3 w-3 rounded-full" />
            <SkeletonBlock className="h-6 w-64" />
          </div>

          <div className="mt-3 flex gap-2">
            <SkeletonBlock className="h-7 w-24 rounded-full" />
            <SkeletonBlock className="h-7 w-28 rounded-full" />
          </div>

          <SkeletonBlock className="mt-4 h-4 w-full" />
          <SkeletonBlock className="mt-2 h-4 w-4/5" />
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <SkeletonBlock className="h-10 w-36 rounded-2xl" />
          <SkeletonBlock className="h-10 w-28 rounded-2xl" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
        <SkeletonBlock className="h-20 rounded-2xl" />
        <SkeletonBlock className="h-20 rounded-2xl" />
        <SkeletonBlock className="h-20 rounded-2xl" />
      </div>
    </article>
  );
}
