import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_BRAND,
  addPdfPageFooters,
  drawPdfCoverHeader,
  drawPdfSectionTitle,
  ensurePdfVerticalSpace,
  loadMedivoxLogoPngDataUrl,
  pdfStandardTableProps,
} from '@/lib/pdf/pdfBrandLayout';

type ModuleBar = { modulo: string; concluidos: number; matriculados: number };
type UserRow = { name?: string; email: string; enrolled: boolean; modulesCompleted: number; moduleTotal: number };

const tbl = () => pdfStandardTableProps();

export async function downloadVendorMetricsPdf({
  vendorName,
  courseTitle,
  companyName,
  enrolledTotal,
  completedAll,
  moduleTotal,
  moduleBars,
  byUser,
  logoDataUrl: logoInput,
}: {
  vendorName: string;
  courseTitle: string;
  companyName?: string;
  enrolledTotal: number;
  completedAll: number;
  moduleTotal: number;
  moduleBars: ModuleBar[];
  byUser: UserRow[];
  logoDataUrl?: string | null;
}): Promise<void> {
  const logo = logoInput ?? (await loadMedivoxLogoPngDataUrl());
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = PDF_BRAND.margin;
  const continuation = `${courseTitle.slice(0, 40)} · Métricas`;

  const metaLine = `Emitido em ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })} · Representante: ${vendorName}`;
  const state = {
    y: drawPdfCoverHeader({
      doc,
      pageW,
      logoDataUrl: logo,
      documentLabel: 'Relatório de métricas',
      mainTitle: 'Indicadores do curso',
      subtitle: courseTitle,
      metaLine: companyName ? `${metaLine} · Empresa: ${companyName}` : metaLine,
    }),
  };

  ensurePdfVerticalSpace(doc, pageW, pageH, state, 28, continuation);
  drawPdfSectionTitle(doc, pageW, margin, state, 'Resumo');
  doc.setFontSize(PDF_BRAND.bodyFs);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_BRAND.inkSoft);
  doc.text(`Módulos no curso: ${moduleTotal}`, margin, state.y);
  state.y += 6;
  doc.text(`Matriculados: ${enrolledTotal}`, margin, state.y);
  state.y += 6;
  doc.text(`Concluíram o curso completo: ${completedAll}`, margin, state.y);
  state.y += 10;

  if (moduleBars.length > 0) {
    ensurePdfVerticalSpace(doc, pageW, pageH, state, 40, continuation);
    drawPdfSectionTitle(doc, pageW, margin, state, 'Conclusão por módulo');
    autoTable(doc, {
      startY: state.y,
      ...tbl(),
      head: [['Módulo', 'Matriculados', 'Concluídos', '% conclusão']],
      body: moduleBars.map((m) => [
        m.modulo,
        String(m.matriculados),
        String(m.concluidos),
        m.matriculados > 0 ? `${Math.round((m.concluidos / m.matriculados) * 100)}%` : '—',
      ]),
    });
    state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  const enrolled = byUser.filter((u) => u.enrolled);
  if (enrolled.length > 0) {
    ensurePdfVerticalSpace(doc, pageW, pageH, state, 36, continuation);
    drawPdfSectionTitle(doc, pageW, margin, state, 'Alunos matriculados');
    autoTable(doc, {
      startY: state.y,
      ...tbl(),
      head: [['Aluno', 'Módulos concluídos', 'Progresso']],
      body: enrolled.map((u) => [
        u.name || u.email,
        `${u.modulesCompleted} / ${u.moduleTotal}`,
        u.moduleTotal > 0 ? `${Math.round((u.modulesCompleted / u.moduleTotal) * 100)}%` : '—',
      ]),
    });
  }

  addPdfPageFooters(doc, pageW, pageH, margin, (i, t) =>
    `Medivox — relatório de métricas — confidencial — página ${i} de ${t}`,
  );

  const slug = courseTitle
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);
  doc.save(`medivox-metricas-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
