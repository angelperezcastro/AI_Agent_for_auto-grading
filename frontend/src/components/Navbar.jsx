import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const baseLink =
  "rounded-xl px-3 py-2 text-sm font-medium transition-colors";

const activeLink = "bg-cyan-50 text-cyan-700";
const inactiveLink = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

export default function Navbar() {
  const { user, logout, isProfessor } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-8">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-cyan-300">
              GM
            </div>
            <div>
              <p className="text-sm font-bold leading-none text-slate-900">
                GradeMind
              </p>
              <p className="text-xs text-slate-500">AI Autograding</p>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-2 md:flex">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `${baseLink} ${isActive ? activeLink : inactiveLink}`
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/browse"
              className={({ isActive }) =>
                `${baseLink} ${isActive ? activeLink : inactiveLink}`
              }
            >
              Browse
            </NavLink>

            {isProfessor && (
              <NavLink
                to="/professor/dashboard"
                className={({ isActive }) =>
                  `${baseLink} ${isActive ? activeLink : inactiveLink}`
                }
              >
                Professor
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-800">
              {user?.full_name || user?.email || "User"}
            </p>
            <p className="text-xs capitalize text-slate-500">
              {user?.role || "authenticated"}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}