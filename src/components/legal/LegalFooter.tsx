import { Link } from 'react-router-dom';

const linkCls =
  'text-zinc-500 transition-colors hover:text-emerald-400/95 hover:underline underline-offset-2';

type Props = {
  /**
   * Documento específico de vendedores — só faz sentido no painel/fluxo do vendedor,
   * não no rodapé da home pública (visitantes e alunos).
   */
  showVendorConfidentialityLink?: boolean;
};

export function LegalFooter({ showVendorConfidentialityLink = false }: Props) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-zinc-800/90 bg-zinc-950/80">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav
          className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-2"
          aria-label="Documentos legais"
        >
          <Link to="/sobre" className={linkCls}>
            Sobre
          </Link>
          <Link to="/contato" className={linkCls}>
            Contato
          </Link>
          <Link to="/termos" className={linkCls}>
            Termos de uso
          </Link>
          <Link to="/privacidade" className={linkCls}>
            Política de privacidade
          </Link>
          <Link to="/compromissos" className={linkCls}>
            Compromissos do participante
          </Link>
          {showVendorConfidentialityLink ? (
            <Link to="/confidencialidade-vendedor" className={linkCls}>
              Confidencialidade (vendedor)
            </Link>
          ) : null}
        </nav>
        <p className="mt-6 text-center text-xs text-zinc-600">
          © {year} Medivox. Conteúdos educacionais para empresas e profissionais de saúde.
        </p>
      </div>
    </footer>
  );
}
