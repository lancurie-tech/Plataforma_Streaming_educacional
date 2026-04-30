import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Radio, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { uploadChannelCover } from '@/lib/firebase/uploadChannelCover';
import { uploadChannelPageVideoCover } from '@/lib/firebase/uploadChannelPageVideoCover';
import {
  deleteChannelAdmin,
  getChannelAdmin,
  saveChannelAdmin,
} from '@/lib/firestore/channelsAdmin';
import type { ChannelPageVideo } from '@/types';

function newVideoRow(order: number): ChannelPageVideo {
  return {
    id: crypto.randomUUID(),
    title: '',
    vimeoUrl: '',
    order,
  };
}

function ChannelPageVideoCoverRow({
  channelId,
  video,
  onUpdate,
  saving,
  uploading,
  onUploadStart,
  onUploadEnd,
  onUploadError,
}: {
  channelId: string;
  video: ChannelPageVideo;
  onUpdate: (patch: Partial<ChannelPageVideo>) => void;
  saving: boolean;
  uploading: boolean;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  onUploadError: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cover = video.coverImageUrl ?? '';

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-zinc-800/90 bg-zinc-900/40 p-3">
      <p className="text-xs font-medium text-zinc-500">Capa do vídeo (cards na página pública)</p>
      {cover.trim() ? (
        <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
          <img
            src={cover.trim()}
            alt=""
            className="aspect-video max-h-48 w-full object-cover sm:max-h-none"
          />
        </div>
      ) : null}
      <Input
        label="URL da imagem (opcional)"
        value={cover}
        onChange={(e) => onUpdate({ coverImageUrl: e.target.value })}
        placeholder="https://… ou envie um arquivo abaixo"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file || !channelId) return;
          onUploadStart();
          void (async () => {
            try {
              const url = await uploadChannelPageVideoCover(channelId, video.id, file);
              onUpdate({ coverImageUrl: url });
            } catch (err) {
              onUploadError(
                err instanceof Error ? err.message : 'Falha no envio (Storage / regras / tamanho).'
              );
            } finally {
              onUploadEnd();
            }
          })();
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="text-sm"
          disabled={!channelId || saving || uploading}
          isLoading={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} />
          Enviar PNG / JPG / WebP
        </Button>
        {cover.trim() ? (
          <Button type="button" variant="outline" className="text-sm" disabled={saving || uploading} onClick={() => onUpdate({ coverImageUrl: '' })}>
            Remover capa
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminChannelEditor() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPageVideoId, setUploadingPageVideoId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [order, setOrder] = useState(0);
  const [published, setPublished] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [pageDescription, setPageDescription] = useState('');
  const [pageVideos, setPageVideos] = useState<ChannelPageVideo[]>([]);

  const load = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    setErr(null);
    try {
      const ch = await getChannelAdmin(channelId);
      if (!ch) {
        setErr('Canal não encontrado.');
        return;
      }
      setTitle(ch.title);
      setOrder(ch.order);
      setPublished(ch.published);
      setCoverImageUrl(ch.coverImageUrl ?? '');
      setPageDescription(ch.pageDescription ?? '');
      setPageVideos(
        ch.pageVideos?.length
          ? ch.pageVideos.map((v, i) => ({
              ...v,
              order: typeof v.order === 'number' ? v.order : i,
            }))
          : [],
      );
    } catch {
      setErr('Não foi possível carregar o canal.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [msg]);

  async function handleSave() {
    if (!channelId) return;
    setSaving(true);
    setErr(null);
    try {
      await saveChannelAdmin(channelId, {
        title,
        order: Number.isFinite(order) ? order : 0,
        published,
        coverImageUrl,
        pageDescription,
        pageVideos,
      });
      setMsg('Salvo.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!channelId) return;
    if (!window.confirm('Excluir este canal permanentemente?')) return;
    setDeleting(true);
    setErr(null);
    try {
      await deleteChannelAdmin(channelId);
      navigate('/admin/canais');
    } catch {
      setErr('Não foi possível excluir.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-500">Carregando…</p>;
  }

  if (err && !title && err.includes('não encontrado')) {
    return (
      <div>
        <p className="text-red-400">{err}</p>
        <Link to="/admin/canais" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
          Voltar aos canais
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <Link
          to="/admin/canais"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft size={18} />
          Canais
        </Link>
      </div>

      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <Radio size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Editar canal</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Página pública em <span className="font-mono text-zinc-300">/canal/{channelId}</span>. Vídeos próprios
            abaixo; programas do catálogo ligam-se a este canal no editor de cada curso.
          </p>
        </div>
      </div>

      {msg ? (
        <p className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {msg}
        </p>
      ) : null}
      {err ? <p className="mt-6 text-sm text-red-400">{err}</p> : null}

      <div className="mt-8 space-y-6">
        <Input label="Nome do canal" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input
          label="Ordem (número)"
          type="number"
          value={String(order)}
          onChange={(e) => setOrder(Number.parseInt(e.target.value, 10) || 0)}
        />

        <div>
          <label htmlFor="channel-page-desc" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Texto na página (opcional)
          </label>
          <textarea
            id="channel-page-desc"
            value={pageDescription}
            onChange={(e) => setPageDescription(e.target.value)}
            rows={3}
            placeholder="Breve apresentação acima dos vídeos…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-sm font-medium text-zinc-300">Vídeos na página do canal</p>
          <p className="mt-1 text-xs text-zinc-500">
            URLs Vimeo; opcionalmente capa por vídeo (link ou envio ao Storage), como nas trilhas da home streaming.
            Ordene com as setas.
          </p>
          <div className="mt-4 space-y-4">
            {pageVideos.map((row, i) => (
              <div key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <div className="sm:flex sm:flex-wrap sm:items-end sm:gap-3">
                  <div className="min-w-0 flex-1 space-y-2 sm:flex sm:flex-1 sm:flex-wrap sm:gap-2 sm:space-y-0">
                    <Input
                      label="Título"
                      value={row.title}
                      onChange={(e) => {
                        const t = e.target.value;
                        setPageVideos((rows) => rows.map((r, j) => (j === i ? { ...r, title: t } : r)));
                      }}
                      className="sm:min-w-40 sm:flex-1"
                    />
                    <Input
                      label="URL Vimeo"
                      value={row.vimeoUrl}
                      onChange={(e) => {
                        const t = e.target.value;
                        setPageVideos((rows) => rows.map((r, j) => (j === i ? { ...r, vimeoUrl: t } : r)));
                      }}
                      className="sm:min-w-48 sm:flex-2"
                      placeholder="https://vimeo.com/…"
                    />
                  </div>
                  <div className="mt-2 flex shrink-0 gap-1 sm:mt-0 sm:pb-0.5">
                    <button
                      type="button"
                      disabled={i === 0}
                      title="Subir"
                      onClick={() => {
                        if (i === 0) return;
                        setPageVideos((rows) => {
                          const next = [...rows];
                          [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                          return next.map((r, idx) => ({ ...r, order: idx }));
                        });
                      }}
                      className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <ChevronUp size={18} />
                    </button>
                    <button
                      type="button"
                      disabled={i >= pageVideos.length - 1}
                      title="Descer"
                      onClick={() => {
                        if (i >= pageVideos.length - 1) return;
                        setPageVideos((rows) => {
                          const next = [...rows];
                          [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
                          return next.map((r, idx) => ({ ...r, order: idx }));
                        });
                      }}
                      className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <ChevronDown size={18} />
                    </button>
                    <button
                      type="button"
                      title="Remover"
                      onClick={() =>
                        setPageVideos((rows) => rows.filter((_, j) => j !== i).map((r, idx) => ({ ...r, order: idx })))
                      }
                      className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-red-950/50 hover:text-red-400"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                {channelId ? (
                  <ChannelPageVideoCoverRow
                    channelId={channelId}
                    video={row}
                    saving={saving}
                    uploading={uploadingPageVideoId === row.id}
                    onUploadStart={() => setUploadingPageVideoId(row.id)}
                    onUploadEnd={() => setUploadingPageVideoId(null)}
                    onUploadError={(msg) => setErr(msg)}
                    onUpdate={(patch) => {
                      setPageVideos((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
                    }}
                  />
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="text-sm"
              onClick={() => setPageVideos((rows) => [...rows, newVideoRow(rows.length)])}
            >
              <Plus size={16} />
              Adicionar vídeo
            </Button>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-zinc-200">Publicar na home Streaming</span>
            <span className="mt-1 block text-xs text-zinc-500">Desmarcado = só visível no admin (rascunho).</span>
          </span>
        </label>

        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-sm font-medium text-zinc-300">Capa (círculo)</p>
          {coverImageUrl.trim() ? (
            <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-zinc-700">
              <img src={coverImageUrl.trim()} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <Input
            label="URL da imagem (opcional)"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://…"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file || !channelId) return;
              setUploading(true);
              setErr(null);
              void (async () => {
                try {
                  const url = await uploadChannelCover(channelId, file);
                  setCoverImageUrl(url);
                } catch {
                  setErr('Falha no envio da imagem (Storage / regras / tamanho).');
                } finally {
                  setUploading(false);
                }
              })();
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-sm"
              disabled={!channelId || uploading}
              isLoading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={16} />
              Enviar PNG / JPG / WebP
            </Button>
            {coverImageUrl.trim() ? (
              <Button type="button" variant="outline" className="text-sm" onClick={() => setCoverImageUrl('')}>
                Remover capa
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void handleSave()} disabled={saving} isLoading={saving}>
            Salvar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-red-900/60 text-red-400 hover:bg-red-950/40"
            disabled={deleting}
            isLoading={deleting}
            onClick={() => void handleDelete()}
          >
            <Trash2 size={16} />
            Excluir canal
          </Button>
        </div>
      </div>
    </div>
  );
}
