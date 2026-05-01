import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PLATFORM_DISPLAY_NAME, PLATFORM_SHORT_NAME } from '@/lib/brand';
import type {
  CompanyCourseAssignment,
  CompanyRoleDef,
  CompanyDepartmentDef,
  CourseSummary,
  ModuleScheduleEntry,
} from '@/types';
import type { ArchiveAccessKeyV2 } from '@/lib/firestore/admin';
import { formatAccessRemaining } from '@/lib/firestore/assignmentAccess';

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

/** Texto escuro sobre papel branco; faixa superior só com texto claro sobre fundo escuro. */
const C = {
  /** Fundo faixa / cabeçalho de tabela */
  navy: [0, 58, 52] as [number, number, number],
  /** Cabeçalho de tabela levemente mais suave */
  tableHead: [0, 72, 64] as [number, number, number],
  /** Fundo de página levemente esverdeado */
  paperTint: [229, 243, 236] as [number, number, number],
  /** Corpo de texto */
  ink: [15, 23, 42] as [number, number, number],
  inkSoft: [51, 65, 85] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  /** Só sobre `navy` */
  onDark: [255, 255, 255] as [number, number, number],
  onDarkMuted: [226, 232, 240] as [number, number, number],
  /** Acento (barra lateral de secção) */
  accent: [5, 150, 105] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
  linkBlue: [37, 99, 235] as [number, number, number],
};

/**
 * Rasteriza o logo em PNG maior (para não ficar pixelado no PDF).
 */
async function loadBrandLogoPngDataUrl(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(`${window.location.origin}/logo.svg`);
    if (!res.ok) return null;
    const svgText = await res.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('logo'));
      img.src = url;
    });
    const upscale = 4;
    const w = Math.max(1, Math.round(img.width * upscale));
    const h = Math.max(1, Math.round(img.height * upscale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    // Exporta o logo em alta resolução, sem padding/fundo,
    // para o posicionamento e escala ficarem previsíveis no header.
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function resolveRegistrationUrl(registrationPath: string): string {
  const trimmed = registrationPath.trim();
  if (!trimmed) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  if (typeof window === 'undefined') return trimmed;

  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return trimmed;
  }
}

function afterTable(doc: jsPDF) {
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.inkSoft);
}

