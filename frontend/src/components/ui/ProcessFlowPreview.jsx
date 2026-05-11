const PROCESS_STEPS = [
  {
    label: "Submit",
    description: "Student sends a deliverable.",
    icon: "submit",
    delayClass: "process-flow-delay-0",
  },
  {
    label: "AI Review",
    description: "Rubric-based evaluation starts.",
    icon: "ai",
    delayClass: "process-flow-delay-1",
  },
  {
    label: "Feedback",
    description: "Score and feedback are generated.",
    icon: "feedback",
    delayClass: "process-flow-delay-2",
  },
  {
    label: "Professor Override",
    description: "Professor can adjust the score.",
    icon: "override",
    delayClass: "process-flow-delay-3",
  },
];

function ProcessIcon({ type }) {
  if (type === "submit") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </svg>
    );
  }

  if (type === "ai") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M12 8V4" />
        <rect x="5" y="8" width="14" height="12" rx="3" />
        <path d="M9 13h.01" />
        <path d="M15 13h.01" />
        <path d="M10 17h4" />
      </svg>
    );
  }

  if (type === "feedback") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.2 2.2 4.8-5.2" />
    </svg>
  );
}

function ProcessStep({ step, index }) {
  return (
    <li className="relative z-10 flex gap-4 md:flex-1 md:flex-col md:items-center md:gap-3">
      <div
        className={`process-flow-node ${step.delayClass} flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-slate-950/80 text-cyan-100 shadow-lg shadow-cyan-950/30 backdrop-blur-md`}
      >
        <ProcessIcon type={step.icon} />
      </div>

      <div className="min-w-0 md:text-center">
        <div className="flex items-center gap-2 md:justify-center">
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            0{index + 1}
          </span>

          <h3 className="text-sm font-semibold text-white">{step.label}</h3>
        </div>

        <p className="mt-1 max-w-[13rem] text-xs leading-5 text-slate-400 md:mx-auto">
          {step.description}
        </p>
      </div>
    </li>
  );
}

export default function ProcessFlowPreview({
  title = "Evaluation process",
  subtitle = "A decorative preview of the SE Autograder workflow.",
  className = "",
}) {
  return (
    <section
      aria-label="SE Autograder process preview"
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-indigo-400/10 blur-3xl"
      />

      <div className="relative z-10 mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
          {title}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
      </div>

      <div className="relative">
        <div
          aria-hidden="true"
          className="process-flow-connector-vertical absolute bottom-8 left-6 top-4 w-px rounded-full bg-white/10 md:hidden"
        />
        <div
          aria-hidden="true"
          className="process-flow-connector-horizontal absolute left-6 right-6 top-6 hidden h-px rounded-full bg-white/10 md:block"
        />

        <ol className="relative z-10 grid gap-5 md:grid-cols-4 md:gap-4">
          {PROCESS_STEPS.map((step, index) => (
            <ProcessStep key={step.label} step={step} index={index} />
          ))}
        </ol>
      </div>
    </section>
  );
}