import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Home, LayoutDashboard, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { STORAGE_NS } from '@/lib/brand';

const STORAGE_KEY_PREFIX = `${STORAGE_NS}.vendedor.onboarding.v1:`;

/** Padding ao redor do item do menu destacado */
const HOLE_PAD = 10;

type HighlightTarget = 'welcome' | 'inicio' | 'relatorios' | 'cursos' | 'documentacao';

type Step = {
  title: string;
  body: React.ReactNode;
  icon: React.ReactNode;
  highlight: HighlightTarget;
};

const STEPS: Step[] = [
  {
    title: 'Bem-vindo ao painel do vendedor',
    highlight: 'welcome',
    icon: <Sparkles className="text-sky-400" size={28} />,
    body: (
      <p>
        Este é o seu espaço para acompanhar <strong className="text-zinc-200">empresas da carteira</strong>,
        ver métricas e preparar conversas com clientes. Nos próximos passos, destacamos cada item do menu
        enquanto o restante fica em segundo plano.
      </p>
    ),
  },
  {
    title: 'Início',
    highlight: 'inicio',
    icon: <Home className="text-sky-400" size={28} />,
    body: (
      <p>
        Em <strong className="text-zinc-200">Início</strong> você vê um resumo: quantas empresas acompanha,
        colaboradores e atalhos. Use quando quiser uma visão geral sem gráficos detalhados.
      </p>
    ),
  },
  {
    title: 'Relatórios',
    highlight: 'relatorios',
    icon: <LayoutDashboard className="text-sky-400" size={28} />,
    body: (
      <p>
        <strong className="text-zinc-200">Relatórios</strong> concentra PDFs, prazos de liberação, tabelas e
        gráficos por curso ou por empresa. É a tela mais densa — volte ao <strong className="text-zinc-200">Início</strong>{' '}
        sempre que precisar de algo mais leve.
      </p>
    ),
  },
  {
    title: 'Cursos (prévia)',
    highlight: 'cursos',
    icon: <BookOpen className="text-sky-400" size={28} />,
    body: (
      <p>
        Em <strong className="text-zinc-200">Cursos</strong> você abre o mesmo fluxo que o colaborador vê no
        treinamento. As respostas de questionário <strong className="text-zinc-200">não são salvas</strong> —
        serve para demonstrar e estudar o material antes de uma reunião.
      </p>
    ),
  },
  {
    title: 'Documentação para vendas',
    highlight: 'documentacao',
    icon: <FileText className="text-sky-400" size={28} />,
    body: (
      <div className="space-y-3">
        <p>
          <strong className="text-zinc-200">Documentação</strong> reúne o pitch do modelo B2B, cadastro por
          chaves e um roteiro de cada curso do catálogo (módulos e tipos de conteúdo), com link para a prévia.
        </p>
        <p className="text-sm text-zinc-500">
          Para rever este tour, limpe o armazenamento do site ou a chave{' '}
          <code className="rounded bg-zinc-800 px-1 font-mono text-xs">{STORAGE_NS}.vendedor.onboarding.v1</code>{' '}
          no
          navegador.
        </p>
      </div>
    ),
  },
];

function tourTargetSelector(h: HighlightTarget): string | null {
  if (h === 'welcome') return null;
  return `[data-vendedor-tour="${h}"]`;
}

type Hole = { top: number; left: number; width: number; height: number };

function SpotlightBackdrop({ hole }: { hole: Hole }) {
  const { top, left, width, height } = hole;
  const blurCls =
    'fixed z-70 bg-zinc-950/80 backdrop-blur-md transition-all duration-300 ease-out pointer-events-none';

  return (
    <>
      <div className={blurCls} style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
      <div className={blurCls} style={{ top: top + height, left: 0, right: 0, bottom: 0 }} />
      <div className={blurCls} style={{ top, left: 0, width: Math.max(0, left), height }} />
      <div
        className={blurCls}
        style={{
          top,
          left: left + width,
          right: 0,
          height,
        }}
      />
      <div
        className="pointer-events-none fixed z-71 rounded-xl ring-2 ring-sky-400/90 shadow-[0_0_0_1px_rgba(56,189,248,0.25),0_0_48px_rgba(56,189,248,0.2)] animate-[pulse_2.5s_ease-in-out_infinite]"
        style={{
          top,
          left,
          width,
          height,
        }}
        aria-hidden
      />
    </>
  );
}

type Props = {
  userId: string;
};

type SpotlightState = { active: boolean; hole: Hole | null };

