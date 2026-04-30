# Medivox — Plataforma de cursos corporativos (B2B)

Documentação da aplicação web para empresas oferecerem formação a colaboradores: **autenticação Firebase**, conteúdo e progresso no **Firestore**, cadastro por **empresa** (slug + chave de acesso), **site público** (experiência tipo streaming + catálogo de cursos), **assistente de IA** (Gemini) na home e no percurso do aluno, área **administrativa** e área **vendedor** (carteira de empresas e relatórios).

Este ficheiro serve de referência para **produção**, onboarding de novas pessoas e para quem voltar ao projeto depois de tempo sem trabalhar nele.

### Estado do produto (abril 2026)

- **Áreas de produto:** **Education** (cursos, B2B, admin, vendedor) e **Streaming** (home pública, canais, ligação ao restante do produto). O núcleo da SPA e das **Cloud Functions** está implementado; evoluções e manutenção de longo prazo dependem de priorização com a equipa de produto.
- **Infra e ambientes:** *front-end* servido em **Firebase Hosting** (a stack **não** usa Vercel). O repositório está no **GitHub**. Existem **dois projectos Firebase** (Google Cloud), um para **desenvolvimento** e outro para **produção**, com Firestore, Authentication, Storage e Cloud Functions **separados** por ambiente. O *deploy* contínuo (incl. *preview* de PRs no projeto de desenvolvimento) está em `.github/workflows/deploy.yml`; validação de qualidade em `ci.yml`.

---

## Índice

