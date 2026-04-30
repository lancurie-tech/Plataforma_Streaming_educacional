import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  gradableQuestionIdsForRole,
  moduleAppliesToCompanyRole,
  questionVisibleToCompanyRole,
} from '@/lib/courseVisibility';
import { getCompany, listCompanies } from '@/lib/firestore/admin';
import { getUserModuleSubmission, listModules } from '@/lib/firestore/courses';
import type { ModuleContent, QuestionDef } from '@/types';

export type StudentProfileRow = {
  uid: string;
  name: string;
  email: string;
  companyId: string;
  companyRoleId?: string | null;
  companyDepartmentId?: string | null;
};

export type ModuleCompletionStat = {
  moduleId: string;
  title: string;
  completed: number;
  /** Matriculados para quem este módulo existe no curso (audiência + conteúdo visível). */
  enrolled: number;
};

export type CompanyCourseStat = {
  companyId: string;
  companyName: string;
  students: number;
  enrolledInCourse: number;
  avgModulesCompleted: number;
  moduleTotal: number;
  gradedAnswersTotal: number;
  correctAnswersTotal: number;
  aggregateAccuracyPercent: number | null;
  avgUserAccuracyPercent: number | null;
};

export type UserCourseStat = {
  uid: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  companyRoleId?: string | null;
  companyDepartmentId?: string | null;
  enrolled: boolean;
  modulesCompleted: number;
  moduleTotal: number;
  correctAnswers: number;
  gradedAnswers: number;
  scorePercent: number | null;
};

export type QuestionDistribution = {
  moduleId: string;
  questionId: string;
  /** Título do módulo (Firestore) para exibição em métricas. */
  moduleTitle: string;
  /** Enunciado da pergunta para exibição em métricas. */
  questionPrompt: string;
  byOptionIndex: Record<number, number>;
};

export type AnalyticsRoleSegment = 'combined';

export type SegmentAnalyticsSlice = {
  moduleCompletion: ModuleCompletionStat[];
  byCompany: CompanyCourseStat[];
  byUser: UserCourseStat[];
  questionDistributions: QuestionDistribution[];
  enrolledInCourseCount: number;
  completedFullCourseCount: number;
};

function collectQuestionsByModule(modules: ModuleContent[]): Map<string, QuestionDef[]> {
  const map = new Map<string, QuestionDef[]>();
  for (const m of modules) {
    const list: QuestionDef[] = [];
    if (m.questions?.length) list.push(...m.questions);
    for (const s of m.steps ?? []) {
      if (s.kind === 'quiz' && s.questions?.length) list.push(...s.questions);
    }
    if (list.length) map.set(m.id, list);
  }
  return map;
}

async function listStudentsForAdmin(): Promise<StudentProfileRow[]> {
  const q = query(collection(db, 'users'), where('role', '==', 'student'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      uid: d.id,
      name: (x.name as string) ?? '',
      email: (x.email as string) ?? '',
      companyId: typeof x.companyId === 'string' ? x.companyId : '',
      companyRoleId: typeof x.companyRoleId === 'string' ? x.companyRoleId : null,
      companyDepartmentId: typeof x.companyDepartmentId === 'string' ? x.companyDepartmentId : null,
    };
  });
}

/** Alunos cujo `companyId` está na lista (para vendedor / relatórios por carteira). */
export async function listStudentsForCompanies(
  companyIds: string[]
): Promise<StudentProfileRow[]> {
  if (!companyIds.length) return [];
  const out: StudentProfileRow[] = [];
  const seen = new Set<string>();
  const uniqueIds = [...new Set(companyIds.filter(Boolean))];
  for (const companyId of uniqueIds) {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('companyId', '==', companyId)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const x = d.data();
      out.push({
        uid: d.id,
        name: (x.name as string) ?? '',
        email: (x.email as string) ?? '',
        companyId: typeof x.companyId === 'string' ? x.companyId : '',
        companyRoleId: typeof x.companyRoleId === 'string' ? x.companyRoleId : null,
        companyDepartmentId: typeof x.companyDepartmentId === 'string' ? x.companyDepartmentId : null,
      });
    }
  }
  return out;
}

async function isEnrolledInCourse(uid: string, courseId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', uid, 'courses', courseId));
  return snap.exists();
}