function computeSpotlightState(open: boolean, stepIndex: number): SpotlightState {
  if (!open) return { active: false, hole: null };
  const mq = window.matchMedia('(min-width: 1024px)');
  if (!mq.matches) return { active: false, hole: null };
  const current = STEPS[stepIndex];
  if (current.highlight === 'welcome') return { active: false, hole: null };
  const sel = tourTargetSelector(current.highlight);
  if (!sel) return { active: false, hole: null };
  const el = document.querySelector(sel);
  if (!el || !(el instanceof HTMLElement)) return { active: false, hole: null };
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return { active: false, hole: null };
  return {
    active: true,
    hole: {
      top: r.top - HOLE_PAD,
      left: r.left - HOLE_PAD,
      width: r.width + HOLE_PAD * 2,
      height: r.height + HOLE_PAD * 2,
    },
  };
}

export function VendedorOnboardingTour({ userId }: Props) {
  const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`) !== '1';
    } catch {
      return true;
    }
  });
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightState>({ active: false, hole: null });

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish]);

  const current = STEPS[step];
  const isWelcome = current.highlight === 'welcome';

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setSpotlight(computeSpotlightState(open, step));
    });
    return () => cancelAnimationFrame(id);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      requestAnimationFrame(() => {
        setSpotlight(computeSpotlightState(open, step));
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, step]);

  const cardStyleAndMode = useMemo(() => {
    if (!open) {
      return { mode: 'center' as const, style: undefined as CSSProperties | undefined };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isLg = vw >= 1024;

    if (!isLg || isWelcome || !spotlight.hole || !spotlight.active) {
      return { mode: 'center' as const, style: undefined as CSSProperties | undefined };
    }

    const h = spotlight.hole;
    const cardW = Math.min(440, vw - 32);
    const pad = 16;
    let left = h.left + h.width + pad;
    const top = Math.max(pad, Math.min(h.top, vh - 420));
    if (left + cardW > vw - pad) {
      left = h.left - cardW - pad;
    }
    if (left < pad) {
      left = pad;
    }

    return {
      mode: 'anchored' as const,
      style: {
        position: 'fixed',
        zIndex: 72,
        width: cardW,
        top,
        left,
        maxHeight: 'min(520px, 88vh)',
      } satisfies CSSProperties,
    };
  }, [open, spotlight.hole, spotlight.active, isWelcome]);

  if (!open) return null;

  const isLast = step >= STEPS.length - 1;

  const showFullDim = isWelcome || !spotlight.active;

  const cardShellClass =
    cardStyleAndMode.mode === 'anchored'
      ? 'relative z-[72] flex max-h-[min(520px,88vh)] w-full flex-col overflow-hidden rounded-2xl border border-zinc-600/50 bg-zinc-900/95 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_25px_50px_-12px_rgba(0,0,0,0.65)] pointer-events-auto'
      : 'relative z-[72] flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-zinc-600/50 bg-zinc-900/95 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_25px_50px_-12px_rgba(0,0,0,0.65)] sm:rounded-2xl pointer-events-auto';

  return (
    <div
      className={`fixed inset-0 z-70 ${cardStyleAndMode.mode === 'center' ? 'flex items-end justify-center p-0 sm:items-center sm:p-4' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendedor-onboarding-title"
    >
      {/* Fundo: boas-vindas ou mobile / sem spotlight — um único véu clicável */}
      {showFullDim ? (
        <button
          type="button"
          className="absolute inset-0 z-70 bg-zinc-950/82 backdrop-blur-md transition-opacity duration-300"
          aria-label="Fechar tour"
          onClick={finish}
        />
      ) : (
        <>
          {spotlight.hole ? <SpotlightBackdrop hole={spotlight.hole} /> : null}
        </>
      )}

      {/* Cartão */}
      <div
        className={cardShellClass}
        style={cardStyleAndMode.style}
      >
        <div className="relative overflow-hidden rounded-t-3xl border-b border-sky-500/25 bg-linear-to-br from-sky-950/85 via-zinc-900/95 to-zinc-950 px-5 py-5 sm:rounded-t-2xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-emerald-500/5 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 ring-1 ring-sky-400/35 shadow-inner shadow-sky-500/10">
                {current.icon}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/95">
                  Passo {step + 1} de {STEPS.length}
                </p>
                <h2 id="vendedor-onboarding-title" className="text-xl font-semibold tracking-tight text-zinc-50">
                  {current.title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={finish}
              className="shrink-0 rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-800/80 hover:text-zinc-200"
              aria-label="Fechar"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-zinc-300">
          {current.body}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/90 bg-zinc-950/50 px-5 py-4">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step ? 'w-8 bg-sky-500 shadow-[0_0_14px_rgba(56,189,248,0.55)]' : 'w-2 bg-zinc-700'
                }`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" className="text-zinc-400" onClick={finish}>
              Pular
            </Button>
            {!isLast ? (
              <Button
                type="button"
                variant="primary"
                className="bg-sky-600 hover:bg-sky-500"
                onClick={() => setStep((s) => s + 1)}
              >
                Próximo
              </Button>
            ) : (
              <Link
                to="/vendedor"
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-900/40 hover:bg-sky-500"
                onClick={finish}
              >
                Ir para o Início
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
