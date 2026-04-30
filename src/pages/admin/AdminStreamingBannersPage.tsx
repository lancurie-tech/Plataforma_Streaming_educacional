import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ChevronDown, ChevronUp, ExternalLink, ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/firebase/config';
import { uploadStreamingBannerImage } from '@/lib/firebase/uploadStreamingBannerImage';
import {
  createStreamingBannerDraft,
  deleteStreamingBannerAdmin,
  listAllStreamingBannersAdmin,
  reorderStreamingBannersAdmin,
  saveStreamingBannerAdmin,
} from '@/lib/firestore/streamingBannersAdmin';
import type { StreamingBanner } from '@/types';

export function AdminStreamingBannersPage() {
  const [items, setItems] = useState<StreamingBanner[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ id: string; kind: 'desktop' | 'mobile' } | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setErr(null);
    const list = await listAllStreamingBannersAdmin();
    setItems(list);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch {
        setErr('Não foi possível carregar os banners.');
        setItems([]);
      }
    })();
  }, [refresh]);

  function patch(id: string, partial: Partial<StreamingBanner>) {
    setItems((list) => (list ? list.map((b) => (b.id === id ? { ...b, ...partial } : b)) : list));
  }

  async function handleSave(b: StreamingBanner) {
    setSavingId(b.id);
    setErr(null);
    try {
      await saveStreamingBannerAdmin(b.id, {
        title: b.title,
        imageUrl: b.imageUrl,
        imageUrlMobile: b.imageUrlMobile ?? '',
        linkUrl: b.linkUrl,
        order: b.order,
        published: b.published,
      });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este banner?')) return;
    setErr(null);
    try {
      await deleteStreamingBannerAdmin(id);
      await refresh();
    } catch {
      setErr('Não foi possível remover.');
    }
  }

  async function handleNew() {
    setCreating(true);
    setErr(null);
    try {
      await createStreamingBannerDraft();
      await refresh();
    } catch {
      setErr('Não foi possível criar o banner.');
    } finally {
      setCreating(false);
    }
  }

  async function handleReorder(orderedIds: string[]) {
    setErr(null);
    try {
      await reorderStreamingBannersAdmin(orderedIds);
      await refresh();
    } catch {
      setErr('Não foi possível atualizar a ordem.');
    }
  }

  function move(id: string, dir: -1 | 1) {
    if (!items?.length) return;
    const sorted = [...items].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    const i = sorted.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[i], next[j]] = [next[j]!, next[i]!];
    void handleReorder(next.map((b) => b.id));
  }

  async function handleUploadFile(id: string, kind: 'desktop' | 'mobile', file: File | null) {
    if (!file) return;
    setUploading({ id, kind });
    setErr(null);
    try {
      const url = await uploadStreamingBannerImage(id, file, kind);
      await setDoc(
        doc(db, 'streamingBanners', id),
        kind === 'desktop'
          ? { imageUrl: url, updatedAt: serverTimestamp() }
          : { imageUrlMobile: url, updatedAt: serverTimestamp() },
        { merge: true },
      );
      patch(id, kind === 'desktop' ? { imageUrl: url } : { imageUrlMobile: url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha no envio da imagem.');
    } finally {
      setUploading(null);
    }
  }

  if (items === null && !err) {
    return <p className="text-zinc-500">Carregando…</p>;
  }

  const sorted = items ? [...items].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)) : [];

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Banners do Streaming</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Carrossel acima dos Canais: cinco miniaturas com a do meio em destaque; a rotação faz cada banner
            ocupar o centro por vez. Arte em proporção mais quadrada (ex. 4:3 ou 16:10) costuma ler melhor nas
            laterais; imagem opcional para telemóvel. Destino do clique: rota interna (ex.{' '}
            <code className="rounded bg-zinc-800 px-1 text-xs">/cursos?program=ID</code>,{' '}
            <code className="rounded bg-zinc-800 px-1 text-xs">/streaming?entry=ID</code>) ou URL completa.
          </p>
        </div>
        <Button type="button" onClick={() => void handleNew()} disabled={creating} isLoading={creating}>
          Novo banner
        </Button>
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        Pré-visualizar:{' '}
        <Link
          to="/streaming"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
        >
          Abrir Streaming
          <ExternalLink size={14} />
        </Link>
      </p>

      {err ? <p className="mt-6 text-sm text-red-400">{err}</p> : null}

      <ul className="mt-8 space-y-6">
        {sorted.map((b, idx) => (
          <li
            key={b.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Banner {idx + 1} · ordem {b.order}
              </p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  title="Subir"
                  disabled={idx === 0}
                  onClick={() => move(b.id, -1)}
                  className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  type="button"
                  title="Descer"
                  disabled={idx >= sorted.length - 1}
                  onClick={() => move(b.id, 1)}
                  className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>

            <label className="mt-3 block text-xs text-zinc-500">
              Título (acessível / leitores de ecrã)
              <input
                type="text"
                value={b.title}
                onChange={(e) => patch(b.id, { title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>

            <label className="mt-3 block text-xs text-zinc-500">
              Destino do clique (URL ou rota)
              <input
                type="text"
                value={b.linkUrl}
                onChange={(e) => patch(b.id, { linkUrl: e.target.value })}
                placeholder="/cursos?program=… ou https://…"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              />
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-zinc-500">Imagem principal</p>
                <div className="mt-2 aspect-21/9 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-600">Sem imagem</div>
                  )}
                </div>
                <label className="mt-2 inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploading?.id === b.id && uploading.kind === 'desktop'}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = '';
                      void handleUploadFile(b.id, 'desktop', f);
                    }}
                  />
                  <span
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-transparent px-4 py-2.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800 ${
                      uploading?.id === b.id && uploading.kind === 'desktop' ? 'opacity-50' : ''
                    }`}
                  >
                    {uploading?.id === b.id && uploading.kind === 'desktop' ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <ImagePlus size={16} />
                    )}
                    Enviar desktop
                  </span>
                </label>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Imagem mobile (opcional)</p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-600">
                  Se o banner for muito horizontal, no telemóvel pode cortar texto. Uma arte mais alta ou centrada no
                  telemóvel evita isso.
                </p>
                <div className="mt-2 aspect-16/10 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                  {b.imageUrlMobile ? (
                    <img
                      src={b.imageUrlMobile}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                      Usa a principal
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploading?.id === b.id && uploading.kind === 'mobile'}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = '';
                        void handleUploadFile(b.id, 'mobile', f);
                      }}
                    />
                    <span
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-transparent px-4 py-2.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800 ${
                        uploading?.id === b.id && uploading.kind === 'mobile' ? 'opacity-50' : ''
                      }`}
                    >
                      {uploading?.id === b.id && uploading.kind === 'mobile' ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <ImagePlus size={16} />
                      )}
                      Enviar mobile
                    </span>
                  </label>
                  {b.imageUrlMobile ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-zinc-500"
                      onClick={() => {
                        void (async () => {
                          try {
                            await setDoc(
                              doc(db, 'streamingBanners', b.id),
                              { imageUrlMobile: null, updatedAt: serverTimestamp() },
                              { merge: true },
                            );
                            patch(b.id, { imageUrlMobile: undefined });
                          } catch {
                            setErr('Não foi possível limpar a imagem mobile.');
                          }
                        })();
                      }}
                    >
                      Limpar mobile
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500"
                checked={b.published}
                onChange={(e) => patch(b.id, { published: e.target.checked })}
              />
              Publicar na home (só com imagem principal)
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void handleSave(b)}
                disabled={savingId === b.id}
                isLoading={savingId === b.id}
              >
                Salvar alterações
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleDelete(b.id)}>
                <Trash2 size={16} />
                Remover
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {sorted.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Nenhum banner. Crie um para começar.</p>
      ) : null}
    </div>
  );
}
