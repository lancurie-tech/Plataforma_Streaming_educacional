import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, GraduationCap, KeyRound, Users } from 'lucide-react';
import { listPublishedCatalogCourses, listModules } from '@/lib/firestore/courses';
import type { CourseSummary, ModuleContent, ModuleStep } from '@/types';
import { useBrand } from '@/contexts/useBrand';

function stepKindLabel(kind: ModuleStep['kind']): string {
  switch (kind) {
    case 'video':
      return 'Vídeo';
    case 'quiz':
      return 'Questionário';
    default:
      return 'Materiais e texto';
  }
}

function moduleFlowLines(mod: ModuleContent): string[] {
  if (mod.steps?.length) {
    return mod.steps.map((s, i) => {
      return `${i + 1}. ${s.title} — ${stepKindLabel(s.kind)}`;
    });
  }
  const bits: string[] = [];
  if (mod.vimeoUrl) bits.push('vídeo');
  if (mod.pdfUrl || mod.content?.trim()) bits.push('texto/PDF');
  if (mod.questions?.length) bits.push('questionário');
  if (bits.length) return [`Formato clássico do módulo: ${bits.join(', ')}.`];
  return ['Detalhes do módulo conforme configurado no painel admin.'];
}

export function VendedorDocumentationPage() {
  const brand = useBrand();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [modulesByCourse, setModulesByCourse] = useState<Record<string, ModuleContent[]>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const list = await listPublishedCatalogCourses();
        if (cancelled) return;
        const sorted = list.sort((a, b) => a.title.localeCompare(b.title));
        setCourses(sorted);
        const entries = await Promise.all(
          sorted.map(async (c) => {
            const mods = await listModules(c.id);
            return [c.id, mods] as const;
          })
        );
        if (cancelled) return;
        const map: Record<string, ModuleContent[]> = {};
        for (const [id, mods] of entries) map[id] = mods;
        setModulesByCourse(map);
      } catch {
        if (!cancelled) {
          setErr('Não foi possível carregar os cursos.');
          setCourses([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Documentação para vendas</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        Use esta página como apoio em reuniões: resumo do modelo de negócio, cadastro B2B e, para cada
        curso do catálogo, o que o colaborador percorre (módulos e tipo de conteúdo). A prévia interativa
        continua em <strong className="text-zinc-300">Cursos</strong> no menu.
      </p>

      <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/35 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
          <GraduationCap className="text-sky-400" size={22} />
          Como a {brand.platformDisplayName} entrega o curso
        </h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-400">
          <li>
            A <strong className="text-zinc-300">empresa contratante</strong> recebe liberações de cursos e
            prazos; os colaboradores acessam por cadastro com chave (link único da empresa).
          </li>
          <li>
            Cada <strong className="text-zinc-300">curso</strong> é dividido em <strong className="text-zinc-300">módulos</strong>.
            Dentro de um módulo, o colaborador avança por passos: vídeos (Vimeo), materiais em PDF/texto e
            questionários — nesta ordem quando o curso usa o editor por passos.
          </li>
          <li>
            Conteúdo pode ser direcionado a <strong className="text-zinc-300">gestores</strong> ou{' '}
            <strong className="text-zinc-300">colaboradores</strong> quando o curso define audiência por
            passo (o perfil vem da chave usada no cadastro).
          </li>
          <li>
            Ao concluir o que o curso exige, o sistema pode registrar progresso e, quando previsto, emitir{' '}
            <strong className="text-zinc-300">certificado</strong>.
          </li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/35 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
          <KeyRound className="text-sky-400" size={22} />
          Cadastro B2B (pitch rápido)
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-400">
          <li className="flex gap-2">
            <Users className="mt-0.5 shrink-0 text-zinc-500" size={18} />
            <span>
              A empresa divulga internamente o <strong className="text-zinc-300">link</strong> no formato{' '}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-(--brand-primary-hover)">
                /nome-da-empresa/cadastro
              </code>
              . O colaborador preenche dados e aceita termos; a liberação de cursos depende do contrato ativo.
            </span>
          </li>
          <li className="flex gap-2">
            <KeyRound className="mt-0.5 shrink-0 text-zinc-500" size={18} />
            <span>
              Existem duas <strong className="text-zinc-300">chaves de acesso</strong> (gestor e colaborador),
              geradas quando a empresa é criada no painel admin. A chave define o perfil no cadastro e pode
              direcionar conteúdos específicos no curso.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-zinc-600">
          Chaves e links completos aparecem nos relatórios por empresa (área restrita). Não envie credenciais
          por e-mail sem criptografia ou canal acordado com o cliente.
        </p>
      </section>

      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Catálogo — o que cada curso contém
      </h2>

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">Carregando cursos e módulos…</p>
      ) : err ? (
        <p className="mt-6 text-sm text-red-400">{err}</p>
      ) : courses.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">Nenhum curso publicado no catálogo.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {courses.map((c) => {
            const mods = modulesByCourse[c.id] ?? [];
            return (
              <li
                key={c.id}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 shadow-sm shadow-black/20"
              >
                <div className="border-b border-zinc-800/90 bg-zinc-900/50 px-5 py-4 sm:flex sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-zinc-100">{c.title}</h3>
                    <p className="mt-0.5 font-mono text-xs text-zinc-500">id: {c.id}</p>
                    {c.description ? (
                      <p className="mt-2 text-sm text-zinc-400">{c.description}</p>
                    ) : null}
                  </div>
                  <Link
                    to={`/vendedor/curso/${c.id}`}
                    className="mt-3 inline-flex shrink-0 items-center gap-1 rounded-xl border border-sky-600/50 bg-sky-950/30 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-950/50 sm:mt-0"
                  >
                    Abrir prévia do aluno
                    <ChevronRight size={18} />
                  </Link>
                </div>
                {c.about ? (
                  <div className="border-b border-zinc-800/80 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sobre o curso</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{c.about}</p>
                  </div>
                ) : null}
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Módulos ({mods.length})
                  </p>
                  {mods.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">Nenhum módulo listado para este curso.</p>
                  ) : (
                    <ol className="mt-3 space-y-4">
                      {mods.map((mod, idx) => (
                        <li
                          key={mod.id}
                          className="rounded-xl border border-zinc-800/90 bg-zinc-900/30 px-4 py-3"
                        >
                          <p className="font-medium text-zinc-200">
                            {idx + 1}. {mod.title || 'Módulo'}
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-zinc-500">
                            {moduleFlowLines(mod).map((line, j) => (
                              <li key={`${mod.id}-${j}`} className="flex gap-2">
                                <BookOpen className="mt-0.5 shrink-0 text-zinc-600" size={14} />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
