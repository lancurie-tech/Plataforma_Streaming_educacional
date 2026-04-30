import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/Button';
import { deleteMyAccountCallable, mapCallableError } from '@/lib/firebase/callables';

export function DeleteAccountSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleDelete() {
    setErr(null);
    if (!confirmed) {
      setErr('Marque a caixa de confirmação para continuar.');
      return;
    }
    const sure = window.confirm(
      'Tem a certeza absoluta? Esta ação não pode ser desfeita. Todos os dados da sua conta serão apagados de forma permanente, nos termos legais descritos nesta página (incluindo prazos de backup quando aplicável).',
    );
    if (!sure) return;
    setBusy(true);
    try {
      await deleteMyAccountCallable({});
      await logout();
      navigate('/', { replace: true });
    } catch (e) {
      setErr(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-6">
      <h2 className="text-lg font-semibold text-red-200">Apagar conta</h2>
      <div className="mt-3 space-y-3 text-sm text-zinc-300">
        <p>
          <strong className="text-zinc-200">Exclusão de dados (LGPD):</strong> ao apagar a conta, serão eliminados
          os seus dados pessoais associados a esta plataforma (perfil, progresso em cursos, certificados e demais
          registos ligados ao seu utilizador), de acordo com o exercício do direito de exclusão previsto na Lei
          Geral de Proteção de Dados (Lei n.º 13.709/2018) e princípios equivalentes do GDPR, sem prejuízo dos
          prazos de retenção legal ou de backup descritos na nossa política de privacidade e no texto ao lado.
        </p>
        <p className="text-zinc-400">
          Esta operação é <strong className="text-zinc-300">irreversível</strong>. Se tiver dúvidas, contacte-nos
          antes de continuar (ver secção «Meus dados» ao lado).
        </p>
      </div>
      <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/40"
        />
        <span>
          Li e compreendo que todos os meus dados nesta conta serão excluídos conforme as exigências da LGPD e que
          não poderei recuperar o acesso com esta conta.
        </span>
      </label>
      {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}
      <Button
        type="button"
        variant="outline"
        className="mt-6 border-red-800/80 text-red-300 hover:bg-red-950/60 hover:text-red-200"
        isLoading={busy}
        disabled={busy}
        onClick={() => void handleDelete()}
      >
        Excluir a minha conta permanentemente
      </Button>
    </div>
  );
}