/**
 * Busca submissões **uma só vez** por módulo e retorna status + respostas.
 * Antes eram duas funções (`fetchModuleStatuses` + `fetchModuleAnswers`) que liam os mesmos
 * documentos em duplicado — cortamos ~50% de leituras Firestore nos relatórios.
 */
async function fetchModuleSubmissions(
  uid: string,
  courseId: string,
  moduleIds: string[]
): Promise<{
  statuses: Record<string, 'draft' | 'completed'>;
  answers: Record<string, Record<string, number>>;
}> {
  const statuses: Record<string, 'draft' | 'completed'> = {};
  const answers: Record<string, Record<string, number>> = {};
  await Promise.all(
    moduleIds.map(async (mid) => {
      const sub = await getUserModuleSubmission(uid, courseId, mid);
      if (!sub) return;
      statuses[mid] = sub.status;
      if (sub.status === 'completed' && sub.answers && Object.keys(sub.answers).length) {
        answers[mid] = sub.answers;
      }
    })
  );
  return { statuses, answers };
}

async function fetchAnswerKeysByModule(
  courseId: string,
  moduleIds: string[]
): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  await Promise.all(
    moduleIds.map(async (mid) => {
      const snap = await getDoc(doc(db, 'answerKeys', `${courseId}__${mid}`));
      if (!snap.exists()) return;
      const raw = snap.data().correctByQuestionId;
      if (raw && typeof raw === 'object') {
        const o: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (typeof v === 'number') o[k] = v;
        }
        if (Object.keys(o).length) map.set(mid, o);
      }
    })
  );
  return map;
}

function scoreUserAgainstKeys(
  answersByModule: Record<string, Record<string, number>>,
  keysByModule: Map<string, Record<string, number>>,
  modules: ModuleContent[],
  roleForVisibility: string | null | undefined
): { correct: number; graded: number } {
  let correct = 0;
  let graded = 0;
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  for (const [mid, key] of keysByModule) {
    const mod = moduleById.get(mid);
    if (!mod) continue;
    const allowed = gradableQuestionIdsForRole(mod, roleForVisibility);
    const ans = answersByModule[mid];
    if (!ans) continue;
    for (const [qid, correctIdx] of Object.entries(key)) {
      if (!allowed.has(qid)) continue;
      if (typeof ans[qid] !== 'number') continue;
      graded += 1;
      if (ans[qid] === correctIdx) correct += 1;
    }
  }
  return { correct, graded };
}

/** Linha de matrícula + submissões por módulo (uso em analytics e painel Saúde Mental). */
export type CourseEnrollmentRow = {
  uid: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  companyRole?: string | null;
  companyRoleId?: string | null;
  companyDepartmentId?: string | null;
  enrolled: boolean;
  /** Data de matrícula em `users/{uid}/courses/{courseId}`, quando existir. */
  enrolledAt?: Date;
  moduleStatuses: Record<string, 'draft' | 'completed'>;
  answersByModule: Record<string, Record<string, number>>;
};

type InternalEnrolledRow = CourseEnrollmentRow;

function visibleModuleIdsForRow(
  modules: ModuleContent[],
  row: InternalEnrolledRow,
): string[] {
  return modules.filter((m) => moduleAppliesToCompanyRole(m, row.companyRole)).map((m) => m.id);
}

function filterEnrolledRows(rows: InternalEnrolledRow[]): InternalEnrolledRow[] {
  return rows.filter((r) => r.enrolled);
}

function buildUserStat(
  row: InternalEnrolledRow,
  modules: ModuleContent[],
  keysByModule: Map<string, Record<string, number>>,
): UserCourseStat {
  if (!row.enrolled) {
    return {
      uid: row.uid,
      name: row.name,
      email: row.email,
      companyId: row.companyId,
      companyName: row.companyName,
      companyRoleId: row.companyRoleId,
      companyDepartmentId: row.companyDepartmentId,
      enrolled: false,
      modulesCompleted: 0,
      moduleTotal: 0,
      correctAnswers: 0,
      gradedAnswers: 0,
      scorePercent: null,
    };
  }

  const vIds = visibleModuleIdsForRow(modules, row);
  const modulesCompleted = vIds.filter((id) => row.moduleStatuses[id] === 'completed').length;
  const moduleTotal = vIds.length;

  const { correct, graded } = scoreUserAgainstKeys(
    row.answersByModule,
    keysByModule,
    modules,
    row.companyRole
  );

  return {
    uid: row.uid,
    name: row.name,
    email: row.email,
    companyId: row.companyId,
    companyName: row.companyName,
    companyRoleId: row.companyRoleId,
    companyDepartmentId: row.companyDepartmentId,
    enrolled: row.enrolled,
    modulesCompleted,
    moduleTotal,
    correctAnswers: correct,
    gradedAnswers: graded,
    scorePercent:
      graded > 0 ? Math.round((correct / graded) * 10000) / 100 : null,
  };
}

