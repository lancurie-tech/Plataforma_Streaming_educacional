import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { postLoginStudentPath } from '@/lib/postLoginRedirect';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login, user, profile, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin', { replace: true });
        return;
      }
      if (profile.role === 'vendedor') {
        if (profile.mustChangePassword) {
          navigate('/vendedor/definir-senha', { replace: true });
          return;
        }
        navigate('/vendedor', { replace: true });
        return;
      }
      const from = (location.state as { from?: string } | null)?.from;
      navigate(postLoginStudentPath(from), { replace: true });
    }
  }, [user, profile, loading, navigate, location.state]);

  async function onSubmit(data: FormValues) {
    try {
      setSubmitting(true);
      clearError();
      await login(data.email, data.password);
    } catch {
      /* contexto já definiu error */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-100">Entrar</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Use o link da sua empresa para o primeiro cadastro (com chave). Aqui você entra com e-mail e
            senha.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              icon={<Mail size={18} />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              icon={<Lock size={18} />}
              error={errors.password?.message}
              {...register('password')}
            />

            {error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : null}

            <Button type="submit" className="w-full py-3 text-base" isLoading={submitting}>
              Entrar
            </Button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm">
            <Link
              to="/esqueci-senha"
              className="block text-zinc-400 transition-colors hover:text-emerald-400"
            >
              Esqueceu sua senha?
            </Link>
            <p className="text-zinc-500">
              Primeiro acesso? Use o endereço enviado pela empresa (ex.:{' '}
              <span className="font-mono text-zinc-400">/empresa/cadastro</span>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
