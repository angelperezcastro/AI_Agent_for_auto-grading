import { Navigate, Route, Routes } from "react-router-dom";
import BrowsePage from "./pages/BrowsePage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProfessorDashboardPage from "./pages/ProfessorDashboardPage";
import RegisterPage from "./pages/RegisterPage";
import WorkspacePage from "./pages/WorkspacePage";
import PrivateRoute from "./routes/PrivateRoute";
import ProfessorRoute from "./routes/ProfessorRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

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
          <ProfessorRoute>
            <ProfessorDashboardPage />
          </ProfessorRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}