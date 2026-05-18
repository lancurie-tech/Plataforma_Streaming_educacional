import { BrandingIdentityEditor } from '@/components/branding/BrandingIdentityEditor';

/**
 * Identidade pré-definida em `siteContent/branding`:
 * usa-se na própria consola Master e nos sites públicos de organizações até terem doc em `tenants/…/public/branding`.
 */
export function MasterGlobalBrandingPage() {
  return (
    <BrandingIdentityEditor
      brandingTenantId={null}
      infoBanner={
        <p className="mt-3 rounded-lg border border-violet-500/35 bg-violet-950/40 px-3 py-2 text-sm leading-relaxed text-violet-100/95">
          <strong className="text-violet-200">Marca pré-definida da plataforma.</strong>{' '}
          Grava em{' '}
          <code className="rounded bg-zinc-950/80 px-1 py-0.5 text-[11px] text-zinc-300">siteContent/branding</code>
          . Esta identidade aparece aqui na master e nos portais públicos de{' '}
          <strong className="text-violet-200">novas organizações</strong>, até cada cliente configurar{' '}
          <code className="rounded bg-zinc-950/80 px-1 py-0.5 text-[11px] text-zinc-300">
            tenants/&lt;id&gt;/public/branding
          </code>{' '}
          na área de administração (por cima da pré-definição global).
        </p>
      }
    />
  );
}