function buildModuleCompletion(
  moduleIds: string[],
  moduleTitle: Map<string, string>,
  moduleById: Map<string, ModuleContent>,
  enrolledRows: InternalEnrolledRow[],
): ModuleCompletionStat[] {
  return moduleIds.map((mid) => {
    const mod = moduleById.get(mid);
    const title = moduleTitle.get(mid) ?? mid;
    if (!mod) {
      return { moduleId: mid, title, enrolled: 0, completed: 0 };
    }
    let enrolled = 0;
    let completed = 0;
    for (const u of enrolledRows) {
      if (!u.enrolled) continue;
      if (!moduleAppliesToCompanyRole(mod, u.companyRole)) continue;
      enrolled += 1;
      if (u.moduleStatuses[mid] === 'completed') completed += 1;
    }
    return { moduleId: mid, title, enrolled, completed };
  });
}

function buildQuestionDistributions(
  questionsByModule: Map<string, QuestionDef[]>,
  moduleById: Map<string, ModuleContent>,
  enrolledRows: InternalEnrolledRow[],
): QuestionDistribution[] {
  const out: QuestionDistribution[] = [];
  for (const [mid, qlist] of questionsByModule) {
    const mod = moduleById.get(mid);
    if (!mod) continue;
    for (const q of qlist) {
      const byOptionIndex: Record<number, number> = {};
      for (const u of enrolledRows) {
        if (!u.enrolled) continue;
        if (!questionVisibleToCompanyRole(mod, q.id, u.companyRole)) continue;
        const ans = u.answersByModule[mid]?.[q.id];
        if (typeof ans !== 'number') continue;
        byOptionIndex[ans] = (byOptionIndex[ans] ?? 0) + 1;
      }
      const total = Object.values(byOptionIndex).reduce((a, b) => a + b, 0);
      if (total > 0) {
        out.push({
          moduleId: mid,
          questionId: q.id,
          moduleTitle: mod.title?.trim() || mid,
          questionPrompt: q.prompt?.trim() || q.id,
          byOptionIndex,
        });
      }
    }
  }
  return out;
}

function buildByCompany(
  companies: { id: string; name: string }[],
  enrolledRows: InternalEnrolledRow[],
  byUser: UserCourseStat[],
  moduleIdsLength: number
): CompanyCourseStat[] {
  type Agg = {
    students: number;
    enrolledInCourse: number;
    sumModules: number;
    correctAnswersTotal: number;
    gradedAnswersTotal: number;
    sumUserAccuracyPercent: number;
    usersWithGradedAnswers: number;
  };
  const map = new Map<string, Agg>();
  for (const c of companies) {
    map.set(c.id, {
      students: 0,
      enrolledInCourse: 0,
      sumModules: 0,
      correctAnswersTotal: 0,
      gradedAnswersTotal: 0,
      sumUserAccuracyPercent: 0,
      usersWithGradedAnswers: 0,
    });
  }
  for (const r of enrolledRows) {
    if (!r.companyId) continue;
    const row = map.get(r.companyId);
    if (row) row.students += 1;
  }
  for (const u of byUser) {
    if (!u.companyId) continue;
    const row = map.get(u.companyId);
    if (!row) continue;
    if (u.enrolled) {
      row.enrolledInCourse += 1;
      row.sumModules += u.modulesCompleted;
      row.correctAnswersTotal += u.correctAnswers;
      row.gradedAnswersTotal += u.gradedAnswers;
      if (u.gradedAnswers > 0) {
        row.sumUserAccuracyPercent += (u.correctAnswers / u.gradedAnswers) * 100;
        row.usersWithGradedAnswers += 1;
      }
    }
  }
  return companies.map((c) => {
    const row = map.get(c.id)!;
    const avg = row.enrolledInCourse > 0 ? row.sumModules / row.enrolledInCourse : 0;
    const aggregateAccuracyPercent =
      row.gradedAnswersTotal > 0
        ? Math.round((row.correctAnswersTotal / row.gradedAnswersTotal) * 10000) / 100
        : null;
    const avgUserAccuracyPercent =
      row.usersWithGradedAnswers > 0
        ? Math.round((row.sumUserAccuracyPercent / row.usersWithGradedAnswers) * 100) / 100
        : null;
    return {
      companyId: c.id,
      companyName: c.name,
      students: row.students,
      enrolledInCourse: row.enrolledInCourse,
      avgModulesCompleted: Math.round(avg * 100) / 100,
      moduleTotal: moduleIdsLength,
      gradedAnswersTotal: row.gradedAnswersTotal,
      correctAnswersTotal: row.correctAnswersTotal,
      aggregateAccuracyPercent,
      avgUserAccuracyPercent,
    };
  });
}

