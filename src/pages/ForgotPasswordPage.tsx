import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { sendPasswordReset, error, clearError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    try {
      setSubmitting(true);
      clearError();
      await sendPasswordReset(data.email);
      setSent(true);
    } catch {
      /* erro no contexto */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-100">Recuperar senha</h1>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-lg font-medium text-zinc-100">Verifique o seu e-mail</h2>
              <p className="text-sm text-zinc-400">
                Se o endereço estiver cadastrado, você receberá instruções para redefinir a senha. Confira também o spam.
                O link expira após algum tempo — você pode solicitar outro e-mail abaixo.
              </p>
              <Link to="/login">
                <Button variant="outline" className="mt-2">
                  <ArrowLeft size={16} />
                  Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-zinc-400">
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  icon={<Mail size={18} />}
                  error={errors.email?.message}
                  {...register('email')}
                />
                {error ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                ) : null}
                <Button type="submit" className="w-full py-3 text-base" isLoading={submitting}>
                  Enviar link de recuperação
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
