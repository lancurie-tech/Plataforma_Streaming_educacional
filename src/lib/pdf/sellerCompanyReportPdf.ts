import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AssignmentExpiryRow } from '@/types';
import type { ManagedCompanyOverview } from '@/lib/firestore/sellerDashboard';
import type { SellerCompanyCourseMetricsPdf } from '@/lib/pdf/sellerCompanyMetricsPdf';
import type { SaudeMentalCompanyPdfSnapshot } from '@/lib/pdf/buildSaudeMentalCompanyPdfSnapshot';
import type { SaudeMentalPdfChartImages } from '@/lib/pdf/saudeMentalChartCapture';
import {
  PDF_BRAND,
  addPdfPageFooters,
  drawPdfCoverHeader,
  drawPdfSectionTitle,
  ensurePdfVerticalSpace,
  loadMedivoxLogoPngDataUrl,
  pdfStandardTableProps,
} from '@/lib/pdf/pdfBrandLayout';

export type SellerPdfSectionFlags = {
  includeEnrollment: boolean;
  includeSaudeMental: boolean;
};

export type SellerCompanyPdfDownloadInput = {
  overview: ManagedCompanyOverview;
  vendorName: string;
  expiryRows: AssignmentExpiryRow[];
  courseNames?: Record<string, string>;
  flags: SellerPdfSectionFlags;
  enrollmentMetrics?: SellerCompanyCourseMetricsPdf | null;
  enrollmentError?: string;
  saudeMentalSnapshot?: SaudeMentalCompanyPdfSnapshot | null;
  saudeMentalError?: string;
  chartImages?: SaudeMentalPdfChartImages;
  /** Opcional: evita segundo fetch se já carregado. */
  logoDataUrl?: string | null;
};

export type SellerPortfolioCompanyPdfPayload = {
  enrollmentMetrics?: SellerCompanyCourseMetricsPdf | null;
  enrollmentError?: string;
  saudeMentalSnapshot?: SaudeMentalCompanyPdfSnapshot | null;
  saudeMentalError?: string;
};

export type SellerPortfolioPdfDownloadInput = {
  overviews: ManagedCompanyOverview[];
  vendorName: string;
  expiryRows: AssignmentExpiryRow[];
  courseNames?: Record<string, string>;
  flags: SellerPdfSectionFlags;
  byCompany: Record<string, SellerPortfolioCompanyPdfPayload>;
  logoDataUrl?: string | null;
};

