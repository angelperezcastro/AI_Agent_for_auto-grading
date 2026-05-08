import Navbar from "../components/Navbar";

export default function ProfessorDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-cyan-700">
            Professor area
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Professor dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Protected route ready. The full professor dashboard is scheduled for
            Week 5. For now, this page verifies that role-based routing works.
          </p>
        </section>
      </main>
    </div>
  );
}