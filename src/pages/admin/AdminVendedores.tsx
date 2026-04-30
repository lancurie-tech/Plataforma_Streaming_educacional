import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Trash2, UserPlus } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import {
  adminCreateVendedorCallable,
  adminDeleteVendedorCallable,
  adminUpdateVendedorCompaniesCallable,
  mapCallableError,
} from '@/lib/firebase/callables';
import { listCompanies } from '@/lib/firestore/admin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { CompanyDoc } from '@/types';

type VendedorRow = {
  id: string;
  name: string;
  email: string;
  managedCompanyIds: string[];
};

export function AdminVendedores() {
  const [rows, setRows] = useState<VendedorRow[]>([]);
  const [companies, setCompanies] = useState<CompanyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [provisionalPassword, setProvisionalPassword] = useState('');
  const [createCompanyIds, setCreateCompanyIds] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSelections, setEditSelections] = useState<Record<string, boolean>>({});
  const [saveBusy, setSaveBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const q = query(collection(db, 'users'), where('role', '==', 'vendedor'));
    const snap = await getDocs(q);
    const list: VendedorRow[] = snap.docs.map((d) => {
      const x = d.data();
      const raw = x.managedCompanyIds;
      const managedCompanyIds = Array.isArray(raw)
        ? raw.filter((id): id is string => typeof id === 'string')
        : [];
      return {
        id: d.id,
        name: (x.name as string) ?? '',
        email: (x.email as string) ?? '',
        managedCompanyIds,
      };
    });
    setRows(list.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const co = await listCompanies();
        await refresh();
        if (!cancelled) setCompanies(co.sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        if (!cancelled) setErr('Não foi possível carregar dados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  function openCreate() {
    setErr(null);
    setName('');
    setEmail('');
    setProvisionalPassword('');
    setCreateCompanyIds({});
    setModal(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim() || !email.trim() || provisionalPassword.length < 6) {
      setErr('Preencha nome, e-mail e senha provisória (mín. 6 caracteres).');
      return;
    }
    const managedCompanyIds = companies.filter((c) => createCompanyIds[c.id]).map((c) => c.id);
    setBusy(true);
    try {
      await adminCreateVendedorCallable({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        provisionalPassword,
        managedCompanyIds,
      });
      setModal(false);
      await refresh();
    } catch (e) {
      setErr(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(v: VendedorRow) {
    const sel: Record<string, boolean> = {};
    for (const c of companies) {
      sel[c.id] = v.managedCompanyIds.includes(c.id);
    }
    setEditSelections(sel);
    setEditingId(v.id);
    setErr(null);
  }

  async function saveEdit(vendedorUid: string) {
    setSaveBusy(true);
    setErr(null);
    const managedCompanyIds = companies.filter((c) => editSelections[c.id]).map((c) => c.id);
    try {
      await adminUpdateVendedorCompaniesCallable({ vendedorUid, managedCompanyIds });
      setEditingId(null);
      await refresh();
    } catch (e) {
      setErr(mapCallableError(e));
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleDelete(v: VendedorRow) {
    if (
      !window.confirm(
        `Excluir permanentemente o vendedor "${v.name}" (${v.email})?\n\nA conta no Authentication e o documento em users serão apagados. Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeletingId(v.id);
    setErr(null);
    try {
      await adminDeleteVendedorCallable({ vendedorUid: v.id });
      await refresh();
    } catch (e) {
      setErr(mapCallableError(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Vendedores</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Crie acesso com senha provisória; no primeiro login o vendedor define uma nova senha. Depois,
            associe as empresas da carteira dele.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="inline-flex items-center gap-2">
          <UserPlus size={18} />
          Novo vendedor
        </Button>
      </div>

      {err && !modal && editingId === null && deletingId === null ? (
        <p className="mt-6 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-zinc-500">Carregando…</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Empresas</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((v) => (
                <tr key={v.id} className="bg-zinc-950/30">
                  <td className="px-4 py-3 text-zinc-200">{v.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{v.email}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {v.managedCompanyIds.length === 0 ? (
                      <span className="text-amber-200/80">Nenhuma — edite para associar</span>
                    ) : (
                      v.managedCompanyIds
                        .map((id) => companies.find((c) => c.id === id)?.name ?? id)
                        .join(', ')
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(v)}
                        className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        Editar empresas
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === v.id}
                        onClick={() => void handleDelete(v)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        <Trash2 size={16} aria-hidden />
                        {deletingId === v.id ? 'Excluindo…' : 'Excluir'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-100">Novo vendedor</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Senha provisória"
                type="password"
                autoComplete="new-password"
                value={provisionalPassword}
                onChange={(e) => setProvisionalPassword(e.target.value)}
                required
              />
              <div>
                <p className="text-sm font-medium text-zinc-300">Empresas (opcional na criação)</p>
                <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 p-3">
                  {companies.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={!!createCompanyIds[c.id]}
                          onChange={(e) =>
                            setCreateCompanyIds((prev) => ({ ...prev, [c.id]: e.target.checked }))
                          }
                        />
                        {c.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              {err ? <p className="text-sm text-red-400">{err}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Criando…' : 'Criar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-100">Empresas do vendedor</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Marque as empresas que este vendedor acompanha nos relatórios.
            </p>
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 p-3">
              {companies.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={!!editSelections[c.id]}
                      onChange={(e) =>
                        setEditSelections((prev) => ({ ...prev, [c.id]: e.target.checked }))
                      }
                    />
                    {c.name}
                  </label>
                </li>
              ))}
            </ul>
            {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Cancelar
              </Button>
              <Button type="button" disabled={saveBusy} onClick={() => void saveEdit(editingId)}>
                {saveBusy ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
