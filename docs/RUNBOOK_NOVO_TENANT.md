# Runbook: novo cliente (tenant) e site público

Checklist operacional para **onboarding** de um cliente B2B no modelo multi-tenant **num único projeto Firebase**, alinhado a `docs/PLANO_MODULAR_MARKETPLACE_MULTITENANT.md` e às fases `FASE1`–`FASE3`.

## Pré-requisitos

- Utilizador com claim **`master_admin`** (ver `docs/FASE3_CONSOLE_MASTER.md` e `npm run master:set-claim`).
- Rules e índices Firestore publicados quando o repositório exigir (`firebase deploy --only firestore:rules,firestore:indexes`).

## 1. Criar o tenant no console master

1. Autenticar-se com conta **master** e abrir **`/master`**.
2. **Novo tenant** (ou equivalente na UI): criar documento em `tenants/{tenantId}` com os metadados acordados (`displayName`, estado, etc.).
3. Em **`tenants/{tenantId}/entitlements/current`**: associar **plano** (`planId`), **módulos** (`enabledModuleIds`) e **limites** (`limits`), conforme `docs/PLANOS_LIMITES_RASCUNHO.md`.
4. Definir **`publicSlug`** no tenant e gravar; o fluxo no master mantém **`tenantPublicSlugs/{slug}`** alinhado à resolução pública (subdomínio ou path `/{slug}/…`).

## 2. URL pública e branding

1. Se usar **apex + path**: confirmar que o slug não está em `RESERVED_SLUGS` (ex.: `master`, `admin`, `login` — ver Cloud Functions e documentação).
2. Testar **`/{publicSlug}`** (e rotas filhas: streaming, login, cadastro) no ambiente alvo.
3. Opcional: em **`tenants/{tenantId}/public/branding`**, configurar identidade visual; o admin do cliente pode usar **`/admin`** → identidade quando o perfil tiver `tenantId` / contexto correto.

## 3. Empresa (`companies`) e cadastro por link

1. Criar ou reutilizar documento em **`companies/{companyId}`** (slug interno de cadastro, chaves de acesso, domínios de e-mail, cursos liberados).
2. **Ligação ao tenant de faturamento**: se `tenantId` do contrato **não** for igual ao `companyId`, no painel **`/admin/empresas/:companyId`** preencher **Tenant para limites de plano** e **Guardar ligação** (campo `companies.tenantId`). Caso contrário, deixar vazio: a callable **`registerWithCompany`** usa **`companyId`** como chave em `tenants/{id}/entitlements/current`.
3. Garantir **`limits.maxActiveUsers`** (ou ausência do limite) no `entitlements` do tenant escolhido; valor numérico **> 0** ativa o bloqueio quando a contagem de utilizadores com aquele `companyId` atinge o teto.

## 4. Primeiro administrador do cliente

1. No **`/master/tenants/{tenantId}`**, secção **«Primeiro administrador do cliente»**: preencher nome, e-mail e **«Criar conta e descarregar PDF»**. A callable **`masterInviteTenantAdmin`** cria Auth + `users/{uid}` com `role: admin` e `tenantId`, define **custom claim** `tenantId` no token, gera link de **definir senha** e devolve dados ao browser; a app **gera um PDF** (instruções, URLs, módulos em `entitlements`) para o master enviar **manualmente** ao cliente.
2. **Firebase Console → Authentication → Authorized domains**: deve incluir o host usado na app (o mesmo que `window.location.origin` quando o master usa esta página), senão `generatePasswordResetLink` falha.
3. **«Esqueci a senha»** no login funciona com o mesmo e-mail se o link do PDF expirar ou falhar.
4. Fluxo legado: continua possível criar manualmente o doc **`users/{uid}`** + Auth (ex.: operações antigas com `companyId`).
5. O admin acede a **`/admin`** no mesmo host da SPA após autenticação.

## 5. Validação mínima antes de go-live

- [ ] Login na SPA (normalmente **`/login`** no apex; rotas `/:companySlug/login` para empresas B2B).
- [ ] Cadastro por link `/{slug_empresa}/cadastro` com chave válida.
- [ ] Com `maxActiveUsers` baixo de teste: último cadastro deve devolver erro **`resource-exhausted`** com mensagem clara.
- [ ] Módulos visíveis alinhados a `enabledModuleIds` / índice público.

## 6. Referências rápidas no código

- Resolução de tenant no browser: `PublicTenantProvider`, `src/lib/tenantHost.ts` (path / host).
- Enforcement de limite no cadastro: **`registerWithCompany`** em `functions/src/index.ts`.
- Convite master: **`masterInviteTenantAdmin`** em `functions/src/index.ts`; PDF no cliente em **`src/lib/pdf/tenantAdminInvitePdf.ts`**.
- Tipos e parse de empresa: `CompanyDoc.tenantId`, `parseCompanyData` em `src/lib/firestore/admin.ts`.

---

*Manter este ficheiro atualizado quando o fluxo de criação de tenant passar a ser 100% automatizado por Functions.*