function buildSegmentSlice(
  internalRows: InternalEnrolledRow[],
  modules: ModuleContent[],
  moduleIds: string[],
  moduleTitle: Map<string, string>,
  moduleById: Map<string, ModuleContent>,
  questionsByModule: Map<string, QuestionDef[]>,
  keysByModule: Map<string, Record<string, number>>,
  companies: { id: string; name: string }[]
): SegmentAnalyticsSlice {
  const enrolledRows = filterEnrolledRows(internalRows);
  const byUser = internalRows.map((r) => buildUserStat(r, modules, keysByModule));

  const enrolledInCourseCount = enrolledRows.length;
  const completedFullCourseCount = enrolledRows.filter((r) => {
    const v = visibleModuleIdsForRow(modules, r);
    return v.length > 0 && v.every((id) => r.moduleStatuses[id] === 'completed');
  }).length;

  const moduleCompletion = buildModuleCompletion(
    moduleIds,
    moduleTitle,
    moduleById,
    enrolledRows,
  );

  const segmentEnrolledForCompany = byUser.filter((u) => u.enrolled);
  const byCompany = buildByCompany(companies, internalRows, segmentEnrolledForCompany, moduleIds.length);

  const questionDistributions = buildQuestionDistributions(
    questionsByModule,
    moduleById,
    enrolledRows,
  );

  return {
    moduleCompletion,
    byCompany,
    byUser,
    questionDistributions,
    enrolledInCourseCount,
    completedFullCourseCount,
  };
}

const CHUNK = 12;

async function inChunks<T, R>(items: T[], fn: (chunk: T[]) => Promise<R[]>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const part = await fn(chunk);
    results.push(...part);
  }
  return results;
}

export type CourseAnalyticsOptions = {
  companyId?: string;
  /** Restringe empresas e alunos a esta carteira (vendedor). */
  managedCompanyIds?: string[];
};

export type CourseAnalyticsReport = {
  courseId: string;
  courseTitle: string;
  moduleIds: string[];
  moduleTotal: number;
  segments: Record<AnalyticsRoleSegment, SegmentAnalyticsSlice>;
  filteredCompanyId: string | null;
  hasGradableContent: boolean;
};

/** Contexto bruto de matrículas e módulos — reutilizado pelo painel nativo de Saúde Mental. */
export type CourseEnrollmentContext = {
  courseId: string;
  courseTitle: string;
  modules: ModuleContent[];
  moduleIds: string[];
  moduleTitle: Map<string, string>;
  moduleById: Map<string, ModuleContent>;
  questionsByModule: Map<string, QuestionDef[]>;
  keysByModule: Map<string, Record<string, number>>;
  companies: { id: string; name: string }[];
  rows: CourseEnrollmentRow[];
  hasGradableContent: boolean;
  filteredCompanyId: string | null;
};

