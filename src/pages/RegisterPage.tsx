import { Navigate } from 'react-router-dom';

/** Cadastro público desativado — usar o link da empresa (`/slug/cadastro`) e a chave de acesso. */
export function RegisterPage() {
  return <Navigate to="/login" replace />;
}
