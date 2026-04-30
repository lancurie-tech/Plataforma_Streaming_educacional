import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2, Tv, Upload } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  createStreamingEntry,
  createStreamingTrack,
  deleteStreamingEntry,
  deleteStreamingTrack,
  loadStreamingAdminTree,
  setStreamingEntryOrder,
  setStreamingTrackOrder,
  updateStreamingEntry,
  updateStreamingTrack,
  type StreamingTrackWithEntries,
} from '@/lib/firestore/streamingAdmin';
import type { StreamingEntry } from '@/types';
import { uploadStreamingEntryCover } from '@/lib/firebase/uploadStreamingEntryCover';

/** Estado de `loaded` / `failed` reseta via `key` quando a URL muda (sem effect). */
function CoverPreviewImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full min-h-19.5 flex-col items-center justify-center gap-1 px-1.5 text-center">
        <span className="text-[10px] font-medium text-amber-500/95">Não carregou</span>
        <span className="text-[9px] leading-tight text-zinc-600">Confira o link ou o formato</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt=""
        className={
          loaded
            ? 'h-full w-full object-cover opacity-100'
            : 'h-full w-full object-cover opacity-0'
        }
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {!loaded ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/95 text-[10px] text-zinc-500">
          Carregando…
        </div>
      ) : null}
    </>
  );
}

/** Miniatura ao lado do campo de URL da capa (carregando / ok / erro). */
function CoverPreviewAside({ url }: { url: string }) {
  const trimmed = url.trim();

  return (
    <div className="flex w-full max-w-34 shrink-0 flex-col gap-1.5 sm:w-34">
      <span className="block text-sm font-medium text-zinc-300">Preview</span>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950/80">
        {!trimmed ? (
          <div className="flex h-full min-h-19.5 items-center justify-center px-1.5 text-center text-[10px] leading-snug text-zinc-600">
            Cole uma URL de imagem (HTTPS)
          </div>
        ) : (
          <CoverPreviewImage key={trimmed} src={trimmed} />
        )}
      </div>
    </div>
  );
}

function CoverUrlFieldWithPreview({
  value,
  onChange,
  inputId,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  inputId: string;
  placeholder: string;
}) {
  return (
    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="min-w-0 flex-1">
        <Input
          id={inputId}
          label="URL da capa (opcional)"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <CoverPreviewAside url={value} />
    </div>
  );
}

