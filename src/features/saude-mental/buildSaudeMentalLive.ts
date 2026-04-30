import type { CourseEnrollmentRow } from '@/lib/firestore/analytics';
import type { StudentDemographics } from '@/types';
import { moduleAppliesToCompanyRole } from '@/lib/courseVisibility';
import type { ModuleContent } from '@/types';
import { SAUDE_MENTAL_INSTRUMENT_MODULE_IDS_ENV } from '@/features/saude-mental/config';
import { likertTo100 } from '@/features/saude-mental/surveyAnalysis';
import type { SurveyResponse } from '@/features/saude-mental/typesSurvey';
import type { CourseParticipant, CompletionStatus } from '@/features/saude-mental/typesCourse';
import { optionIndexToLikert, orderedQuizQuestionsForModule } from '@/features/saude-mental/moduleQuestions';

export type InstrumentModuleMap = { T0: string; T1: string; T2: string };

/**
 * Resolve os 3 módulos T0/T1/T2 (Instrumento 01 → 03).
 * Ordem de prioridade: `.env` → títulos Medivox ("Instrumento de Autopercepção 1/2" + terceiro sem sufixo)
 * → legado "Instrumento 01/02/03".
 */
export function resolveInstrumentModuleIds(modules: ModuleContent[]): InstrumentModuleMap | null {
  const env = SAUDE_MENTAL_INSTRUMENT_MODULE_IDS_ENV;
  if (env) {
    const parts = env.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 3) {
      const ids = new Set(modules.map((m) => m.id));
      if (parts.every((id) => ids.has(id))) {
        return { T0: parts[0], T1: parts[1], T2: parts[2] };
      }
    }
  }

  const norm = (s: string) => s.trim().toLowerCase();

  const matchAutopercepcao1 = (title: string) => {
    const t = norm(title);
    return (
      /\bautopercep[cç][aã]o\s*1\b/.test(t) ||
      /\binstrumento\s+de\s+autopercep[cç][aã]o\s*1\b/.test(t) ||
      /\binstrumento\s*0*1\b/.test(t)
    );
  };
  const matchAutopercepcao2 = (title: string) => {
    const t = norm(title);
    return (
      /\bautopercep[cç][aã]o\s*2\b/.test(t) ||
      /\binstrumento\s+de\s+autopercep[cç][aã]o\s*2\b/.test(t) ||
      /\binstrumento\s*0*2\b/.test(t)
    );
  };
  /** T2: "Instrumento de Autopercepção 3" ou só "Instrumento de Autopercepção" (terceiro módulo no demo). */
  const matchAutopercepcao3 = (title: string) => {
    const t = norm(title);
    if (/\bautopercep[cç][aã]o\s*3\b/.test(t) || /\binstrumento\s*0*3\b/.test(t)) return true;
    if (/^instrumento\s+de\s+autopercep[cç][aã]o\s*$/.test(t.trim())) return true;
    return false;
  };

  const byOrder = (a: ModuleContent, b: ModuleContent) => a.order - b.order;

  const cands0 = modules.filter((m) => matchAutopercepcao1(m.title)).sort(byOrder);
  const cands1 = modules.filter((m) => matchAutopercepcao2(m.title)).sort(byOrder);
  const cands2 = modules.filter((m) => matchAutopercepcao3(m.title)).sort(byOrder);

  const t0 = cands0[0];
  const t1 = cands1[0];
  let t2 = cands2[0];

  if (t0 && t1 && !t2) {
    const used = new Set([t0.id, t1.id]);
    const rest = modules
      .filter((m) => !used.has(m.id))
      .filter((m) => {
        const t = norm(m.title);
        return (
          t.includes('autopercep') &&
          !matchAutopercepcao1(m.title) &&
          !matchAutopercepcao2(m.title)
        );
      })
      .sort(byOrder);
    t2 = rest[0];
  }

  if (t0 && t1 && t2 && new Set([t0.id, t1.id, t2.id]).size === 3) {
    return { T0: t0.id, T1: t1.id, T2: t2.id };
  }

  const legacy0 = modules.find((m) => /instrumento\s*0*1\b/i.test(m.title));
  const legacy1 = modules.find((m) => /instrumento\s*0*2\b/i.test(m.title));
  const legacy2 = modules.find((m) => /instrumento\s*0*3\b/i.test(m.title));
  if (legacy0 && legacy1 && legacy2 && new Set([legacy0.id, legacy1.id, legacy2.id]).size === 3) {
    return { T0: legacy0.id, T1: legacy1.id, T2: legacy2.id };
  }

  /** Momentos T0/T1/T2 explícitos no título (planilhas / relatórios). */
  const tTag = (tag: string) => (title: string) => new RegExp(`\\b${tag}\\b`, 'i').test(norm(title));
  const tag0 = modules.filter((m) => tTag('T0')(m.title)).sort(byOrder)[0];
  const tag1 = modules.filter((m) => tTag('T1')(m.title)).sort(byOrder)[0];
  const tag2 = modules.filter((m) => tTag('T2')(m.title)).sort(byOrder)[0];
  if (tag0 && tag1 && tag2 && new Set([tag0.id, tag1.id, tag2.id]).size === 3) {
    return { T0: tag0.id, T1: tag1.id, T2: tag2.id };
  }

  /** Último recurso: módulos com questionário longo (≥10 perguntas), por ordem do curso. */
  const withManyQs = modules
    .filter((m) => orderedQuizQuestionsForModule(m).length >= 10)
    .sort(byOrder);
  if (withManyQs.length === 3) {
    return { T0: withManyQs[0]!.id, T1: withManyQs[1]!.id, T2: withManyQs[2]!.id };
  }
  const hinted = withManyQs.filter((m) =>
    /instrumento|autopercep|questionário|questionario|likert|escala|avalia/i.test(m.title),
  );
  if (hinted.length >= 3) {
    const sorted = [...hinted].sort(byOrder);
    const a = sorted[0]!;
    const b = sorted[1]!;
    const c = sorted[2]!;
    if (new Set([a.id, b.id, c.id]).size === 3) {
      return { T0: a.id, T1: b.id, T2: c.id };
    }
  }

  return null;
}

