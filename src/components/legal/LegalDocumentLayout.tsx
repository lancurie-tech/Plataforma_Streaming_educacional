import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  version: string;
  children: ReactNode;
  /** Texto curto abaixo do título (ex.: âmbito do documento). */
  scope?: string;
  /** Páginas institucionais (ex.: Sobre) não exibem o aviso de revisão jurídica. */
  showLegalDisclaimer?: boolean;
};

export function LegalDocumentLayout({
  title,
  version,
  scope,
  children,
  showLegalDisclaimer = true,
}: Props) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-12">
      {showLegalDisclaimer ? (
        <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">
          Documento para revisão jurídica · não constitui assessoria legal
        </p>
      ) : null}
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">Versão {version}</p>
      {scope ? <p className="mt-4 text-sm leading-relaxed text-zinc-400">{scope}</p> : null}
      <div className="legal-prose mt-10 space-y-6 text-sm leading-relaxed text-zinc-300 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:text-zinc-100">
        {children}
      </div>
      <p className="mt-12 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
        Medivox — plataforma de conteúdos educacionais. Em caso de dúvidas sobre tratamento de dados,
        utilize os canais indicados na Política de Privacidade.
      </p>
      <Link to="/streaming" className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-300 hover:underline">
        ← Voltar ao início
      </Link>
    </article>
  );
}
