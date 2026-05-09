import { jsPDF } from 'jspdf';
import { COMMERCIAL_MODULE_IDS } from '@/lib/modules/commercialEntitlements';
import { PDF_BRAND } from '@/lib/pdf/pdfBrandLayout';
import { PLATFORM_SHORT_NAME } from '@/lib/brand';

const COMMERCIAL_LABELS_PT: Record<string, string> = {
  streaming: 'Streaming — área pública de vídeos e canais',
  cursos: 'Cursos — catálogo, matrículas e certificados',
  chat: 'Chat — comunicação interna (quando ativo)',
  vendedores: 'Vendedores — portal e relatórios da equipa comercial',
};

export type TenantAdminInvitePdfPayload = {
  tenantId: string;
  organizationDisplayName: string;
  publicSlug: string;
  invitedName: string;
  invitedEmail: string;
  clientPortalUrl: string;
  loginUrl: string;
  forgotPasswordUrl: string;
  adminPanelUrl: string;
  definePasswordLink: string;
  enabledModuleIds: string[];
};

function slugifyFilenamePart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function formatModulesForPdf(ids: string[]): string[] {
  const lines: string[] = [];
  const set = new Set(ids);
  const commercialSet = new Set<string>(COMMERCIAL_MODULE_IDS);
  for (const id of COMMERCIAL_MODULE_IDS) {
    if (set.has(id)) {
      lines.push(`• ${COMMERCIAL_LABELS_PT[id] ?? id} (${id})`);
    }
  }
  const extras = ids.filter((x) => !commercialSet.has(x));
  if (extras.length) {
    lines.push('• Outros identificadores técnicos no contrato: ' + extras.join(', '));
  }
  if (lines.length === 0) {
    lines.push('• (Nenhum módulo listado nos entitlements — confira no console master.)');
  }
  return lines;
}

/**
 * PDF para envio manual ao administrador do cliente após `masterInviteTenantAdmin`.
 */
export function downloadTenantAdminInvitePdf(payload: TenantAdminInvitePdfPayload): void {
  const B = PDF_BRAND;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = B.margin;
  let y = m;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 16) {
      doc.addPage();
      y = m;
    }
  };

  const bandTitle = 'Guia de primeiro acesso — administrador da organização';
  doc.setFillColor(...B.navy);
  doc.rect(0, 0, pageW, B.headerBandH, 'F');
  doc.setTextColor(...B.onDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(B.titleFs);
  doc.text(bandTitle, m, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(B.smallFs);
  doc.setTextColor(...B.onDarkMuted);
  doc.text('Documento confidencial — destinar apenas ao administrador indicado abaixo.', m, 19);

  y = B.headerBandH + 10;
  doc.setTextColor(...B.ink);

  const bodyFs = B.bodyFs;
  const lineGap = 6;
  const para = (text: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bodyFs);
    doc.setTextColor(...B.inkSoft);
    const lines = doc.splitTextToSize(text, pageW - 2 * m);
    const h = lines.length * lineGap + 2;
    ensureSpace(h);
    doc.text(lines, m, y + lineGap);
    y += h;
    doc.setFont('helvetica', 'normal');
  };

  const section = (title: string) => {
    ensureSpace(14);
    doc.setFillColor(...B.accent);
    doc.rect(m, y, 3, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(B.sectionFs);
    doc.setTextColor(...B.ink);
    doc.text(title, m + 6, y + 7);
    y += 12;
  };

  para(`Organização: ${payload.organizationDisplayName} (tenantId: ${payload.tenantId})`);
  para(`Slug público na URL: /${payload.publicSlug}/`);
  para(`Administrador convidado: ${payload.invitedName}`);
  para(`E-mail de acesso (login): ${payload.invitedEmail}`);

  section('Passos para o primeiro acesso');
  para(
    '1. Abra o link «Definir senha» no final deste documento (é um link único gerado pelo sistema). ' +
      'Se já expirou ou não funcionar, use a página «Esqueci a senha» no login com o mesmo e-mail.',
    false
  );
  para(
    '2. Depois de definir a senha, entre em «Área de login» com o e-mail acima e a nova senha.',
    false
  );
  para(
    '3. O site público dos seus utilizadores finais (alunos) está no link «Portal do cliente». ' +
      'O painel de gestão (cursos, streaming, etc.) está em «Painel administrativo».',
    false
  );

  section('Links importantes');
  const linkBlock = (label: string, url: string) => {
    doc.setFontSize(bodyFs);
    doc.setTextColor(...B.ink);
    ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', m, y + lineGap);
    y += lineGap + 1;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235);
    const wrapped = doc.splitTextToSize(url, pageW - 2 * m);
    const h = wrapped.length * lineGap + 2;
    ensureSpace(h);
    doc.text(wrapped, m, y + lineGap);
    y += h + 2;
    doc.setTextColor(...B.inkSoft);
  };

  linkBlock('Definir senha (primeira vez)', payload.definePasswordLink);
  linkBlock('Área de login', payload.loginUrl);
  linkBlock('Esqueci a senha (alternativa)', payload.forgotPasswordUrl);
  linkBlock('Portal do cliente (site público)', payload.clientPortalUrl);
  linkBlock('Painel administrativo', payload.adminPanelUrl);

  section('Módulos disponibilizados neste tenant');
  const modLines = formatModulesForPdf(payload.enabledModuleIds);
  for (const line of modLines) {
    para(line);
  }

  section('Notas');
  para(
    '• O cadastro de alunos por empresa (com chave de acesso) usa normalmente um URL no formato ' +
      '/«slug-da-empresa»/cadastro — deve ser configurado no painel administrativo após criar a empresa.',
    false
  );
  para(
    '• Guarde este PDF em local seguro: contém um link sensível de definição de senha.',
    false
  );

  const totalPages = doc.getNumberOfPages();
  const generatedAt = new Date().toLocaleString('pt-BR');
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(B.footerFs);
    doc.setTextColor(...B.muted);
    doc.text(
      `${PLATFORM_SHORT_NAME} · gerado em ${generatedAt} · página ${i} / ${totalPages}`,
      m,
      pageH - 10
    );
  }

  const fname = `guia-admin-${slugifyFilenamePart(payload.tenantId)}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
