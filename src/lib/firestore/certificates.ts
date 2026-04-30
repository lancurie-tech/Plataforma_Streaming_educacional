import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { moduleAppliesToCompanyRole } from '@/lib/courseVisibility';
import { getCourse, getUserModuleSubmission, listModules } from '@/lib/firestore/courses';
import type { UserProfile } from '@/types';

export type UserCertificate = {
  courseId: string;
  courseTitle: string;
  studentName: string;
  issuedAt: Date;
  verificationCode: string;
};

/** Texto exibido no certificado abaixo do nome do curso. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatCertificateAudienceLine(_audience?: unknown): string | null {
  return null;
}

function randomVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return s;
}

function parseCert(courseId: string, data: Record<string, unknown>): UserCertificate {
  const issued = data.issuedAt as Timestamp | undefined;
  return {
    courseId,
    courseTitle: (data.courseTitle as string) ?? courseId,
    studentName: (data.studentName as string) ?? '',
    issuedAt: issued?.toDate?.() ?? new Date(),
    verificationCode: (data.verificationCode as string) ?? '—',
  };
}

export async function listUserCertificates(uid: string): Promise<UserCertificate[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'certificates'));
  const list = snap.docs.map((d) => parseCert(d.id, d.data() as Record<string, unknown>));
  list.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
  return list;
}

export async function getUserCertificate(
  uid: string,
  courseId: string
): Promise<UserCertificate | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'certificates', courseId));
  if (!snap.exists()) return null;
  return parseCert(courseId, snap.data() as Record<string, unknown>);
}

/**
 * Se todos os módulos **visíveis para o aluno** estiverem concluídos e ainda não houver certificado,
 * grava um documento em `users/{uid}/certificates/{courseId}`.
 */
export async function issueCertificateIfEligible(
  uid: string,
  courseId: string,
  studentName: string,
  viewerProfile: Pick<UserProfile, 'role'> | null | undefined
): Promise<void> {
  const certRef = doc(db, 'users', uid, 'certificates', courseId);
  const existing = await getDoc(certRef);
  if (existing.exists()) return;

  if (viewerProfile?.role === 'admin') return;

  const modules = await listModules(courseId);
  if (modules.length === 0) return;

  const role = null;
  const visible = modules.filter((m) => moduleAppliesToCompanyRole(m, role));
  if (visible.length === 0) return;

  for (const m of visible) {
    const sub = await getUserModuleSubmission(uid, courseId, m.id);
    if (sub?.status !== 'completed') return;
  }

  const course = await getCourse(courseId);
  if (!course) return;

  const certificateAudience =
    role === 'gestor' || role === 'colaborador' ? role : null;

  await setDoc(certRef, {
    courseId,
    courseTitle: course.title,
    studentName: studentName.trim() || 'Aluno',
    issuedAt: serverTimestamp(),
    verificationCode: randomVerificationCode(),
    ...(certificateAudience ? { certificateAudience } : {}),
  });
}
