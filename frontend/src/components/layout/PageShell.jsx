function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PageShell({
  as: Component = "div",
  children,
  className = "",
}) {
  return (
    <Component
      className={cx(
        "motion-safe:animate-[pageShellEnter_260ms_ease-out] motion-reduce:animate-none",
        className
      )}
    >
      <style>
        {`
          @keyframes pageShellEnter {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

      {children}
    </Component>
  );
}