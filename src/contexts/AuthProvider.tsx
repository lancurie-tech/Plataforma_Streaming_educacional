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
import { usePublicTenantHost } from '@/contexts/usePublicTenantHost';
import { getTenant, getTenantEntitlements } from '@/lib/firestore/tenancy';
import { resolveTenantId } from '@/lib/auth/resolveTenantId';
import {
  COMMERCIAL_MODULE_IDS,
  hasCommercialModule,
  hasLegacyCapability,
  type CommercialModuleId,
} from '@/lib/modules/commercialEntitlements';

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
  const { publicSnapshot, resolvedSlug } = usePublicTenantHost();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [masterAdmin, setMasterAdmin] = useState(false);
  const [tokenClaimsReady, setTokenClaimsReady] = useState(true);
  const [entitlements, setEntitlements] = useState<AuthContextValue['entitlements']>(null);
  const [tenantUrlSlug, setTenantUrlSlug] = useState<string | null>(null);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setMasterAdmin(false);
      setTokenClaimsReady(true);
      return;
    }
    let cancelled = false;
    setTokenClaimsReady(false);
    void user
      .getIdTokenResult(true)
      .then((tk) => {
        if (!cancelled) setMasterAdmin(tk.claims.master_admin === true);
      })
      .catch(() => {
        if (!cancelled) setMasterAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setTokenClaimsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
            setEntitlements(null);
            setTenantUrlSlug(null);
            setEntitlementsLoading(false);
            setLoading(false);
            return;
          }
          setProfile(p);
          const tenantId = resolveTenantId(p);
          if (!tenantId) {
            setEntitlements(null);
            setTenantUrlSlug(null);
            setEntitlementsLoading(false);
          } else {
            setEntitlementsLoading(true);
            try {
              const [current, tdoc] = await Promise.all([
                getTenantEntitlements(tenantId),
                getTenant(tenantId),
              ]);
              setEntitlements(current);
              const slug =
                (tdoc?.publicSlug && tdoc.publicSlug.trim().toLowerCase()) || tenantId;
              setTenantUrlSlug(slug);
            } catch {
              setEntitlements(null);
              setTenantUrlSlug(null);
            } finally {
              setEntitlementsLoading(false);
            }
          }
        } catch {
          setProfile(null);
          setEntitlements(null);
          setTenantUrlSlug(null);
          setEntitlementsLoading(false);
        }
      } else {
        setProfile(null);
        setEntitlements(null);
        setTenantUrlSlug(null);
        setEntitlementsLoading(false);
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
      setTenantUrlSlug(null);
      return;
    }
    try {
      const p = await getUserProfile(u.uid);
      if (!p) {
        await logoutUser();
        setProfile(null);
        setEntitlements(null);
        setTenantUrlSlug(null);
        setEntitlementsLoading(false);
        return;
      }
      setProfile(p);
      const tenantId = resolveTenantId(p);
      if (!tenantId) {
        setEntitlements(null);
        setTenantUrlSlug(null);
        setEntitlementsLoading(false);
        return;
      }
      setEntitlementsLoading(true);
      try {
        const [current, tdoc] = await Promise.all([
          getTenantEntitlements(tenantId),
          getTenant(tenantId),
        ]);
        setEntitlements(current);
        const slug =
          (tdoc?.publicSlug && tdoc.publicSlug.trim().toLowerCase()) || tenantId;
        setTenantUrlSlug(slug);
      } catch {
        setEntitlements(null);
        setTenantUrlSlug(null);
      } finally {
        setEntitlementsLoading(false);
      }
    } catch {
      setProfile(null);
      setEntitlements(null);
      setTenantUrlSlug(null);
      setEntitlementsLoading(false);
    }
  }, [user]);

  const hasModule = useCallback(
    (moduleId: string) => {
      /**
       * Com slug no URL (`/empresa/...`): módulos vêm sempre do índice público (`tenantPublicSlugs`),
       * mesmo para utilizadores autenticados (incl. master a pré-visualizar o cliente).
       */
      const urlTenantIds =
        resolvedSlug &&
        publicSnapshot &&
        Array.isArray(publicSnapshot.enabledModuleIds);

      if (urlTenantIds) {
        const ids = publicSnapshot!.enabledModuleIds;
        if ((COMMERCIAL_MODULE_IDS as readonly string[]).includes(moduleId)) {
          return hasCommercialModule(ids, moduleId as CommercialModuleId);
        }
        return hasLegacyCapability(ids, moduleId);
      }

      /** Visitante no apex sem índice de tenant: permissivo (evita loop na home sem perfil). */
      if (!profile) {
        return true;
      }
      const tenantId = resolveTenantId(profile);
      if (!tenantId) return true;
      if (entitlementsLoading) return true;
      if (!entitlements) return false;
      const ids = entitlements.enabledModuleIds;
      if ((COMMERCIAL_MODULE_IDS as readonly string[]).includes(moduleId)) {
        return hasCommercialModule(ids, moduleId as CommercialModuleId);
      }
      return hasLegacyCapability(ids, moduleId);
    },
    [entitlements, entitlementsLoading, profile, publicSnapshot, resolvedSlug]
  );

  const value: AuthContextValue = {
    user,
    profile,
    tenantUrlSlug,
    masterAdmin,
    tokenClaimsReady,
    entitlements,
    entitlementsLoading,
    loading,
    error,
    login,
    logout,
    sendPasswordReset,
    clearError,
    refreshProfile,
    hasModule,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
