import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { listEnrolledCourseIds } from '@/lib/firestore/courses';
import { isAssignmentActive } from '@/lib/firestore/assignmentAccess';

/** IDs com liberação ainda válida (não expirada). */
export async function listAllowedCourseIdsForCompany(companyId: string): Promise<string[]> {
  const snap = await getDocs(collection(db, 'companies', companyId, 'allowedCourses'));
  return snap.docs.filter((d) => isAssignmentActive(d.data() as Record<string, unknown>)).map((d) => d.id);
}

export async function isCourseAllowedForCompany(
  companyId: string,
  courseId: string
): Promise<boolean> {
  const snap = await getDoc(doc(db, 'companies', companyId, 'allowedCourses', courseId));
  if (!snap.exists()) return false;
  return isAssignmentActive(snap.data() as Record<string, unknown>);
}

/**
 * Cursos que o aluno pode abrir agora: matrícula ∩ catálogo da empresa (se tiver empresa).
 * Sem empresa: mantém só matrículas (fluxo legado / registro geral).
 */
export async function listVisibleCourseIdsForStudent(
  uid: string,
  companyId: string | null | undefined
): Promise<string[]> {
  const enrolled = await listEnrolledCourseIds(uid);
  if (!companyId) {
    return enrolled;
  }
  const allowed = new Set(await listAllowedCourseIdsForCompany(companyId));
  return enrolled.filter((id) => allowed.has(id));
}
