import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api, getApiErrorMessage } from "../services/api";
import { useAuth } from "../context/useAuth";

export default function DashboardPage() {
  const { user } = useAuth();

  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchEnrollments() {
      try {
        const response = await api.get("/enrollments");
        setEnrollments(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchEnrollments();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="mb-8 rounded-3xl bg-slate-900 p-8 text-white">
          <p className="text-sm font-medium text-cyan-200">Student dashboard</p>
          <h1 className="mt-2 text-3xl font-bold">
            Welcome{user?.full_name ? `, ${user.full_name}` : ""}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            This is your project overview. From here you will access your active
            enrollments, submit deliverables, and view AI feedback.
          </p>
        </section>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">My projects</h2>
            <p className="text-sm text-slate-500">
              Enrollments returned by the backend.
            </p>
          </div>

          <Link
            to="/browse"
            className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Browse subjects
          </Link>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Loading enrollments...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && enrollments.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="font-semibold text-slate-900">
              No active enrollments yet
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Go to Browse and enroll in a project.
            </p>
          </div>
        )}

        {!loading && !error && enrollments.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {enrollments.map((enrollment) => (
              <Link
                key={enrollment.id}
                to={`/workspace/${enrollment.id}`}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {enrollment.project_name ||
                        enrollment.project?.name ||
                        `Enrollment #${enrollment.id}`}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {enrollment.subject_name ||
                        enrollment.project?.subject?.name ||
                        "Subject"}
                    </p>
                  </div>

                  <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                    Step {enrollment.current_deliverable || 1}/4
                  </span>
                </div>

                <p className="mt-5 text-sm text-slate-500">
                  Open workspace to continue your sequential deliverables.
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}