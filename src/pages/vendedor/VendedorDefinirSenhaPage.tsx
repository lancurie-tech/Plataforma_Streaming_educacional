import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { updatePasswordForCurrentSession } from '@/lib/firebase/auth';
import {
  mapCallableError,
  vendedorClearMustChangePasswordCallable,
} from '@/lib/firebase/callables';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthHeader } from '@/components/layout/AuthHeader';

const schema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string().min(6, 'Confirme a senha'),
  })
  .refine((d) => d.password === d.confirm, { message: 'As senhas não coincidem.', path: ['confirm'] });

type FormValues = z.infer<typeof schema>;

export function VendedorDefinirSenhaPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && profile?.role === 'vendedor' && !profile.mustChangePassword) {
      navigate('/vendedor', { replace: true });
    }
  }, [loading, profile, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Carregando…
      </div>
    );
  }

  if (!user || profile?.role !== 'vendedor') {
    return <Navigate to="/login" replace />;
  }

  if (!profile.mustChangePassword) {
    return null;
  }

  async function onSubmit(data: FormValues) {
    setErr(null);
    setSubmitting(true);
    try {
      await updatePasswordForCurrentSession(data.password);
      await vendedorClearMustChangePasswordCallable({});
      await refreshProfile();
      navigate('/vendedor', { replace: true });
    } catch (e: unknown) {
      let msg = mapCallableError(e);
      if (e && typeof e === 'object' && 'code' in e) {
        const code = String((e as { code: string }).code);
        if (code === 'auth/weak-password') msg = 'Senha muito fraca. Use pelo menos 6 caracteres.';
        if (code === 'auth/requires-recent-login')
          msg = 'Sessão expirou. Faça login de novo e repita a troca de senha.';
      }
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <AuthHeader />
      <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-center text-2xl font-semibold text-zinc-100">Definir nova senha</h1>
          <p className="mt-2 text-center text-sm text-zinc-400">
            Por segurança, troque a senha provisória antes de continuar.
          </p>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-8 space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8"
          >
            <Input
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              icon={<Lock size={18} />}
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirmar senha"
              type="password"
              autoComplete="new-password"
              icon={<Lock size={18} />}
              error={errors.confirm?.message}
              {...register('confirm')}
            />
            {err ? <p className="text-sm text-red-400">{err}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Salvando…' : 'Continuar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
