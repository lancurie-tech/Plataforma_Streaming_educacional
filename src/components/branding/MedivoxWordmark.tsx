/** Wordmark vetorial (sem fundo) — ícone com barras paralelas + texto. */
export function MedivoxWordmark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path fill="#1b3022" d="M2 27h8l10-20h-8l-10 20z" />
      <path fill="#66BC3F" d="M12 28h8l10-20h-8l-10 20z" />
      <text
        x="38"
        y="27"
        fill="currentColor"
        style={{ fontFamily: 'system-ui, Segoe UI, sans-serif', fontSize: 22, fontWeight: 700 }}
      >
        Medivox
      </text>
    </svg>
  );
}
