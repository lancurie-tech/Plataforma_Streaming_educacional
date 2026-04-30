import {
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getCountFromServer,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  AssignmentExpiryRow,
  CompanyCourseAssignment,
  CompanyDoc,
  CourseSummary,
} from '@/types';
import { isAssignmentActive } from '@/lib/firestore/assignmentAccess';

function parseCompanyData(d: { id: string; data: () => Record<string, unknown> | undefined }): CompanyDoc {
  const x = d.data()!;
  const allowedEmailDomains = Array.isArray(x.allowedEmailDomains)
    ? (x.allowedEmailDomains as string[]).filter((s) => typeof s === 'string')
    : undefined;
  return {
    id: d.id,
    name: (x.name as string) ?? '',
    slug: (x.slug as string) ?? '',
    active: x.active !== false,
    roles: Array.isArray(x.roles) ? (x.roles as CompanyDoc['roles']) : undefined,
    departments: Array.isArray(x.departments) ? (x.departments as CompanyDoc['departments']) : undefined,
    allowedEmailDomains: allowedEmailDomains?.length ? allowedEmailDomains : undefined,
    createdAt: (x.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (x.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function listCompanies(): Promise<CompanyDoc[]> {
  const snap = await getDocs(collection(db, 'companies'));
  return snap.docs.map((d) => parseCompanyData(d as unknown as { id: string; data: () => Record<string, unknown> }));
}

export async function setCompanyActive(companyId: string, active: boolean): Promise<void> {
  await setDoc(
    doc(db, 'companies', companyId),
    { active, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function listCoursesCatalog(): Promise<CourseSummary[]> {
  const snap = await getDocs(collection(db, 'courses'));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      title: (x.title as string) ?? d.id,
      description: x.description as string | undefined,
    };
  });
}

/** Todos os cursos com documento em allowedCourses (inclui expirados). */
export async function listAllowedCourseIds(companyId: string): Promise<string[]> {
  const snap = await getDocs(collection(db, 'companies', companyId, 'allowedCourses'));
  return snap.docs.map((d) => d.id);
}

function parseCompanyCourseAssignmentDoc(
  courseId: string,
  x: Record<string, unknown>
): CompanyCourseAssignment {
  const assignedAt = (x.assignedAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? null;
  const expiresAt = (x.expiresAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? null;
  let moduleSchedule: CompanyCourseAssignment['moduleSchedule'];
  if (x.moduleSchedule && typeof x.moduleSchedule === 'object') {
    moduleSchedule = {};
    for (const [mid, raw] of Object.entries(x.moduleSchedule as Record<string, Record<string, unknown>>)) {
      moduleSchedule[mid] = {
        opensAt: (raw?.opensAt as { toDate?: () => Date })?.toDate?.() ?? null,
        closesAt: (raw?.closesAt as { toDate?: () => Date })?.toDate?.() ?? null,
      };
    }
  }
  return {
    courseId,
    assignedAt,
    expiresAt,
    isActive: isAssignmentActive(x),
    moduleSchedule,
  };
}

export async function getCompanyCourseAssignment(
  companyId: string,
  courseId: string
): Promise<CompanyCourseAssignment | null> {
  const snap = await getDoc(doc(db, 'companies', companyId, 'allowedCourses', courseId));
  if (!snap.exists()) return null;
  return parseCompanyCourseAssignmentDoc(courseId, snap.data() as Record<string, unknown>);
}

export async function listCompanyCourseAssignments(
  companyId: string
): Promise<CompanyCourseAssignment[]> {
  const snap = await getDocs(collection(db, 'companies', companyId, 'allowedCourses'));
  return snap.docs.map((d) =>
    parseCompanyCourseAssignmentDoc(d.id, d.data() as Record<string, unknown>)
  );
}

/** Só liberações ainda válidas (para filtros de aluno / métricas por empresa). */
export async function listActiveAllowedCourseIds(companyId: string): Promise<string[]> {
  const rows = await listCompanyCourseAssignments(companyId);
  return rows.filter((r) => r.isActive).map((r) => r.courseId);
}

export type SetCompanyCourseAssignmentMode =
  | { kind: 'unlimited' }
  | { kind: 'durationDays'; days: number }
  | { kind: 'untilDate'; endDate: Date }
  /** Prazo só por módulo: remove data global de expiração (agendamento em moduleSchedule). */
  | { kind: 'perModuleOnly' };

const ENROLL_BATCH_MAX = 400;

/**
 * Garante `users/{uid}/courses/{courseId}` para todos os alunos da empresa.
 * Necessário porque a lista do aluno é matrícula ∩ allowedCourses; só o cadastro criava matrículas antes.
 */
export async function enrollCompanyStudentsInCourse(
  companyId: string,
  courseId: string
): Promise<void> {
  /** Só `companyId` na query evita índice composto; filtramos `student` no cliente. */
  const q = query(collection(db, 'users'), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  const students = snap.docs.filter((d) => (d.data().role as string | undefined) === 'student');
  if (students.length === 0) return;

  let batch = writeBatch(db);
  let n = 0;
  for (const u of students) {
    const ref = doc(db, 'users', u.id, 'courses', courseId);
    batch.set(
      ref,
      {
        enrolledAt: serverTimestamp(),
        viaCompany: true,
      },
      { merge: true }
    );
    n++;
    if (n >= ENROLL_BATCH_MAX) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) {
    await batch.commit();
  }
}

export async function setCompanyCourseAssignment(
  companyId: string,
  courseId: string,
  mode: SetCompanyCourseAssignmentMode
): Promise<void> {
  const ref = doc(db, 'companies', companyId, 'allowedCourses', courseId);
  if (mode.kind === 'perModuleOnly') {
    await setDoc(
      ref,
      {
        assignedAt: serverTimestamp(),
        expiresAt: deleteField(),
      },
      { merge: true }
    );
    await enrollCompanyStudentsInCourse(companyId, courseId);
    return;
  }
  if (mode.kind === 'unlimited') {
    await setDoc(
      ref,
      {
        assignedAt: serverTimestamp(),
        expiresAt: deleteField(),
        moduleSchedule: deleteField(),
      },
      { merge: true }
    );
    await enrollCompanyStudentsInCourse(companyId, courseId);
    return;
  }
  let expiresAt: Date;
  if (mode.kind === 'durationDays') {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + mode.days);
    expiresAt.setHours(23, 59, 59, 999);
  } else {
    expiresAt = new Date(mode.endDate);
    expiresAt.setHours(23, 59, 59, 999);
  }
  await setDoc(
    ref,
    {
      assignedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      moduleSchedule: deleteField(),
    },
    { merge: true }
  );
  await enrollCompanyStudentsInCourse(companyId, courseId);
}

export async function setCompanyModuleSchedule(
  companyId: string,
  courseId: string,
  moduleSchedule: Record<string, { opensAt: Date | null; closesAt: Date | null }>
): Promise<void> {
  const ref = doc(db, 'companies', companyId, 'allowedCourses', courseId);
  const firestoreSchedule: Record<string, Record<string, unknown>> = {};
  for (const [mid, s] of Object.entries(moduleSchedule)) {
    firestoreSchedule[mid] = {
      opensAt: s.opensAt ? Timestamp.fromDate(s.opensAt) : null,
      closesAt: s.closesAt ? Timestamp.fromDate(s.closesAt) : null,
    };
  }
  await setDoc(
    ref,
    {
      moduleSchedule: firestoreSchedule,
      expiresAt: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** @deprecated Prefer setCompanyCourseAssignment com modo explícito. */
export async function addCourseToCompany(companyId: string, courseId: string): Promise<void> {
  await setCompanyCourseAssignment(companyId, courseId, { kind: 'unlimited' });
}

export async function removeCourseFromCompany(companyId: string, courseId: string): Promise<void> {
  await deleteDoc(doc(db, 'companies', companyId, 'allowedCourses', courseId));
}

export async function countStudentsByCompany(companyId: string): Promise<number> {
  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId),
    where('role', '==', 'student')
  );
  const agg = await getCountFromServer(q);
  return agg.data().count;
}

export async function countStudentsTotal(): Promise<number> {
  const q = query(collection(db, 'users'), where('role', '==', 'student'));
  const agg = await getCountFromServer(q);
  return agg.data().count;
}

export async function countCompanies(): Promise<number> {
  const agg = await getCountFromServer(collection(db, 'companies'));
  return agg.data().count;
}

export async function getCompany(companyId: string): Promise<CompanyDoc | null> {
  const snap = await getDoc(doc(db, 'companies', companyId));
  if (!snap.exists()) return null;
  return parseCompanyData(snap as unknown as { id: string; data: () => Record<string, unknown> });
}

/** Chave v2 (nível × área) como gravada no arquivo. */
export type ArchiveAccessKeyV2 = {
  id: string;
  roleId: string;
  roleLabel: string;
  departmentId: string;
  departmentLabel: string;
  plainKey: string;
};

/** Chaves de cadastro arquivadas (subcoleção só legível por admin nas regras). */
export type CompanyRegistrationArchive = {
  registrationPath: string;
  accessKeys?: ArchiveAccessKeyV2[];
  savedAt: Date | null;
};

const COMPANY_REGISTRATION_ARCHIVE_ID = 'archive';

export async function getCompanyRegistrationArchive(
  companyId: string
): Promise<CompanyRegistrationArchive | null> {
  const snap = await getDoc(
    doc(db, 'companies', companyId, 'adminRegistrationKeys', COMPANY_REGISTRATION_ARCHIVE_ID)
  );
  if (!snap.exists()) return null;
  const x = snap.data();
  const registrationPath = typeof x.registrationPath === 'string' ? x.registrationPath : '';
  if (!registrationPath) return null;
  return {
    registrationPath,
    accessKeys: Array.isArray(x.accessKeys) ? (x.accessKeys as ArchiveAccessKeyV2[]) : undefined,
    savedAt: x.savedAt?.toDate?.() ?? null,
  };
}


/** Empresas que têm o curso `courseId` em `allowedCourses` (collection group). */
export async function listCompanyIdsWithCourse(courseId: string): Promise<string[]> {
  const snap = await getDocs(collectionGroup(db, 'allowedCourses'));
  return snap.docs.filter((d) => d.id === courseId).map((d) => d.ref.parent.parent!.id);
}

/** Liberações com data de término (para métricas de prazo). Ignora ilimitadas. */
export async function listAssignmentExpiryRows(): Promise<AssignmentExpiryRow[]> {
  const [companies, catalog] = await Promise.all([listCompanies(), listCoursesCatalog()]);
  const titleById = new Map(catalog.map((c) => [c.id, c.title]));
  const out: AssignmentExpiryRow[] = [];
  const now = Date.now();
  for (const co of companies) {
    const snap = await getDocs(collection(db, 'companies', co.id, 'allowedCourses'));
    for (const d of snap.docs) {
      const x = d.data() as Record<string, unknown>;
      const ts = x.expiresAt as { toDate?: () => Date } | undefined;
      const exp = ts?.toDate?.();
      if (!exp) continue;
      const ms = exp.getTime() - now;
      out.push({
        companyId: co.id,
        companyName: co.name,
        courseId: d.id,
        courseTitle: titleById.get(d.id) ?? d.id,
        expiresAt: exp,
        daysRemaining: Math.ceil(ms / 86_400_000),
        isExpired: ms <= 0,
      });
    }
  }
  out.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  return out;
}
