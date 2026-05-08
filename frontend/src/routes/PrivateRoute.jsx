import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function FullPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="rounded-2xl bg-white px-6 py-5 shadow-sm border border-slate-200">
        <p className="text-sm font-medium text-slate-700">Loading session...</p>
      </div>
    </div>
  );
}

export default function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}