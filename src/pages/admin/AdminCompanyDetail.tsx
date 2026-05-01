import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { Plus, Trash2, ChevronDown, ChevronRight, FileDown } from 'lucide-react';
import {
  getCompany,
  getCompanyRegistrationArchive,
  listCoursesCatalog,
  listCompanyCourseAssignments,
  removeCourseFromCompany,
  setCompanyActive,
  setCompanyCourseAssignment,
  setCompanyModuleSchedule,
  type CompanyRegistrationArchive,
  type SetCompanyCourseAssignmentMode,
} from '@/lib/firestore/admin';
import { listModules } from '@/lib/firestore/courses';
import { formatAccessRemaining } from '@/lib/firestore/assignmentAccess';
import {
  adminUpdateCompanyConfigCallable,
  mapCallableError,
} from '@/lib/firebase/callables';
import type {
  CompanyDoc,
  CompanyCourseAssignment,
  CompanyRoleDef,
  CompanyDepartmentDef,
  CourseSummary,
  ModuleContent,
} from '@/types';
import { Button } from '@/components/ui/Button';
import { useBrand } from '@/contexts/useBrand';
import { generateCompanyPdf } from '@/lib/companyPdfExport';

const DEFAULT_ROLES: CompanyRoleDef[] = [
  { id: 'operacional', label: 'Operacional' },
  { id: 'lideranca', label: 'Liderança' },
  { id: 'alta_gestao', label: 'Alta gestão' },
];

