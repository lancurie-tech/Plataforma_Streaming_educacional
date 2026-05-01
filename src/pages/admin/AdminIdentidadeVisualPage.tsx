import { useCallback, useEffect, useState } from 'react';
import { deleteObject, ref } from 'firebase/storage';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { uploadBrandingFavicon } from '@/lib/firebase/uploadBrandingFavicon';
import { uploadBrandingLogo } from '@/lib/firebase/uploadBrandingLogo';
import { storage } from '@/lib/firebase/config';
import {
  clearBrandingFaviconFields,
  clearBrandingLogoFields,
  docToBrandingPaletteDraft,
  docToBrandingFormDraft,
  emptyBrandingFormDraft,
  loadBrandingForAdmin,
  saveBrandingPalette,
  saveBrandingFaviconFields,
  saveBrandingLogoFields,
  saveBrandingTexts,
  type BrandingPaletteDraft,
  type BrandingFirestoreDoc,
  type BrandingFormDraft,
} from '@/lib/firestore/branding';
import {
  DEFAULT_BRAND_PALETTE,
  defaultResolvedBranding,
  PLATFORM_FAVICON_SRC,
  PLATFORM_LOGO_SRC,
  STREAMING_ASSISTANT_CHAT_TITLE,
  VENDOR_DISPLAY_FALLBACK,
} from '@/lib/brand';

const PALETTE_PRESETS: {
  id: string;
  name: string;
  description: string;
  palette: BrandingPaletteDraft;
}[] = [
  {
    id: 'deep-teal',
    name: 'Profissional escuro',
    description: 'Fundo escuro com destaque em verde-azulado.',
    palette: {
      primary: '#0f766e',
      primaryHover: '#14b8a6',
      accent: '#2dd4bf',
      background: '#0b1220',
      text: '#f8fafc',
      textMuted: '#94a3b8',
    },
  },
  {
    id: 'clean-light',
    name: 'Clean claro',
    description: 'Layout claro para marcas com identidade suave.',
    palette: {
      primary: '#2563eb',
      primaryHover: '#3b82f6',
      accent: '#0ea5e9',
      background: '#f8fafc',
      text: '#0f172a',
      textMuted: '#475569',
    },
  },
  {
    id: 'warm-brand',
    name: 'Marca quente',
    description: 'Tom quente com boa leitura em fundo escuro.',
    palette: {
      primary: '#b45309',
      primaryHover: '#d97706',
      accent: '#f59e0b',
      background: '#111827',
      text: '#f9fafb',
      textMuted: '#9ca3af',
    },
  },
];

