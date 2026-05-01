/**
 * Base unificada tipo `Base_*_Empresas_Dashboard_Unificada.xlsx`.
 * O parser é tolerante: detecta coluna de empresa e colunas numéricas automaticamente.
 */

export type ParsedUnifiedSheet = {
  headers: string[];
  rows: Record<string, unknown>[];
  sheetName: string;
};

const MAX_BYTES = 12 * 1024 * 1024;

export function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export async function parseUnifiedXlsxFile(file: File): Promise<ParsedUnifiedSheet> {
  if (file.size > MAX_BYTES) {
    throw new Error('Arquivo muito grande (máx. 12 MB).');
  }
  if (!/\.xlsx$/i.test(file.name) && !/\.xls$/i.test(file.name)) {
    throw new Error('Envie um arquivo .xlsx ou .xls.');
  }

  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('A planilha não contém abas.');
  }
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error('Não foi possível ler a primeira aba.');
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  });

  if (json.length === 0) {
    return { headers: [], rows: [], sheetName };
  }

  const headers = Object.keys(json[0]!);
  return { headers, rows: json, sheetName };
}

const COMPANY_HEADER_HINTS =
  /\b(empresa|organiza|organiza[cç][aã]o|unidade|filial|company|cliente|raz[aã]o|nome\s*empresa)\b/i;

export function detectCompanyColumn(headers: string[]): string | null {
  for (const h of headers) {
    if (COMPANY_HEADER_HINTS.test(h) || COMPANY_HEADER_HINTS.test(normalizeKey(h))) {
      return h;
    }
  }
  const first = headers[0];
  return first ?? null;
}

function cellToNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).trim().replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function detectNumericColumns(
  headers: string[],
  rows: Record<string, unknown>[],
  companyCol: string | null,
  minRatio = 0.35
): string[] {
  if (rows.length === 0) return [];
  const out: string[] = [];
  for (const h of headers) {
    if (companyCol && h === companyCol) continue;
    if (COMPANY_HEADER_HINTS.test(h)) continue;
    let ok = 0;
    for (const r of rows) {
      const n = cellToNumber(r[h]);
      if (n !== null) ok++;
    }
    if (ok / rows.length >= minRatio) out.push(h);
  }
  return out.slice(0, 12);
}

export function filterRowsByCompanyNames(
  rows: Record<string, unknown>[],
  companyCol: string,
  allowedNames: Set<string>
): Record<string, unknown>[] {
  if (allowedNames.size === 0) return rows;
  return rows.filter((r) => {
    const raw = r[companyCol];
    const key = normalizeKey(String(raw ?? ''));
    if (!key) return false;
    if (allowedNames.has(key)) return true;
    for (const n of allowedNames) {
      if (key.includes(n) || n.includes(key)) return true;
    }
    return false;
  });
}