const DEFAULT_DEPARTMENTS: CompanyDepartmentDef[] = [
  { id: 'administrativo', label: 'Administrativo' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operacional', label: 'Operacional' },
  { id: 'suporte_interno', label: 'Suporte interno' },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

type CourseModalState =
  | { open: false }
  | { open: true; courseId: string; courseTitle: string; mode: 'add' | 'edit' };

const DURATION_PRESETS = [
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: '365 dias', days: 365 },
] as const;

function TagList({
  items,
  onRemove,
}: {
  items: { id: string; label: string }[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return <p className="text-xs text-zinc-500">Nenhum configurado.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
        >
          {item.label}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="ml-0.5 text-zinc-500 hover:text-red-400"
            aria-label={`Remover ${item.label}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function AddItemRow({
  presets,
  existing,
  onAdd,
  label,
}: {
  presets: { id: string; label: string }[];
  existing: { id: string }[];
  onAdd: (item: { id: string; label: string }) => void;
  label: string;
}) {
  const CUSTOM_VALUE = '__custom__';
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState('');
  const available = presets.filter((p) => !existing.some((e) => e.id === p.id));

  function commitCustom() {
    const lbl = custom.trim();
    const id = slugify(lbl);
    if (id && !existing.some((e) => e.id === id)) {
      onAdd({ id, label: lbl });
      setCustom('');
      setShowCustom(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <select
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        value=""
        onChange={(e) => {
          if (e.target.value === CUSTOM_VALUE) {
            setShowCustom(true);
            return;
          }
          const p = available.find((x) => x.id === e.target.value);
          if (p) onAdd(p);
        }}
      >
        <option value="" disabled>
          Adicionar {label}…
        </option>
        {available.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>+ Criar novo {label}</option>
      </select>

      {showCustom ? (
        <div className="flex items-end gap-2">
          <input
            type="text"
            autoFocus
            placeholder={`Nome do novo ${label}…`}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitCustom(); }}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1 py-2.5 text-sm"
            disabled={!custom.trim()}
            onClick={commitCustom}
          >
            <Plus size={14} /> Adicionar
          </Button>
          <button
            type="button"
            className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
            onClick={() => { setShowCustom(false); setCustom(''); }}
          >
            Cancelar
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ModuleScheduleSection({
  companyId,
  courseId,
  assignment,
  onReload,
}: {
  companyId: string;
  courseId: string;
  assignment: CompanyCourseAssignment;
  onReload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState<ModuleContent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, { opensAt: string; closesAt: string }>>({});
  const [presetStart, setPresetStart] = useState('');
  const [presetWeeks, setPresetWeeks] = useState(2);

  useEffect(() => {
    if (!open || loaded) return;
    let cancel = false;
    void (async () => {
      try {
        const mods = await listModules(courseId);
        if (cancel) return;
        setModules(mods.sort((a, b) => a.order - b.order));
        const d: Record<string, { opensAt: string; closesAt: string }> = {};
        for (const m of mods) {
          const s = assignment.moduleSchedule?.[m.id];
          d[m.id] = {
            opensAt: s?.opensAt ? s.opensAt.toISOString().slice(0, 10) : '',
            closesAt: s?.closesAt ? s.closesAt.toISOString().slice(0, 10) : '',
          };
        }
        setDraft(d);
        setLoaded(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, loaded, courseId, assignment.moduleSchedule]);

  async function save() {
    setSaving(true);
    try {
      const schedule: Record<string, { opensAt: Date | null; closesAt: Date | null }> = {};
      for (const [mid, val] of Object.entries(draft)) {
        const o = val.opensAt ? new Date(`${val.opensAt}T00:00:00`) : null;
        const c = val.closesAt ? new Date(`${val.closesAt}T23:59:59`) : null;
        if (o || c) schedule[mid] = { opensAt: o, closesAt: c };
      }
      await setCompanyModuleSchedule(companyId, courseId, schedule);
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  function clearModule(mid: string) {
    setDraft((d) => ({ ...d, [mid]: { opensAt: '', closesAt: '' } }));
  }

  function applyPresetWindows() {
    if (!presetStart.trim() || modules.length === 0) return;
    const start = new Date(`${presetStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) return;
    const daysEach = presetWeeks * 7;
    const next: Record<string, { opensAt: string; closesAt: string }> = { ...draft };
    modules.forEach((m, i) => {
      const open = new Date(start);
      open.setDate(open.getDate() + i * daysEach);
      const close = new Date(open);
      close.setDate(close.getDate() + daysEach - 1);
      next[m.id] = {
        opensAt: open.toISOString().slice(0, 10),
        closesAt: close.toISOString().slice(0, 10),
      };
    });
    setDraft(next);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        className="flex items-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-emerald-600/50 hover:text-emerald-300"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Agendamento por módulo
      </button>
      {open ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/40">
          {!loaded ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">Carregando módulos…</p>
          ) : modules.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">Nenhum módulo neste curso.</p>
          ) : (
            <>
              <div className="border-b border-zinc-800/60 px-4 py-3">
                <p className="text-xs font-medium text-emerald-200/90">Preenchimento rápido</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  A partir da data de início do 1º módulo, aplica uma janela igual para cada módulo em
                  sequência. Depois você pode ajustar cada data manualmente.
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs text-zinc-400">
                    Início do 1º módulo
                    <input
                      type="date"
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500"
                      value={presetStart}
                      onChange={(e) => setPresetStart(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-400">
                    Duração de cada módulo
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500"
                      value={presetWeeks}
                      onChange={(e) => setPresetWeeks(Number(e.target.value))}
                    >
                      <option value={1}>1 semana</option>
                      <option value={2}>2 semanas</option>
                      <option value={3}>3 semanas</option>
                      <option value={4}>4 semanas</option>
                      <option value={6}>6 semanas</option>
                      <option value={8}>8 semanas</option>
                    </select>
                  </label>
                  <Button type="button" variant="outline" className="text-xs" onClick={applyPresetWindows}>
                    Aplicar às datas
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {modules.map((m) => {
                  const hasSchedule = Boolean(draft[m.id]?.opensAt || draft[m.id]?.closesAt);
                  return (
                    <div key={m.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-zinc-100">{m.title}</p>
                        {hasSchedule ? (
                          <button
                            type="button"
                            className="text-xs text-zinc-500 hover:text-red-400"
                            onClick={() => clearModule(m.id)}
                          >
                            Limpar
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-400">
                            Data de abertura
                          </label>
                          <input
                            type="date"
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-emerald-500"
                            value={draft[m.id]?.opensAt ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [m.id]: { ...d[m.id]!, opensAt: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-400">
                            Data de fechamento
                          </label>
                          <input
                            type="date"
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-emerald-500"
                            value={draft[m.id]?.closesAt ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [m.id]: { ...d[m.id]!, closesAt: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-zinc-800/60 px-4 py-3">
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  isLoading={saving}
                  onClick={() => void save()}
                >
                  Salvar agendamento
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AdminCompanyDetail() {
  const brand = useBrand();
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<CompanyDoc | null>(null);
  const [catalog, setCatalog] = useState<CourseSummary[]>([]);
  const [assignments, setAssignments] = useState<CompanyCourseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [registrationArchive, setRegistrationArchive] = useState<CompanyRegistrationArchive | null>(
    null
  );

  const [roles, setRoles] = useState<CompanyRoleDef[]>([]);
  const [departments, setDepartments] = useState<CompanyDepartmentDef[]>([]);
  const [configBusy, setConfigBusy] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const [emailDomains, setEmailDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');

  /** Evita que `load()` sobrescreva níveis/áreas/domínios ainda não salvos ao adicionar curso etc. */
  const configFormDirtyRef = useRef(false);

  const [courseModal, setCourseModal] = useState<CourseModalState>({ open: false });
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalChoice, setModalChoice] = useState<'unlimited' | 'preset' | 'date' | 'perModule'>('preset');
  const [modalPresetDays, setModalPresetDays] = useState(30);
  const [modalDate, setModalDate] = useState('');

  const byCourseId = useMemo(() => new Map(assignments.map((a) => [a.courseId, a])), [assignments]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setReady(false);
    try {
      const [c, courses, asg, archive] = await Promise.all([
        getCompany(companyId),
        listCoursesCatalog(),
        listCompanyCourseAssignments(companyId),
        getCompanyRegistrationArchive(companyId),
      ]);
      setCompany(c);
      setCatalog(courses.sort((a, b) => a.title.localeCompare(b.title)));
      setAssignments(asg);
      setRegistrationArchive(archive);
      if (c && !configFormDirtyRef.current) {
        setRoles(c.roles?.length ? c.roles : []);
        setDepartments(c.departments?.length ? c.departments : []);
        setEmailDomains(c.allowedEmailDomains?.length ? c.allowedEmailDomains : []);
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [companyId]);

  useEffect(() => {
    configFormDirtyRef.current = false;
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function flipActive() {
    if (!companyId || !company) return;
    await setCompanyActive(companyId, !company.active);
    await load();
  }

  function addDomain() {
    const d = newDomain.trim().toLowerCase().replace(/^@/, '');
    if (!d || emailDomains.includes(d)) return;
    configFormDirtyRef.current = true;
    setEmailDomains((prev) => [...prev, d]);
    setNewDomain('');
  }

  async function saveConfig() {
    if (!companyId) return;
    if (roles.length === 0) {
      setConfigMsg('Adicione pelo menos um nível.');
      return;
    }
    if (departments.length === 0) {
      setConfigMsg('Adicione pelo menos uma área.');
      return;
    }
    setConfigBusy(true);
    setConfigMsg(null);
    try {
      const res = await adminUpdateCompanyConfigCallable({ companyId, roles, departments, allowedEmailDomains: emailDomains });
      setConfigMsg(`Configuração salva — ${res.data.keyCount} chaves geradas.`);
      configFormDirtyRef.current = false;
      await load();
    } catch (e) {
      setConfigMsg(mapCallableError(e));
    } finally {
      setConfigBusy(false);
    }
  }

  function openAddCourse(course: CourseSummary) {
    setModalErr(null);
    setModalChoice('preset');
    setModalPresetDays(30);
    setModalDate('');
    setCourseModal({ open: true, courseId: course.id, courseTitle: course.title, mode: 'add' });
  }

  function openEditCourse(course: CourseSummary) {
    setModalErr(null);
    const a = byCourseId.get(course.id);
    const hasModuleCal =
      a?.moduleSchedule &&
      Object.values(a.moduleSchedule).some((s) => s?.opensAt || s?.closesAt);
    if (hasModuleCal) {
      setModalChoice('perModule');
      setModalDate('');
    } else if (a?.expiresAt) {
      setModalChoice('date');
      setModalDate(a.expiresAt.toISOString().slice(0, 10));
    } else {
      setModalChoice('unlimited');
      setModalDate('');
    }
    setModalPresetDays(30);
    setCourseModal({ open: true, courseId: course.id, courseTitle: course.title, mode: 'edit' });
  }

  function closeCourseModal() {
    setCourseModal({ open: false });
    setModalErr(null);
  }

  async function applyCourseModal() {
    if (!companyId || !courseModal.open) return;
    setModalBusy(true);
    setModalErr(null);
    try {
      let mode: SetCompanyCourseAssignmentMode;
      if (modalChoice === 'perModule') {
        mode = { kind: 'perModuleOnly' };
      } else if (modalChoice === 'unlimited') {
        mode = { kind: 'unlimited' };
      } else if (modalChoice === 'date') {
        if (!modalDate.trim()) {
          setModalErr('Informe a data final.');
          return;
        }
        const end = new Date(`${modalDate}T12:00:00`);
        if (Number.isNaN(end.getTime())) {
          setModalErr('Data inválida.');
          return;
        }
        mode = { kind: 'untilDate', endDate: end };
      } else {
        mode = { kind: 'durationDays', days: modalPresetDays };
      }
      await setCompanyCourseAssignment(companyId, courseModal.courseId, mode);
      await load();
      closeCourseModal();
    } catch (e) {
      const msg =
        e instanceof FirebaseError
          ? e.code === 'permission-denied'
            ? 'Permissão negada pelo Firestore.'
            : e.message || e.code
          : e instanceof Error
            ? e.message
            : 'Erro desconhecido';
      setModalErr(`Não foi possível salvar: ${msg}`);
    } finally {
      setModalBusy(false);
    }
  }

  async function removeCourse(courseId: string) {
    if (!companyId) return;
    if (!window.confirm('Remover este curso da empresa?')) return;
    setSaving(courseId);
    try {
      await removeCourseFromCompany(companyId, courseId);
      await load();
    } finally {
      setSaving(null);
    }
  }

  if (!companyId) return <p className="text-zinc-400">Empresa inválida.</p>;
  if (!ready || loading) return <p className="text-zinc-500">Carregando…</p>;
  if (!company) {
    return (
      <p className="text-red-400">
        Empresa não encontrada.{' '}
        <Link to="/admin/empresas" className="text-emerald-400 hover:underline">
          Voltar
        </Link>
      </p>
    );
  }

  const hasV2Keys = Boolean(registrationArchive?.accessKeys?.length);

  return (
    <div className="space-y-10 pb-16">
      <div>
        <Link
          to="/admin/empresas"
          className="mb-6 inline-block text-sm text-zinc-400 hover:text-emerald-400"
        >
          ← Empresas
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Editar · {company.name}</h1>
            <p className="mt-1 font-mono text-sm text-zinc-500">
              Cadastro: /{company.slug}/cadastro
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Status:{' '}
              {company.active ? (
                <span className="text-emerald-400">ativa</span>
              ) : (
                <span className="text-amber-400">inativa</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void flipActive()}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              company.active
                ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
            }`}
          >
            {company.active ? 'Desativar empresa' : 'Ativar empresa'}
          </button>
        </div>
      </div>

      {/* ---- Secção: Níveis / Funções ---- */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
        <h2 className="text-base font-semibold text-zinc-100">Nível / Função</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Cada nível terá uma chave de acesso por área. Defina os níveis antes de gerar as chaves.
        </p>
        <div className="mt-4">
          <TagList
            items={roles}
            onRemove={(id) => {
              configFormDirtyRef.current = true;
              setRoles((r) => r.filter((x) => x.id !== id));
            }}
          />
          <AddItemRow
            presets={DEFAULT_ROLES}
            existing={roles}
            onAdd={(item) => {
              configFormDirtyRef.current = true;
              setRoles((r) => [...r, item]);
            }}
            label="nível"
          />
        </div>
      </section>

      {/* ---- Secção: Áreas / Setores ---- */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
        <h2 className="text-base font-semibold text-zinc-100">Área / Setor</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Cada área combinada com cada nível gera uma chave única de cadastro.
        </p>
        <div className="mt-4">
          <TagList
            items={departments}
            onRemove={(id) => {
              configFormDirtyRef.current = true;
              setDepartments((d) => d.filter((x) => x.id !== id));
            }}
          />
          <AddItemRow
            presets={DEFAULT_DEPARTMENTS}
            existing={departments}
            onAdd={(item) => {
              configFormDirtyRef.current = true;
              setDepartments((d) => [...d, item]);
            }}
            label="área"
          />
        </div>
      </section>

      {/* ---- Domínios de e-mail ---- */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/40 p-5">
        <h2 className="text-base font-semibold text-zinc-100">Domínios de e-mail aceitos</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Restrinja o cadastro apenas a e-mails corporativos. Deixe vazio para aceitar qualquer domínio.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {emailDomains.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1 text-sm text-zinc-200"
            >
              @{d}
              <button
                type="button"
                className="ml-0.5 text-zinc-500 hover:text-red-400"
                onClick={() => {
                  configFormDirtyRef.current = true;
                  setEmailDomains((prev) => prev.filter((x) => x !== d));
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
            placeholder="empresa.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDomain();
              }
            }}
          />
          <Button type="button" variant="outline" className="text-xs" onClick={addDomain}>
            Adicionar
          </Button>
        </div>
      </section>

      {/* ---- Gerar / atualizar chaves ---- */}
      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
        <h2 className="text-base font-semibold text-emerald-100/95">Gerar chaves de acesso</h2>
        <p className="mt-1 text-xs text-emerald-200/70">
          Ao salvar, são geradas {roles.length * departments.length} chaves ({roles.length} níveis ×{' '}
          {departments.length} áreas). Chaves anteriores são substituídas.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            isLoading={configBusy}
            disabled={roles.length === 0 || departments.length === 0}
            onClick={() => void saveConfig()}
          >
            Salvar níveis + áreas e gerar chaves
          </Button>
          {configMsg ? (
            <span
              className={`text-sm ${configMsg.includes('salva') ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {configMsg}
            </span>
          ) : null}
        </div>
      </section>

      {/* ---- Chaves arquivadas ---- */}
      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
        <h2 className="text-base font-semibold text-amber-100/95">Chaves arquivadas</h2>
        <p className="mt-1 text-xs text-amber-200/70">
          Visível apenas para administradores. Não envie em canais públicos.
        </p>
        {registrationArchive ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/80 p-3 text-sm">
              <p className="text-xs text-zinc-500">Caminho de cadastro</p>
              <p className="mt-1 break-all font-mono text-emerald-400">
                {registrationArchive.registrationPath}
              </p>
            </div>

            {hasV2Keys ? (
              <div className="overflow-x-auto rounded-lg border border-zinc-700/80 bg-zinc-950/80">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nível</th>
                      <th className="px-3 py-2 font-medium">Área</th>
                      <th className="px-3 py-2 font-medium">Chave</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {registrationArchive.accessKeys!.map((k) => (
                      <tr key={k.id} className="text-zinc-200">
                        <td className="px-3 py-2">{k.roleLabel}</td>
                        <td className="px-3 py-2">{k.departmentLabel}</td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-300">{k.plainKey}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {registrationArchive.savedAt ? (
              <p className="text-xs text-zinc-600">
                Arquivado em {registrationArchive.savedAt.toLocaleString('pt-BR')}
              </p>
            ) : null}
            {hasV2Keys ? (
              <Button
                type="button"
                variant="outline"
                className="mt-4 gap-2 text-sm"
                onClick={() => {
                  void (async () => {
                    const moduleNames: Record<string, string> = {};
                    const moduleScheduleRowsByCourse: Record<
                      string,
                      Array<{ title: string; opens: string; closes: string }>
                    > = {};
                    for (const a of assignments) {
                      try {
                        const mods = await listModules(a.courseId);
                        for (const m of mods) moduleNames[m.id] = m.title;
                        const sched = a.moduleSchedule;
                        if (sched && mods.length > 0) {
                          moduleScheduleRowsByCourse[a.courseId] = mods
                            .sort((x, y) => x.order - y.order)
                            .map((m) => {
                              const s = sched[m.id];
                              return {
                                title: m.title,
                                opens: s?.opensAt ? s.opensAt.toLocaleDateString('pt-BR') : '—',
                                closes: s?.closesAt ? s.closesAt.toLocaleDateString('pt-BR') : '—',
                              };
                            });
                        }
                      } catch { /* ignore */ }
                    }
                    await generateCompanyPdf({
                      companyName: company.name,
                      slug: company.slug,
                      registrationPath: registrationArchive.registrationPath,
                      roles,
                      departments,
                      accessKeys: registrationArchive.accessKeys ?? [],
                      courses: catalog,
                      assignments,
                      moduleNames,
                      moduleScheduleRowsByCourse,
                      branding: brand,
                    });
                  })();
                }}
              >
                <FileDown size={16} /> Exportar PDF (guia de acesso)
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            Nenhuma chave arquivada. Configure níveis e áreas acima e clique em "Gerar chaves".
          </p>
        )}
      </section>

      {/* ---- Cursos liberados ---- */}
      <section>
        <h2 className="text-lg font-medium text-zinc-200">Cursos liberados e prazo de acesso</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Defina acesso por curso e, opcionalmente, agende abertura/fecho de cada módulo.
        </p>
        <ul className="mt-6 space-y-2">
          {catalog.map((c) => {
            const a = byCourseId.get(c.id);
            const on = Boolean(a);
            const busy = saving === c.id;
            const rem = a ? formatAccessRemaining(a.expiresAt) : null;
            return (
              <li
                key={c.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-200">{c.title}</p>
                    <p className="font-mono text-xs text-zinc-600">{c.id}</p>
                    {on && rem ? (
                      <p
                        className={`mt-1 text-xs ${
                          rem.expired
                            ? 'text-red-400'
                            : rem.urgent
                              ? 'text-amber-400'
                              : 'text-zinc-500'
                        }`}
                      >
                        {rem.shortLabel}
                        {a && !a.isActive ? ' · Alunos sem acesso' : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {on ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          className="text-xs"
                          onClick={() => openEditCourse(c)}
                        >
                          Prazo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          className="border-red-900/50 text-xs text-red-400"
                          onClick={() => void removeCourse(c.id)}
                        >
                          <Trash2 size={14} /> Remover
                        </Button>
                      </>
                    ) : (
                      <Button type="button" disabled={busy} onClick={() => openAddCourse(c)}>
                        Adicionar
                      </Button>
                    )}
                  </div>
                </div>
                {on && a && companyId ? (
                  <ModuleScheduleSection
                    companyId={companyId}
                    courseId={c.id}
                    assignment={a}
                    onReload={load}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {catalog.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nenhum curso no catálogo.</p>
        ) : null}
      </section>

      {/* ---- Modal de curso ---- */}
      {courseModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-100">
              {courseModal.mode === 'add' ? 'Adicionar curso' : 'Prazo de acesso'} —{' '}
              {courseModal.courseTitle}
            </h3>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="acc"
                  checked={modalChoice === 'unlimited'}
                  onChange={() => setModalChoice('unlimited')}
                />
                Acesso ilimitado
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="acc"
                  checked={modalChoice === 'preset'}
                  onChange={() => setModalChoice('preset')}
                />
                Por duração a partir de agora
              </label>
              {modalChoice === 'preset' ? (
                <select
                  className="ml-6 w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                  value={modalPresetDays}
                  onChange={(e) => setModalPresetDays(Number(e.target.value))}
                >
                  {DURATION_PRESETS.map((p) => (
                    <option key={p.days} value={p.days}>
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="acc"
                  checked={modalChoice === 'date'}
                  onChange={() => setModalChoice('date')}
                />
                Até data final
              </label>
              {modalChoice === 'date' ? (
                <input
                  type="date"
                  className="ml-6 w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                />
              ) : null}
              <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="acc"
                  className="mt-1"
                  checked={modalChoice === 'perModule'}
                  onChange={() => setModalChoice('perModule')}
                />
                <span>
                  <span className="font-medium text-zinc-200">Somente por módulo</span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    Sem prazo global do curso. Defina abertura e fechamento de cada módulo na secção
                    &quot;Agendamento por módulo&quot; (abaixo). Ao gravar, o prazo único do curso é
                    removido.
                  </span>
                </span>
              </label>
            </div>
            {modalErr ? <p className="mt-4 text-sm text-red-400">{modalErr}</p> : null}
            <div className="mt-6 flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeCourseModal}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                isLoading={modalBusy}
                onClick={() => void applyCourseModal()}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