export async function generateCompanyPdf({
  companyName,
  slug,
  registrationPath,
  roles,
  departments,
  accessKeys,
  courses,
  assignments,
  moduleNames,
  moduleScheduleRowsByCourse,
}: {
  companyName: string;
  slug: string;
  registrationPath: string;
  roles: CompanyRoleDef[];
  departments: CompanyDepartmentDef[];
  accessKeys: ArchiveAccessKeyV2[];
  courses: CourseSummary[];
  assignments: CompanyCourseAssignment[];
  moduleNames?: Record<string, string>;
  moduleScheduleRowsByCourse?: Record<string, Array<{ title: string; opens: string; closes: string }>>;
}): Promise<void> {
  const logoDataUrl = await loadBrandLogoPngDataUrl();
  const registrationUrl = resolveRegistrationUrl(registrationPath);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = 0;

  const titleFs = 22;
  const companyFs = 15;
  const sectionFs = 13.5;
  const bodyFs = 11.5;
  const smallFs = 10;
  const footerFs = 9;
  const lineHBody = 5.6;

  const headerBandH = 22;

  function drawPageBackground() {
    doc.setFillColor(...C.paperTint);
    doc.rect(0, 0, pageW, pageH, 'F');

    if (!logoDataUrl) return;
    try {
      const ip = doc.getImageProperties(logoDataUrl);
      const wmW = Math.min(pageW * 0.95, pageW - 2);
      const wmH = (ip.height * wmW) / ip.width;
      const wmX = (pageW - wmW) / 2;
      const wmY = (pageH - wmH) / 2;

      // Marca d'água central discreta para reforço visual da marca.
      doc.addImage(logoDataUrl, 'PNG', wmX, wmY, wmW, wmH);
    } catch {
      // Ignore watermark draw failures.
    }
  }

  function drawContinuationHeader() {
    drawPageBackground();
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, pageW, 11, 'F');
    doc.setFontSize(footerFs);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.onDark);
    doc.text(PLATFORM_SHORT_NAME, margin, 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(footerFs - 0.5);
    doc.setTextColor(...C.onDarkMuted);
    const tail = `· ${companyName} · Guia de acesso`;
    doc.text(tail, margin + 22, 7.5, { maxWidth: pageW - margin * 2 - 24 });
  }

  function addFooters() {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(footerFs);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted);
      doc.text(
        `${PLATFORM_DISPLAY_NAME} — documento confidencial — uso pela organização e colaboradores autorizados — página ${i} de ${total}`,
        pageW / 2,
        pageH - 7,
        { align: 'center', maxWidth: pageW - margin * 2 },
      );
    }
    doc.setPage(total);
  }

  function addSection(title: string) {
    if (y > pageH - 48) {
      doc.addPage();
      drawContinuationHeader();
      y = 18;
    }
    y += 6;
    doc.setFillColor(...C.accent);
    doc.rect(margin, y, 2, 8, 'F');
    doc.setFontSize(sectionFs);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.ink);
    doc.text(title, margin + 5, y + 5.6);
    y += 11;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.25);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  }

  function addBody(text: string) {
    doc.setFontSize(bodyFs);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.inkSoft);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    if (y + lines.length * lineHBody > pageH - 22) {
      doc.addPage();
      drawContinuationHeader();
      y = 18;
    }
    doc.text(lines, margin, y);
    y += lines.length * lineHBody + 3;
  }

  const tableFont = 11;
  const tableCommon = {
    margin: { left: margin, right: margin },
    theme: 'grid' as const,
    styles: {
      fontSize: tableFont,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3.5, right: 3.5 },
      lineColor: [203, 213, 225] as [number, number, number],
      lineWidth: 0.15,
      textColor: C.ink,
      valign: 'middle' as const,
      fillColor: false as const,
    },
    headStyles: {
      fillColor: C.tableHead,
      textColor: 255,
      fontStyle: 'bold' as const,
      fontSize: tableFont,
    },
    bodyStyles: {
      textColor: C.ink,
      fillColor: false as const,
    },
    alternateRowStyles: {
      fillColor: false as const,
    },
    willDrawPage: (data: { pageNumber: number }) => {
      // Páginas adicionais criadas automaticamente pelo autoTable
      // também precisam do fundo e da marca d'água.
      if (data.pageNumber > 1) drawContinuationHeader();
    },
  };

  // —— Faixa superior: só fundo escuro + logo (texto claro opcional, nunca fora da faixa) ——
  drawPageBackground();
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pageW, headerBandH, 'F');

  if (logoDataUrl) {
    try {
      const ip = doc.getImageProperties(logoDataUrl);
      const logoH = 19;
      const logoW = Math.min((ip.width * logoH) / ip.height, pageW - margin * 2);
      const logoX = (pageW - logoW) / 2;
      const logoY = (headerBandH - logoH) / 2;
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(...C.onDark);
      doc.text(PLATFORM_SHORT_NAME, pageW / 2, headerBandH / 2 + 4, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...C.onDark);
    doc.text(PLATFORM_SHORT_NAME, pageW / 2, headerBandH / 2 + 4, { align: 'center' });
  }

  // A partir daqui: sempre papel “branco” + texto escuro (nada de cinza claro sobre branco para corpo principal)
  y = headerBandH + 10;

  doc.setFontSize(smallFs);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.muted);
  doc.text('Formação digital em saúde — documento para a organização cliente', margin, y);
  y += 8;

  doc.setFontSize(titleFs);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.ink);
  doc.text('Guia de acesso à plataforma', margin, y);
  y += 10;

  doc.setFontSize(companyFs);
  doc.setTextColor(...C.inkSoft);
  doc.text(companyName, margin, y);
  y += 7;
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 56, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(smallFs + 0.5);
  doc.setTextColor(...C.muted);
  doc.text(`Emitido em ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}`, margin, y);
  y += 12;

  addSection('1. Link de cadastro');
  addBody(
    `Os colaboradores devem acessar o endereço abaixo para criar conta na ${PLATFORM_DISPLAY_NAME}. Envie o link por canal interno seguro.`,
  );
  if (y > pageH - 36) {
    doc.addPage();
    drawContinuationHeader();
    y = 18;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const urlLines = doc.splitTextToSize(registrationUrl, pageW - margin * 2);
  doc.setTextColor(...C.linkBlue);
  const linkStartY = y;
  const linkLineH = 5.6;
  doc.text(urlLines, margin, linkStartY);
  for (let i = 0; i < urlLines.length; i++) {
    const line = String(urlLines[i]);
    const lineY = linkStartY + i * linkLineH;
    const lineW = doc.getTextWidth(line);
    doc.setDrawColor(...C.linkBlue);
    doc.setLineWidth(0.25);
    doc.line(margin, lineY + 0.6, margin + lineW, lineY + 0.6);
  }
  if (/^https?:\/\//i.test(registrationUrl)) {
    doc.link(margin, linkStartY - 4, pageW - margin * 2, urlLines.length * linkLineH + 2, {
      url: registrationUrl,
    });
  }
  y += urlLines.length * linkLineH + 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodyFs);
  doc.setTextColor(...C.inkSoft);
  // doc.text(`Identificador da empresa (slug): ${slug}`, margin, y);
  y += 9;

  addSection('2. Níveis / funções');
  if (roles.length > 0) {
    autoTable(doc, {
      startY: y,
      ...tableCommon,
      head: [['Nível']],
      body: roles.map((r) => [r.label]),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    afterTable(doc);
  } else {
    addBody('Nenhum nível configurado.');
  }

  addSection('3. Áreas / setores');
  if (departments.length > 0) {
    autoTable(doc, {
      startY: y,
      ...tableCommon,
      head: [['Área']],
      body: departments.map((d) => [d.label]),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    afterTable(doc);
  } else {
    addBody('Nenhuma área configurada.');
  }

  addSection('4. Chaves de acesso');
  if (accessKeys.length > 0) {
    addBody(
      'Cada chave corresponde a uma combinação Nível × Área. Entregue a chave certa a cada colaborador — ela define a classificação na plataforma e o conteúdo visível.',
    );
    autoTable(doc, {
      startY: y,
      ...tableCommon,
      head: [['Nível', 'Área', 'Chave de acesso']],
      body: accessKeys.map((k) => [k.roleLabel, k.departmentLabel, k.plainKey]),
      columnStyles: {
        2: { font: 'courier', fontStyle: 'bold', fontSize: 11, textColor: [15, 23, 42] },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    afterTable(doc);
  } else {
    addBody(`Nenhuma chave v2 gerada. Entre em contato com o administrador da ${PLATFORM_DISPLAY_NAME}.`);
  }

  const assignMap = new Map(assignments.map((a) => [a.courseId, a]));
  const assigned = courses.filter((c) => assignMap.has(c.id));

  addSection('5. Cursos disponibilizados');
  if (assigned.length > 0) {
    for (const c of assigned) {
      const a = assignMap.get(c.id)!;
      const sched = a.moduleSchedule;
      const fromCaller = moduleScheduleRowsByCourse?.[c.id];
      const hasPerModuleCalendar =
        (fromCaller && fromCaller.length > 0) ||
        (sched && Object.values(sched).some((s) => s?.opensAt || s?.closesAt));

      if (y > pageH - 58) {
        doc.addPage();
        drawContinuationHeader();
        y = 18;
      }
      y += 4;
      doc.setFillColor(...C.navy);
      doc.roundedRect(margin, y, pageW - margin * 2, 10, 1.2, 1.2, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.onDark);
      doc.text(c.title, margin + 3, y + 6.8);
      y += 16;

      if (hasPerModuleCalendar) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFs);
        doc.setTextColor(...C.inkSoft);
        const expl = doc.splitTextToSize(
          'Calendário por módulo: não há um único prazo para o curso completo; cada linha é um módulo.',
          pageW - margin * 2,
        );
        if (y + expl.length * lineHBody > pageH - 36) {
          doc.addPage();
          drawContinuationHeader();
          y = 18;
        }
        doc.text(expl, margin, y);
        y += expl.length * lineHBody + 4;
        const rowList =
          fromCaller ??
          Object.entries(sched ?? {})
            .map(([mid, s]: [string, ModuleScheduleEntry]) => ({
              title: moduleNames?.[mid] ?? mid,
              opens: fmtDate(s.opensAt),
              closes: fmtDate(s.closesAt),
            }))
            .filter((r) => r.opens !== '—' || r.closes !== '—');
        if (rowList.length === 0) {
          doc.setTextColor(...C.muted);
          doc.text('(Datas por módulo ainda não preenchidas.)', margin, y);
          y += 9;
        } else {
          autoTable(doc, {
            startY: y,
            ...tableCommon,
            head: [['Módulo', 'Abertura', 'Encerramento']],
            body: rowList.map((r) => [r.title, r.opens, r.closes]),
          });
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
          afterTable(doc);
        }
      } else {
        const rem = formatAccessRemaining(a.expiresAt);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFs);
        doc.setTextColor(...C.inkSoft);
        const lines = doc.splitTextToSize(`Prazo do curso: ${rem.shortLabel}`, pageW - margin * 2);
        if (y + lines.length * lineHBody > pageH - 22) {
          doc.addPage();
          drawContinuationHeader();
          y = 18;
        }
        doc.text(lines, margin, y);
        y += lines.length * lineHBody + 5;
      }
    }
  } else {
    addBody('Nenhum curso liberado para esta empresa.');
  }

  addSection('6. Orientações de uso');
  addBody(
    '• A organização é responsável pela distribuição das chaves corretas a cada colaborador, de acordo com o nível e a área.\n\n' +
      '• Se um colaborador utilizar a chave errada, ficará classificado de forma incorreta e poderá ver conteúdo diferente do previsto.\n\n' +
      '• Cada chave pode ser utilizada por vários colaboradores do mesmo nível e área.\n\n' +
      `• Para dúvidas ou alteração de chaves, entre em contato com o administrador da ${PLATFORM_DISPLAY_NAME}.`,
  );

  addSection('7. Informações importantes');
  addBody(
    '• Dados pessoais são tratados nos termos da Política de Privacidade aceita no cadastro (LGPD).\n\n' +
      '• Os certificados emitidos permanecem na conta do aluno após o encerramento do prazo de acesso ao curso.\n\n' +
      '• O conteúdo dos cursos pode variar conforme o nível do colaborador.',
  );

  addFooters();
  doc.save(`guia-acesso-${slug}.pdf`);
}
