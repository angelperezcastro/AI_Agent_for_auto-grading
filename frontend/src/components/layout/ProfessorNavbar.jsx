import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

export default function ProfessorNavbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const linkBase =
    "rounded-xl px-4 py-2 text-sm font-semibold transition-colors";

  const getLinkClass = ({ isActive }) =>
    isActive
      ? `${linkBase} bg-slate-900 text-white`
      : `${linkBase} text-slate-600 hover:bg-slate-100 hover:text-slate-900`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Professor Panel
          </p>
          <h1 className="text-lg font-black text-slate-900">SE Autograder</h1>
        </div>

        <nav className="flex items-center gap-2">
          <NavLink to="/professor/dashboard" className={getLinkClass}>
            Dashboard
          </NavLink>

          <NavLink to="/professor/manage" className={getLinkClass}>
            Manage Subjects
          </NavLink>

          <NavLink to="/professor/settings" className={getLinkClass}>
            Settings
          </NavLink>
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-800">
              {user?.email || "Professor"}
            </p>
            <p className="text-xs text-slate-500">Professor account</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}