function trackFromRole(role: string | null | undefined): string {
  return role ?? 'geral';
}

function instStatus(
  row: CourseEnrollmentRow,
  moduleId: string | undefined
): CompletionStatus | undefined {
  if (!moduleId) return undefined;
  const st = row.moduleStatuses[moduleId];
  if (st === 'completed') return 'concluido';
  if (st === 'draft') return 'em_andamento';
  return 'nao_iniciado';
}

function visibleModuleIds(modules: ModuleContent[], role: string | null | undefined): string[] {
  return modules.filter((m) => moduleAppliesToCompanyRole(m, role)).map((m) => m.id);
}

function buildSurveyRowForInstrument(
  row: CourseEnrollmentRow,
  tempo: SurveyResponse['tempo'],
  moduleId: string,
  mod: ModuleContent,
  empresaNome: string,
  demographics?: StudentDemographics
): SurveyResponse | null {
  if (!moduleAppliesToCompanyRole(mod, row.companyRole)) return null;
  if (row.moduleStatuses[moduleId] !== 'completed') return null;
  const qs = orderedQuizQuestionsForModule(mod);
  if (qs.length < 6) return null;

  const answers = row.answersByModule[moduleId] ?? {};
  const out: Partial<SurveyResponse> = {
    empresa_id: row.companyId,
    empresa_nome: empresaNome,
    participante_id: row.uid,
    trilha: trackFromRole(row.companyRole),
    tempo,
  };

  const qkeys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'] as const;

  for (let i = 0; i < 10; i++) {
    const qdef = qs[i];
    if (!qdef) {
      if (i < 6) return null;
      break;
    }
    const raw = answers[qdef.id];
    if (typeof raw !== 'number') {
      if (i < 6) return null;
      continue;
    }
    const lik = optionIndexToLikert(raw, qdef.options.length);
    if (Number.isNaN(lik)) {
      if (i < 6) return null;
      continue;
    }
    (out as Record<string, unknown>)[qkeys[i]] = lik;
  }

  const q1 = out.q1 as number;
  const q2 = out.q2 as number;
  const q3 = out.q3 as number;
  const q4 = out.q4 as number;
  const q5 = out.q5 as number;
  const q6 = out.q6 as number;
  if ([q1, q2, q3, q4, q5, q6].some((x) => typeof x !== 'number')) return null;
  const avgCore = (q1 + q2 + q3 + q4 + q5 + q6) / 6;
  out.score_geral = likertTo100(avgCore);

  if (demographics?.sexo) out.sexo = demographics.sexo;
  if (demographics?.faixaEtaria) out.faixa_etaria = demographics.faixaEtaria;
  if (typeof demographics?.segundaJornada === 'boolean') out.segunda_jornada = demographics.segundaJornada;
  if (typeof demographics?.idade === 'number') out.idade = demographics.idade;

  return out as SurveyResponse;
}