/** Capa no Storage + URL: mesmo padrão de “Imagem do card” nos cursos (prévia grande, enviar, remover). */
function StreamingEntryCoverCard({
  trackId,
  entryId,
  coverUrl,
  onCoverUrlChange,
  disabled,
  onPersistCover,
}: {
  trackId: string;
  entryId: string;
  coverUrl: string;
  onCoverUrlChange: (next: string) => void;
  disabled: boolean;
  /** Grava só o campo da capa no Firestore (demais campos já salvos no último estado conhecido pelo chamador). */
  onPersistCover: (coverImageUrl: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div>
        <p className="text-sm font-medium text-zinc-300">Capa do vídeo (cards na home streaming)</p>
        <p className="mt-1 text-xs text-zinc-500">
          Opcional. PNG, JPG ou WebP no Storage do projeto; a URL pública fica salva neste vídeo. Se não houver capa,
          usa-se o thumbnail do Vimeo.
        </p>
      </div>
      {coverUrl.trim() ? (
        <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
          <img
            src={coverUrl.trim()}
            alt="Prévia da capa do vídeo na trilha"
            className="aspect-video w-full object-cover"
          />
        </div>
      ) : null}
      <Input
        id={`streaming-entry-cover-url-${entryId}`}
        label="URL da imagem (opcional)"
        placeholder="https://… ou envie um arquivo abaixo"
        value={coverUrl}
        onChange={(e) => onCoverUrlChange(e.target.value)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setUploadError(null);
          setUploading(true);
          void (async () => {
            try {
              const downloadUrl = await uploadStreamingEntryCover(trackId, entryId, file);
              onCoverUrlChange(downloadUrl);
              onPersistCover(downloadUrl);
            } catch (err) {
              setUploadError(
                err instanceof Error
                  ? err.message
                  : 'Falha no envio. Verifique o Storage no Firebase e o arquivo (máx. 6 MB).'
              );
            } finally {
              setUploading(false);
            }
          })();
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="text-sm"
          disabled={disabled || uploading}
          isLoading={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} />
          Enviar PNG / JPG / WebP
        </Button>
        {coverUrl.trim() ? (
          <Button
            type="button"
            variant="outline"
            className="text-sm"
            disabled={disabled || uploading}
            onClick={() => {
              onCoverUrlChange('');
              onPersistCover(null);
            }}
          >
            Remover capa
          </Button>
        ) : null}
      </div>
      {uploadError ? <p className="text-xs text-red-400">{uploadError}</p> : null}
    </div>
  );
}

export function AdminStreamingPage() {
  const [tree, setTree] = useState<StreamingTrackWithEntries[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await loadStreamingAdminTree();
    setTree(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadStreamingAdminTree();
        if (!cancelled) setTree(data);
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof FirebaseError
              ? e.message
              : e instanceof Error
                ? e.message
                : 'Erro ao carregar.';
          setError(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      const msg =
        e instanceof FirebaseError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Operação falhou.';
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  async function handleNewTrack() {
    await run('new-track', async () => {
      await createStreamingTrack('Nova trilha');
    });
  }

  async function moveTrack(index: number, dir: -1 | 1) {
    if (!tree || index + dir < 0 || index + dir >= tree.length) return;
    const ids = tree.map((t) => t.track.id);
    const j = index + dir;
    const next = [...ids];
    [next[index], next[j]] = [next[j]!, next[index]!];
    await run(`order-tracks`, async () => {
      await setStreamingTrackOrder(next);
    });
  }

  async function moveEntry(trackId: string, entryIds: string[], index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= entryIds.length) return;
    const next = [...entryIds];
    [next[index], next[j]] = [next[j]!, next[index]!];
    await run(`order-entry-${trackId}`, async () => {
      await setStreamingEntryOrder(trackId, next);
    });
  }

  if (tree === null && !error) {
    return <p className="text-sm text-zinc-500">Carregando trilhas…</p>;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-100">
          <Tv className="text-emerald-400" size={28} />
          Home streaming
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Trilhas aparecem na página inicial pública (<code className="text-zinc-400">/</code>).
          Só entradas com URL Vimeo válida são exibidas aos visitantes.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => void handleNewTrack()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 py-2 text-sm"
        >
          <Plus size={18} />
          Nova trilha
        </Button>
      </div>

      <ul className="space-y-6">
        {(tree ?? []).map((row, ti) => (
          <TrackCard
            key={`${row.track.id}:${row.track.title}`}
            row={row}
            trackIndex={ti}
            trackCount={tree?.length ?? 0}
            busy={busy}
            onSaveTrackTitle={(title) =>
              run(`track-${row.track.id}`, async () => {
                await updateStreamingTrack(row.track.id, { title });
              })
            }
            onDeleteTrack={() => {
              if (!confirm(`Remover a trilha “${row.track.title}” e todos os vídeos?`)) return;
              void run(`del-track-${row.track.id}`, async () => {
                await deleteStreamingTrack(row.track.id);
              });
            }}
            onMoveTrack={(dir) => void moveTrack(ti, dir)}
            onAddEntry={(title, vimeoUrl, description, coverImageUrl) =>
              run(`add-entry-${row.track.id}`, async () => {
                await createStreamingEntry(row.track.id, { title, vimeoUrl, description, coverImageUrl });
              })
            }
            onSaveEntry={(entryId, data) =>
              run(`entry-${entryId}`, async () => {
                await updateStreamingEntry(row.track.id, entryId, data);
              })
            }
            onDeleteEntry={(entryId) => {
              if (!confirm('Remover este vídeo da trilha?')) return;
              void run(`del-entry-${entryId}`, async () => {
                await deleteStreamingEntry(row.track.id, entryId);
              });
            }}
            onMoveEntry={(index, dir) => {
              const ids = row.entries.map((e) => e.id);
              void moveEntry(row.track.id, ids, index, dir);
            }}
          />
        ))}
      </ul>

      {tree && tree.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma trilha ainda. Crie uma com “Nova trilha”.</p>
      ) : null}
    </div>
  );
}

function TrackCard({
  row,
  trackIndex,
  trackCount,
  busy,
  onSaveTrackTitle,
  onDeleteTrack,
  onMoveTrack,
  onAddEntry,
  onSaveEntry,
  onDeleteEntry,
  onMoveEntry,
}: {
  row: StreamingTrackWithEntries;
  trackIndex: number;
  trackCount: number;
  busy: string | null;
  onSaveTrackTitle: (title: string) => void;
  onDeleteTrack: () => void;
  onMoveTrack: (dir: -1 | 1) => void;
  onAddEntry: (title: string, vimeoUrl: string, description?: string, coverImageUrl?: string) => void;
  onSaveEntry: (
    entryId: string,
    data: {
      title?: string;
      vimeoUrl?: string;
      coverImageUrl?: string | null;
      description?: string | null;
    }
  ) => void;
  onDeleteEntry: (entryId: string) => void;
  onMoveEntry: (index: number, dir: -1 | 1) => void;
}) {
  const [titleDraft, setTitleDraft] = useState(row.track.title);
  const [expanded, setExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCover, setNewCover] = useState('');
  const [newDesc, setNewDesc] = useState('');

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown size={18} className="shrink-0 text-emerald-400" />
        ) : (
          <ChevronRight size={18} className="shrink-0 text-zinc-500" />
        )}
        <span className="min-w-0 flex-1 truncate text-base font-medium text-zinc-100">
          {row.track.title}
        </span>
        <span className="shrink-0 text-xs text-zinc-500">
          {row.entries.length} vídeo{row.entries.length !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded ? (
      <div className="border-t border-zinc-800 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label="Nome da trilha"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="max-w-md"
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null || titleDraft.trim() === row.track.title}
              onClick={() => onSaveTrackTitle(titleDraft)}
              className="py-2 text-sm"
            >
              Salvar nome
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null || trackIndex === 0}
            onClick={() => onMoveTrack(-1)}
            aria-label="Mover trilha para cima"
            className="px-2 py-2"
          >
            <ChevronUp size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null || trackIndex >= trackCount - 1}
            onClick={() => onMoveTrack(1)}
            aria-label="Mover trilha para baixo"
            className="px-2 py-2"
          >
            <ChevronDown size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="px-2 py-2 text-red-400 hover:text-red-300"
            disabled={busy !== null}
            onClick={onDeleteTrack}
          >
            <Trash2 size={18} />
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-zinc-800 pt-4">
        <h3 className="text-sm font-medium text-zinc-300">Vídeos nesta trilha</h3>
        <ul className="mt-3 space-y-4">
          {row.entries.map((entry, ei) => (
            <EntryRow
              key={`${entry.id}:${entry.title}:${entry.vimeoUrl}:${entry.description ?? ''}:${entry.coverImageUrl ?? ''}`}
              trackId={row.track.id}
              entry={entry}
              index={ei}
              total={row.entries.length}
              busy={busy}
              onSave={(data) => onSaveEntry(entry.id, data)}
              onDelete={() => onDeleteEntry(entry.id)}
              onMove={(dir) => onMoveEntry(ei, dir)}
            />
          ))}
        </ul>

        <div className="mt-4 rounded-lg border border-dashed border-zinc-700 p-3">
          <p className="text-xs font-medium text-zinc-500">Adicionar vídeo</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input
              label="Título do vídeo"
              placeholder="Ex.: Episódio 1"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Input
              label="URL Vimeo"
              placeholder="https://vimeo.com/…"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          </div>
          <CoverUrlFieldWithPreview
            inputId={`streaming-new-cover-${row.track.id}`}
            placeholder="https://… imagem JPG ou PNG para o cartão na home"
            value={newCover}
            onChange={setNewCover}
          />
          <p className="mt-2 text-xs text-amber-200/90">
            Para enviar arquivo para o Storage (como nos cursos), adicione o vídeo à trilha e use “Enviar PNG / JPG /
            WebP” ao editar esse vídeo.
          </p>
          <Input
            label="Descrição (opcional)"
            className="mt-2"
            placeholder="Breve resumo"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <Button
            type="button"
            className="mt-2 py-2 text-sm"
            disabled={busy !== null || !newUrl.trim()}
            onClick={() => {
              onAddEntry(newTitle, newUrl, newDesc || undefined, newCover.trim() || undefined);
              setNewTitle('');
              setNewUrl('');
              setNewCover('');
              setNewDesc('');
            }}
          >
            Adicionar à trilha
          </Button>
        </div>
      </div>
      </div>
      ) : null}
    </li>
  );
}

