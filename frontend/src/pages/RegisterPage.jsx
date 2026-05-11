import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthFloatingIcons from "../components/auth/AuthFloatingIcons";
import ProcessFlowPreview from "../components/ui/ProcessFlowPreview";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../services/api";

const inputClassName =
  "w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-slate-400 shadow-inner shadow-slate-950/20 outline-none transition duration-200 focus:border-cyan-300 focus:bg-white/[0.13] focus:ring-4 focus:ring-cyan-300/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-400";

const roleOptions = [
  {
    value: "student",
    label: "Student",
    description: "Submit deliverables, track progress, and receive AI feedback.",
  },
  {
    value: "professor",
    label: "Professor",
    description: "Manage subjects, supervise progress, and override scores.",
  },
];

function RoleIcon({ role }) {
  if (role === "professor") {
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
        <path d="M22 10 12 5 2 10l10 5z" />
        <path d="M6 12v5c2 2 10 2 12 0v-5" />
        <path d="M22 10v6" />
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
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function RoleCard({ option, selected, disabled, onChange }) {
  return (
    <label className={disabled ? "cursor-not-allowed" : "cursor-pointer"}>
      <input
        type="radio"
        name="role"
        value={option.value}
        checked={selected}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
      />

      <div
        className={[
          "relative h-full overflow-hidden rounded-2xl border p-4 shadow-lg outline-none transition-all duration-300 ease-out",
          "peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-300/30",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-white/[0.09]",
          selected
            ? "scale-[1.015] border-cyan-300/60 bg-gradient-to-br from-cyan-300/18 via-sky-400/10 to-emerald-300/10 shadow-cyan-950/35"
            : "border-white/15 bg-white/[0.055] shadow-slate-950/20",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r transition-opacity duration-300",
            selected
              ? "from-transparent via-cyan-200/80 to-transparent opacity-100"
              : "from-transparent via-white/20 to-transparent opacity-40",
          ].join(" ")}
        />

        <div className="flex items-start gap-3">
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300",
              selected
                ? "border-cyan-200/50 bg-cyan-300/20 text-cyan-100 shadow-lg shadow-cyan-950/25"
                : "border-white/10 bg-slate-950/45 text-slate-300",
            ].join(" ")}
          >
            <RoleIcon role={option.value} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">{option.label}</p>

              <span
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                  selected
                    ? "border-cyan-200 bg-cyan-300 text-slate-950"
                    : "border-white/20 bg-white/[0.04] text-transparent",
                ].join(" ")}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
            </div>

            <p className="mt-1 text-sm leading-6 text-slate-400">
              {option.description}
            </p>
          </div>
        </div>
      </div>
    </label>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "student",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(form);

      navigate("/login", {
        replace: true,
        state: {
          registered: true,
          email: form.email,
        },
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-premium-bg relative min-h-screen overflow-hidden px-4 py-8 text-white sm:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="auth-grid-overlay absolute inset-0 opacity-45" />
        <div className="auth-blob auth-blob-a absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="auth-blob auth-blob-b absolute right-[-7rem] top-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="auth-blob auth-blob-c absolute bottom-[-8rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-300/10 blur-3xl" />
        <AuthFloatingIcons />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <section className="auth-card-enter grid w-full overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] p-4 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl sm:p-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-6">
          <div className="auth-form-card-enter rounded-[1.5rem] border border-white/15 bg-slate-950/55 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-8">
            <div className="mb-8">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
                SE Autograder
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-white">
                Create account
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                Choose your role and create your academic workspace.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-2xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm text-red-100 shadow-lg shadow-red-950/20"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Full name
                </label>

                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={updateField}
                  disabled={loading}
                  className={inputClassName}
                  placeholder="Ángel Pérez"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className={inputClassName}
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={updateField}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={loading}
                  className={inputClassName}
                  placeholder="Minimum 6 characters"
                />
              </div>

              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-slate-200">
                  Role
                </legend>

                <div className="grid gap-3 sm:grid-cols-2">
                  {roleOptions.map((option) => (
                    <RoleCard
                      key={option.value}
                      option={option}
                      selected={form.role === option.value}
                      disabled={loading}
                      onChange={updateField}
                    />
                  ))}
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="group relative w-full overflow-hidden rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 shadow-xl shadow-cyan-950/30 transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/35 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                <span className="relative">
                  {loading ? "Creating account..." : "Create account"}
                </span>
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-300">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-cyan-200 transition hover:text-white focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/30"
              >
                Login
              </Link>
            </p>

            <div className="mt-8 lg:hidden">
              <ProcessFlowPreview
                title="Academic workflow"
                subtitle="Submit, AI review, feedback delivery, and professor override."
              />
            </div>
          </div>

          <aside className="hidden rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-sm font-medium text-cyan-100 shadow-lg shadow-cyan-950/20">
                <span className="auth-soft-pulse h-2 w-2 rounded-full bg-cyan-300" />
                Academic workflow automation
              </p>

              <h2 className="max-w-xl text-5xl font-bold tracking-tight text-white">
                Join a structured AI-assisted academic platform.
              </h2>

              <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
                Students complete sequential deliverables, receive AI-generated
                feedback, and professors supervise the process with full
                visibility and manual override control.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              <ProcessFlowPreview
                title="Process preview"
                subtitle="A decorative overview of how submissions move through SE Autograder."
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                  <p className="text-sm font-semibold text-white">
                    Student workspace
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Submit work, unlock deliverables, and view structured
                    feedback.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                  <p className="text-sm font-semibold text-white">
                    Professor control
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Monitor progress, review AI output, and override scores.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}