export function buildSurveyResponsesFromRows(
  rows: CourseEnrollmentRow[],
  moduleById: Map<string, ModuleContent>,
  instruments: InstrumentModuleMap,
  companyName: Map<string, string>,
  demographicsByUid?: Map<string, StudentDemographics>
): SurveyResponse[] {
  const list: SurveyResponse[] = [];
  const temps: SurveyResponse['tempo'][] = ['T0', 'T1', 'T2'];
  const instIds = [instruments.T0, instruments.T1, instruments.T2];

  for (const row of rows) {
    if (!row.enrolled) continue;
    const nome = row.companyId ? (companyName.get(row.companyId) ?? row.companyName) : row.companyName;
    const dem = demographicsByUid?.get(row.uid);
    for (let i = 0; i < 3; i++) {
      const mid = instIds[i];
      const mod = moduleById.get(mid);
      if (!mod) continue;
      const sr = buildSurveyRowForInstrument(row, temps[i], mid, mod, nome, dem);
      if (sr) list.push(sr);
    }
  }
  return list;
}

export function buildCourseParticipantsFromRows(
  rows: CourseEnrollmentRow[],
  modules: ModuleContent[],
  instruments: InstrumentModuleMap,
  instrumentSet: Set<string>,
  companyName: Map<string, string>
): CourseParticipant[] {
  return rows.map((row) => {
    const role = row.companyRole;
    const vIds = visibleModuleIds(modules, role).filter((id) => !instrumentSet.has(id));
    const enrolled = row.enrolled;
    const started =
      enrolled &&
      vIds.some((id) => row.moduleStatuses[id] === 'draft' || row.moduleStatuses[id] === 'completed');
    const completed =
      enrolled &&
      vIds.length > 0 &&
      vIds.every((id) => row.moduleStatuses[id] === 'completed');
    const doneCount = vIds.filter((id) => row.moduleStatuses[id] === 'completed').length;
    const progress_pct = enrolled && vIds.length ? (doneCount / vIds.length) * 100 : 0;

    const eligible = true;
    const invited = true;

    return {
      company_id: row.companyId,
      company_name: row.companyId ? (companyName.get(row.companyId) ?? row.companyName) : row.companyName,
      participant_id: row.uid,
      track: trackFromRole(role),
      eligible,
      invited,
      enrolled,
      started,
      completed,
      enrolled_at: row.enrolledAt?.toISOString(),
      progress_pct,
      instrument_1_status: instStatus(row, instruments.T0),
      instrument_2_status: instStatus(row, instruments.T1),
      instrument_3_status: instStatus(row, instruments.T2),
    };
  });
}
