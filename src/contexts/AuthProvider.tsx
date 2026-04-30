import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import {
  getUserProfile,
  loginUser,
  logoutUser,
  onAuthChange,
  resetPassword,
} from '@/lib/firebase/auth';
import type { UserProfile } from '@/types';
import { AuthContext, type AuthContextValue } from '@/contexts/authContext';

function errCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code: string }).code);
  }
  return undefined;
}

function mapFirebaseError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    const map: Record<string, string> = {
      'auth/invalid-email': 'E-mail inválido.',
      'auth/user-disabled': 'Esta conta foi desativada.',
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
      'auth/weak-password': 'Senha muito fraca.',
      'auth/requires-recent-login':
        'Por segurança, saia da conta, entre de novo e repita a operação.',
      'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
      'auth/network-request-failed': 'Falha de rede. Verifique sua conexão.',
      'auth/expired-action-code': 'Este link expirou. Solicite um novo e-mail.',
      'auth/invalid-action-code': 'Link inválido ou já utilizado.',
    };
    return map[code] ?? 'Não foi possível concluir a operação. Tente novamente.';
  }
  return 'Erro inesperado. Tente novamente.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        try {
          const p = await getUserProfile(u.uid);
          /**
           * Auth e Firestore são separados: apagar só `users/{uid}` deixa tokens válidos.
           * Sem perfil, encerramos a sessão para não manter “login fantasma”.
           */
          if (!p) {
            await logoutUser();
            setProfile(null);
            setLoading(false);
            return;
          }
          setProfile(p);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await loginUser(email, password);
    } catch (e) {
      const msg = mapFirebaseError(e);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await logoutUser();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setError(null);
    try {
      await resetPassword(email);
    } catch (e) {
      /** Não revelar se o e-mail existe (boas práticas Firebase / anti-enumeração). */
      if (errCode(e) === 'auth/user-not-found') {
        return;
      }
      const msg = mapFirebaseError(e);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const refreshProfile = useCallback(async () => {
    const u = user;
    if (!u) {
      setProfile(null);
      return;
    }
    try {
      const p = await getUserProfile(u.uid);
      if (!p) {
        await logoutUser();
        setProfile(null);
        return;
      }
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, [user]);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    error,
    login,
    logout,
    sendPasswordReset,
    clearError,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
