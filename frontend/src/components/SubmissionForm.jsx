import { useMemo, useState } from "react";
import { api, getApiErrorMessage } from "../services/api";

const EMAIL_DELIVERY_WARNING =
  "Submission saved. Email delivery could not be confirmed.";

const SUBMISSION_PROGRESS_STEPS = [
  {
    key: "saving",
    title: "Saving submission",
    description: "Your deliverable is being stored in the platform.",
  },
  {
    key: "email",
    title: "Sending confirmation email",
    description: "The system is trying to notify you by email.",
  },
  {
    key: "evaluation",
    title: "AI evaluation in progress",
    description: "The evaluator will review your deliverable automatically.",
  },
  {
    key: "feedback",
    title: "Feedback will appear here and also arrive by email",
    description: "Your score and feedback will be available once processed.",
  },
];

function getDeliverableGuidance(deliverableNumber) {
  const guidance = {
    1: {
      title: "Research + Motivation Letter",
      points: [
        "Explain the project context and the problem you want to address.",
        "Use credible sources and reference them clearly inside the text.",
        "Explain your personal or academic motivation for choosing this project.",
        "Structure the text with a clear introduction, development and conclusion.",
      ],
      placeholder:
        "Write your research and motivation letter here. Include the problem context, relevant sources, motivation, and a clear structure...",
    },
    2: {
      title: "User Requirements List",
      points: [
        "Write requirements in a clear and consistent format.",
        "Avoid ambiguity and vague expressions.",
        "Connect the requirements to the research from Deliverable 1.",
        "Cover the main user needs and expected system behavior.",
      ],
      placeholder:
        "Write your user requirements list here. Use clear requirement statements and make them traceable to your previous research...",
    },
    3: {
      title: "Target Group Interview Questions",
      points: [
        "Design questions that can reveal new requirements.",
        "Cover use cases that were not fully explored before.",
        "Use a variety of open, specific and scenario-based questions.",
        "Avoid leading questions that force a specific answer.",
      ],
      placeholder:
        "Write your target group questions here. Focus on discovering needs, pain points, missing use cases and new requirements...",
    },
    4: {
      title: "Updated Requirements List",
      points: [
        "Integrate the findings derived from your target group questions.",
        "Preserve consistency with the previous requirements.",
        "Remove duplicates, contradictions and immature requirements.",
        "Produce a more complete and mature final requirements document.",
      ],
      placeholder:
        "Write your updated requirements list here. Integrate the new requirements and explain how the final list has matured...",
    },
  };

  return guidance[deliverableNumber] || guidance[1];
}

function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasEmailDeliveryFailure(submissionResponse) {
  return (
    submissionResponse?.email_sent === false ||
    Boolean(submissionResponse?.email_error)
  );
}

function getProgressStepState(stepKey, progressStatus) {
  if (progressStatus === "idle") {
    return "pending";
  }

  if (progressStatus === "submitting") {
    if (stepKey === "saving") {
      return "active";
    }

    return "pending";
  }

  if (progressStatus === "success") {
    if (stepKey === "saving" || stepKey === "email") {
      return "complete";
    }

    if (stepKey === "evaluation") {
      return "active";
    }

    return "pending";
  }

  if (progressStatus === "email-warning") {
    if (stepKey === "saving") {
      return "complete";
    }

    if (stepKey === "email") {
      return "warning";
    }

    if (stepKey === "evaluation") {
      return "active";
    }

    return "pending";
  }

  if (progressStatus === "error") {
    if (stepKey === "saving") {
      return "error";
    }

    return "pending";
  }

  return "pending";
}

function getStepNodeClassName(stepState) {
  if (stepState === "complete") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (stepState === "active") {
    return "border-cyan-300 bg-cyan-50 text-cyan-700 shadow-lg shadow-cyan-100 motion-safe:animate-pulse motion-reduce:animate-none";
  }

  if (stepState === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }

  if (stepState === "error") {
    return "border-red-300 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-white text-slate-400";
}

function getStepTextClassName(stepState) {
  if (stepState === "complete") {
    return "text-emerald-800";
  }

  if (stepState === "active") {
    return "text-cyan-900";
  }

  if (stepState === "warning") {
    return "text-amber-800";
  }

  if (stepState === "error") {
    return "text-red-800";
  }

  return "text-slate-500";
}

function ProgressStepIcon({ state, index }) {
  if (state === "complete") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (state === "warning") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }

  if (state === "error") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    );
  }

  if (state === "active") {
    return (
      <span
        aria-hidden="true"
        className="h-3 w-3 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin motion-reduce:animate-none"
      />
    );
  }

  return <span className="text-xs font-black">{index + 1}</span>;
}

