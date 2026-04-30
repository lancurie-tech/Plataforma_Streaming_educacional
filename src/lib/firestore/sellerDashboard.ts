import {
  countStudentsByCompany,
  getCompany,
  getCompanyRegistrationArchive,
  listCompanyCourseAssignments,
  type CompanyRegistrationArchive,
} from '@/lib/firestore/admin';
import type { CompanyCourseAssignment, CompanyDoc } from '@/types';

export type ManagedCompanyOverview = {
  company: CompanyDoc;
  /** Alunos com role `student` nesta empresa. */
  studentCount: number;
  assignments: CompanyCourseAssignment[];
  /** Chaves de cadastro arquivadas (só empresas criadas após o arquivo existir + regras/deploy). */
  registrationArchive: CompanyRegistrationArchive | null;
};

/**
 * Carrega dados das empresas da carteira do vendedor (leitura documento a documento — compatível com as regras do Firestore).
 */
export async function fetchManagedCompaniesOverview(
  managedCompanyIds: string[]
): Promise<ManagedCompanyOverview[]> {
  if (!managedCompanyIds.length) return [];

  const rows: ManagedCompanyOverview[] = [];
  for (const id of managedCompanyIds) {
    const company = await getCompany(id);
    if (!company) continue;
    const [studentCount, assignments, registrationArchive] = await Promise.all([
      countStudentsByCompany(id),
      listCompanyCourseAssignments(id),
      getCompanyRegistrationArchive(id),
    ]);
    rows.push({ company, studentCount, assignments, registrationArchive });
  }
  return rows.sort((a, b) => a.company.name.localeCompare(b.company.name));
}
