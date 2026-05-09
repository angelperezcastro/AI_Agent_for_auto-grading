import { useMemo, useState } from "react";
import { api, getApiErrorMessage } from "../services/api";

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

export default function SubmissionForm({
  enrollmentId,
  deliverable,
  onCancel,
  onSubmitted,
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [error, setError] = useState("");

  const guidance = getDeliverableGuidance(deliverable.number);

  const wordCount = useMemo(() => countWords(content), [content]);

  const canSubmit = content.trim().length >= 30 && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      setError("Please write a more complete deliverable before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSubmittedMessage("");

    try {
      await api.post("/submissions", {
        enrollment_id: Number(enrollmentId),
        deliverable_number: deliverable.number,
        content: content.trim(),
      });

      setSubmittedMessage(
        "Submitted! The AI is now evaluating your work. You will receive your score and feedback by email within 1–2 minutes."
      );

      await onSubmitted?.();

      setTimeout(() => {
        onCancel?.();
      }, 1800);
    } catch (err) {
      setError(getApiErrorMessage(err));
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

          {submitting && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
              <span>
                Submitting... A confirmation email will be sent to your inbox.
              </span>
            </div>
          )}

          {submittedMessage && (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              {submittedMessage}
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-bold text-slate-800">
                Deliverable content
              </label>

              <div className="flex items-center gap-3">
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