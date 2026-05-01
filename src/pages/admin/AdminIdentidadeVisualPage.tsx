import { useCallback, useEffect, useState } from 'react';
import { deleteObject, ref } from 'firebase/storage';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { uploadBrandingLogo } from '@/lib/firebase/uploadBrandingLogo';
import { storage } from '@/lib/firebase/config';
import {
  clearBrandingLogoFields,
  docToBrandingFormDraft,
  emptyBrandingFormDraft,
  loadBrandingForAdmin,
  saveBrandingLogoFields,
  saveBrandingTexts,
  type BrandingFirestoreDoc,
  type BrandingFormDraft,
} from '@/lib/firestore/branding';
import {
  defaultResolvedBranding,
  PLATFORM_LOGO_SRC,
  STREAMING_ASSISTANT_CHAT_TITLE,
  VENDOR_DISPLAY_FALLBACK,
} from '@/lib/brand';

export function AdminIdentidadeVisualPage() {
  const defaults = defaultResolvedBranding();
  const [remote, setRemote] = useState<BrandingFirestoreDoc | null>(null);
  const [draft, setDraft] = useState<BrandingFormDraft>(emptyBrandingFormDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await loadBrandingForAdmin();
      setRemote(data);
      setDraft(docToBrandingFormDraft(data));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveTexts() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      await saveBrandingTexts(draft);
      setOk('Textos salvos. O site atualiza automaticamente para todos os visitantes.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoFile(file: File | null) {
    if (!file) return;
    setUploadBusy(true);
    setErr(null);
    setOk(null);
    try {
      if (remote?.logoStoragePath) {
        try {
          await deleteObject(ref(storage, remote.logoStoragePath));
        } catch {
          /* ficheiro antigo pode já ter sido apagado */
        }
      }
      const { url, storagePath } = await uploadBrandingLogo(file);
      await saveBrandingLogoFields(url, storagePath);
      setOk('Logo atualizado.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha no envio do logo.');
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleRemoveLogo() {
    setUploadBusy(true);
    setErr(null);
    setOk(null);
    try {
      if (remote?.logoStoragePath) {
        try {
          await deleteObject(ref(storage, remote.logoStoragePath));
        } catch {
          /* ignore */
        }
      }
      await clearBrandingLogoFields();
      setOk('Logo removido — o site volta a usar o ficheiro padrão em public/.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível remover o logo.');
    } finally {
      setUploadBusy(false);
    }
  }

  const previewLogo = remote?.logoUrl?.trim() || PLATFORM_LOGO_SRC;

  return (
    <div className="max-w-3xl">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <Palette size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Identidade visual</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Personalize nome comercial, textos do assistente/vendedor e o logo sem alterar código. Os valores vazios
            voltam aos <strong className="font-medium text-zinc-300">defaults</strong> definidos no projeto (fallback).
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-zinc-500">Carregando…</p>
      ) : (
        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-sm font-semibold text-zinc-200">Logo</h2>
            <p className="mt-1 text-xs text-zinc-500">
              PNG, JPG, SVG ou WebP (até 6 MB). O ficheiro fica no{' '}
              <strong className="text-zinc-400">Firebase Storage</strong>; apenas a URL é guardada no Firestore (
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-[11px]">siteContent/branding</code>
              ).
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3">
                <img
                  src={previewLogo}
                  alt=""
                  className="h-14 w-auto max-w-[280px] object-contain"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700">
                    {uploadBusy ? 'Enviando…' : 'Enviar novo logo'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    disabled={uploadBusy}
                    onChange={(e) => void handleLogoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {remote?.logoUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs"
                    disabled={uploadBusy}
                    onClick={() => void handleRemoveLogo()}
                  >
                    Remover logo personalizado
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Sem logo guardado, usa-se <code className="rounded bg-zinc-800 px-1">{PLATFORM_LOGO_SRC}</code> em{' '}
              <strong className="text-zinc-400">public/</strong>.
            </p>
          </section>

          <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-sm font-semibold text-zinc-200">Textos</h2>
            <Field
              label="Nome da plataforma (documentos e páginas)"
              hint={`Default: ${defaults.platformDisplayName}`}
              value={draft.platformDisplayName}
              onChange={(v) => setDraft((d) => ({ ...d, platformDisplayName: v }))}
            />
            <Field
              label="Nome curto (menus, certificados, PDFs)"
              hint={`Default: ${defaults.platformShortName}`}
              value={draft.platformShortName}
              onChange={(v) => setDraft((d) => ({ ...d, platformShortName: v }))}
            />
            <Field
              label="Título do assistente na home de streaming"
              hint={`Default: ${STREAMING_ASSISTANT_CHAT_TITLE}`}
              value={draft.streamingAssistantChatTitle}
              onChange={(v) => setDraft((d) => ({ ...d, streamingAssistantChatTitle: v }))}
            />
            <Field
              label="Rótulo fallback para vendedor sem nome no perfil"
              hint={`Default: ${VENDOR_DISPLAY_FALLBACK}`}
              value={draft.vendorDisplayFallback}
              onChange={(v) => setDraft((d) => ({ ...d, vendorDisplayFallback: v }))}
            />
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={saving} onClick={() => void handleSaveTexts()}>
              {saving ? 'Salvando…' : 'Salvar textos'}
            </Button>
          </div>

          {err ? (
            <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{err}</p>
          ) : null}
          {ok ? (
            <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
              {ok}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        placeholder="Vazio = usar default do sistema"
      />
      <p className="mt-1 text-[11px] text-zinc-600">{hint}</p>
    </div>
  );
}
