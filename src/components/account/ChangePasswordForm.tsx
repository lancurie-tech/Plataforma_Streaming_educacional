import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { changePasswordWithCurrent } from '@/lib/firebase/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas novas não coincidem.',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

function mapError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    const map: Record<string, string> = {
      'auth/wrong-password': 'Senha atual incorreta.',
      'auth/invalid-credential': 'Senha atual incorreta.',
      'auth/weak-password': 'Senha nova muito fraca.',
      'auth/requires-recent-login': 'Por segurança, saia da conta, entre de novo e tente alterar a senha.',
      'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
      'auth/network-request-failed': 'Falha de rede. Verifique sua conexão.',
    };
    return map[code] ?? 'Não foi possível alterar a senha. Tente novamente.';
  }
  if (err instanceof Error) return err.message;
  return 'Não foi possível alterar a senha. Tente novamente.';
}

export function ChangePasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    setFormError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await changePasswordWithCurrent(data.currentPassword, data.newPassword);
      setSuccess(true);
      reset();
    } catch (e) {
      setFormError(mapError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Alterar senha</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Informe a senha atual e escolha uma nova (mínimo 6 caracteres).
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Input
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          icon={<Lock size={18} />}
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          icon={<Lock size={18} />}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          icon={<Lock size={18} />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {formError ? <p className="text-sm text-red-400">{formError}</p> : null}
        {success ? (
          <p className="text-sm text-emerald-400">Senha alterada com sucesso.</p>
        ) : null}

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </div>
  );
}
