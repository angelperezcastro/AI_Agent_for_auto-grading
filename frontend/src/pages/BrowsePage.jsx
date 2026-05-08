import Navbar from "../components/Navbar";

export default function BrowsePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-cyan-700">Browse</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Subject browser
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Route ready. In the next frontend block, this page will fetch
            subjects with <code className="font-mono">GET /subjects</code>,
            display projects, and allow students to enroll.
          </p>
        </section>
      </main>
    </div>
  );
}