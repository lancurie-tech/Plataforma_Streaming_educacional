import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ModuleStepKind } from '@/types';
import {
  emptyCourseDraft,
  loadCourseDraft,
  duplicateDraftModule,
  newEmptyMaterial,
  newEmptyModule,
  newEmptyQuestion,
  newEmptyStep,
  saveCourseDraft,
  deleteCourseCompletely,
  type CourseDraft,
  type DraftModule,
  type DraftQuestion,
  type DraftStep,
} from '@/lib/firestore/courseEditor';
import { uploadCourseCatalogCover } from '@/lib/firebase/uploadCourseCatalogCover';
import { listAllChannelsAdmin } from '@/lib/firestore/channelsAdmin';
import type { CatalogChannel } from '@/types';

const MIN_QUIZ_OPTIONS = 2;
const MAX_QUIZ_OPTIONS = 8;

const ROLE_PRESETS = [
  { id: 'operacional', label: 'Operacional' },
  { id: 'lideranca', label: 'Liderança' },
  { id: 'alta_gestao', label: 'Alta gestão' },
];

const DEPT_PRESETS = [
  { id: 'administrativo', label: 'Administrativo' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operacional', label: 'Operacional' },
  { id: 'suporte_interno', label: 'Suporte interno' },
];

function FieldTextarea({
  label,
  value,
  onChange,
  rows = 4,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
}) {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}

function SelectSmall({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = `sel-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-zinc-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** `standby`: área em standby — valores gravados no curso, sem efeito na visibilidade do aluno. */
function MultiTagSelect({
  label,
  selected,
  onChange,
  presets,
  standby,
}: {
  label: string;
  selected: string[];
  onChange: (v: string[]) => void;
  presets: { id: string; label: string }[];
  standby?: boolean;
}) {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  const selectedLabels = selected.map((s) => presets.find((p) => p.id === s)?.label ?? s).join(', ');
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onChange(active ? selected.filter((s) => s !== p.id) : [...selected, p.id])
              }
              className={clsx(
                'rounded-lg border px-2.5 py-1 text-xs transition',
                active
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {standby ? (
        <p className="text-xs text-zinc-600">
          {selected.length === 0
            ? 'Opcional — não altera quem vê o conteúdo (só nível restringe).'
            : `Metadado no curso (não filtra alunos): ${selectedLabels}.`}
        </p>
      ) : selected.length === 0 ? (
        <p className="text-xs text-zinc-600">Nenhuma restrição por nível — visível a todos os níveis.</p>
      ) : (
        <p className="text-xs text-zinc-500">Visível apenas para: {selectedLabels}</p>
      )}
    </div>
  );
}

function QuestionFields({
  q,
  onChange,
  onRemove,
}: {
  q: DraftQuestion;
  onChange: (next: DraftQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Questão</p>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
          aria-label="Remover questão"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <FieldTextarea label="Enunciado" value={q.prompt} onChange={(v) => onChange({ ...q, prompt: v })} rows={2} />
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">
          Alternativas ({MIN_QUIZ_OPTIONS} a {MAX_QUIZ_OPTIONS})
        </p>
        <div className="flex flex-col gap-3">
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <Input
                  label={`Opção ${oi + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const next = [...q.options];
                    next[oi] = e.target.value;
                    onChange({ ...q, options: next });
                  }}
                />
              </div>
              <button
                type="button"
                disabled={q.options.length <= MIN_QUIZ_OPTIONS}
                title={
                  q.options.length <= MIN_QUIZ_OPTIONS
                    ? `Mínimo de ${MIN_QUIZ_OPTIONS} opções`
                    : 'Remover esta opção'
                }
                onClick={() => {
                  const next = q.options.filter((_, i) => i !== oi);
                  let c = q.correctOptionIndex;
                  if (c === oi) c = undefined;
                  else if (typeof c === 'number' && c > oi) c -= 1;
                  onChange({ ...q, options: next, correctOptionIndex: c });
                }}
                className="mb-0.5 shrink-0 rounded-lg border border-zinc-700 px-2.5 py-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          disabled={q.options.length >= MAX_QUIZ_OPTIONS}
          onClick={() => onChange({ ...q, options: [...q.options, ''] })}
        >
          <Plus size={14} />
          Adicionar opção
        </Button>
      </div>
      <SelectSmall
        label="Resposta correta (métricas)"
        value={q.correctOptionIndex === undefined ? '' : String(q.correctOptionIndex)}
        onChange={(v) =>
          onChange({
            ...q,
            correctOptionIndex: v === '' ? undefined : Number.parseInt(v, 10),
          })
        }
        options={[
          { value: '', label: 'Não definir' },
          ...q.options.map((_, oi) => ({ value: String(oi), label: `Opção ${oi + 1}` })),
        ]}
      />
    </div>
  );
}

