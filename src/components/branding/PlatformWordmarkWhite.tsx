import { useBrand } from '@/contexts/useBrand';

/** Wordmark branco em fundo transparente — para header escuro. */
export function PlatformWordmarkWhite({ className = '' }: { className?: string }) {
  const brand = useBrand();
  return (
    <svg
      className={className}
      viewBox="0 0 260 40"
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
        style={{ fontFamily: 'system-ui, Segoe UI, sans-serif', fontSize: 14, fontWeight: 700 }}
      >
        {brand.platformShortName}
      </text>
    </svg>
  );
}