1. [Estado do produto (abril 2026)](#estado-do-produto-abril-2026) · [Estado do projeto, ambientes e stack](#estado-do-projeto-ambientes-e-stack)
2. [Papéis de utilizador e matriz de acesso](#papéis-de-utilizador-e-matriz-de-acesso)
3. [Funcionalidades por área](#funcionalidades-por-área)
4. [LGPD, termos e aceites obrigatórios](#lgpd-termos-e-aceites-obrigatórios)
5. [Segurança (autenticação, senhas, dados e regras)](#segurança-autenticação-senhas-dados-e-regras)
6. [Modelo de dados no Firestore (resumo)](#modelo-de-dados-no-firestore-resumo)
7. [Assistente de IA (chat)](#assistente-de-ia-chat)
8. [Cloud Functions](#cloud-functions)
9. [Mapa de rotas](#mapa-de-rotas)
10. [Estrutura do repositório](#estrutura-do-repositório)
11. [Variáveis de ambiente](#variáveis-de-ambiente)
12. [Scripts, seeds e CI/CD](#scripts-seeds-e-cicd)
13. [Primeiro administrador](#primeiro-administrador)
14. [Documentação adicional](#documentação-adicional)

---

## Estado do projeto, ambientes e stack

| Área | Situação |
|------|----------|
| **SPA** | Desenvolvimento local (`npm run dev`) e build (`npm run build` / `npm run build:dev` conforme `.env.*`). |
| **Hospedagem do *front-end*** | **Firebase Hosting** (artefactos `dist/` em `firebase.json`). **Não** há *deploy* do *front* na Vercel. |
| **Dois ambientes** | Dois **projectos Firebase** (IDs distintos no Google Cloud): um de **desenvolvimento** e um de **produção** — cada um com o seu Firestore, Auth, Storage, Functions e regras implantadas a partir do mesmo código. Ficheiro `.firebaserc` com *aliases*; *secrets* no GitHub separados para `*_DEV` e produção. |
| **CI/CD** | **`ci.yml`:** `npm ci`, lint e *build* nas branches `main` e `dev`. **`deploy.yml`:** *push* em `dev` → *Hosting* (canal *live*) e *backend* no projeto **dev**; *push* em `main` → idem no projeto **prod**; **PRs** → *preview* de Hosting **só** no projeto dev, sem tocar no Firestore de produção. |
| **Firebase (cliente)** | Authentication + Firestore; regras `firestore.rules`; índices `firestore.indexes.json`. |
| **Cloud Functions** | Código em `functions/` (Node/TypeScript). Plano **Blaze** e *deploy* das functions em cada ambiente conforme o fluxo acima. |
| **Vídeo / IA** | Vídeo alojado no **Vimeo** (conta/contrato do cliente). Assistente: **Google Gemini** via *backend* (sem chave exposta no *front*). |
| **Curso demo** | ID típico `demo` (“Saúde Mental nas Empresas”), gerado/importado via `scripts/`; o seed de analytics **não** deve alterar o conteúdo pedagógico desse curso. |

**Stack técnica (resumo)**

- **Front-end:** React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7, Recharts (métricas), jsPDF (relatórios PDF do vendedor).
- **Backend / dados:** Firebase (Authentication, Firestore, Storage), Cloud Functions 2.ª geração; região alinhada a `VITE_FIREBASE_FUNCTIONS_REGION` (ex.: `southamerica-east1`).
- **Repositório e automação:** GitHub; *workflows* em `.github/workflows/`.
- **Monorepo lógico:** SPA na **raiz** (`src/`, `public/`); `functions/` separado; `firebase.json` e `.firebaserc` na raiz.

---

## Papéis de utilizador e matriz de acesso

O sistema distingue três **papéis** no documento `users/{uid}` (`role`): **`admin`**, **`student`** (aluno/colaborador) e **`vendedor`**. O **papel dentro da empresa** (`companyRole`: `gestor` ou `colaborador`) só se aplica a alunos e é definido pela **chave de acesso** usada no cadastro.

| Papel | Quem cria | Acesso principal |
|-------|-----------|------------------|
| **Administrador** | Manual no Firestore (primeiro user) ou processo interno da equipa | Painel `/admin`: empresas, cursos, liberações e prazos, streaming da home, vendedores, métricas globais, conta. **Lê e escreve** conteúdo de curso, empresas, `answerKeys`, etc., conforme `firestore.rules`. |
| **Aluno (`student`)** | Cadastro em `/{slug}/cadastro` via Cloud Function `registerWithCompany` (com chave válida) | Cursos matriculados + liberados para a empresa; perfil; certificados. **Não** lê `answerKeys`. Só altera o próprio perfil com restrições (não muda `role`, `companyId`, `cpf`). Progresso em subcoleções `users/{uid}/courses/{courseId}/modules/`. |
| **Vendedor** | Admin via callable `adminCreateVendedor` | Relatórios e métricas apenas das empresas em `managedCompanyIds`; leitura de alunos/progresso/certificados **só** dessas empresas. Demo de cursos em `/vendedor/cursos` e `/vendedor/curso/:courseId` (comportamento de demonstração). **Lê** `answerKeys` (relatórios). Após criação: **obriga** troca de senha provisória e aceite do termo de confidencialidade antes do painel principal. |

**Regras gerais de navegação**

- Login em `/login` redireciona por `role`: admin → `/admin`; vendedor → `/vendedor/definir-senha` ou `/vendedor`; aluno → **`/`** (home streaming) ou rota guardada em `state.from` (ex.: `/perfil`).
- A rota antiga **`/meus-cursos`** redireciona para **`/cursos`** (lista de cursos do aluno no mesmo layout público que o streaming).
- Vendedor autenticado **não** acede às rotas de aluno no site público (`/cursos`, `/curso/...`): é redirecionado para o fluxo `/vendedor/...`.
- Rotas `/admin/*` exigem `role === 'admin'` (`AdminRoute`).
- Rotas `/vendedor/*` (exceto definir senha e aceitar confidencialidade) exigem vendedor + senha definitiva + confidencialidade aceite (`VendedorRoute`).

---

## Funcionalidades por área

### Site público (`PublicLayout`)

- **Home `/`:** trilhas estilo streaming (`streamingTracks` / `entries`), vídeos Vimeo, dados públicos; navegação secundária **Início | Cursos**.
- **`/cursos`:** visitante vê o **catálogo público** (`catalogPublished`); aluno autenticado vê os **cursos disponíveis** (matrícula + liberações da empresa).
- **`/curso/:courseId`:** consumo do curso (módulos, vídeo, materiais, quiz) no mesmo layout — o aluno mantém acesso rápido ao streaming e à lista de cursos.
- **Menu Conta** (canto superior, utilizador autenticado): atalhos para início/streaming, cursos, área do aluno (`/perfil`), certificados e **sair**; admin/vendedor em páginas públicas vêem entradas adequadas ao papel.
- **Documentos legais:** termos de uso, política de privacidade, compromissos do participante, termo de confidencialidade do vendedor (URLs dedicadas — ver [mapa de rotas](#mapa-de-rotas)).
- **Rodapé legal** nas páginas que usam o layout público ou convidado, com links para esses documentos.

### Convidado (antes do login)

- `/login`, `/esqueci-senha`, `/registro` (redireciona conforme política atual).
- `/:companySlug/login` e `/:companySlug/cadastro`: cadastro B2B com chave de acesso (validação forte na Cloud Function quando deployada).
- Overlay de boas-vindas na home e no cadastro por empresa (`/:slug/cadastro`); **Entrar** no cabeçalho público. Sem sessão, o **assistente de IA** só convida a iniciar sessão (ver [Assistente de IA](#assistente-de-ia-chat)).

### Aluno / colaborador

- **Cadastro:** formulário com aceite obrigatório dos três documentos (termos, privacidade, compromissos) na **versão** sincronizada com o servidor; a function recusa cadastro sem isso ou com versões incorretas.
- **Após login:** destino por defeito é a **home streaming** (`/`); **perfil** e **certificados** permanecem em `/perfil` e `/certificados` (layout com `AppHeader` dedicado).
- **Cursos:** interseção entre matrícula (`users/{uid}/courses/...`) e liberações da empresa (`companies/{id}/allowedCourses/...`); empresa **inativa** bloqueia uso; prazos (`expiresAt`) respeitados.
- **Assistente de IA** na home, na lista de cursos e **dentro do curso** — ajuda pedagógica; **não** deve responder a perguntas de avaliação (regra reforçada no servidor; ver [Assistente de IA](#assistente-de-ia-chat)).
- **Módulos:** passos (`steps`) — vídeo (Vimeo), materiais/PDFs, quiz; audiência por conteúdo (`gestor` / `colaborador` / `all`) quando aplicável.
- **Progresso:** lógica de conclusão de passos (vídeo até ao fim, materiais, quiz); rascunho local reduz escritas frequentes; sincronização com Firestore alinhada ao fecho do módulo / regras de negócio definidas no código.
- **Perfil:** dados pessoais e vínculo com a empresa.
- **Certificados:** documentos emitidos com campos validados na criação (incl. código de verificação).

### Vendedor

- **Carteira:** `managedCompanyIds` em `users/{uid}`; todas as leituras sensíveis respeitam essa lista nas **regras Firestore**.
- **Relatórios:** gráficos e tabelas no estilo do admin, filtrados à carteira; exportação PDF por empresa e visão agregada.
- **Métricas:** distribuição de respostas com títulos de módulo e texto de pergunta (quando disponíveis nos dados), para leitura humana nos gráficos.
- **Primeiro acesso:** senha provisória definida pelo admin → fluxo `/vendedor/definir-senha` → aceite de confidencialidade `/vendedor/aceitar-confidencialidade` → painel.

### Administrador

- **Empresas:** CRUD (criação gera chaves gestor/colaborador; eliminação é destrutiva e remove utilizadores ligados à empresa).
- **Cursos:** editor completo, catálogo, “empresas com acesso” por curso.
- **Visão geral** (`/admin`): resumo em alto nível (totais e tabela por empresa).
- **Dashboard** (`/admin/dashboard`): métricas e engajamento por curso/empresa, gráficos e prazos.
- **Streaming** da home pública (CRUD de trilhas e entradas).
- **Vendedores:** criar, atualizar carteira, eliminar.
- **Pré-visualização** de curso possível com query `preview=admin` a partir do painel (nova janela).

---

## LGPD, termos e aceites obrigatórios

A plataforma trata dados pessoais (ex.: e-mail, nome, CPF de colaboradores) e dados de progresso formativos. A conformidade jurídica final é responsabilidade da **organização operadora** e do **encarregado/DPO**; o software ajuda com **transparência** (páginas legais), **registo de versões** e **aceites explícitos** onde o fluxo exige.

### Versões dos documentos (fonte de verdade)

- Ficheiros **`src/legal/legalVersions.ts`** (SPA) e **`functions/src/legalVersions.ts`** (Cloud Functions) devem estar **alinhados**.
- Ao publicar nova versão de um texto legal (revisão jurídica), **incrementar** a versão em ambos e fazer deploy das **functions** e do **front** para que cadastros e aceites usem a mesma referência.

### Cadastro do aluno (colaborador)

- **Obrigatório:** o utilizador deve aceitar, no formulário de `/{slug}/cadastro`, os **Termos de uso**, a **Política de privacidade** e os **Compromissos do participante** (checkboxes / fluxo UI).
- A Cloud Function **`registerWithCompany`** valida que o payload inclui `legalAcceptance` com as **três** versões **iguais** às constantes do servidor. Caso contrário, o cadastro é **recusado**.
- No Firestore, fica registado em `users/{uid}` algo como `legalAcceptanceStudent`: versões aceites e `acceptedAt` (timestamp do servidor), para auditoria.

### Vendedor

- O cadastro do vendedor é feito pelo **admin** (senha provisória); não há fluxo de “termos completos” idêntico ao do aluno no primeiro momento.
- **Antes de usar o painel**, o vendedor deve aceitar o **Termo de confidencialidade** na rota dedicada; a callable **`vendedorAcceptConfidentiality`** valida a **versão** contra `LEGAL_VERSIONS.vendorConfidentiality` e grava `vendorConfidentiality` (versão + `acceptedAt`) em `users/{uid}`.
- A página pública do texto está em **`/confidencialidade-vendedor`** (conteúdo editável em `src/legal/`).

### Administrador

- Não há fluxo extra de aceite legal na aplicação para a conta admin; o acesso admin deve ser tratado como **conta privilegiada** (procedimentos internos, MFA no e-mail da organização quando possível, etc.).

### Onde ler os textos

- Conteúdo dos documentos: componentes em `src/legal/content/` e páginas em `src/pages/legal/`.
- **Não** confundir os slugs reservados de URL (`termos`, `privacidade`, etc.) com slugs de empresa — estão bloqueados na criação de empresas e nas functions.

---

## Segurança (autenticação, senhas, dados e regras)

### Autenticação e senhas

- **Firebase Authentication** gere passwords (não armazenadas em texto claro no Firestore). Política mínima reforçada na app e nas functions (ex.: **mínimo 6 caracteres** no cadastro B2B e vendedor).
- **Recuperação de senha:** fluxo nativo Firebase (`/esqueci-senha`).
- **Vendedor:** senha provisória definida pelo admin; flag `mustChangePassword` obriga troca antes do uso normal do painel.

### Chaves de acesso da empresa (cadastro B2B)

- As chaves **gestor** e **colaborador** geradas na criação da empresa são mostradas ao admin e armazenadas em texto **apenas** no documento de arquivo (`companies/{id}/adminRegistrationKeys/archive`) para consulta do operador.
- No documento da empresa guardam-se **apenas hashes** (SHA-256 com salt por tipo de chave). A validação na **`registerWithCompany`** compara hash da chave introduzida com os valores guardados.
- Chaves incorretas, empresa inativa ou CPF duplicado na mesma empresa bloqueiam o cadastro.

### Firestore

- Ficheiro **`firestore.rules`**: autorização por `role`, empresa ativa, matrícula e liberações de curso; vendedor só lê dados de alunos das empresas da carteira; **`answerKeys`** legível por **admin** e **vendedor**, **não** por aluno.
- Criação de documentos `users/{uid}` **não** é permitida diretamente do cliente (`allow create: if false`); perfis de utilizadores em contexto de registo passam pelas **Cloud Functions** com Admin SDK.
- **Streaming** e entradas: leitura pública, escrita só admin.

### Cloud Functions

- Callables sensíveis exigem utilizador autenticado e, quando aplicável, verificação de papel **admin** no Firestore (`assertIsAdmin`).
- **CORS** das callables: lista de origens (localhost, domínios Firebase Hosting, `*.web.app`, e opcionalmente `CALLABLE_CORS_ORIGINS` no ambiente das functions) para o browser poder invocar as funções.

### Boas práticas de operação

- Nunca commitar `.env`, chaves JSON de service account nem listas de passwords.
- Considerar **App Check** (reCAPTCHA v3) para reduzir abuso de APIs públicas — ver comentários em `.env.example`.
- Deploy de regras após alterações: `firebase deploy --only firestore:rules` (e índices se necessário).

---

## Modelo de dados no Firestore (resumo)

| Coleção / caminho | Uso principal |
|-------------------|----------------|
| `users/{uid}` | Perfil: `role`, `companyId`, `cpf`, aceites legais, vendedor `managedCompanyIds` / `mustChangePassword` / `vendorConfidentiality`. |
| `users/{uid}/courses/{courseId}` | Matrícula (`enrolledAt`, etc.). |
| `users/{uid}/courses/{courseId}/modules/{moduleId}` | Progresso do módulo (passos, quiz, etc.). |
| `users/{uid}/certificates/{courseId}` | Certificado emitido. |
| `companies/{companyId}` | Nome, `slug`, `active`, hashes de chaves + salts. |
| `companies/{companyId}/allowedCourses/{courseId}` | Liberação e opcionalmente `expiresAt`. |
| `companies/{companyId}/adminRegistrationKeys/archive` | Chaves em texto para o admin (gestor/colaborador). |
| `courses/{courseId}` e `.../modules/{moduleId}` | Conteúdo pedagógico editado pelo admin. |
| `answerKeys/{docId}` | Gabaritos para métricas (não expostos ao aluno). |
| `streamingTracks/{trackId}` e `.../entries/{entryId}` | Home streaming pública. |
| `assistantQuota/{uid}/daily/{YYYY-MM-DD}` | Contagem de mensagens do assistente de IA (janela diária; ver secção seguinte). |

---

## Assistente de IA (chat)

Chat contextual alimentado por **Google Gemini** (via Cloud Function `streamingAssistantChat`). Documentação de operação e custos: **[docs/ASSISTENTE_IA_MEDIVOX.md](./docs/ASSISTENTE_IA_MEDIVOX.md)**.

### Onde aparece

- Botão flutuante nas rotas **`/`**, **`/cursos`** e **`/curso/:courseId`** (layout público).
- **Login obrigatório** para enviar mensagens; visitante vê apenas convite a entrar.

### O que o modelo pode usar (contexto no servidor)

- **Streaming:** todas as trilhas e entradas configuradas na home, com transcrições quando disponíveis (Vimeo).
- **Cursos:** cursos publicados no catálogo (texto para descoberta na aba Cursos).
- **Vídeo em destaque:** se o aluno abriu um vídeo em destaque na home, enviam-se `focusTrackId` + `focusEntryId` e a respetiva transcrição para perguntas do tipo “o que estou a ver”.
- **Modo curso:** com o aluno em **`/curso/:courseId`**, enviam-se `courseId` e título; o *system prompt* instrui o modelo a **não** responder a perguntas de **testes, questionários ou avaliações** (anti-cola). Pode explicar conceitos, dar exemplos genéricos e apoiar o estudo sem resolver itens de prova.

### Limites e quota

- **30 mensagens por utilizador autenticado e por dia** (dia civil em **America/Sao_Paulo**).
- Ao exceder, a function devolve erro `resource-exhausted` com texto indicando **quando recomeça a contagem** e **tempo aproximado até à meia-noite** em Brasília.

### Segredos e deploy

- Chave Gemini: secret **`GOOGLE_API_KEY`** nas Cloud Functions (não substituir por `.env` só no cliente).
- Modelo opcional: parâmetro `GEMINI_MODEL` (predefinição atual: `gemini-2.5-flash` na API Google AI).
- Após alterações na function ou no prompt: `firebase deploy --only functions:streamingAssistantChat` (ou pacote `functions` completo).

---

## Cloud Functions

| Function | Papel |
|----------|--------|
| **`registerWithCompany`** | Cadastro validado por slug, chaves (hash), empresa ativa, CPF, versões legais; cria Auth + Firestore + matrículas nos cursos liberados ativos. |
| **`adminCreateCompany`** | Cria empresa, salts e hashes de chaves; devolve chaves em claro uma vez para o admin. |
| **`adminDeleteCompany`** | Remove empresa, vínculos, chaves e **utilizadores** associados (operação destrutiva). |
| **`adminCreateVendedor`** | Cria utilizador vendedor com senha provisória e `mustChangePassword`. |
| **`adminUpdateVendedorCompanies`** | Atualiza `managedCompanyIds`. |
| **`adminDeleteVendedor`** | Remove vendedor (Auth + dados). |
| **`vendedorClearMustChangePassword`** | Limpa `mustChangePassword` após definir senha definitiva. |
| **`vendedorAcceptConfidentiality`** | Regista aceite do termo de confidencialidade com versão validada no servidor. |
| **`logStreamingView`** | Métricas ao abrir vídeo em destaque na home (callable autenticada). |
| **`streamingAssistantChat`** | Chat Gemini: contexto streaming + cursos + foco opcional + modo curso; quota diária; exige Auth. |

Sem **Blaze** / sem deploy das functions: utilizadores já criados e grande parte do Firestore podem ser testados; **cadastro por empresa**, criação de empresas/vendedores pelo painel e aceites que dependem das callables exigem deploy.

**PowerShell (Windows):** ao usar `firebase deploy --only` com vários alvos, usar aspas, por exemplo:

`firebase deploy --only "functions,firestore:rules"`

---

## Mapa de rotas

### Site público (com ou sem login)

| Rota | Descrição |
|------|-----------|
| `/` | Home estilo streaming (trilhas Vimeo); assistente de IA (com login). |
| `/cursos` | Catálogo para visitante; **meus cursos** (matrícula) para aluno autenticado; assistente de IA (com login). |
| `/curso/:courseId` | Curso (aluno autenticado + regras de matrícula); assistente em **modo curso** (anti-cola no servidor). |
| `/termos` | Termos de uso. |
| `/privacidade` | Política de privacidade. |
| `/compromissos` | Compromissos do participante. |
| `/confidencialidade-vendedor` | Termo de confidencialidade (vendedor). |

### Convidado (layout com atalhos e rodapé legal)

| Rota | Descrição |
|------|-----------|
| `/login` | Login por e-mail. |
| `/esqueci-senha` | Recuperação de senha. |
| `/registro` | Redireciona conforme política atual. |
| `/:companySlug/login` | Login contextual. |
| `/:companySlug/cadastro` | Cadastro com chave + aceites legais (aluno). |

### Aluno (`role === "student"`)

| Rota | Descrição |
|------|-----------|
| `/cursos` | Lista de cursos permitidos + matrícula (substitui a antiga `/meus-cursos`). |
| `/meus-cursos` | Redireciona para `/cursos`. |
| `/curso/:courseId` | Curso, módulos, vídeo, materiais, quiz (no `PublicLayout`; ver acima). |
| `/perfil` | Perfil, CPF, empresa. |
| `/certificados` | Certificados obtidos. |

### Vendedor (`role === "vendedor"`)

| Rota | Descrição |
|------|-----------|
| `/vendedor` | Início — resumo da carteira e atalhos. |
| `/vendedor/relatorios` | Relatórios detalhados (métricas, PDFs, prazos). |
| `/vendedor/documentacao` | Material de apoio à venda (modelo B2B e roteiro por curso). |
| `/vendedor/cursos` | Demo do catálogo. |
| `/vendedor/curso/:courseId` | Curso em modo demonstração. |
| `/vendedor/definir-senha` | Primeiro acesso (`mustChangePassword`). |
| `/vendedor/aceitar-confidencialidade` | Aceite obrigatório do termo antes do painel. |

### Administrador (`role === "admin"`)

| Rota | Descrição |
|------|-----------|
| `/admin` | Visão geral (resumo da plataforma). |
| `/admin/dashboard` | Dashboard — métricas, gráficos e filtros. |
| `/admin/metricas` | Redireciona para `/admin/dashboard` (URL antiga). |
| `/admin/empresas` | Empresas. |
| `/admin/empresas/:companyId` | Detalhe: cursos liberados, prazos. |
| `/admin/cursos` | Catálogo e acessos por curso. |
| `/admin/cursos/novo`, `/admin/cursos/:courseId/edit` | Editor de curso. |
| `/admin/streaming` | Trilhas da home pública. |
| `/admin/vendedores` | Vendedores. |
| `/admin/conta` | Conta do admin. |

---

## Estrutura do repositório

```
Medivox/
├── .github/workflows/     # CI e deploy Firebase (dev + prod)
├── docs/                  # Documentação suplementar (índice em docs/README.md)
├── functions/             # Cloud Functions (Firebase)
├── public/                # Assets estáticos (favicons, logos)
├── scripts/               # Seeds e utilitários
├── src/
│   ├── components/        # UI, layouts, auth guards, curso, legais
│   ├── contexts/          # Auth
│   ├── lib/               # Firebase, Firestore, analytics, PDF, Vimeo, progresso
│   ├── legal/             # Versões e conteúdo dos textos legais
│   ├── pages/             # Rotas (admin, vendedor, público, aluno, legais)
│   └── types/
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── package.json
└── vite.config.ts
```

Ficheiros de imagem soltos na **raiz** do repo: se não forem referenciados pelo código, preferir movê-los para `public/` e evitar duplicados.

---

## Variáveis de ambiente

- **Local:** copiar **`.env.development.example`** → **`.env.development`** (projeto Firebase **dev**) para o dia a dia com `npm run dev`. Opcionalmente **`.env.production.example`** → **`.env.production`** se precisares de `npm run build` / `npm run preview` contra **prod** na máquina.
- **Índice / explicação dos modos Vite:** **`.env.example`** (só documentação; não precisa de copiar para outro nome).
- **CI:** os valores vêm dos **secrets** em `deploy.yml` (`VITE_*` em `main`, `VITE_*_DEV` em `dev` / PRs).
- **Nunca** commitar `.env`, `.env.development`, `.env.production` nem JSON de service account.
- **App Check** e **Saúde Mental:** ver comentários nos `.env.*.example`.

---

## Scripts, seeds e CI/CD

| Comando | Descrição |
|---------|-----------|
| `npm run seed:build-demo` | Gera JSON do curso **demo**. |
| `npm run seed:firestore` | Importa para o Firestore (Admin SDK; `GOOGLE_APPLICATION_CREDENTIALS`). |
| `npm run seed:b2b-standby` | Cenário B2B de teste. |
| `npm run seed:analytics-demo` | Dados sintéticos para métricas (sem reescrever o conteúdo pedagógico do `demo`). |

**Comandos frequentes**

```bash
npm install
npm run dev
npm run lint
npm run build        # modo production (usa .env.production se existir)
npm run build:dev    # modo development (usa .env.development)
npm run preview
```

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

- **`ci.yml`:** lint + build.
- **`deploy.yml`:** Firebase Hosting + Firestore, Storage e Cloud Functions; merge em **`dev`** só no projeto dev, em **`main`** só em prod; PRs geram só preview de Hosting no dev.

---

## Primeiro administrador

Criar em Firestore `users/{uid}` alinhado ao UID do Firebase Authentication, com `role: "admin"`, `name`, `email`, e campos de data coerentes com o restante modelo. Sem este documento, o utilizador autenticado não é reconhecido como admin pelas regras e pela UI.

---

## Documentação adicional

Material mais detalhado em **`docs/`** — ver **[docs/README.md](docs/README.md)** (setup manual, importação Firestore, dados de exemplo, arquitetura do modelo de curso, **assistente de IA**).

Para **visão de negócio, conformidade (LGPD), textos legais e segurança** orientada a decisores, ver **[docs/DOCUMENTACAO_NEGOCIO_CONFORMIDADE_MEDIVOX.md](docs/DOCUMENTACAO_NEGOCIO_CONFORMIDADE_MEDIVOX.md)**.

---

## `.gitignore` (resumo)

Ignora `node_modules/`, `dist/`, `functions/lib/`, `.env`, pastas `secrets/`, chaves `*-firebase-adminsdk-*.json`, e padrões de notas locais com possíveis credenciais em `docs/`. Mantém versionado **`.env.example`** (sem secrets reais em produção).

---

*Atualizar este README quando mudarem rotas críticas, regras Firestore, functions (incl. assistente de IA), fluxos LGPD ou política de deploy.*