function EntryRow({
  trackId,
  entry,
  index,
  total,
  busy,
  onSave,
  onDelete,
  onMove,
}: {
  trackId: string;
  entry: StreamingEntry;
  index: number;
  total: number;
  busy: string | null;
  onSave: (data: {
    title?: string;
    vimeoUrl?: string;
    coverImageUrl?: string | null;
    description?: string | null;
  }) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [title, setTitle] = useState(entry.title);
  const [url, setUrl] = useState(entry.vimeoUrl);
  const [cover, setCover] = useState(entry.coverImageUrl ?? '');
  const [desc, setDesc] = useState(entry.description ?? '');

  const dirty =
    title !== entry.title ||
    url !== entry.vimeoUrl ||
    cover !== (entry.coverImageUrl ?? '') ||
    desc !== (entry.description ?? '');

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="flex flex-wrap gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="URL Vimeo" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null || index === 0}
            onClick={() => onMove(-1)}
            aria-label="Mover para cima"
            className="px-2 py-1.5"
          >
            <ChevronUp size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null || index >= total - 1}
            onClick={() => onMove(1)}
            aria-label="Mover para baixo"
            className="px-2 py-1.5"
          >
            <ChevronDown size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="px-2 py-1.5 text-red-400"
            disabled={busy !== null}
            onClick={onDelete}
            aria-label="Remover"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
      <StreamingEntryCoverCard
        trackId={trackId}
        entryId={entry.id}
        coverUrl={cover}
        onCoverUrlChange={setCover}
        disabled={busy !== null}
        onPersistCover={(coverImageUrl) =>
          onSave({
            title,
            vimeoUrl: url,
            coverImageUrl,
            description: desc.trim() === '' ? null : desc,
          })
        }
      />
      <Input
        label="Descrição (opcional)"
        className="mt-2"
        placeholder="Breve resumo"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        className="mt-2 py-2 text-sm"
        disabled={busy !== null || !dirty}
        onClick={() =>
          onSave({
            title,
            vimeoUrl: url,
            coverImageUrl: cover.trim() === '' ? null : cover.trim(),
            description: desc.trim() === '' ? null : desc,
          })
        }
      >
        Salvar vídeo
      </Button>
    </li>
  );
}
