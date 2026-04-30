import type { StudentDemographics } from '@/types';

const SEXO = new Set(['Masculino', 'Feminino', 'Outro']);

const FAIXAS = new Set(['Até 24', '25 a 34', '35 a 44', '45 a 54', '55 ou mais']);

/** Opções alinhadas ao Excel / dashboard de referência. */
export const FAIXA_ETARIA_OPTIONS = ['Até 24', '25 a 34', '35 a 44', '45 a 54', '55 ou mais'] as const;

export function parseStudentDemographics(raw: unknown): StudentDemographics | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const sexo = o.sexo;
  const faixaEtaria = o.faixaEtaria;
  const segundaJornada = o.segundaJornada;
  const idade = o.idade;
  const out: StudentDemographics = {};
  if (typeof sexo === 'string' && SEXO.has(sexo)) out.sexo = sexo as StudentDemographics['sexo'];
  if (typeof faixaEtaria === 'string' && FAIXAS.has(faixaEtaria)) out.faixaEtaria = faixaEtaria;
  if (typeof segundaJornada === 'boolean') out.segundaJornada = segundaJornada;
  if (typeof idade === 'number' && Number.isFinite(idade) && idade >= 0 && idade <= 120) out.idade = Math.round(idade);
  if (Object.keys(out).length === 0) return undefined;
  return out;
}

export function isCompleteStudentDemographics(d: StudentDemographics | undefined): boolean {
  if (!d) return false;
  return Boolean(d.sexo && d.faixaEtaria && typeof d.segundaJornada === 'boolean');
}
