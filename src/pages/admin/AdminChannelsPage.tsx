import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Radio } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createChannelDraft, listAllChannelsAdmin } from '@/lib/firestore/channelsAdmin';
import type { CatalogChannel } from '@/types';

export function AdminChannelsPage() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<CatalogChannel[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setErr(null);
    const list = await listAllChannelsAdmin();
    setChannels(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) {
          setErr('Não foi possível carregar os canais.');
          setChannels([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function handleNew() {
    setCreating(true);
    setErr(null);
    try {
      const id = await createChannelDraft();
      navigate(`/admin/canais/${encodeURIComponent(id)}/edit`);
    } catch {
      setErr('Não foi possível criar o canal.');
    } finally {
      setCreating(false);
    }
  }

  if (channels === null && !err) {
    return <p className="text-zinc-500">Carregando…</p>;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--brand-primary) text-white">
            <Radio size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Canais</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Página pública em <span className="font-mono text-zinc-500">/canal/…</span> com vídeos e programas
              ligados no editor de cada curso.
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => void handleNew()} disabled={creating} isLoading={creating}>
          <Plus size={16} />
          Novo canal
        </Button>
      </div>

      {err ? <p className="mt-6 text-sm text-red-400">{err}</p> : null}

      {channels && channels.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">Nenhum canal. Use &quot;Novo canal&quot; para começar.</p>
      ) : null}

      {channels && channels.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {channels.map((ch) => (
            <li
              key={ch.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/35 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950">
                  {ch.coverImageUrl ? (
                    <img src={ch.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-medium text-zinc-500">
                      {ch.title.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{ch.title}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {(ch.pageVideos?.length ?? 0) > 0
                      ? `${ch.pageVideos!.length} vídeo(s) na página`
                      : 'Sem vídeos no canal'}
                    {ch.programCourseId ? ' · legado: programa no doc.' : ''}
                    {!ch.published ? ' · rascunho' : ''}
                  </p>
                </div>
              </div>
              <Link
                to={`/admin/canais/${encodeURIComponent(ch.id)}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
              >
                <Pencil size={16} />
                Editar
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
