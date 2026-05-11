import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../services/api";

const inputClassName =
  "w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-slate-400 shadow-inner shadow-slate-950/20 outline-none transition duration-200 focus:border-cyan-300 focus:bg-white/[0.13] focus:ring-4 focus:ring-cyan-300/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-400";

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
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <section className="auth-card-enter grid w-full overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] p-4 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl sm:p-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-6">
          <div className="rounded-[1.5rem] border border-white/15 bg-slate-950/55 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-8">
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

              <div>
                <label
                  htmlFor="role"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Role
                </label>

                <select
                  id="role"
                  name="role"
                  value={form.role}
                  onChange={updateField}
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/80 px-4 py-3 text-white shadow-inner shadow-slate-950/20 outline-none transition duration-200 focus:border-cyan-300 focus:bg-slate-900 focus:ring-4 focus:ring-cyan-300/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-400"
                >
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                </select>
              </div>

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
          </div>

          <div className="hidden rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-8 lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-sm font-medium text-cyan-100 shadow-lg shadow-cyan-950/20">
                <span className="auth-soft-pulse h-2 w-2 rounded-full bg-cyan-300" />
                Academic workflow automation
              </p>

              <h2 className="max-w-xl text-5xl font-bold tracking-tight text-white">
                One platform for students, professors, AI feedback, and Gmail
                notifications.
              </h2>

              <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
                Students submit four sequential deliverables. Professors monitor
                progress, review AI feedback, and override scores when needed.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                <p className="text-sm font-semibold text-white">
                  Student workspace
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Submit work, unlock deliverables, and view structured feedback.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                <p className="text-sm font-semibold text-white">
                  Professor supervision
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Track progress, inspect feedback, and apply manual overrides.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}