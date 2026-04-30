/** Remove formatação e mantém só dígitos */
export function digitsOnlyCpf(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

/**
 * Valida CPF brasileiro (dígitos verificadores).
 * Não consulta a Receita Federal — só rejeita sequências inválidas algoritmicamente.
 */
export function isValidCpf(cpf: string): boolean {
  const d = digitsOnlyCpf(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]!, 10) * (10 - i);
  let mod = (sum * 10) % 11;
  if (mod === 10 || mod === 11) mod = 0;
  if (mod !== parseInt(d[9]!, 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]!, 10) * (11 - i);
  mod = (sum * 10) % 11;
  if (mod === 10 || mod === 11) mod = 0;
  return mod === parseInt(d[10]!, 10);
}

export function formatCpfDisplay(digits: string): string {
  const d = digitsOnlyCpf(digits);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