function slugifyFilename(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48) || 'empresa';
}

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n}%`;
}

const tbl = () => pdfStandardTableProps();

function renderCourseMetricsBlock(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  margin: number,
  continuation: string,
  state: { y: number },
  studentCountPlatform: number,
  metrics: SellerCompanyCourseMetricsPdf,
): void {
  ensurePdfVerticalSpace(doc, pageW, pageH, state, 52, continuation);
  drawPdfSectionTitle(doc, pageW, margin, state, 'Métricas do curso (plataforma)');
  doc.setFontSize(PDF_BRAND.bodyFs);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_BRAND.inkSoft);
  const intro = `Curso: ${metrics.courseTitle}`;
  doc.text(intro, margin, state.y);
  state.y += 6;
  const line2 = `Alunos com perfil nesta empresa: ${studentCountPlatform} · Matriculados neste curso: ${metrics.enrolledInCourseCount} · Concluíram o curso completo: ${metrics.completedFullCourseCount}`;
  const lines2 = doc.splitTextToSize(line2, pageW - margin * 2);
  ensurePdfVerticalSpace(doc, pageW, pageH, state, lines2.length * 5.6 + 4, continuation);
  doc.text(lines2, margin, state.y);
  state.y += lines2.length * 5.6 + 4;

  if (metrics.hasGradableContent) {
    const agg = fmtPct(metrics.aggregateAccuracyPercent);
    const avgU = fmtPct(metrics.avgUserAccuracyPercent);
    const avgMod = metrics.avgModulesCompleted != null ? String(metrics.avgModulesCompleted) : '—';
    const perf = `Desempenho em quiz: acerto agregado ${agg} · média da taxa de acerto por aluno ${avgU} · média de módulos concluídos (matriculados): ${avgMod} · respostas avaliadas: ${metrics.gradedAnswersTotal}`;
    const pl = doc.splitTextToSize(perf, pageW - margin * 2);
    ensurePdfVerticalSpace(doc, pageW, pageH, state, pl.length * 5.6 + 4, continuation);
    doc.setFontSize(PDF_BRAND.smallFs + 0.5);
    doc.text(pl, margin, state.y);
    state.y += pl.length * 5.6 + 4;
  } else {
    ensurePdfVerticalSpace(doc, pageW, pageH, state, 12, continuation);
    doc.setFontSize(PDF_BRAND.smallFs + 0.5);
    doc.setTextColor(...PDF_BRAND.muted);
    doc.text(
      'Este curso não possui chaves de resposta configuradas; métricas de acerto em quiz não se aplicam.',
      margin,
      state.y,
      { maxWidth: pageW - margin * 2 },
    );
    state.y += 10;
  }
  doc.setTextColor(...PDF_BRAND.inkSoft);

  if (metrics.moduleRows.length > 0) {
    ensurePdfVerticalSpace(doc, pageW, pageH, state, 36, continuation);
    autoTable(doc, {
      startY: state.y,
      ...tbl(),
      head: [['Módulo', 'Elegíveis', 'Concluídos', '% conclusão']],
      body: metrics.moduleRows.map((m) => [
        m.title,
        String(m.enrolled),
        String(m.completed),
        m.pct != null ? `${m.pct}%` : '—',
      ]),
    });
    state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Intencionalmente omitido no relatório de vendedor:
  // tabela com identificação nominal de alunos matriculados.
}

function addChartImage(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  margin: number,
  continuation: string,
  state: { y: number },
  title: string,
  dataUrl: string | undefined,
): void {
  if (!dataUrl) return;
  ensurePdfVerticalSpace(doc, pageW, pageH, state, 28, continuation);
  doc.setFontSize(PDF_BRAND.sectionFs - 1);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_BRAND.ink);
  doc.text(title, margin, state.y);
  state.y += 7;
  const props = doc.getImageProperties(dataUrl);
  const maxW = pageW - 2 * margin;
  const w = maxW * 0.9;
  const h = (props.height * w) / props.width;
  ensurePdfVerticalSpace(doc, pageW, pageH, state, h + 6, continuation);
  const x = margin + (maxW - w) / 2;
  doc.addImage(dataUrl, 'PNG', x, state.y, w, h);
  state.y += h + 10;
}

function renderSaudeMentalPdfSection(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  margin: number,
  continuation: string,
  state: { y: number },
  sm: SaudeMentalCompanyPdfSnapshot,
  chartImages: SaudeMentalPdfChartImages | undefined,
): void {
  ensurePdfVerticalSpace(doc, pageW, pageH, state, 40, continuation);
  drawPdfSectionTitle(doc, pageW, margin, state, 'Saúde Mental — engajamento e autopercepção (T0–T2)');

  doc.setFontSize(PDF_BRAND.bodyFs);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_BRAND.inkSoft);
  doc.text(`Curso: ${sm.courseTitle}`, margin, state.y);
  state.y += 6;
  const rec = doc.splitTextToSize(sm.recorteDescription, pageW - margin * 2);
  ensurePdfVerticalSpace(doc, pageW, pageH, state, rec.length * 5.6 + 4, continuation);
  doc.text(rec, margin, state.y);
  state.y += rec.length * 5.6 + 6;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_BRAND.ink);
  doc.text(`Sinalizador (geral T0+T1+T2): ${sm.headlineT2.title}`, margin, state.y);
  state.y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BRAND.smallFs + 0.5);
  doc.setTextColor(...PDF_BRAND.muted);
  const expl = doc.splitTextToSize(sm.headlineT2.explanation, pageW - margin * 2);
  ensurePdfVerticalSpace(doc, pageW, pageH, state, expl.length * 5.2 + 4, continuation);
  doc.text(expl, margin, state.y);
  state.y += expl.length * 5.2 + 8;
  doc.setTextColor(...PDF_BRAND.inkSoft);
  doc.setFontSize(PDF_BRAND.bodyFs);

  ensurePdfVerticalSpace(doc, pageW, pageH, state, 32, continuation);
  autoTable(doc, {
    startY: state.y,
    ...tbl(),
    head: [['Etapa do funil', 'Quantidade', '% sobre elegíveis']],
    body: sm.funnel.map((f) => [f.label, String(f.count), `${Math.round(f.rateFromEligible * 10) / 10}%`]),
  });
  state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  drawPdfSectionTitle(doc, pageW, margin, state, 'Indicadores de jornada (recorte)');
  const m = sm.courseMetrics;
  const j = `Elegíveis: ${m.eligibleCount} · Inscritos: ${m.enrolledCount} · Iniciaram: ${m.startedCount} · Concluíram curso: ${m.completedCount} · Adesão: ${m.adherenceRate.toFixed(1)}% · Conclusão (sobre inscritos): ${m.completionRate.toFixed(1)}%`;
  const jl = doc.splitTextToSize(j, pageW - margin * 2);
  ensurePdfVerticalSpace(doc, pageW, pageH, state, jl.length * 5.6 + 4, continuation);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BRAND.bodyFs);
  doc.setTextColor(...PDF_BRAND.inkSoft);
  doc.text(jl, margin, state.y);
  state.y += jl.length * 5.6 + 4;
  const inst = `Instrumentos concluídos (sobre inscritos): ${sm.instrumentTitles.T0} — ${sm.instrumentRates.T0}% · ${sm.instrumentTitles.T1} — ${sm.instrumentRates.T1}% · ${sm.instrumentTitles.T2} — ${sm.instrumentRates.T2}%`;
  const il = doc.splitTextToSize(inst, pageW - margin * 2);
  ensurePdfVerticalSpace(doc, pageW, pageH, state, il.length * 5.6 + 4, continuation);
  doc.text(il, margin, state.y);
  state.y += il.length * 5.6 + 6;

  if (sm.modulePerformance.length > 0) {
    ensurePdfVerticalSpace(doc, pageW, pageH, state, 36, continuation);
    autoTable(doc, {
      startY: state.y,
      ...tbl(),
      head: [['Módulo (jornada)', 'Elegíveis', 'Concluídos', '%']],
      body: sm.modulePerformance.map((row) => [
        row.moduleName,
        String(row.applicable),
        String(row.completed),
        `${Math.round(row.completionRate * 10) / 10}%`,
      ]),
    });
    state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  if (sm.tracks.length > 0) {
    ensurePdfVerticalSpace(doc, pageW, pageH, state, 32, continuation);
    autoTable(doc, {
      startY: state.y,
      ...tbl(),
      head: [['Trilha', 'Participantes', '% conclusão']],
      body: sm.tracks.map((t) => [t.label, String(t.participants), `${Math.round(t.completionRate * 10) / 10}%`]),
    });
    state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  ensurePdfVerticalSpace(doc, pageW, pageH, state, 28, continuation);
  autoTable(doc, {
    startY: state.y,
    ...tbl(),
    head: [['Momento', 'Respostas válidas', 'Score médio (0–100)']],
    body: sm.surveyByTempo.map((r) => [r.label, String(r.responses), String(r.avgScore100)]),
  });
  state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  if (sm.dimensionsT2vsT0.length > 0) {
    ensurePdfVerticalSpace(doc, pageW, pageH, state, 36, continuation);
    autoTable(doc, {
      startY: state.y,
      ...tbl(),
      head: [['Dimensão', 'Score geral (0–100)', 'Δ vs T0', '% alerta', 'Prioridade']],
      body: sm.dimensionsT2vsT0.map((d) => [
        d.dimension,
        String(d.score100),
        String(d.delta),
        `${d.negativePercent}%`,
        d.priority,
      ]),
    });
    state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  if (sm.groupByTrilha.length > 0) {
    ensurePdfVerticalSpace(doc, pageW, pageH, state, 32, continuation);
    autoTable(doc, {
      startY: state.y,
      ...tbl(),
      head: [['Trilha (T2)', 'Score médio', 'N', '% alerta q5/q6']],
      body: sm.groupByTrilha.map((g) => [g.label, String(g.score), String(g.count), `${g.alertPercent}%`]),
    });
    state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  if (chartImages && (chartImages.funnel || chartImages.evolution || chartImages.radarGeral)) {
    addChartImage(doc, pageW, pageH, margin, continuation, state, 'Funil (geral)', chartImages.funnel);
    addChartImage(doc, pageW, pageH, margin, continuation, state, 'Evolução do score por momento (geral)', chartImages.evolution);
    addChartImage(doc, pageW, pageH, margin, continuation, state, 'Radar geral das dimensões (T0, T1, T2)', chartImages.radarGeral);
  }

  if (sm.perTempo.length > 0) {
    for (const pt of sm.perTempo) {
      drawPdfSectionTitle(doc, pageW, margin, state, `${pt.label} — métricas e comparativos`);
      const rowInfo = `Respostas válidas: ${pt.responses} · Score médio: ${pt.avgScore100}`;
      const rowLines = doc.splitTextToSize(rowInfo, pageW - margin * 2);
      ensurePdfVerticalSpace(doc, pageW, pageH, state, rowLines.length * 5.6 + 4, continuation);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(PDF_BRAND.bodyFs);
      doc.setTextColor(...PDF_BRAND.inkSoft);
      doc.text(rowLines, margin, state.y);
      state.y += rowLines.length * 5.6 + 4;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_BRAND.ink);
      doc.text(`Sinalizador (${pt.label}): ${pt.headline.title}`, margin, state.y);
      state.y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(PDF_BRAND.smallFs + 0.5);
      doc.setTextColor(...PDF_BRAND.muted);
      const e = doc.splitTextToSize(pt.headline.explanation, pageW - margin * 2);
      ensurePdfVerticalSpace(doc, pageW, pageH, state, e.length * 5.2 + 4, continuation);
      doc.text(e, margin, state.y);
      state.y += e.length * 5.2 + 5;
      doc.setFontSize(PDF_BRAND.bodyFs);
      doc.setTextColor(...PDF_BRAND.inkSoft);

      if (pt.dimensionsVsT0.length > 0) {
        ensurePdfVerticalSpace(doc, pageW, pageH, state, 32, continuation);
        autoTable(doc, {
          startY: state.y,
          ...tbl(),
          head: [['Dimensão', 'Score (0–100)', 'Δ vs T0', '% alerta', 'Prioridade']],
          body: pt.dimensionsVsT0.map((d) => [
            d.dimension,
            String(d.score100),
            String(d.delta),
            `${d.negativePercent}%`,
            d.priority,
          ]),
        });
        state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
      }

      if (pt.groupByTrilha.length > 0) {
        ensurePdfVerticalSpace(doc, pageW, pageH, state, 28, continuation);
        autoTable(doc, {
          startY: state.y,
          ...tbl(),
          head: [[`Trilha (${pt.label})`, 'Score médio', 'N', '% alerta q5/q6']],
          body: pt.groupByTrilha.map((g) => [g.label, String(g.score), String(g.count), `${g.alertPercent}%`]),
        });
        state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
      }

      if (chartImages) {
        const chartByTempo =
          pt.tempo === 'T0'
            ? chartImages.radarT0
            : pt.tempo === 'T1'
              ? chartImages.radarT1
              : chartImages.radarT2;
        addChartImage(doc, pageW, pageH, margin, continuation, state, `Radar das dimensões (${pt.label})`, chartByTempo);
      }
    }
  }
}

type CompanyPageExtras = {
  courseNames?: Record<string, string>;
  flags: SellerPdfSectionFlags;
  enrollmentMetrics?: SellerCompanyCourseMetricsPdf | null;
  enrollmentError?: string;
  saudeMentalSnapshot?: SaudeMentalCompanyPdfSnapshot | null;
  saudeMentalError?: string;
  chartImages?: SaudeMentalPdfChartImages;
};

function renderCompanyPage(
  doc: jsPDF,
  overview: ManagedCompanyOverview,
  vendorName: string,
  expiryRows: AssignmentExpiryRow[],
  generatedAt: Date,
  extras: CompanyPageExtras,
  logoDataUrl: string | null,
): void {
  const { company, studentCount, assignments } = overview;
  const { courseNames, flags, enrollmentMetrics, enrollmentError, saudeMentalSnapshot, saudeMentalError, chartImages } =
    extras;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = PDF_BRAND.margin;
  const continuation = `${company.name} · Relatório`;

  const metaLine = `Emitido em ${generatedAt.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })} · Representante: ${vendorName}`;
  const state = {
    y: drawPdfCoverHeader({
      doc,
      pageW,
      logoDataUrl,
      documentLabel: 'Relatório para empresa',
      mainTitle: 'Resumo e indicadores',
      subtitle: company.name,
      metaLine,
    }),
  };

  ensurePdfVerticalSpace(doc, pageW, pageH, state, 30, continuation);
  drawPdfSectionTitle(doc, pageW, margin, state, 'Identificação');
  doc.setFontSize(PDF_BRAND.bodyFs);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_BRAND.inkSoft);
  doc.text(`Slug (URL): ${company.slug}`, margin, state.y);
  state.y += 6;
  doc.text(`Status: ${company.active ? 'Ativa' : 'Inativa'}`, margin, state.y);
  state.y += 6;
  doc.text(`Colaboradores cadastrados (alunos): ${studentCount}`, margin, state.y);
  state.y += 10;

  ensurePdfVerticalSpace(doc, pageW, pageH, state, 40, continuation);
  drawPdfSectionTitle(doc, pageW, margin, state, 'Cursos liberados');
  const courseRows = assignments.map((a) => [
    courseNames?.[a.courseId] ?? a.courseId,
    fmtDate(a.assignedAt),
    a.expiresAt ? fmtDate(a.expiresAt) : 'Sem prazo',
    a.isActive ? 'Sim' : 'Não',
  ]);
  autoTable(doc, {
    startY: state.y,
    ...tbl(),
    head: [['Curso', 'Liberação', 'Expira', 'Ativo']],
    body: courseRows.length ? courseRows : [['—', '—', '—', 'Nenhuma liberação']],
  });
  state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  ensurePdfVerticalSpace(doc, pageW, pageH, state, 36, continuation);
  drawPdfSectionTitle(doc, pageW, margin, state, 'Prazos de liberação (resumo)');
  const exp = expiryRows.filter((r) => r.companyId === company.id);
  const expBody =
    exp.length > 0
      ? exp.map((r) => [
          r.courseTitle,
          fmtDate(r.expiresAt),
          r.isExpired ? 'Encerrado' : `${r.daysRemaining} dias`,
        ])
      : [['—', '—', 'Nenhuma com prazo definido']];
  autoTable(doc, {
    startY: state.y,
    ...tbl(),
    head: [['Curso', 'Expira em', 'Prazo']],
    body: expBody,
  });
  state.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (flags.includeEnrollment) {
    if (enrollmentError) {
      ensurePdfVerticalSpace(doc, pageW, pageH, state, 16, continuation);
      doc.setFontSize(PDF_BRAND.bodyFs);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_BRAND.warn);
      doc.text(`Métricas do curso selecionado: ${enrollmentError}`, margin, state.y, { maxWidth: pageW - margin * 2 });
      state.y += 12;
    } else if (enrollmentMetrics) {
      renderCourseMetricsBlock(
        doc,
        pageW,
        pageH,
        margin,
        continuation,
        state,
        studentCount,
        enrollmentMetrics,
      );
    }
  }

  if (flags.includeSaudeMental) {
    if (saudeMentalError) {
      ensurePdfVerticalSpace(doc, pageW, pageH, state, 16, continuation);
      doc.setFontSize(PDF_BRAND.bodyFs);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_BRAND.warn);
      doc.text(`Saúde Mental (autopercepção): ${saudeMentalError}`, margin, state.y, {
        maxWidth: pageW - margin * 2,
      });
      state.y += 12;
    } else if (saudeMentalSnapshot) {
      renderSaudeMentalPdfSection(doc, pageW, pageH, margin, continuation, state, saudeMentalSnapshot, chartImages);
    }
  }
}

function addSellerReportFooters(
  doc: jsPDF,
  flags: SellerPdfSectionFlags,
  chartImages: SaudeMentalPdfChartImages | undefined,
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = PDF_BRAND.margin;
  const hasCharts =
    !!chartImages &&
    !!(
      chartImages.funnel ||
      chartImages.evolution ||
      chartImages.radarGeral ||
      chartImages.radarT0 ||
      chartImages.radarT1 ||
      chartImages.radarT2
    );
  addPdfPageFooters(doc, pageW, pageH, margin, (i, t) =>
    flags.includeSaudeMental && hasCharts
      ? `Medivox — relatório com gráficos — confidencial — página ${i} de ${t}`
      : `Medivox — relatório para empresa — confidencial — página ${i} de ${t}`,
  );
}

export async function downloadSellerCompanyPdf(input: SellerCompanyPdfDownloadInput): Promise<void> {
  const logo = input.logoDataUrl ?? (await loadMedivoxLogoPngDataUrl());
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date();
  renderCompanyPage(doc, input.overview, input.vendorName, input.expiryRows, now, {
    courseNames: input.courseNames,
    flags: input.flags,
    enrollmentMetrics: input.enrollmentMetrics,
    enrollmentError: input.enrollmentError,
    saudeMentalSnapshot: input.saudeMentalSnapshot,
    saudeMentalError: input.saudeMentalError,
    chartImages: input.chartImages,
  }, logo);
  addSellerReportFooters(doc, input.flags, input.chartImages);
  doc.save(`medivox-relatorio-${slugifyFilename(input.overview.company.slug)}.pdf`);
}

export async function downloadSellerPortfolioPdf(input: SellerPortfolioPdfDownloadInput): Promise<void> {
  const { overviews, vendorName, expiryRows, courseNames, flags, byCompany } = input;
  if (!overviews.length) return;
  const logo = input.logoDataUrl ?? (await loadMedivoxLogoPngDataUrl());
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date();
  overviews.forEach((overview, i) => {
    if (i > 0) doc.addPage();
    const p = byCompany[overview.company.id] ?? {};
    renderCompanyPage(doc, overview, vendorName, expiryRows, now, {
      courseNames,
      flags,
      enrollmentMetrics: p.enrollmentMetrics,
      enrollmentError: p.enrollmentError,
      saudeMentalSnapshot: p.saudeMentalSnapshot,
      saudeMentalError: p.saudeMentalError,
    }, logo);
  });
  addSellerReportFooters(doc, flags, undefined);
  doc.save(`medivox-relatorio-carteira-${slugifyFilename(vendorName || 'vendedor')}-${now.toISOString().slice(0, 10)}.pdf`);
}
