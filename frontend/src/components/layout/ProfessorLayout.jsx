import ProfessorNavbar from "./ProfessorNavbar";

export default function ProfessorLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <ProfessorNavbar />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}