function SubmissionProgressPanel({ progressStatus, warningMessage, error }) {
  if (progressStatus === "idle") {
    return null;
  }

  const isError = progressStatus === "error";
  const isWarning = progressStatus === "email-warning";
  const isSuccess = progressStatus === "success";

  return (
    <section
      aria-live="polite"
      aria-label="Submission progress"
      className={[
        "mb-6 overflow-hidden rounded-3xl border p-5 shadow-sm",
        isError
          ? "border-red-200 bg-red-50"
          : isWarning
            ? "border-amber-200 bg-amber-50"
            : "border-cyan-200 bg-cyan-50",
      ].join(" ")}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className={[
              "text-sm font-black uppercase tracking-[0.18em]",
              isError
                ? "text-red-700"
                : isWarning
                  ? "text-amber-700"
                  : "text-cyan-800",
            ].join(" ")}
          >
            Submission progress
          </p>

          <h2
            className={[
              "mt-2 text-lg font-black",
              isError
                ? "text-red-950"
                : isWarning
                  ? "text-amber-950"
                  : "text-cyan-950",
            ].join(" ")}
          >
            {isError
              ? "Submission could not be completed"
              : isWarning
                ? "Submission saved with an email warning"
                : isSuccess
                  ? "Submission saved successfully"
                  : "Submitting your deliverable"}
          </h2>
        </div>

        <span
          className={[
            "inline-flex w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide",
            isError
              ? "bg-red-100 text-red-700"
              : isWarning
                ? "bg-amber-100 text-amber-700"
                : "bg-cyan-100 text-cyan-700",
          ].join(" ")}
        >
          {isError ? "Action needed" : isWarning ? "Saved" : "In progress"}
        </span>
      </div>

      <ol className="mt-5 grid gap-3 md:grid-cols-4">
        {SUBMISSION_PROGRESS_STEPS.map((step, index) => {
          const stepState = getProgressStepState(step.key, progressStatus);

          return (
            <li
              key={step.key}
              className="rounded-2xl border border-white/70 bg-white/75 p-4"
            >
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-xl border transition",
                  getStepNodeClassName(stepState),
                ].join(" ")}
              >
                <ProgressStepIcon state={stepState} index={index} />
              </div>

              <p
                className={[
                  "mt-3 text-sm font-black leading-5",
                  getStepTextClassName(stepState),
                ].join(" ")}
              >
                {step.title}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-600">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>

      {warningMessage && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-white/70 px-4 py-3 text-sm font-semibold text-amber-800">
          {warningMessage}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-white/70 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}

export default function SubmissionForm({
  enrollmentId,
  deliverable,
  onCancel,
  onSubmitted,
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [emailWarning, setEmailWarning] = useState("");
  const [error, setError] = useState("");
  const [progressStatus, setProgressStatus] = useState("idle");

  const guidance = getDeliverableGuidance(deliverable.number);

  const wordCount = useMemo(() => countWords(content), [content]);

  const canSubmit = content.trim().length >= 30 && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      setError("Please write a more complete deliverable before submitting.");
      setProgressStatus("error");
      return;
    }

    setSubmitting(true);
    setError("");
    setEmailWarning("");
    setSubmittedMessage("");
    setProgressStatus("submitting");

    try {
      const response = await api.post("/submissions", {
        enrollment_id: Number(enrollmentId),
        deliverable_number: deliverable.number,
        content: content.trim(),
      });

      const submissionResponse = response.data;
      const emailFailed = hasEmailDeliveryFailure(submissionResponse);

      if (emailFailed) {
        setProgressStatus("email-warning");
        setEmailWarning(EMAIL_DELIVERY_WARNING);
        setSubmittedMessage(EMAIL_DELIVERY_WARNING);
      } else {
        setProgressStatus("success");
        setSubmittedMessage(
          "Submission saved. The AI evaluation is now in progress. Your score and feedback will appear here and also arrive by email."
        );
      }

      await onSubmitted?.(submissionResponse);

      if (!emailFailed) {
        setTimeout(() => {
          onCancel?.();
        }, 2200);
      }
    } catch (err) {
      setProgressStatus("error");
      setError(
        getApiErrorMessage(err) ||
          "Submission could not be saved. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">
                Deliverable {deliverable.number}
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">
                {guidance.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Write your deliverable inside the platform. After submission,
                the system will save your work, send a confirmation email, and
                start the AI evaluation process.
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Close
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8">
          <section className="mb-6 rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-cyan-900">
              Instructions
            </h2>

            <ul className="mt-3 space-y-2">
              {guidance.points.map((point) => (
                <li
                  key={point}
                  className="flex gap-2 text-sm leading-6 text-cyan-900"
                >
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-600" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <SubmissionProgressPanel
            progressStatus={progressStatus}
            warningMessage={emailWarning}
            error={error}
          />

          {submittedMessage && progressStatus !== "email-warning" && (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              {submittedMessage}
            </div>
          )}

          <div>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label
                htmlFor="submission-content"
                className="text-sm font-bold text-slate-800"
              >
                Deliverable content
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    wordCount >= 100
                      ? "bg-emerald-50 text-emerald-700"
                      : wordCount >= 30
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {wordCount} words
                </span>

                <span className="text-xs text-slate-400">
                  Minimum recommended: 100 words
                </span>
              </div>
            </div>

            <textarea
              id="submission-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={submitting || Boolean(submittedMessage)}
              placeholder={guidance.placeholder}
              className="min-h-[480px] w-full resize-y rounded-3xl border border-slate-300 bg-white px-5 py-4 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              The platform is the workspace. Email is the notification layer.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!canSubmit || Boolean(submittedMessage)}
                aria-busy={submitting}
                className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit deliverable"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}