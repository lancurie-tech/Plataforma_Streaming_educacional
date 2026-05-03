import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, UserRound, KeyRound, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { registerWithCompanyCallable, mapCallableError } from '@/lib/firebase/callables';
import { loginUser } from '@/lib/firebase/auth';
import { RESERVED_COMPANY_SLUGS } from '@/lib/slug';
import { isValidCpf, formatCpfDisplay, digitsOnlyCpf } from '@/lib/cpf';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LEGAL_VERSIONS } from '@/legal/legalVersions';
import { FAIXA_ETARIA_OPTIONS } from '@/lib/studentDemographics';

const schema = z.object({
  name: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  accessKey: z.string().min(4, 'Informe a chave fornecida pela empresa'),
  cpf: z
    .string()
    .refine((v) => isValidCpf(v), { message: 'CPF inválido (verifique os dígitos).' }),
  sexo: z
    .string()
    .min(1, 'Selecione sexo.')
    .refine((v) => ['Masculino', 'Feminino', 'Outro'].includes(v), { message: 'Selecione sexo.' }),
  faixaEtaria: z
    .string()
    .min(1, 'Selecione a faixa etária.')
    .refine((v) => (FAIXA_ETARIA_OPTIONS as readonly string[]).includes(v), {
      message: 'Selecione a faixa etária.',
    }),
  segundaJornada: z
    .string()
    .min(1, 'Indique segunda jornada.')
    .refine((v) => v === 'sim' || v === 'nao', { message: 'Indique se possui segunda jornada.' }),
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: 'É necessário aceitar os Termos de uso.',
  }),
  acceptPrivacy: z.boolean().refine((v) => v === true, {
    message: 'É necessário aceitar a Política de privacidade.',
  }),
  acceptCommitments: z.boolean().refine((v) => v === true, {
    message: 'É necessário aceitar os Compromissos do participante.',
  }),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.infer<typeof schema>;

export function CompanyRegisterPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slug = (companySlug ?? '').toLowerCase();
  const invalidSlug =
    !slug || RESERVED_COMPANY_SLUGS.has(slug) || slug === 'admin' || slug === 'esqueci-senha';

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormInput>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      accessKey: '',
      cpf: '',
      sexo: '',
      faixaEtaria: '',
      segundaJornada: '',
      acceptTerms: false,
      acceptPrivacy: false,
      acceptCommitments: false,
    },
  });

  const companyHomeStreaming = !invalidSlug ? `/${slug}/streaming` : '/login';

  useEffect(() => {
    if (!authLoading && user && !invalidSlug) {
      navigate(companyHomeStreaming, { replace: true });
    }
  }, [user, authLoading, navigate, invalidSlug, companyHomeStreaming]);

  async function onSubmit(raw: FormInput) {
    if (invalidSlug) return;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return;
    const data: FormOutput = parsed.data;
    setErr(null);
    setSubmitting(true);
    try {
      await registerWithCompanyCallable({
        companySlug: slug,
        accessKey: data.accessKey.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        name: data.name.trim(),
        cpf: digitsOnlyCpf(data.cpf),
        demographics: {
          sexo: data.sexo as 'Masculino' | 'Feminino' | 'Outro',
          faixaEtaria: data.faixaEtaria,
          segundaJornada: data.segundaJornada === 'sim',
        },
        legalAcceptance: {
          termsVersion: LEGAL_VERSIONS.termsOfService,
          privacyVersion: LEGAL_VERSIONS.privacyPolicy,
          commitmentsVersion: LEGAL_VERSIONS.studentCommitments,
        },
      });
      await loginUser(data.email.trim().toLowerCase(), data.password);
      navigate(`/${slug}/streaming`, { replace: true });
    } catch (e) {
      setErr(mapCallableError(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (invalidSlug) {
    return (
      <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center px-4 py-10">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-zinc-100">Link inválido</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Use o link completo enviado pela sua empresa (incluindo o nome da empresa na URL).
          </p>
          <Link to="/login" className="mt-6 inline-block text-sm text-emerald-400 hover:underline">
            Ir para login geral
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-100">Cadastro</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Empresa: <span className="font-mono text-emerald-400/90">{slug}</span>
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Use a chave que corresponde ao seu perfil (nível e área na empresa).
            A chave define automaticamente sua classificação na plataforma — o conteúdo dos cursos pode variar por perfil.
            A empresa deve ter enviado a chave certa para você.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Nome completo"
              autoComplete="name"
              placeholder="Seu nome"
              icon={<UserRound size={18} />}
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              icon={<Mail size={18} />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Controller
              name="cpf"
              control={control}
              render={({ field }) => (
                <Input
                  label="CPF"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  error={errors.cpf?.message}
                  value={formatCpfDisplay(field.value ?? '')}
                  onChange={(e) => field.onChange(digitsOnlyCpf(e.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              icon={<Lock size={18} />}
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Chave de acesso"
              autoComplete="off"
              placeholder="Chave da empresa"
              icon={<KeyRound size={18} />}
              error={errors.accessKey?.message}
              {...register('accessKey')}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-300">Sexo</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-3 pr-8 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    {...register('sexo')}
                  >
                    <option value="">Selecione…</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Outro">Outro</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                </div>
                {errors.sexo ? <p className="text-xs text-red-400">{errors.sexo.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-300">Faixa etária</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-3 pr-8 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    {...register('faixaEtaria')}
                  >
                    <option value="">Selecione…</option>
                    {FAIXA_ETARIA_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                </div>
                {errors.faixaEtaria ? <p className="text-xs text-red-400">{errors.faixaEtaria.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-300">Segunda jornada</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-3 pr-8 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    {...register('segundaJornada')}
                  >
                    <option value="">Selecione…</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                </div>
                {errors.segundaJornada ? (
                  <p className="text-xs text-red-400">{errors.segundaJornada.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <Controller
                name="acceptTerms"
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-zinc-300">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600 accent-emerald-600"
                      checked={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                    <span>
                      Li e aceito os{' '}
                      <Link
                        to="/termos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 underline-offset-2 hover:underline"
                      >
                        Termos de uso
                      </Link>
                      .
                    </span>
                  </label>
                )}
              />
              {errors.acceptTerms ? (
                <p className="text-xs text-red-400">{errors.acceptTerms.message}</p>
              ) : null}
              <Controller
                name="acceptPrivacy"
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-zinc-300">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600 accent-emerald-600"
                      checked={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                    <span>
                      Li e aceito a{' '}
                      <Link
                        to="/privacidade"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 underline-offset-2 hover:underline"
                      >
                        Política de privacidade
                      </Link>
                      .
                    </span>
                  </label>
                )}
              />
              {errors.acceptPrivacy ? (
                <p className="text-xs text-red-400">{errors.acceptPrivacy.message}</p>
              ) : null}
              <Controller
                name="acceptCommitments"
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-zinc-300">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600 accent-emerald-600"
                      checked={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                    <span>
                      Li e aceito os{' '}
                      <Link
                        to="/compromissos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 underline-offset-2 hover:underline"
                      >
                        Compromissos do participante
                      </Link>
                      .
                    </span>
                  </label>
                )}
              />
              {errors.acceptCommitments ? (
                <p className="text-xs text-red-400">{errors.acceptCommitments.message}</p>
              ) : null}
            </div>

            {err ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{err}</p>
              </div>
            ) : null}

            <Button type="submit" className="w-full py-3 text-base" isLoading={submitting}>
              Criar conta e entrar
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Já tem conta?{' '}
            <Link
              to={`/${slug}/login`}
              className="font-medium text-emerald-400 hover:text-emerald-300"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
