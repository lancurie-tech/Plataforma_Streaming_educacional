import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export async function isCompanyActive(companyId: string): Promise<boolean | null> {
  const snap = await getDoc(doc(db, 'companies', companyId));
  if (!snap.exists()) return null;
  return snap.data().active !== false;
}
