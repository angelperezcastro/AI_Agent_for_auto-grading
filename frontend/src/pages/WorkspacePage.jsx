import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function WorkspacePage() {
  const { enrollmentId } = useParams();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-cyan-700">
            Enrollment #{enrollmentId}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Student workspace
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Route ready. Later this page will show the 4-deliverable timeline,
            submission form, score badges, criteria breakdown and feedback.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((number) => (
              <div
                key={number}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-sm font-semibold text-slate-900">
                  Deliverable {number}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Timeline placeholder.
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}