export async function loadCourseEnrollmentContext(
  courseId: string,
  options?: CourseAnalyticsOptions
): Promise<CourseEnrollmentContext> {
  const filterCompanyId = options?.companyId?.trim() || null;
  const managed = options?.managedCompanyIds?.filter(Boolean) ?? [];

  const [companiesAll, studentsAll, modules] = await Promise.all([
    managed.length > 0
      ? Promise.all(managed.map((id) => getCompany(id))).then((rows) =>
          rows.filter((c): c is NonNullable<typeof c> => c != null)
        )
      : listCompanies(),
    managed.length > 0 ? listStudentsForCompanies(managed) : listStudentsForAdmin(),
    listModules(courseId),
  ]);

  if (managed.length > 0 && filterCompanyId && !managed.includes(filterCompanyId)) {
    throw new Error('Empresa fora da sua carteira.');
  }

  const companies = filterCompanyId
    ? companiesAll.filter((c) => c.id === filterCompanyId)
    : companiesAll;

  const students = filterCompanyId
    ? studentsAll.filter((s) => s.companyId === filterCompanyId)
    : studentsAll;

  const companyName = new Map(companiesAll.map((c) => [c.id, c.name]));
  const moduleIds = modules.map((m) => m.id);
  const moduleTitle = new Map(modules.map((m) => [m.id, m.title]));
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const questionsByModule = collectQuestionsByModule(modules);
  const keysByModule = await fetchAnswerKeysByModule(courseId, moduleIds);
  const hasGradableContent = keysByModule.size > 0;

  const courseSnap = await getDoc(doc(db, 'courses', courseId));
  const courseTitle = courseSnap.exists()
    ? ((courseSnap.data().title as string) ?? courseId)
    : courseId;

  const rows: CourseEnrollmentRow[] = await inChunks(students, async (chunk) =>
    Promise.all(
      chunk.map(async (s) => {
        const enrolled = await isEnrolledInCourse(s.uid, courseId);
        if (!enrolled || moduleIds.length === 0) {
          return {
            uid: s.uid,
            name: s.name,
            email: s.email,
            companyId: s.companyId,
            companyName: s.companyId ? (companyName.get(s.companyId) ?? '—') : '—',
            companyRole: s.companyRoleId,
            companyRoleId: s.companyRoleId,
            companyDepartmentId: s.companyDepartmentId,
            enrolled,
            moduleStatuses: {} as Record<string, 'draft' | 'completed'>,
            answersByModule: {} as Record<string, Record<string, number>>,
          };
        }
        const [enrollSnap, { statuses: moduleStatuses, answers: answersByModule }] = await Promise.all([
          getDoc(doc(db, 'users', s.uid, 'courses', courseId)),
          fetchModuleSubmissions(s.uid, courseId, moduleIds),
        ]);
        let enrolledAt: Date | undefined;
        if (enrollSnap.exists()) {
          const raw = enrollSnap.data().enrolledAt as { toDate?: () => Date } | undefined;
          if (raw && typeof raw.toDate === 'function') enrolledAt = raw.toDate();
        }
        return {
          uid: s.uid,
          name: s.name,
          email: s.email,
          companyId: s.companyId,
          companyName: s.companyId ? (companyName.get(s.companyId) ?? '—') : '—',
          companyRole: s.companyRoleId,
          companyRoleId: s.companyRoleId,
          companyDepartmentId: s.companyDepartmentId,
          enrolled,
          enrolledAt,
          moduleStatuses,
          answersByModule,
        };
      })
    )
  );

  return {
    courseId,
    courseTitle,
    modules,
    moduleIds,
    moduleTitle,
    moduleById,
    questionsByModule,
    keysByModule,
    companies,
    rows,
    hasGradableContent,
    filteredCompanyId: filterCompanyId,
  };
}

export async function buildCourseAnalyticsReport(
  courseId: string,
  options?: CourseAnalyticsOptions
): Promise<CourseAnalyticsReport> {
  const {
    courseTitle,
    moduleIds,
    modules,
    moduleTitle,
    moduleById,
    questionsByModule,
    keysByModule,
    companies,
    rows: internalRows,
    hasGradableContent,
    filteredCompanyId: filterCompanyId,
  } = await loadCourseEnrollmentContext(courseId, options);

  const segments: Record<AnalyticsRoleSegment, SegmentAnalyticsSlice> = {
    combined: buildSegmentSlice(
      internalRows,
      modules,
      moduleIds,
      moduleTitle,
      moduleById,
      questionsByModule,
      keysByModule,
      companies
    ),
  };

  return {
    courseId,
    courseTitle,
    moduleIds,
    moduleTotal: moduleIds.length,
    segments,
    filteredCompanyId: filterCompanyId,
    hasGradableContent,
  };
}
