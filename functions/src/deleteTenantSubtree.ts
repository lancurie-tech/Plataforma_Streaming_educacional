import type {
  CollectionReference,
  DocumentReference,
  Firestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { FieldPath } from 'firebase-admin/firestore';

/** Remove todas as subcoleções e o documento `tenants/{tenantId}` (Admin SDK). */
export async function deleteTenantDocumentTree(db: Firestore, tenantId: string): Promise<void> {
  const ref = db.collection('tenants').doc(tenantId);
  const snap = await ref.get();
  if (!snap.exists) return;
  await deleteDocRecursive(ref);
}

async function deleteCollectionDocsRecursive(col: CollectionReference): Promise<void> {
  let last: QueryDocumentSnapshot | undefined;
  const page = 200;
  while (true) {
    let q = col.orderBy(FieldPath.documentId()).limit(page);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      await deleteDocRecursive(d.ref);
    }
    if (snap.size < page) break;
    last = snap.docs[snap.docs.length - 1];
  }
}

async function deleteDocRecursive(ref: DocumentReference): Promise<void> {
  const cols = await ref.listCollections();
  for (const col of cols) {
    await deleteCollectionDocsRecursive(col);
  }
  await ref.delete();
}
