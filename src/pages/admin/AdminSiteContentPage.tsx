import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  docToDraft,
  emptySitePublicContentDraft,
  loadSitePublicContentForEdit,
  saveSitePublicContent,
  type SitePublicContentDraft,
} from '@/lib/firestore/siteContent';
import { DEFAULT_ABOUT_MARKDOWN } from '@/legal/defaultAboutMarkdown';
import { DEFAULT_CONTACT_MARKDOWN } from '@/legal/defaultContactMarkdown';
import {
  DEFAULT_COMMITMENTS_MARKDOWN,
  DEFAULT_PRIVACY_MARKDOWN,
  DEFAULT_TERMS_MARKDOWN,
  DEFAULT_VENDOR_CONFIDENTIALITY_MARKDOWN,
} from '@/legal/referenceLegalMarkdown';
import { DEFAULT_ACCOUNT_RIGHTS_MARKDOWN } from '@/legal/defaultAccountRightsMarkdown';
import { useBrand } from '@/contexts/useBrand';

type TabId =
  | 'about'
  | 'contact'
  | 'terms'
  | 'privacy'
  | 'commitments'
  | 'vendorConfidentiality'
  | 'accountRights';

const REFERENCE_BY_TAB: Record<TabId, string> = {
  about: DEFAULT_ABOUT_MARKDOWN,
  contact: DEFAULT_CONTACT_MARKDOWN,
  terms: DEFAULT_TERMS_MARKDOWN,
  privacy: DEFAULT_PRIVACY_MARKDOWN,
  commitments: DEFAULT_COMMITMENTS_MARKDOWN,
  vendorConfidentiality: DEFAULT_VENDOR_CONFIDENTIALITY_MARKDOWN,
  accountRights: DEFAULT_ACCOUNT_RIGHTS_MARKDOWN,
};

export function AdminSiteContentPage() {
  const brand = useBrand();
  const tabs = useMemo(
    (): { id: TabId; label: string; hint: string; previewPath: string }[] => [
      {
        id: 'about',
        label: `Sobre — ${brand.platformShortName}`,
        hint: 'Página /sobre — conteúdo institucional. Sem texto aqui, o site usa o texto padrão do sistema.',
        previewPath: '/sobre',
      },
      {
        id: 'contact',
        label: 'Contato',
        hint: 'Página /contato. Sem texto aqui, o site usa o modelo de contato padrão do sistema.',
        previewPath: '/contato',
      },
      {
        id: 'terms',
        label: 'Termos de uso',
        hint: 'Sem texto salvo no Firestore, o site exibe o documento em React no código. Use “Preencher com texto de referência” para copiar esse texto em Markdown e editar.',
        previewPath: '/termos',
      },
      {
        id: 'privacy',
        label: 'Política de privacidade',
        hint: 'Sem texto salvo, o site usa o documento padrão do código. “Preencher com texto de referência” traz o mesmo conteúdo em Markdown.',
        previewPath: '/privacidade',
      },
      {
        id: 'commitments',
        label: 'Compromissos do participante',
        hint: 'Sem texto salvo, o site usa o documento padrão do código. “Preencher com texto de referência” traz o mesmo conteúdo em Markdown.',
        previewPath: '/compromissos',
      },
      {
        id: 'vendorConfidentiality',
        label: 'Confidencialidade (vendedor)',
        hint: 'Sem texto salvo, o site usa o documento padrão do código. “Preencher com texto de referência” traz o mesmo conteúdo em Markdown.',
        previewPath: '/confidencialidade-vendedor',
      },
      {
        id: 'accountRights',
        label: 'Área do usuário (LGPD)',
        hint: 'Texto na coluna direita da página /perfil (direitos LGPD/GDPR e contacto). Deixe vazio para usar o texto padrão do sistema.',
        previewPath: '/perfil',
      },
    ],
    [brand.platformShortName],
  );

  const [tab, setTab] = useState<TabId>('about');
  const [draft, setDraft] = useState<SitePublicContentDraft>(emptySitePublicContentDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await loadSitePublicContentForEdit();
      setDraft(docToDraft(data));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      await saveSitePublicContent(draft);
      setOk('Alterações salvas. O site público passa a usar estes textos (pode levar um instante ao recarregar).');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  const active = tabs.find((t) => t.id === tab)!;
  const markdownKey = `${tab}Markdown` as keyof SitePublicContentDraft;
  const versionKey = `${tab}Version` as keyof SitePublicContentDraft;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-zinc-100">Conteúdo do site público</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Edite os textos em <strong className="font-medium text-zinc-300">Markdown</strong> (títulos com{' '}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">##</code>, negrito com{' '}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">**</code>, listas com{' '}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">-</code>). Deixe o corpo vazio para voltar ao
        texto padrão do sistema. As páginas <strong className="text-zinc-300">Sobre</strong> e{' '}
        <strong className="text-zinc-300">Contato</strong> têm modelo embutido até você publicar conteúdo
        aqui; nas demais, o padrão continua sendo os documentos em código até você salvar Markdown no
        Firestore (ou use o botão de referência para copiar esse texto).
      </p>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-(--brand-primary) text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-zinc-500">Carregando…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={active.previewPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-(--brand-primary-hover) hover:underline"
            >
              Abrir página no site
              <ExternalLink size={14} />
            </Link>
            <Button
              type="button"
              variant="outline"
              className="text-xs"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  [markdownKey]: REFERENCE_BY_TAB[tab],
                }))
              }
            >
              Preencher com texto de referência (código)
            </Button>
          </div>

          <p className="text-xs text-zinc-500">{active.hint}</p>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Versão exibida no rodapé do documento
            </label>
            <input
              type="text"
              value={draft[versionKey] as string}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  [versionKey]: e.target.value,
                }))
              }
              placeholder="Ex.: 2026-04-18-v2 (vazio = usa a versão padrão do código)"
              className="mt-2 w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-(--brand-primary-hover) focus:outline-none focus:ring-1 focus:ring-(--brand-primary-hover)"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Corpo (Markdown)
            </label>
            <textarea
              value={draft[markdownKey] as string}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  [markdownKey]: e.target.value,
                }))
              }
              rows={22}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-3 font-mono text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-(--brand-primary-hover) focus:outline-none focus:ring-1 focus:ring-(--brand-primary-hover)"
              placeholder="Deixe vazio para usar o conteúdo padrão do sistema…"
            />
          </div>

          {err ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {err}
            </p>
          ) : null}
          {ok ? (
            <p className="rounded-lg border border-(--brand-primary-hover) bg-(--brand-primary) px-3 py-2 text-sm text-white/95">
              {ok}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void handleSave()} disabled={saving} isLoading={saving}>
              Salvar todas as páginas
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void load()}>
              Recarregar do Firestore
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
