import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, ArrowLeft, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import {
  formatCertificateAudienceLine,
  listUserCertificates,
  type UserCertificate,
} from '@/lib/firestore/certificates';
import { Button } from '@/components/ui/Button';
import { CertificateVisual } from '@/components/certificate/CertificateVisual';
import { openCertificatePrintWindow } from '@/components/certificate/certificatePrint';

function CertificateCard({ c }: { c: UserCertificate }) {
  const audienceLine = formatCertificateAudienceLine();
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex flex-col gap-4 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Award size={22} />
          </span>
          <div>
            <h2 className="font-medium text-zinc-100">{c.courseTitle}</h2>
            {audienceLine ? (
              <p className="mt-1 text-xs font-medium text-emerald-400/90">{audienceLine}</p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-500">
              Este registro permanece disponível mesmo que o curso não esteja mais liberado para sua empresa.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => openCertificatePrintWindow(c)}
        >
          <Printer size={16} />
          Imprimir / PDF
        </Button>
      </div>
      <div className="bg-zinc-950/80 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <CertificateVisual c={c} className="w-full" />
        </div>
      </div>
    </article>
  );
}

export function CertificatesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<UserCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const list = await listUserCertificates(user.uid);
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setErr('Não foi possível carregar seus certificados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div>
      <Link
        to="/cursos"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400"
      >
        <ArrowLeft size={16} />
        Meus cursos
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Certificados e histórico</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Cursos que você concluiu com todos os módulos finalizados. Os registros ficam guardados aqui mesmo que o
          curso deixe de aparecer na lista da sua empresa.
        </p>
      </header>

      {loading ? (
        <p className="text-zinc-500">Carregando…</p>
      ) : err ? (
        <p className="text-red-400">{err}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center">
          <Award className="mx-auto text-zinc-600" size={40} />
          <p className="mt-4 text-zinc-400">
            Ainda não há certificados. Finalize todos os módulos de um curso liberado para sua empresa para gerar o
            certificado automaticamente.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((c) => (
            <li key={c.courseId}>
              <CertificateCard c={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
