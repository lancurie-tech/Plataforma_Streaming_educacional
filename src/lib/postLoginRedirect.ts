/** Destino após login de aluno: `state.from` (rota protegida) ou home de streaming (`/streaming`). */
export function postLoginStudentPath(from: unknown): string {
  if (
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    from !== '/login'
  ) {
    return from;
  }
  return '/streaming';
}
