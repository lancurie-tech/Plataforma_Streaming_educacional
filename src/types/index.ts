import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'student' | 'vendedor';

/** Quem pode ver o item no curso — mantido para compatibilidade com dados antigos. */
export type ContentAudience = 'all';

/** Nível / função configurável por empresa. */
export type CompanyRoleDef = { id: string; label: string };

/** Área / setor configurável por empresa. */
export type CompanyDepartmentDef = { id: string; label: string };

/** Chave de acesso — cada combinação nível × área da empresa gera uma chave única. */
export type CompanyAccessKeyEntry = {
  id: string;
  roleId: string;
  departmentId: string;
  /** Texto da chave em claro — gravado APENAS em `adminRegistrationKeys/archive`. */
  plainKey?: string;
};

/** Abertura/fecho por módulo dentro de um curso liberado para empresa. */
export type ModuleScheduleEntry = {
  opensAt: Date | null;
  closesAt: Date | null;
};

/** Aceites legais registados no cadastro de aluno (Cloud Function). */
export type StudentLegalAcceptance = {
  termsVersion: string;
  privacyVersion: string;
  commitmentsVersion: string;
  acceptedAt: Date;
};

/** Aceite do termo de confidencialidade do vendedor (Cloud Function). */
export type VendorConfidentialityAcceptance = {
  version: string;
  acceptedAt: Date;
};

