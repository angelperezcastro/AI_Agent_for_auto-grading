import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PrivateRoute from "./PrivateRoute";

export default function ProfessorRoute({ children }) {
  const { user, loading } = useAuth();

  return (
    <PrivateRoute>
      {loading ? null : user?.role === "professor" ? (
        children
      ) : (
        <Navigate to="/dashboard" replace />
      )}
    </PrivateRoute>
  );
}