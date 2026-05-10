import { Navigate, Route, Routes } from "react-router-dom";

import ProfessorLayout from "./components/layout/ProfessorLayout";

import BrowsePage from "./pages/BrowsePage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import RegisterPage from "./pages/RegisterPage";
import WorkspacePage from "./pages/WorkspacePage";

import ManagePage from "./pages/professor/ManagePage";
import ProfessorDashboard from "./pages/professor/ProfessorDashboard";
import SettingsPage from "./pages/professor/SettingsPage";
import StudentDetailPage from "./pages/professor/StudentDetailPage";

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
            <SettingsPage />
          </ProfessorPage>
        }
      />

      <Route
        path="/professor/student/:enrollmentId"
        element={
          <ProfessorPage>
            <StudentDetailPage />
          </ProfessorPage>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}