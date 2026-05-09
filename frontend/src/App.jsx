import { Navigate, Route, Routes } from "react-router-dom";
import BrowsePage from "./pages/BrowsePage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import RegisterPage from "./pages/RegisterPage";
import WorkspacePage from "./pages/WorkspacePage";
import ProfessorLayout from "./components/layout/ProfessorLayout";
import ProfessorDashboard from "./pages/professor/ProfessorDashboard";
import ManagePage from "./pages/professor/ManagePage";
import PrivateRoute from "./routes/PrivateRoute";
import ProfessorRoute from "./routes/ProfessorRoute";
import { useAuth } from "./context/useAuth";

function getStoredUserRole() {
  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    const parsedUser = JSON.parse(storedUser);
    return String(parsedUser?.role || "").toLowerCase();
  } catch {
    return null;
  }
}

function RootRedirect() {
  const { user } = useAuth();
  const role = String(user?.role || getStoredUserRole() || "").toLowerCase();

  if (role === "professor") {
    return <Navigate to="/professor/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function ProfessorPage({ children }) {
  return (
    <ProfessorRoute>
      <ProfessorLayout>{children}</ProfessorLayout>
    </ProfessorRoute>
  );
}

function ComingSoonPage({ title, description }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
        Coming Soon
      </p>
      <h1 className="mt-2 text-3xl font-black text-slate-900">{title}</h1>
      <p className="mt-3 max-w-3xl text-slate-500">{description}</p>
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />

      <Route
        path="/browse"
        element={
          <PrivateRoute>
            <BrowsePage />
          </PrivateRoute>
        }
      />

      <Route
        path="/workspace/:enrollmentId"
        element={
          <PrivateRoute>
            <WorkspacePage />
          </PrivateRoute>
        }
      />

      <Route
        path="/professor/dashboard"
        element={
          <ProfessorPage>
            <ProfessorDashboard />
          </ProfessorPage>
        }
      />

      <Route
        path="/professor/manage"
        element={
          <ProfessorPage>
            <ManagePage />
          </ProfessorPage>
        }
      />

      <Route
        path="/professor/settings"
        element={
          <ProfessorPage>
            <ComingSoonPage
              title="Gmail Settings"
              description="This page will contain the connected Gmail accounts, OAuth popup flow, project assignments and test email sender. It is planned for the next block of Week 5."
            />
          </ProfessorPage>
        }
      />

      <Route
        path="/professor/student/:enrollmentId"
        element={
          <ProfessorPage>
            <ComingSoonPage
              title="Student Detail"
              description="This page will show the four deliverables, AI feedback, email history and professor score override panel. It is planned for the next block of Week 5."
            />
          </ProfessorPage>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
