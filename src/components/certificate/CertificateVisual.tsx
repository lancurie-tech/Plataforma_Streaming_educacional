import { useId } from 'react';
import {
  BRAND_GREEN,
  GOLD,
  GOLD_DARK,
  GREEN_DEEP,
  MEDIVOX_LOGO_PATH,
  SEAL_CX,
  SEAL_CY,
  formatDateLong,
  starburstPath,
} from '@/components/certificate/certificateShared';
import {
  formatCertificateAudienceLine,
  type UserCertificate,
} from '@/lib/firestore/certificates';

/** Faixa diagonal: gradiente um pouco mais claro nas bordas para equilibrar o layout. */
const BRAND_GREEN_BAND = `linear-gradient(148deg, #8fd06e 0%, ${BRAND_GREEN} 42%, #52a836 100%)`;

function SealMedallionSvg({
  gradId,
  radId,
  logoSrc,
}: {
  gradId: string;
  radId: string;
  logoSrc: string;
}) {
  const burst = starburstPath(SEAL_CX, SEAL_CY, 47, 40, 28);
  const clipId = `${gradId}-logoClip`;

  return (
    <svg
      viewBox="0 0 100 118"
      className="h-30 w-25 drop-shadow-lg sm:h-35 sm:w-29"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5edd4" />
          <stop offset="35%" stopColor="#e8c84a" />
          <stop offset="70%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#8a6d18" />
        </linearGradient>
        <radialGradient id={radId} cx="32%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#fffef5" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#f0d878" stopOpacity="1" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="1" />
        </radialGradient>
        <filter id={`${gradId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
        </filter>
        <clipPath id={clipId}>
          <circle cx={SEAL_CX} cy={SEAL_CY} r="30.5" />
        </clipPath>
      </defs>

      {/* Fitas (atrás) */}
      <path
        d="M 38 86 L 34 108 L 44 102 Z"
        fill={GREEN_DEEP}
        stroke={GOLD}
        strokeWidth="0.6"
      />
      <path
        d="M 62 86 L 66 108 L 56 102 Z"
        fill={GREEN_DEEP}
        stroke={GOLD}
        strokeWidth="0.6"
      />

      {/* Borda serrilhada verde */}
      <path d={burst} fill={GREEN_DEEP} filter={`url(#${gradId}-shadow)`} />

      {/* Anel dourado */}
      <circle
        cx={SEAL_CX}
        cy={SEAL_CY}
        r="38"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2.2"
      />

      {/* Disco central metálico */}
      <circle cx={SEAL_CX} cy={SEAL_CY} r="33.5" fill={`url(#${radId})`} stroke={GOLD_DARK} strokeWidth="0.4" />

      {/* Logo Medivox (cores da marca no PNG) dentro do selo */}
      <image
        href={logoSrc}
        x="25"
        y="19"
        width="50"
        height="50"
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${clipId})`}
      />

      {/* Detalhe decorativo discreto sobre o anel */}
      <path
        d="M 24 54 Q 32 60 50 58 Q 68 60 76 54"
        fill="none"
        stroke={GREEN_DEEP}
        strokeWidth="0.75"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

function GoldCornerLines({ className, flipX }: { className?: string; flipX?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={flipX ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M140 0h-50M140 0v50M140 8h-42M140 8v42M140 16h-34M140 16v34" stroke={GOLD} strokeWidth="1.2" />
      <path d="M0 140h50M0 140v-50M0 132h42M0 132v-42M0 124h34M0 124v-34" stroke={GOLD} strokeWidth="1.2" />
    </svg>
  );
}

type Props = {
  c: UserCertificate;
  className?: string;
};

export function CertificateVisual({ c, className = '' }: Props) {
  const issued = formatDateLong(c.issuedAt);
  const sealUid = useId().replace(/:/g, '');
  const audienceLine = formatCertificateAudienceLine();

  return (
    <div
      className={`relative overflow-hidden rounded-sm bg-white shadow-[0_4px_40px_rgba(0,0,0,0.12)] ${className}`}
      style={{
        aspectRatio: '297 / 210',
        color: '#222',
      }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 h-[38%] w-[70%]"
        style={{
          background: BRAND_GREEN_BAND,
          clipPath: 'polygon(0 0, 100% 0, 42% 100%, 0 62%)',
        }}
      />

      <GoldCornerLines className="pointer-events-none absolute right-0 top-0 z-2 h-20 w-20 opacity-95 sm:h-24 sm:w-24" />
      <GoldCornerLines
        className="pointer-events-none absolute bottom-0 left-0 z-2 h-20 w-20 opacity-95 sm:h-24 sm:w-24"
        flipX
      />

      {/* Selo com logo Medivox — canto inferior direito */}
      <div
        className="pointer-events-none absolute bottom-2 right-2 z-10 sm:bottom-3 sm:right-3 md:bottom-4 md:right-5"
        aria-hidden
      >
        <SealMedallionSvg
          gradId={`sg${sealUid}lin`}
          radId={`sg${sealUid}rad`}
          logoSrc={MEDIVOX_LOGO_PATH}
        />
      </div>

      <div className="relative z-3 flex h-full min-h-0 flex-col justify-start px-5 pb-27 pt-5 sm:px-8 sm:pb-28 sm:pt-6 md:px-10 md:pb-30 md:pt-7">
        <header className="shrink-0 text-center">
          <h3
            className="text-2xl font-bold tracking-[0.2em] sm:text-3xl md:text-[2.15rem]"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: GREEN_DEEP }}
          >
            CERTIFICADO
          </h3>
          <p
            className="mt-2 text-[10px] font-bold uppercase tracking-[0.28em] sm:text-xs"
            style={{ fontFamily: "'Montserrat', sans-serif", color: GOLD }}
          >
            de conclusão
          </p>
        </header>

        <div className="mx-auto mt-3 w-full max-w-xl shrink-0 text-center sm:mt-4 md:mt-5">
          <p
            className="pb-1 text-[10px] font-semibold uppercase leading-normal tracking-[0.2em] text-[#444] sm:pb-1.5 sm:text-[11px]"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            A plataforma Medivox confere a
          </p>

          <p
            className="mx-auto mt-5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap border-b border-zinc-300 px-3 pb-1 pt-3 text-center text-2xl leading-[1.65] text-[#111] sm:mt-6 sm:max-w-[min(100%,36rem)] sm:px-5 sm:pt-4 sm:text-4xl md:mt-7 md:pt-5 md:text-5xl"
            style={{ fontFamily: "'Great Vibes', cursive" }}
            title={c.studentName}
          >
            {c.studentName}
          </p>

          <p
            className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-[#4a4a4a] sm:mt-6 sm:text-base"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            O título de conclusão do curso abaixo, obtido mediante o cumprimento de todos os módulos e critérios
            estabelecidos, em comprovação de esforço e dedicação.
          </p>

          <p
            className="mx-auto mt-5 max-w-xl text-[10px] font-semibold uppercase leading-relaxed tracking-[0.14em] text-[#555] sm:mt-6 sm:text-[11px]"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Curso
          </p>
          <p
            className="mx-auto mt-3 max-w-xl text-lg font-bold leading-snug sm:mt-3.5 sm:text-xl md:text-2xl"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              color: GREEN_DEEP,
              fontWeight: 700,
            }}
          >
            {c.courseTitle}
          </p>
          {audienceLine ? (
            <p
              className="mx-auto mt-2 max-w-xl text-xs font-semibold uppercase leading-snug tracking-[0.12em] text-[#5a6b52] sm:text-sm"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {audienceLine}
            </p>
          ) : null}

          <div className="mx-auto mt-4 max-w-lg border-t border-zinc-200/90 pt-4 sm:mt-5 sm:pt-5">
            <div className="flex flex-col justify-center gap-5 sm:flex-row sm:gap-12">
              <div className="text-center">
                <div className="mx-auto mb-2 h-px max-w-[180px]" style={{ background: GREEN_DEEP }} />
                <p
                  className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#555] sm:text-[10px]"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  Plataforma Medivox
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-2 h-px max-w-[180px]" style={{ background: GREEN_DEEP }} />
                <p
                  className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#555] sm:text-[10px]"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  Validação digital
                </p>
              </div>
            </div>
          </div>

          <p
            className="mx-auto mt-3 max-w-lg pb-2.5 text-center text-[7px] leading-relaxed text-zinc-500 sm:mt-3.5 sm:pb-3 sm:text-[7.5px]"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <span className="uppercase tracking-[0.14em]">Registro</span>{' '}
            <span className="font-mono text-[7.5px] font-medium tracking-[0.12em] text-zinc-600 sm:text-[8px]">
              {c.verificationCode}
            </span>
            <span className="mx-1.5 text-zinc-400">·</span>
            <time className="text-zinc-500" dateTime={c.issuedAt.toISOString()}>
              {issued}
            </time>
          </p>
        </div>
      </div>
    </div>
  );
}