/** Dados opcionais para relatórios (alinhados ao Excel unificado / saúde mental). */
export type StudentDemographics = {
  sexo?: 'Masculino' | 'Feminino' | 'Outro';
  /** Ex.: "Até 24", "25 a 34", … */
  faixaEtaria?: string;
  segundaJornada?: boolean;
  idade?: number;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Tenant lógico para modelo multi-tenant (Fase 1+). */
  tenantId?: string | null;
  cpf?: string;
  companyId?: string | null;
  companySlug?: string | null;
  /** Nível / função dentro da empresa (sistema de classificação). */
  companyRoleId?: string | null;
  /** Área / setor dentro da empresa (novo sistema de classificação). */
  companyDepartmentId?: string | null;
  /** Aluno: dados para painéis analíticos (sexo, faixa etária, segunda jornada). */
  demographics?: StudentDemographics;
  /** Vendedor: após primeiro login com senha provisória, deve trocar a senha. */
  mustChangePassword?: boolean;
  /** Empresas que o vendedor acompanha (relatórios). */
  managedCompanyIds?: string[];
  /** Aluno: versões aceites no cadastro (evidência LGPD). */
  legalAcceptanceStudent?: StudentLegalAcceptance;
  /** Vendedor: termo de confidencialidade aceite. */
  vendorConfidentiality?: VendorConfidentialityAcceptance;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantStatus = 'active' | 'suspended' | 'pending';

export type TenantDoc = {
  id: string;
  displayName: string;
  planId: string;
  status: TenantStatus;
  contacts?: string[];
  /**
   * Slug público para URL (`slug.dominioapex.com`). Índice espelhado em `tenantPublicSlugs/{slug}`.
   * Domínio próprio do cliente (planos superiores) será configurável à parte.
   */
  publicSlug?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantEntitlements = {
  tenantId: string;
  planId: string;
  /** Contrato comercial: principalmente `streaming` | `cursos` | `chat` | `vendedores`; tokens técnicos antigos ainda aceites. */
  enabledModuleIds: string[];
  limits: Record<string, number>;
  updatedAt: Date;
};

export type PlanDoc = {
  id: string;
  displayName: string;
  active: boolean;
  limits: Record<string, number>;
  /** Alinhado ao contrato comercial (ver `docs/MODULOS_IDS.md`). */
  includedModuleIds?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type CatalogModuleStatus = 'active' | 'beta' | 'hidden';

export type CatalogModuleDoc = {
  id: string;
  title: string;
  description?: string;
  /** Liga o item do catálogo ao módulo comercial (`streaming` \| `cursos` \| …). Deve igualar o id do doc para o MVP. */
  commercialModuleId: string;
  status: CatalogModuleStatus;
};

export type MarketplaceRequestStatus = 'pending' | 'approved' | 'rejected' | 'archived';

export type MarketplaceRequestDoc = {
  id: string;
  tenantId: string;
  tenantDisplayName?: string | null;
  moduleId: string;
  commercialModuleId: string;
  message?: string | null;
  status: MarketplaceRequestStatus;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  requestedByUid?: string | null;
  requestedByEmail?: string | null;
  handledByUid?: string | null;
  handledAt?: Date | null;
};

export type CompanyDoc = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  /** Níveis / funções configurados para esta empresa. */
  roles?: CompanyRoleDef[];
  /** Áreas / setores configurados para esta empresa. */
  departments?: CompanyDepartmentDef[];
  /** Domínios de e-mail aceitos no cadastro (ex.: ["empresa.com","gmail.com"]). Vazio = aceita todos. */
  allowedEmailDomains?: string[];
  createdAt: Date;
  updatedAt: Date;
};

/** Vídeo introdutório no catálogo público (URL Vimeo + título opcional na UI). */
export type CourseIntroVideo = {
  url: string;
  title?: string;
  /** Capa estática opcional (ex.: vídeos na página do canal). */
  coverImageUrl?: string;
};

export type CourseSummary = {
  id: string;
  title: string;
  description?: string;
  /** Texto longo exibido na home pública (“Sobre o curso”). */
  about?: string;
  /**
   * Vídeos Vimeo na home pública (ordem importa: o 1º no card da lista; todos na área expandida).
   * Itens podem ser só URL (legado) ou `{ url, title? }`; `introVimeoUrl` único é normalizado na leitura.
   */
  introVimeoUrls?: CourseIntroVideo[];
  /**
   * Imagem do card na seção “Programas” (home pública). Se preenchida, substitui o frame do 1º Vimeo no card.
   */
  catalogCardImageUrl?: string;
  /** Se true, curso aparece na home e pode ser lido sem login (somente catálogo). */
  catalogPublished?: boolean;
  /**
   * Se preenchido, o curso aparece na página pública `/canal/{channelId}` e deixa de listar em “Programas”.
   */
  channelId?: string;
};

/** Vídeo Vimeo na página dedicada do canal (conteúdo sem curso ou além do curso). */
export type ChannelPageVideo = {
  id: string;
  title: string;
  vimeoUrl: string;
  /** Capa do cartão (URL ou envio ao Storage no admin). */
  coverImageUrl?: string;
  description?: string;
  order: number;
};

/**
 * Canal na home Streaming (círculo com capa). Página pública `/canal/:id` com vídeos próprios e cursos ligados.
 */
export type CatalogChannel = {
  id: string;
  title: string;
  order: number;
  /** Capa circular na UI. */
  coverImageUrl?: string;
  /** Texto curto opcional acima dos vídeos na página do canal. */
  pageDescription?: string;
  /** Vídeos Vimeo só na página do canal (ex.: INTES sem curso). */
  pageVideos?: ChannelPageVideo[];
  /**
   * Legado: curso do catálogo antes de existir `channelId` no curso. Ainda usado como fallback na página do canal.
   */
  programCourseId?: string;
  /** Se false, só admin vê no painel; não aparece na home pública. */
  published: boolean;
};

/**
 * Banner promocional no topo do Streaming (acima dos Canais).
 * `linkUrl`: rota interna (ex. `/cursos?program=…`, `/streaming?entry=…`) ou URL absoluta.
 */
export type StreamingBanner = {
  id: string;
  /** Rótulo para admin e texto acessível (aria-label). */
  title: string;
  /** Imagem principal (desktop / fallback). */
  imageUrl: string;
  /** Imagem opcional para ecrãs estreitos; se vazio, usa `imageUrl` com object-fit. */
  imageUrlMobile?: string;
  linkUrl: string;
  order: number;
  published: boolean;
};

/** Trilha na home principal estilo streaming (ex.: Cardiologia, Psiquiatria). */
export type StreamingTrack = {
  id: string;
  title: string;
  order: number;
};

/** Vídeo/podcast Vimeo dentro de uma trilha. */
export type StreamingEntry = {
  id: string;
  title: string;
  vimeoUrl: string;
  /** URL HTTPS de imagem para capa do cartão; se vazio, usa o thumbnail do Vimeo. */
  coverImageUrl?: string;
  description?: string;
  order: number;
};

/** Liberação de curso para empresa (`allowedCourses/{courseId}`). */
export type CompanyCourseAssignment = {
  courseId: string;
  assignedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  /** Agendamento por módulo (abertura / fecho). */
  moduleSchedule?: Record<string, ModuleScheduleEntry>;
};

/** Linha para painel de prazos de liberação curso × empresa. */
export type AssignmentExpiryRow = {
  companyId: string;
  companyName: string;
  courseId: string;
  courseTitle: string;
  expiresAt: Date;
  daysRemaining: number;
  isExpired: boolean;
};

export type QuestionDef = {
  id: string;
  prompt: string;
  options: string[];
  audience?: ContentAudience;
};

export type ModuleMaterialLink = {
  title: string;
  description: string;
  pdfUrl: string;
  audience?: ContentAudience;
};

export type ModuleStepKind = 'materials' | 'video' | 'quiz';

/** Passos dentro do módulo (wizard: Materiais → vídeos → questões → anexos). */
export type ModuleStep = {
  id: string;
  title: string;
  order: number;
  kind: ModuleStepKind;
  body?: string;
  materials?: ModuleMaterialLink[];
  vimeoUrl?: string;
  questions?: QuestionDef[];
  audience?: ContentAudience;
  /** Se ausente ou vazio → herdam-se `visibleToRoles` do módulo. */
  visibleToRoles?: string[];
  /** Standby: gravado no Firestore / editor; não restringe visibilidade (só nível restringe). */
  visibleToDepartments?: string[];
};

export type ModuleContent = {
  id: string;
  title: string;
  content: string;
  vimeoUrl: string;
  pdfUrl: string;
  questions: QuestionDef[];
  order: number;
  steps?: ModuleStep[];
  audience?: ContentAudience;
  /** Restringir a determinados níveis (roleIds). Se ausente ou vazio → visível a todos os níveis. */
  visibleToRoles?: string[];
  /** Standby: departmentIds no dado; visibilidade efetiva só por `visibleToRoles` (nível). */
  visibleToDepartments?: string[];
};

/** Progresso por passo do módulo (rascunho local ou gravado ao finalizar); quiz usa `answers` no documento. */
export type ModuleStepProgress = {
  /** Vídeo assistido até ao fim (evento `ended` do player). */
  videoWatchedToEnd?: boolean;
  /** Utilizador confirmou leitura dos materiais do passo. */
  materialsDone?: boolean;
};

export type UserModuleSubmission = {
  answers: Record<string, number>;
  submittedAt: Timestamp | null;
  status: 'draft' | 'completed';
  stepProgress?: Record<string, ModuleStepProgress>;
};
