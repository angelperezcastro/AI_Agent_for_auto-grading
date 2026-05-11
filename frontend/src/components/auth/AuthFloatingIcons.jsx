function FloatingIcon({ className = "", children }) {
  return (
    <div
      aria-hidden="true"
      className={`auth-floating-icon absolute flex items-center justify-center rounded-2xl border border-cyan-200/10 bg-white/[0.045] text-cyan-100/50 shadow-2xl shadow-cyan-950/20 backdrop-blur-[2px] ${className}`}
    >
      {children}
    </div>
  );
}

function FileTextIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
      <path d="M9 9h1" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
    >
      <path d="M12 8V4" />
      <path d="M8 4h8" />
      <rect x="5" y="8" width="14" height="12" rx="3" />
      <path d="M9 13h.01" />
      <path d="M15 13h.01" />
      <path d="M10 17h4" />
      <path d="M3 13h2" />
      <path d="M19 13h2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.2 2.2 4.8-5.2" />
    </svg>
  );
}

function GraduationCapIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
    >
      <path d="M22 10 12 5 2 10l10 5z" />
      <path d="M6 12v5c2 2 10 2 12 0v-5" />
      <path d="M22 10v6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2" />
    </svg>
  );
}

export default function AuthFloatingIcons() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <FloatingIcon className="auth-float-file left-[7%] top-[18%] h-14 w-14 rotate-[-10deg]">
        <FileTextIcon />
      </FloatingIcon>

      <FloatingIcon className="auth-float-bot left-[18%] bottom-[15%] hidden h-16 w-16 rotate-[8deg] sm:flex">
        <BotIcon />
      </FloatingIcon>

      <FloatingIcon className="auth-float-mail right-[9%] top-[16%] h-14 w-14 rotate-[12deg]">
        <MailIcon />
      </FloatingIcon>

      <FloatingIcon className="auth-float-check right-[17%] bottom-[18%] hidden h-14 w-14 rotate-[-8deg] md:flex">
        <CheckCircleIcon />
      </FloatingIcon>

      <FloatingIcon className="auth-float-cap left-[46%] top-[8%] hidden h-16 w-16 rotate-[5deg] lg:flex">
        <GraduationCapIcon />
      </FloatingIcon>

      <FloatingIcon className="auth-float-lock right-[42%] bottom-[8%] hidden h-12 w-12 rotate-[-4deg] lg:flex">
        <LockIcon />
      </FloatingIcon>
    </div>
  );
}