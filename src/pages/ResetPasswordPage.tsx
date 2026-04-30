import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle, Lock } from 'lucide-react';
import { applyPasswordReset, verifyPasswordResetOob } from '@/lib/firebase/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z
  .object({
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirm: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem.',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

function mapError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    const map: Record<string, string> = {
      'auth/expired-action-code': 'Este link expirou. Solicite um novo e-mail em «Esqueci minha senha».',
      'auth/invalid-action-code': 'Link inválido ou já utilizado. Solicite um novo e-mail.',
      'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
      'auth/network-request-failed': 'Falha de rede. Verifique sua conexão.',
    };
    return map[code] ?? 'Não foi possível redefinir a senha. Tente novamente.';
  }
  return 'Não foi possível redefinir a senha. Tente novamente.';
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode') ?? searchParams.get('oobcode');
  const mode = searchParams.get('mode');

  const [checking, setChecking] = useState(Boolean(oobCode));
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!oobCode) {
      setChecking(false);
      setCodeInvalid(true);
      return;
    }
    if (mode && mode !== 'resetPassword') {
      setChecking(false);
      setCodeInvalid(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const email = await verifyPasswordResetOob(oobCode);
        if (!cancelled) {
          setEmailHint(email);
          setCodeInvalid(false);
        }
      } catch {
        if (!cancelled) {
          setCodeInvalid(true);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oobCode, mode]);

  async function onSubmit(data: FormValues) {
    if (!oobCode) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await applyPasswordReset(oobCode, data.password);
      setDone(true);
    } catch (e) {
      setFormError(mapError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-100">Nova senha</h1>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
          {checking ? (
            <p className="text-center text-sm text-zinc-400">A validar o link…</p>
          ) : done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-lg font-medium text-zinc-100">Senha atualizada</h2>
              <p className="text-sm text-zinc-400">Já pode entrar com a nova senha.</p>
              <Link to="/login">
                <Button variant="outline" className="mt-2">
                  <ArrowLeft size={16} />
                  Ir para o login
                </Button>
              </Link>
            </div>
          ) : codeInvalid || !oobCode ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-zinc-400">
                Não foi possível usar este link. Peça um novo e-mail de recuperação ou abra o link mais recente que
                recebeu.
              </p>
              <Link to="/esqueci-senha" className="inline-block text-sm font-medium text-emerald-400 hover:underline">
                Esqueci minha senha
              </Link>
              <div>
                <Link to="/login" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-400">
                  <ArrowLeft size={16} />
                  Voltar ao login
                </Link>
              </div>
            </div>
          ) : (
            <>
              {emailHint ? (
                <p className="mb-6 text-sm text-zinc-400">
                  Conta: <span className="font-medium text-zinc-200">{emailHint}</span>
                </p>
              ) : null}
              <p className="mb-6 text-sm text-zinc-400">Defina uma nova senha para a sua conta.</p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Input
                  label="Nova senha"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  icon={<Lock size={18} />}
                  error={errors.password?.message}
                  {...register('password')}
                />
                <Input
                  label="Confirmar senha"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  icon={<Lock size={18} />}
                  error={errors.confirm?.message}
                  {...register('confirm')}
                />
                {formError ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                    <p className="text-sm text-red-400">{formError}</p>
                  </div>
                ) : null}
                <Button type="submit" className="w-full py-3 text-base" isLoading={submitting}>
                  Guardar nova senha
                </Button>
              </form>
              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400"
                >
                  <ArrowLeft size={16} />
                  Voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
