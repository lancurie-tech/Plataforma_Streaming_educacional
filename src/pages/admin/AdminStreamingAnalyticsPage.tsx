import { useEffect, useState } from 'react';
import { Tv } from 'lucide-react';
import {
  listStreamingEntryStats,
  listStreamingTrackStats,
  type StreamingEntryStatRow,
  type StreamingTrackStatRow,
} from '@/lib/firestore/streamingStatsAdmin';

export function AdminStreamingAnalyticsPage() {
  const [tracks, setTracks] = useState<StreamingTrackStatRow[] | null>(null);
  const [entries, setEntries] = useState<StreamingEntryStatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [t, e] = await Promise.all([listStreamingTrackStats(), listStreamingEntryStats()]);
        if (cancelled) return;
        setTracks(t);
        setEntries(e);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erro ao carregar métricas.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-100 sm:text-2xl">
          <Tv className="h-7 w-7 text-emerald-400" />
          Streaming — audiência
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Contagens quando um visitante abre um vídeo em destaque na página inicial (cada combinação trilha + vídeo
          conta no máximo uma vez por sessão do navegador). Os totais são atualizados pelas Cloud Functions.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-lg font-semibold text-zinc-100">Trilhas (acessos)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Soma de aberturas de qualquer vídeo dentro da trilha (uma sessão pode incrementar trilha e vídeo em conjunto).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Trilha</th>
                <th className="py-2 text-right">Acessos</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {tracks === null ? (
                <tr>
                  <td colSpan={2} className="py-6 text-zinc-500">
                    A carregar…
                  </td>
                </tr>
              ) : tracks.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-6 text-zinc-500">
                    Ainda não há dados. Abra vídeos na home pública (/) para gerar métricas.
                  </td>
                </tr>
              ) : (
                tracks.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/80 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-zinc-200">{row.trackTitle}</td>
                    <td className="py-2.5 text-right tabular-nums text-emerald-400">{row.views}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-lg font-semibold text-zinc-100">Vídeos (acessos)</h2>
        <p className="mt-1 text-sm text-zinc-500">Por cartão de vídeo na home streaming.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Trilha</th>
                <th className="py-2 pr-4">Vídeo</th>
                <th className="py-2 text-right">Acessos</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {entries === null ? (
                <tr>
                  <td colSpan={3} className="py-6 text-zinc-500">
                    A carregar…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-zinc-500">
                    Ainda não há dados.
                  </td>
                </tr>
              ) : (
                entries.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/80 last:border-0">
                    <td className="py-2.5 pr-4 text-zinc-400">{row.trackTitle}</td>
                    <td className="py-2.5 pr-4 font-medium text-zinc-200">{row.entryTitle}</td>
                    <td className="py-2.5 text-right tabular-nums text-emerald-400">{row.views}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