export function AdminIdentidadeVisualPage() {
  const defaults = defaultResolvedBranding();
  const [remote, setRemote] = useState<BrandingFirestoreDoc | null>(null);
  const [draft, setDraft] = useState<BrandingFormDraft>(emptyBrandingFormDraft());
  const [paletteDraft, setPaletteDraft] = useState<BrandingPaletteDraft>(docToBrandingPaletteDraft(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [logoPresetBusy, setLogoPresetBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await loadBrandingForAdmin();
      setRemote(data);
      setDraft(docToBrandingFormDraft(data));
      setPaletteDraft(docToBrandingPaletteDraft(data));
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

  async function handleSavePalette() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      for (const [k, v] of Object.entries(paletteDraft)) {
        const t = v.trim();
        if (t && !/^#[0-9a-fA-F]{6}$/.test(t)) {
          throw new Error(`Valor inválido em ${k}. Use formato hexadecimal como #1A2B3C.`);
        }
      }
      await saveBrandingPalette(paletteDraft);
      setOk('Paleta salva. O site atualiza automaticamente para todos os visitantes.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar paleta.');
    } finally {
      setSaving(false);
    }
  }

  function applyAutoContrast() {
    const bg = paletteDraft.background.trim() || DEFAULT_BRAND_PALETTE.background;
    const hex = normalizeHex(bg) ?? DEFAULT_BRAND_PALETTE.background;
    const [r, g, b] = hexToRgb(hex);
    const luminance = relativeLuminance(r, g, b);
    const useDarkText = luminance > 0.5;
    setPaletteDraft((d) => ({
      ...d,
      text: useDarkText ? '#111827' : '#f9fafb',
      textMuted: useDarkText ? '#374151' : '#9ca3af',
    }));
    setOk('Auto-contraste aplicado. Revise e clique em "Salvar paleta".');
    setErr(null);
  }

  function applyPalettePreset(preset: BrandingPaletteDraft, name: string) {
    setPaletteDraft({ ...preset });
    setOk(`Preset "${name}" aplicado. Ajuste manualmente se quiser e clique em "Salvar paleta".`);
    setErr(null);
  }

  async function applyLogoBasedPreset() {
    if (!previewLogo) {
      setErr('Envie um logo antes de gerar preset baseado na marca.');
      setOk(null);
      return;
    }
    setLogoPresetBusy(true);
    setErr(null);
    setOk(null);
    try {
      const palette = await buildPaletteFromLogo(previewLogo);
      setPaletteDraft(palette);
      setOk('Preset "Baseado no logo" aplicado. Ajuste manualmente se quiser e clique em "Salvar paleta".');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('cors-blocked') || msg.includes('tainted-canvas')) {
        setErr(
          'Não foi possível analisar o logo por CORS do Firebase Storage no localhost. Configure CORS do bucket para permitir sua origem (ex.: http://localhost:5174) e tente novamente.'
        );
      } else {
        setErr('Não foi possível extrair cores do logo. Tente outro arquivo ou ajuste manualmente.');
      }
    } finally {
      setLogoPresetBusy(false);
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
      setOk('Logo removido.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível remover o logo.');
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleFaviconFile(file: File | null) {
    if (!file) return;
    setUploadBusy(true);
    setErr(null);
    setOk(null);
    try {
      if (remote?.faviconStoragePath) {
        try {
          await deleteObject(ref(storage, remote.faviconStoragePath));
        } catch {
          /* ficheiro antigo pode já ter sido apagado */
        }
      }
      const { url, storagePath } = await uploadBrandingFavicon(file);
      await saveBrandingFaviconFields(url, storagePath);
      setOk('Favicon atualizado.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha no envio do favicon.');
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleRemoveFavicon() {
    setUploadBusy(true);
    setErr(null);
    setOk(null);
    try {
      if (remote?.faviconStoragePath) {
        try {
          await deleteObject(ref(storage, remote.faviconStoragePath));
        } catch {
          /* ignore */
        }
      }
      await clearBrandingFaviconFields();
      setOk('Favicon removido.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível remover o favicon.');
    } finally {
      setUploadBusy(false);
    }
  }

  const previewLogo = remote?.logoUrl?.trim() || PLATFORM_LOGO_SRC;
  const previewFavicon = remote?.faviconUrl?.trim() || PLATFORM_FAVICON_SRC;

  return (
    <div className="max-w-3xl">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--brand-primary) text-white">
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
                {previewLogo ? (
                  <img
                    src={previewLogo}
                    alt=""
                    className="h-14 w-auto max-w-[280px] object-contain"
                  />
                ) : (
                  <span className="text-xs text-zinc-500">Sem logo configurado</span>
                )}
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
              Sem logo guardado, nenhum logo é exibido até existir uma imagem personalizada.
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-sm font-semibold text-zinc-200">Favicon</h2>
            <p className="mt-1 text-xs text-zinc-500">
              PNG, JPG, SVG, WebP ou ICO (até 2 MB). Fica no{' '}
              <strong className="text-zinc-400">Firebase Storage</strong>; a URL é guardada no Firestore (
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-[11px]">siteContent/branding</code>).
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3">
                {previewFavicon ? (
                  <img src={previewFavicon} alt="" className="h-10 w-10 rounded-md object-contain" />
                ) : (
                  <span className="text-xs text-zinc-500">Sem favicon configurado</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700">
                    {uploadBusy ? 'Enviando…' : 'Enviar favicon'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                    className="sr-only"
                    disabled={uploadBusy}
                    onChange={(e) => void handleFaviconFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {remote?.faviconUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs"
                    disabled={uploadBusy}
                    onClick={() => void handleRemoveFavicon()}
                  >
                    Remover favicon personalizado
                  </Button>
                ) : null}
              </div>
            </div>
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

          <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-sm font-semibold text-zinc-200">Paleta de cores</h2>
            <p className="text-xs text-zinc-500">
              Defina as cores principais do site. Campo vazio volta para o default do sistema.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Presets</p>
              <div className="grid gap-2 sm:grid-cols-4">
                {PALETTE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPalettePreset(preset.palette, preset.name)}
                    className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-left transition hover:border-(--brand-primary-hover) hover:bg-zinc-800/80"
                  >
                    <p className="text-sm font-medium text-zinc-200">{preset.name}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">{preset.description}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 rounded-full border border-zinc-600" style={{ backgroundColor: preset.palette.primary }} />
                      <span className="h-3.5 w-3.5 rounded-full border border-zinc-600" style={{ backgroundColor: preset.palette.primaryHover }} />
                      <span className="h-3.5 w-3.5 rounded-full border border-zinc-600" style={{ backgroundColor: preset.palette.accent }} />
                      <span className="h-3.5 w-3.5 rounded-full border border-zinc-600" style={{ backgroundColor: preset.palette.background }} />
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void applyLogoBasedPreset()}
                  disabled={logoPresetBusy || !previewLogo}
                  className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-left transition hover:border-(--brand-primary-hover) hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="text-sm font-medium text-zinc-200">Baseado no logo</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {previewLogo
                      ? 'Extrai tons principais da imagem atual do logo.'
                      : 'Envie um logo para habilitar este preset.'}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {logoPresetBusy ? (
                      <span className="text-[11px] text-zinc-500">Analisando…</span>
                    ) : (
                      <>
                        <span className="h-3.5 w-3.5 rounded-full border border-zinc-600 bg-zinc-500" />
                        <span className="h-3.5 w-3.5 rounded-full border border-zinc-600 bg-zinc-500" />
                        <span className="h-3.5 w-3.5 rounded-full border border-zinc-600 bg-zinc-500" />
                        <span className="h-3.5 w-3.5 rounded-full border border-zinc-600 bg-zinc-500" />
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" className="text-xs" onClick={applyAutoContrast}>
                Auto-contraste
              </Button>
            </div>
            <ColorField
              label="Cor primária (botões principais)"
              hint={`Default: ${DEFAULT_BRAND_PALETTE.primary}`}
              value={paletteDraft.primary}
              onChange={(v) => setPaletteDraft((d) => ({ ...d, primary: v }))}
            />
            <ColorField
              label="Cor primária hover/foco"
              hint={`Default: ${DEFAULT_BRAND_PALETTE.primaryHover}`}
              value={paletteDraft.primaryHover}
              onChange={(v) => setPaletteDraft((d) => ({ ...d, primaryHover: v }))}
            />
            <ColorField
              label="Cor de acento"
              hint={`Default: ${DEFAULT_BRAND_PALETTE.accent}`}
              value={paletteDraft.accent}
              onChange={(v) => setPaletteDraft((d) => ({ ...d, accent: v }))}
            />
            <ColorField
              label="Cor de fundo global"
              hint={`Default: ${DEFAULT_BRAND_PALETTE.background}`}
              value={paletteDraft.background}
              onChange={(v) => setPaletteDraft((d) => ({ ...d, background: v }))}
            />
            <ColorField
              label="Cor do texto principal"
              hint={`Default: ${DEFAULT_BRAND_PALETTE.text}`}
              value={paletteDraft.text}
              onChange={(v) => setPaletteDraft((d) => ({ ...d, text: v }))}
            />
            <ColorField
              label="Cor do texto secundário"
              hint={`Default: ${DEFAULT_BRAND_PALETTE.textMuted}`}
              value={paletteDraft.textMuted}
              onChange={(v) => setPaletteDraft((d) => ({ ...d, textMuted: v }))}
            />
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={saving} onClick={() => void handleSaveTexts()}>
              {saving ? 'Salvando…' : 'Salvar textos'}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSavePalette()}>
              {saving ? 'Salvando…' : 'Salvar paleta'}
            </Button>
          </div>

          {err ? (
            <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{err}</p>
          ) : null}
          {ok ? (
            <p className="rounded-lg border border-(--brand-primary-hover) bg-(--brand-primary) px-4 py-3 text-sm text-white">
              {ok}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function normalizeHex(input: string): string | null {
  const t = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const rl = toLinear(r);
  const gl = toLinear(g);
  const bl = toLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h /= 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function shiftLightness(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const nextL = clamp(l + amount, 0.05, 0.92);
  const [nr, ng, nb] = hslToRgb(h, s, nextL);
  return rgbToHex(nr, ng, nb);
}

async function buildPaletteFromLogo(imageUrl: string): Promise<BrandingPaletteDraft> {
  const img = new Image();
  if (/^https?:\/\//i.test(imageUrl)) {
    img.crossOrigin = 'anonymous';
  }
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('cors-blocked:image-load-failed'));
    img.src = imageUrl;
  });

  const w = Math.max(1, Math.min(220, img.naturalWidth || img.width || 220));
  const h = Math.max(1, Math.min(220, img.naturalHeight || img.height || 220));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    throw new Error('tainted-canvas');
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number; sat: number; lum: number }>();
  for (let i = 0; i < data.length; i += 4 * 2) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 90) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = relativeLuminance(r, g, b);
    if (sat < 0.08) continue;
    const qr = Math.round(r / 20) * 20;
    const qg = Math.round(g / 20) * 20;
    const qb = Math.round(b / 20) * 20;
    const key = `${qr}-${qg}-${qb}`;
    const prev = buckets.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      buckets.set(key, { count: 1, r: qr, g: qg, b: qb, sat, lum });
    }
  }

  const ranked = [...buckets.values()].sort((a, b) => b.count - a.count);
  const primaryRgb = ranked[0] ? [ranked[0].r, ranked[0].g, ranked[0].b] as [number, number, number] : [15, 118, 110];
  const accentPick = ranked.find((c) => Math.abs(c.r - primaryRgb[0]) + Math.abs(c.g - primaryRgb[1]) + Math.abs(c.b - primaryRgb[2]) > 70);
  const accentRgb = accentPick ? [accentPick.r, accentPick.g, accentPick.b] as [number, number, number] : [45, 212, 191];

  const bgCandidate = ranked.find((c) => c.lum < 0.2) ?? ranked[0];
  const bgBase = bgCandidate ? rgbToHex(bgCandidate.r, bgCandidate.g, bgCandidate.b) : '#0b1220';
  const background = shiftLightness(bgBase, -0.08);

  const primary = rgbToHex(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  const accent = rgbToHex(accentRgb[0], accentRgb[1], accentRgb[2]);
  const primaryHover = shiftLightness(primary, 0.08);

  const [br, bg, bb] = hexToRgb(background);
  const bgLum = relativeLuminance(br, bg, bb);
  const text = bgLum > 0.5 ? '#111827' : '#f8fafc';
  const textMuted = bgLum > 0.5 ? '#374151' : '#94a3b8';

  return { primary, primaryHover, accent, background, text, textMuted };
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
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-(--brand-primary-hover) focus:outline-none focus:ring-1 focus:ring-(--brand-primary-hover)"
        placeholder="Vazio = usar default do sistema"
      />
      <p className="mt-1 text-[11px] text-zinc-600">{hint}</p>
    </div>
  );
}

function ColorField({
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
  const normalized = /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : '#000000';
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</label>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="color"
          value={normalized}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-(--brand-primary-hover) focus:outline-none focus:ring-1 focus:ring-(--brand-primary-hover)"
          placeholder="#000000"
        />
      </div>
      <p className="mt-1 text-[11px] text-zinc-600">{hint}</p>
    </div>
  );
}
