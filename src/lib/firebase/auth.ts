import {
  EmailAuthProvider,
  confirmPasswordReset,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  verifyPasswordResetCode,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { parseStudentDemographics } from '@/lib/studentDemographics';
import type {
  UserProfile,
  UserRole,
  StudentLegalAcceptance,
  VendorConfidentialityAcceptance,
} from '@/types';

export async function loginUser(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

/** URL para onde o Firebase redireciona após concluir a ação no handler padrão (deve estar em Domínios autorizados). */
function passwordResetContinueUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/login`;
}

export async function resetPassword(email: string): Promise<void> {
  const url = passwordResetContinueUrl();
  await sendPasswordResetEmail(
    auth,
    email,
    url
      ? {
          url,
          handleCodeInApp: false,
        }
      : undefined
  );
}

/** Valida o código do e-mail e devolve o e-mail da conta (Firebase). */
export async function verifyPasswordResetOob(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode);
}

export async function applyPasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPassword);
}

/** Exige sessão recente: reautentica com a senha atual e aplica a nova. */
/** Após login recente (ex.: primeira troca de senha do vendedor). */
export async function updatePasswordForCurrentSession(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Nenhum usuário logado.');
  }
  await updatePassword(user, newPassword);
}

export async function changePasswordWithCurrent(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  const email = user?.email;
  if (!user || !email) {
    throw new Error('Nenhum usuário logado.');
  }
  const credential = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  const role = (d.role as UserRole | undefined) ?? 'student';
  const managedRaw = d.managedCompanyIds;
  const managedCompanyIds =
    role === 'vendedor'
      ? Array.isArray(managedRaw)
        ? managedRaw.filter((x): x is string => typeof x === 'string')
        : []
      : undefined;

  const legalRaw = d.legalAcceptanceStudent as Record<string, unknown> | undefined;
  let legalAcceptanceStudent: StudentLegalAcceptance | undefined;
  if (legalRaw && typeof legalRaw === 'object') {
    const tv = legalRaw.termsVersion;
    const pv = legalRaw.privacyVersion;
    const cv = legalRaw.commitmentsVersion;
    const at = legalRaw.acceptedAt as { toDate?: () => Date } | undefined;
    if (
      typeof tv === 'string' &&
      typeof pv === 'string' &&
      typeof cv === 'string' &&
      at &&
      typeof at.toDate === 'function'
    ) {
      legalAcceptanceStudent = {
        termsVersion: tv,
        privacyVersion: pv,
        commitmentsVersion: cv,
        acceptedAt: at.toDate(),
      };
    }
  }

  const vcRaw = d.vendorConfidentiality as Record<string, unknown> | undefined;
  let vendorConfidentiality: VendorConfidentialityAcceptance | undefined;
  if (vcRaw && typeof vcRaw === 'object') {
    const ver = vcRaw.version;
    const vat = vcRaw.acceptedAt as { toDate?: () => Date } | undefined;
    if (typeof ver === 'string' && vat && typeof vat.toDate === 'function') {
      vendorConfidentiality = { version: ver, acceptedAt: vat.toDate() };
    }
  }

  const demographics = parseStudentDemographics(d.demographics);

  return {
    id: snap.id,
    name: d.name as string,
    email: d.email as string,
    role,
    tenantId: typeof d.tenantId === 'string' ? d.tenantId : null,
    cpf: d.cpf as string | undefined,
    companyId: (d.companyId as string | null | undefined) ?? null,
    companySlug: (d.companySlug as string | null | undefined) ?? null,
    companyRoleId: typeof d.companyRoleId === 'string' ? d.companyRoleId : null,
    companyDepartmentId: typeof d.companyDepartmentId === 'string' ? d.companyDepartmentId : null,
    ...(demographics ? { demographics } : {}),
    mustChangePassword: role === 'vendedor' ? d.mustChangePassword === true : undefined,
    ...(role === 'vendedor' ? { managedCompanyIds } : {}),
    ...(legalAcceptanceStudent ? { legalAcceptanceStudent } : {}),
    ...(vendorConfidentiality ? { vendorConfidentiality } : {}),
    createdAt: d.createdAt?.toDate?.() ?? new Date(),
    updatedAt: d.updatedAt?.toDate?.() ?? new Date(),
  };
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
