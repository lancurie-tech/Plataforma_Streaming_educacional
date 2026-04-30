/** Wordmark branco em fundo transparente — para header escuro (substitui PNG com fundo preto). */
export function MedivoxWordmarkWhite({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path fill="#fafafa" d="M2 27h8l10-20h-8l-10 20z" />
      <path fill="#fafafa" d="M12 28h8l10-20h-8l-10 20z" />
      <text
        x="38"
        y="27"
        fill="#fafafa"
        style={{ fontFamily: 'system-ui, Segoe UI, sans-serif', fontSize: 22, fontWeight: 700 }}
      >
        Medivox
      </text>
    </svg>
  );
}