function StepBlock({
  step,
  onChange,
  onRemove,
}: {
  step: DraftStep;
  onChange: (s: DraftStep) => void;
  onRemove: () => void;
}) {
  const kindLabels: Record<ModuleStepKind, string> = {
    materials: 'Materiais / texto',
    video: 'Vídeo (Vimeo)',
    quiz: 'Questionário',
  };

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SelectSmall
          label="Tipo de passo"
          value={step.kind}
          onChange={(v) => onChange({ ...step, kind: v as ModuleStepKind })}
          options={(Object.keys(kindLabels) as ModuleStepKind[]).map((k) => ({
            value: k,
            label: kindLabels[k],
          }))}
        />
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
        >
          <Trash2 size={14} />
          Remover passo
        </button>
      </div>
      <Input label="Título do passo" value={step.title} onChange={(e) => onChange({ ...step, title: e.target.value })} />
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-400">Quem vê este passo (só nível conta)</p>
        <p className="text-xs text-zinc-600">
          Vazio no passo = mesmas regras de nível do módulo. Área abaixo fica gravada no curso (standby), mas hoje não
          restringe visibilidade — a área do aluno segue no cadastro da empresa para métricas.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <MultiTagSelect
            label="Níveis (opcional)"
            selected={step.visibleToRoles}
            onChange={(v) => onChange({ ...step, visibleToRoles: v })}
            presets={ROLE_PRESETS}
          />
          <MultiTagSelect
            label="Áreas (standby — não filtra)"
            selected={step.visibleToDepartments}
            onChange={(v) => onChange({ ...step, visibleToDepartments: v })}
            presets={DEPT_PRESETS}
            standby
          />
        </div>
      </div>
      <FieldTextarea label="Texto / conteúdo (opcional)" value={step.body} onChange={(v) => onChange({ ...step, body: v })} rows={3} />
      {step.kind === 'video' ? (
        <Input
          label="URL do Vimeo"
          value={step.vimeoUrl}
          onChange={(e) => onChange({ ...step, vimeoUrl: e.target.value })}
          placeholder="https://vimeo.com/..."
        />
      ) : null}
      {step.kind === 'materials' ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-500">Materiais (PDF/links)</p>
          {step.materials.map((mat, mi) => (
            <div key={mi} className="space-y-2 rounded-lg border border-zinc-800/80 p-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-red-400 hover:underline"
                  onClick={() =>
                    onChange({
                      ...step,
                      materials: step.materials.filter((_, i) => i !== mi),
                    })
                  }
                >
                  Remover material
                </button>
              </div>
              <Input
                label="Título do arquivo"
                value={mat.title}
                onChange={(e) => {
                  const next = [...step.materials];
                  next[mi] = { ...mat, title: e.target.value };
                  onChange({ ...step, materials: next });
                }}
              />
              <Input
                label="Descrição (opcional)"
                value={mat.description}
                onChange={(e) => {
                  const next = [...step.materials];
                  next[mi] = { ...mat, description: e.target.value };
                  onChange({ ...step, materials: next });
                }}
              />
              <Input
                label="URL do PDF"
                value={mat.pdfUrl}
                onChange={(e) => {
                  const next = [...step.materials];
                  next[mi] = { ...mat, pdfUrl: e.target.value };
                  onChange({ ...step, materials: next });
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="text-xs"
            onClick={() => onChange({ ...step, materials: [...step.materials, newEmptyMaterial()] })}
          >
            <Plus size={14} />
            Adicionar material
          </Button>
        </div>
      ) : null}
      {step.kind === 'quiz' ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-500">Questões deste passo</p>
          {step.questions.map((q, qi) => (
            <QuestionFields
              key={q.id}
              q={q}
              onChange={(next) => {
                const qs = [...step.questions];
                qs[qi] = next;
                onChange({ ...step, questions: qs });
              }}
              onRemove={() =>
                onChange({
                  ...step,
                  questions: step.questions.filter((_, i) => i !== qi),
                })
              }
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className="text-xs"
            onClick={() =>
              onChange({
                ...step,
                questions: [...step.questions, newEmptyQuestion()],
              })
            }
          >
            <Plus size={14} />
            Adicionar questão
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ModuleCard({
  mod,
  index,
  total,
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
}: {
  mod: DraftModule;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (m: DraftModule) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left text-zinc-400 outline-none ring-emerald-500/0 transition hover:text-zinc-200 focus-visible:ring-2"
        >
          {expanded ? <ChevronDown size={18} className="shrink-0" /> : <ChevronRight size={18} className="shrink-0" />}
          <GripVertical size={18} className="hidden shrink-0 sm:block" />
          <span className="shrink-0 text-sm font-medium text-zinc-200">Módulo {index + 1}</span>
          {mod.firestoreId ? (
            <span className="hidden shrink-0 font-mono text-xs text-zinc-600 sm:inline">{mod.firestoreId}</span>
          ) : null}
          {!expanded && mod.title.trim() ? (
            <span className="min-w-0 truncate text-sm text-zinc-500">— {mod.title.trim()}</span>
          ) : null}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs disabled:opacity-30"
          >
            Subir
          </button>
          <button
            type="button"
            disabled={index >= total - 1}
            onClick={() => onMove(1)}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs disabled:opacity-30"
          >
            Descer
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            title="Duplicar módulo abaixo deste"
          >
            <Copy size={14} />
            Duplicar
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30"
          >
            <Trash2 size={14} />
            Excluir
          </button>
        </div>
      </div>

      {expanded ? (
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Título do módulo" value={mod.title} onChange={(e) => onChange({ ...mod, title: e.target.value })} />
          <Input
            label="Ordem (número)"
            type="number"
            value={String(mod.order)}
            onChange={(e) => onChange({ ...mod, order: Number.parseInt(e.target.value, 10) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <MultiTagSelect
              label="Visível para Níveis"
              selected={mod.visibleToRoles}
              onChange={(v) => onChange({ ...mod, visibleToRoles: v })}
              presets={ROLE_PRESETS}
            />
            <MultiTagSelect
              label="Áreas (standby — não filtra)"
              selected={mod.visibleToDepartments}
              onChange={(v) => onChange({ ...mod, visibleToDepartments: v })}
              presets={DEPT_PRESETS}
              standby
            />
          </div>
          <p className="text-xs text-zinc-600">
            Só <span className="text-zinc-400">Níveis</span> definem quem vê o módulo. Áreas ficam no dado para uso
            futuro; nos passos você pode preencher nível por etapa (área no passo também é standby).
          </p>
        </div>
        <FieldTextarea label="Texto principal (layout simples)" value={mod.content} onChange={(v) => onChange({ ...mod, content: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="URL Vimeo (layout simples)"
            value={mod.vimeoUrl}
            onChange={(e) => onChange({ ...mod, vimeoUrl: e.target.value })}
          />
          <Input label="URL PDF (layout simples)" value={mod.pdfUrl} onChange={(e) => onChange({ ...mod, pdfUrl: e.target.value })} />
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-4">
          <p className="text-sm font-medium text-zinc-200">Passos do módulo (recomendado)</p>
          <p className="mt-1 text-xs text-zinc-500">
            Se houver passos, o aluno vê o fluxo por etapas (materiais, vídeo, quiz). Se ficar vazio, vale o layout simples acima.
          </p>
          <div className="mt-4 space-y-4">
            {mod.steps.map((st, si) => (
              <StepBlock
                key={st.localKey}
                step={st}
                onChange={(next) => {
                  const steps = [...mod.steps];
                  steps[si] = next;
                  onChange({ ...mod, steps });
                }}
                onRemove={() =>
                  onChange({
                    ...mod,
                    steps: mod.steps.filter((_, i) => i !== si),
                  })
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onChange({
                  ...mod,
                  steps: [...mod.steps, newEmptyStep(mod.steps.length, 'materials')],
                })
              }
            >
              <Plus size={16} />
              Adicionar passo
            </Button>
          </div>
        </div>
      </div>
      ) : null}
    </div>
  );
}

export function AdminCourseEditor() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !courseId;

  const [draft, setDraft] = useState<CourseDraft>(() => emptyCourseDraft());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  /** Qual módulo está expandido no editor; `null` = todos recolhidos. */
  const [expandedModuleKey, setExpandedModuleKey] = useState<string | null>(null);
  const [catalogCoverUploading, setCatalogCoverUploading] = useState(false);
  const catalogCoverFileRef = useRef<HTMLInputElement>(null);
  const [channels, setChannels] = useState<CatalogChannel[]>([]);

  useEffect(() => {
    const st = location.state as { justSaved?: boolean } | undefined;
    if (!st?.justSaved) return;
    setSaveMessage('Curso salvo com sucesso.');
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!saveMessage) return;
    const t = window.setTimeout(() => setSaveMessage(null), 5000);
    return () => window.clearTimeout(t);
  }, [saveMessage]);

  useEffect(() => {
    let cancelled = false;
    void listAllChannelsAdmin().then((list) => {
      if (!cancelled) setChannels(list.sort((a, b) => a.title.localeCompare(b.title)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew || !courseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await loadCourseDraft(courseId);
        if (!cancelled) {
          setDraft(d);
          setExpandedModuleKey(null);
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar o curso.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, isNew]);

  const reorderModules = useCallback((from: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const to = from + dir;
      if (to < 0 || to >= prev.modules.length) return prev;
      const next = [...prev.modules];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return {
        ...prev,
        modules: next.map((mod, i) => ({ ...mod, order: i })),
      };
    });
  }, []);

  async function handleDeleteCourse() {
    if (!courseId) return;
    if (
      !window.confirm(
        `Excluir o curso "${draft.title || '(sem título)'}" permanentemente?\n\nSerão removidos módulos, gabaritos, vínculos com empresas e matrículas dos alunos. Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteCourseCompletely(courseId);
      navigate('/admin/cursos');
    } catch {
      setError('Não foi possível excluir o curso. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { courseId: savedId } = await saveCourseDraft(isNew ? null : courseId ?? null, draft);
      if (isNew) {
        navigate(`/admin/cursos/${savedId}/edit`, { replace: true, state: { justSaved: true } });
        return;
      }
      const refreshed = await loadCourseDraft(savedId);
      setDraft(refreshed);
      setSaveMessage('Curso salvo com sucesso.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <p className="text-zinc-500">Carregando curso…</p>
      </div>
    );
  }

  if (error && !isNew && draft.modules.length === 0 && !draft.title) {
    return (
      <div>
        <p className="text-red-400">{error}</p>
        <Link to="/admin/cursos" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
          Voltar aos cursos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link
          to="/admin/cursos"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft size={18} />
          Cursos
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <BookOpen size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">{isNew ? 'Novo curso' : 'Editar curso'}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Preencha os dados e salve. Libere o curso para empresas na lista de cursos.
            </p>
          </div>
        </div>
        {!isNew && courseId ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleting || saving}
              onClick={() => {
                const path = `/curso/${encodeURIComponent(courseId)}?preview=admin`;
                window.open(`${window.location.origin}${path}`, '_blank', 'noopener,noreferrer');
              }}
            >
              Prévia (aluno)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-900/60 text-red-400 hover:bg-red-950/40"
              disabled={deleting || saving}
              isLoading={deleting}
              onClick={() => void handleDeleteCourse()}
            >
              Excluir curso
            </Button>
          </div>
        ) : null}
      </div>

      {saveMessage ? (
        <p
          className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          {saveMessage}
        </p>
      ) : null}

      {error ? <p className="mt-6 text-sm text-red-400">{error}</p> : null}

      <div className="mt-8 space-y-6">
        <Input label="Título do curso" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        <FieldTextarea
          label="Descrição"
          value={draft.description}
          onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
          rows={3}
        />
        <FieldTextarea
          label="Sobre o curso (home pública)"
          value={draft.about}
          onChange={(v) => setDraft((d) => ({ ...d, about: v }))}
          rows={8}
        />
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div>
            <p className="text-sm font-medium text-zinc-300">Imagem do card (Programas na home)</p>
            <p className="mt-1 text-xs text-zinc-500">
              Opcional. Se definir uma capa em PNG, JPG ou WebP, ela aparece no carrossel horizontal no lugar do frame
              do primeiro vídeo Vimeo. Os vídeos introdutórios continuam no painel ao abrir o curso.
            </p>
          </div>
          {draft.catalogCardImageUrl.trim() ? (
            <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
              <img
                src={draft.catalogCardImageUrl.trim()}
                alt="Prévia da capa do card"
                className="aspect-video w-full object-cover"
              />
            </div>
          ) : null}
          <Input
            label="URL da imagem (opcional)"
            value={draft.catalogCardImageUrl}
            onChange={(e) => setDraft((d) => ({ ...d, catalogCardImageUrl: e.target.value }))}
            placeholder="https://… ou envie um arquivo abaixo"
          />
          <input
            ref={catalogCoverFileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file || !courseId) return;
              setCatalogCoverUploading(true);
              setError(null);
              void (async () => {
                try {
                  const url = await uploadCourseCatalogCover(courseId, file);
                  setDraft((d) => ({ ...d, catalogCardImageUrl: url }));
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Falha no envio da imagem. Verifique o Storage no Firebase e o arquivo (máx. 6 MB).'
                  );
                } finally {
                  setCatalogCoverUploading(false);
                }
              })();
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-sm"
              disabled={!courseId || catalogCoverUploading || saving}
              isLoading={catalogCoverUploading}
              onClick={() => catalogCoverFileRef.current?.click()}
            >
              <Upload size={16} />
              Enviar PNG / JPG / WebP
            </Button>
            {draft.catalogCardImageUrl.trim() ? (
              <Button
                type="button"
                variant="outline"
                className="text-sm"
                disabled={catalogCoverUploading || saving}
                onClick={() => setDraft((d) => ({ ...d, catalogCardImageUrl: '' }))}
              >
                Remover capa
              </Button>
            ) : null}
          </div>
          {isNew ? (
            <p className="text-xs text-amber-200/90">
              Salve o curso uma vez para habilitar o envio por arquivo (a imagem fica no Storage do projeto).
            </p>
          ) : null}
        </div>
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div>
            <p className="text-sm font-medium text-zinc-300">Vídeos introdutórios (Vimeo)</p>
            <p className="mt-1 text-xs text-zinc-500">
              Se não houver <span className="text-zinc-400">imagem do card</span> acima, o{' '}
              <span className="text-zinc-400">primeiro</span> vídeo define o frame do card; na home, ao abrir o curso,
              todos aparecem na área de vídeos introdutórios. O <span className="text-zinc-400">título</span> substitui
              &quot;Vídeo 1&quot;, &quot;Vídeo 2&quot; etc. Ordene com as setas.
            </p>
          </div>
          {draft.introVimeoUrls.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nenhuma URL de vídeo. Você pode usar só a imagem do card acima; para o carrossel ao abrir o curso, adicione
              vídeos aqui.
            </p>
          ) : null}
          {draft.introVimeoUrls.map((row, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/20 p-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-xs font-medium text-zinc-500">
                  {draft.introVimeoUrls.length === 1
                    ? 'Vídeo introdutório'
                    : `Vídeo ${i + 1}${i === 0 ? ' (destaque no card)' : ''}`}
                </p>
                <Input
                  label="Título (opcional)"
                  value={row.title}
                  onChange={(e) => {
                    const next = [...draft.introVimeoUrls];
                    next[i] = { ...next[i]!, title: e.target.value };
                    setDraft((d) => ({ ...d, introVimeoUrls: next }));
                  }}
                  placeholder="Ex.: Boas-vindas ao programa"
                />
                <Input
                  label="URL Vimeo"
                  value={row.url}
                  onChange={(e) => {
                    const next = [...draft.introVimeoUrls];
                    next[i] = { ...next[i]!, url: e.target.value };
                    setDraft((d) => ({ ...d, introVimeoUrls: next }));
                  }}
                  placeholder="https://vimeo.com/…"
                />
              </div>
              <div className="flex shrink-0 gap-1 sm:pb-0.5">
                <button
                  type="button"
                  disabled={i === 0}
                  title="Mover para cima"
                  onClick={() => {
                    if (i === 0) return;
                    const next = [...draft.introVimeoUrls];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    setDraft((d) => ({ ...d, introVimeoUrls: next }));
                  }}
                  className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  type="button"
                  disabled={i === draft.introVimeoUrls.length - 1}
                  title="Mover para baixo"
                  onClick={() => {
                    if (i >= draft.introVimeoUrls.length - 1) return;
                    const next = [...draft.introVimeoUrls];
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    setDraft((d) => ({ ...d, introVimeoUrls: next }));
                  }}
                  className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown size={18} />
                </button>
                <button
                  type="button"
                  title="Remover"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      introVimeoUrls: d.introVimeoUrls.filter((_, j) => j !== i),
                    }))
                  }
                  className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-red-950/50 hover:text-red-400"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="text-sm"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                introVimeoUrls: [...d.introVimeoUrls, { url: '', title: '' }],
              }))
            }
          >
            <Plus size={16} />
            Adicionar vídeo
          </Button>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
            checked={draft.catalogPublished}
            onChange={(e) => setDraft((d) => ({ ...d, catalogPublished: e.target.checked }))}
          />
          <span>
            <span className="block text-sm font-medium text-zinc-200">Mostrar na página inicial (catálogo público)</span>
            <span className="mt-1 block text-xs text-zinc-500">
              Visitantes não logados veem prévia: cronograma (módulos e passos), texto &quot;Sobre o curso&quot; e os vídeos
              introdutórios — não o conteúdo das aulas.
            </span>
          </span>
        </label>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-4">
          <SelectSmall
            label="Canal (opcional)"
            value={draft.channelId}
            onChange={(channelId) => setDraft((d) => ({ ...d, channelId }))}
            options={[
              { value: '', label: 'Nenhum — aparece só em Programas' },
              ...channels.map((ch) => ({ value: ch.id, label: ch.title })),
            ]}
          />
          <p className="mt-2 text-xs text-zinc-500">
            Se escolher um canal, o curso deixa de aparecer na lista &quot;Programas&quot; e passa a aparecer na página{' '}
            <span className="font-mono text-zinc-400">/canal/…</span> desse canal (com os vídeos configurados no canal).
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-zinc-200">Módulos</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const m = newEmptyModule(draft.modules.length);
              setDraft((d) => ({
                ...d,
                modules: [...d.modules, m],
              }));
              setExpandedModuleKey(m.localKey);
            }}
          >
            <Plus size={16} />
            Adicionar módulo
          </Button>
        </div>

        {draft.modules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/20 p-8 text-center text-sm text-zinc-500">
            Nenhum módulo. Use &quot;Adicionar módulo&quot; para começar.
          </p>
        ) : (
          <div className="space-y-6">
            {draft.modules.map((mod, index) => (
              <ModuleCard
                key={mod.localKey}
                mod={mod}
                index={index}
                total={draft.modules.length}
                expanded={expandedModuleKey === mod.localKey}
                onToggleExpand={() =>
                  setExpandedModuleKey((k) => (k === mod.localKey ? null : mod.localKey))
                }
                onChange={(m) =>
                  setDraft((d) => ({
                    ...d,
                    modules: d.modules.map((x, i) => (i === index ? m : x)),
                  }))
                }
                onRemove={() => {
                  setExpandedModuleKey((k) => (k === mod.localKey ? null : k));
                  setDraft((d) => ({
                    ...d,
                    modules: d.modules.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i })),
                  }));
                }}
                onMove={(dir) => reorderModules(index, dir)}
                onDuplicate={() => {
                  const copy = duplicateDraftModule(mod);
                  setDraft((d) => {
                    const next = [...d.modules.slice(0, index + 1), copy, ...d.modules.slice(index + 1)].map(
                      (m, i) => ({ ...m, order: i }),
                    );
                    return { ...d, modules: next };
                  });
                  setExpandedModuleKey(copy.localKey);
                }}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-8">
          <Button type="button" isLoading={saving} onClick={() => void handleSave()}>
            Salvar no Firestore
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => navigate('/admin/cursos')}>
            Voltar à lista
          </Button>
        </div>
      </div>
    </div>
  );
}
