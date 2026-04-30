import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Play } from 'lucide-react';

export type EntryLabelInfo = { title: string; trackTitle?: string };

type Segment =
  | { type: 'text'; value: string }
  | { type: 'entry'; entryId: string };

const ENTRY_RE = /\(?\s*id_entrada:\s*([A-Za-z0-9]+)\s*\)?/gi;

function splitByEntryRefs(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  const re = new RegExp(ENTRY_RE.source, ENTRY_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: 'text', value: text.slice(last, m.index) });
    }
    out.push({ type: 'entry', entryId: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push({ type: 'text', value: text.slice(last) });
  }
  if (out.length === 0) {
    out.push({ type: 'text', value: text });
  }
  return out;
}

function RichLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) {
          return (
            <strong key={i} className="font-semibold text-zinc-100">
              {bold[1]}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function TextBlock({ text }: { text: string }) {
  const lines = text.split(/\n/);
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-zinc-300">
      {lines.map((line, i) => {
        const trimmed = line.trimEnd();
        const bullet = /^[\s]*[*•-]\s+(.+)$/.exec(trimmed);
        if (bullet) {
          return (
            <div key={i} className="flex gap-2 pl-0.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500/80" aria-hidden />
              <span className="min-w-0">
                <RichLine text={bullet[1] ?? ''} />
              </span>
            </div>
          );
        }
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }
        /** Oculta linha só com ID Firestore (ruído se o modelo repetir o id). */
        if (/^[A-Za-z0-9_-]{12,40}$/.test(trimmed) && !/[a-z]{3,}/i.test(trimmed)) {
          return null;
        }
        return (
          <p key={i} className="min-w-0">
            <RichLine text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

function EntryCta({
  entryId,
  label,
  onNavigate,
}: {
  entryId: string;
  label?: EntryLabelInfo;
  /** Ex.: fechar o painel ao seguir para o vídeo. */
  onNavigate?: () => void;
}) {
  /** Rota dentro de `PublicLayout` — evitar `/?entry=` (rota `/` = WelcomeGate) que desmonta o chat. */
  const to = `/streaming?entry=${encodeURIComponent(entryId)}`;
  const title = label?.title?.trim() || 'Ver vídeo no streaming';
  const sub = label?.trackTitle?.trim();

  return (
    <Link
      to={to}
      onClick={() => onNavigate?.()}
      className="mt-1 flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-2.5 py-2 text-left text-emerald-100 shadow-sm transition hover:border-emerald-400/50 hover:bg-emerald-900/45"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-600/25 text-emerald-200">
        <Play className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] font-medium text-zinc-100">{title}</span>
        {sub ? (
          <span className="mt-0.5 block text-[10px] text-emerald-200/75">{sub}</span>
        ) : null}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
    </Link>
  );
}

type Props = {
  content: string;
  /** Títulos vindos do catálogo Firestore (mesmos ids que id_entrada). */
  entryLabels: Record<string, EntryLabelInfo>;
  /** Chamado ao clicar numa sugestão de vídeo (ex.: fechar o painel). */
  onEntryLinkClick?: () => void;
};

export function StreamingAssistantMessage({ content, entryLabels, onEntryLinkClick }: Props) {
  const { nodes, hasEntryLinks } = useMemo(() => {
    const segments = splitByEntryRefs(content);
    const seenEntry = new Set<string>();
    const nodes: ReactNode[] = [];
    let textKey = 0;
    let hasEntryLinks = false;

    for (const seg of segments) {
      if (seg.type === 'text') {
        if (!seg.value.trim()) continue;
        nodes.push(<TextBlock key={`t-${textKey++}`} text={seg.value} />);
        continue;
      }
      if (seenEntry.has(seg.entryId)) continue;
      seenEntry.add(seg.entryId);
      hasEntryLinks = true;
      nodes.push(
        <EntryCta
          key={`e-${seg.entryId}`}
          entryId={seg.entryId}
          label={entryLabels[seg.entryId]}
          onNavigate={onEntryLinkClick}
        />
      );
    }

    return { nodes, hasEntryLinks };
  }, [content, entryLabels, onEntryLinkClick]);

  return (
    <div className="space-y-2">
      {nodes}
      {hasEntryLinks ? (
        <p className="mt-2 border-t border-zinc-800/90 pt-2 text-[11px] leading-snug text-zinc-500">
          <span className="font-medium text-zinc-400">Dica:</span> para o assistente usar a transcrição de um
          vídeo nas próximas perguntas, abra-o em Streaming — use o botão acima ou o vídeo na lista. Com o vídeo em
          destaque na página, o contexto passa a incluir o que é dito nesse vídeo.
        </p>
      ) : null}
    </div>
  );
}
