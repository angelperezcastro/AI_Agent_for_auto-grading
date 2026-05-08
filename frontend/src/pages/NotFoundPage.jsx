import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-cyan-700">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          The route you are trying to access does not exist.
        </p>

        <Link
          to="/dashboard"
          className="mt-6 inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Go to dashboard
        </Link>
      </section>
    </main>
  );
}