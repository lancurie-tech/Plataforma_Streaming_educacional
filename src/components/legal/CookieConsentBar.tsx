import { Link, useLocation } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { useAnalyticsConsent } from '@/contexts/AnalyticsConsentContext';
import { useBrand } from '@/contexts/useBrand';

/**
 * Cartão central no ecrã (efeito “hover” no painel). Escolha gravada em localStorage.
 * Métricas opcionais (ex.: streaming) só com “Aceitar”.
 */
export function CookieConsentBar() {
  const brand = useBrand();
  const { pathname } = useLocation();
  const { consent, grant, deny } = useAnalyticsConsent();

  if (pathname.startsWith('/admin') || pathname.startsWith('/master')) return null;
  if (consent !== null) return null;

  return (
    <div
      className="fixed inset-0 z-110 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]" aria-hidden />

      <div
        className="relative w-full max-w-88 rounded-2xl border border-zinc-700/90 bg-zinc-900/98 px-4 py-4 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_64px_-12px_rgba(0,0,0,0.6)] sm:max-w-md sm:px-5 sm:py-5"
      >
        <div className="flex gap-2.5 sm:gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 sm:h-10 sm:w-10 sm:rounded-xl"
            aria-hidden
          >
            <Cookie size={20} strokeWidth={2} className="sm:h-[22px] sm:w-[22px]" />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <h2 id="cookie-consent-title" className="text-sm font-semibold leading-tight text-zinc-100">
              Conteúdo educativo e privacidade
            </h2>
            <div id="cookie-consent-desc" className="space-y-2 text-xs leading-snug text-zinc-400 sm:text-[13px] sm:leading-relaxed">
              <p>
                Os vídeos da {brand.platformDisplayName} são exclusivamente educativos e informativos e{' '}
                <strong className="font-medium text-zinc-300">não substituem a consulta médica</strong>. Em caso de
                sintomas ou dúvidas, procure seu médico de confiança.
              </p>
              <p>
                Opcionalmente usamos dados de utilização no site. Para saber mais, consulte a{' '}
                <Link
                  to="/privacidade"
                  className="font-medium text-emerald-400 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-300"
                >
                  Política de privacidade
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 pt-0.5 sm:flex-row sm:justify-end sm:gap-2">
              <button
                type="button"
                onClick={deny}
                className="rounded-xl border border-zinc-600 bg-transparent px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 sm:px-4 sm:text-sm"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={grant}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500 sm:px-4 sm:text-sm"
              >
                Aceitar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
