# Medivox — Plataforma de curso (decisão executiva)

Especificação enxuta para **decisão de arquitetura e custo**. Sem código de aplicação.  
Preços e cotas: [Firebase](https://firebase.google.com/pricing), [Firestore](https://cloud.google.com/firestore/pricing), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Fair use](https://vercel.com/docs/limits/fair-use-guidelines) (referência março/2026 — conferir fontes antes de fechar orçamento).

---

## 1. Produto

| Item | Descrição |
| --- | --- |
| Estrutura | **8 módulos** por curso |
| Conteúdo por módulo | Descrição textual, **vídeo Vimeo** (embed), **PDF** no **Firebase Storage** |
| Avaliação | **Perguntas objetivas** (ex.: múltipla escolha / V ou F); permite **score** futuro (acertos/erros) |
| Persistência | **Uma gravação por módulo** por aluno (um documento com todas as respostas daquele módulo) |
| Acesso | **Firebase Auth**; **catálogo de cursos** separado dos **dados por aluno**; matrícula define **quais cursos** cada `uid` pode ver |

---

## 2. Stack Medivox

| Camada | Escolha |
| --- | --- |
| Front | **Vite** + **React** + **TypeScript** |
| Roteamento | **react-router-dom** |
| UI | **Tailwind CSS**, ícones (ex.: lucide-react) |
| Formulários | **react-hook-form** + **zod** (validação no cliente; regras de negócio sensíveis na camada de dados) |
| Dados | **Firebase** — Auth, Firestore, Storage |
| Config no build | Variáveis **`VITE_*`** (somente **chaves públicas** do Firebase; **nunca** service account no repositório ou no bundle) |
| Repo / CI | **GitHub** + **GitHub Actions** (lint, build, deploy) |
| Hospedagem | **Vercel** (SPA estática após `vite build`) |

---

## 3. Arquitetura (visão)

- **Vercel**: entrega HTML/JS/CSS; vídeo não passa pelo seu host (Vimeo).
- **Firebase**: identidade, documentos do curso/respostas, arquivos PDF.
- **GitHub Actions**: pipeline até deploy na Vercel (secrets: token e IDs Vercel).

---

## 4. Modelo de dados Firestore — duas árvores paralelas

Premissa: **front replicável**; conteúdo e regras de acesso vivem no Firebase. Há **dois eixos** independentes que se cruzam pelo `courseId` (e pelo `uid` autenticado).

### 4.1 Catálogo (global, igual para todos os que têm acesso)

Conteúdo público **entre alunos matriculados** — não contém respostas.

```
courses/{courseId}                          — metadados do curso (título, descrição, ordem, ativo…)
courses/{courseId}/modules/{moduleId}        — informações do módulo: contexto, Vimeo, PDF, perguntas objetivas (enunciados + opções)
```

- **Alternativa** para poupar reads: um único doc `courses/{courseId}` com campo **`modules`** (array) trazendo os 8 módulos; **subcoleção** por módulo é melhor quando módulos crescem ou mudam com frequência isolada.
- Escrita no client **negada**; manutenção via **Console** ou **Admin SDK** / processo interno.

### 4.2 Por usuário (matrícula + progresso)

Dados **privados** do aluno.

```
users/{uid}
users/{uid}/courses/{courseId}              — matrícula / acesso (ex.: `enrolledAt`, `status`; confirma que este uid pode consumir este curso)
users/{uid}/courses/{courseId}/modules/{moduleId}  — respostas salvas (1 doc por módulo): `answers`, `submittedAt`, campos de score futuros
```

- **`users/{uid}`**: cadastro complementar ao Auth.
- **`users/{uid}/courses/{courseId}`**: documento leve que **amarra o aluno ao curso**. O app lista “meus cursos” com uma **query** nessa subcoleção; o front só carrega catálogo `courses/...` para `courseId`s aos quais o usuário está ligado.

### 4.3 Controle de acesso (lógica)

- **Listar cursos do aluno:** ler `users/{uid}/courses` → obter `courseId`s permitidos.
- **Abrir conteúdo:** ler `courses/{courseId}` e `courses/{courseId}/modules/...` **somente** se existir matrícula (validado nas **Security Rules** com `exists()` no path do usuário, ou claim customizada se um dia migrar para isso).
- **Salvar respostas:** escrita só em `users/{uid}/courses/{courseId}/modules/{moduleId}` com `request.auth.uid == uid` e, se desejado, regra que exige matrícula ativa.

### 4.4 Reads e writes (custos)

- **Writes** de progresso: continua **~1 write por módulo** salvo (um doc de respostas).
- **Reads** do catálogo: dependem de quantos docs de `courses/...` você busca por sessão; reutilizar estado no React e evitar listeners desnecessários mantém o custo baixo (ver [tabela de preços](https://cloud.google.com/firestore/pricing)).
- **Reads** extras: cada `exists()` / `get()` nas **rules** conta como leitura — equilibrar segurança e número de verificações.

**Storage:** PDFs alinhados ao catálogo (ex.: `courses/{courseId}/module-03.pdf`).

---

## 5. Segurança (cadastro, matrícula, catálogo e respostas)

Objetivo: **nada sensível depende só do frontend**; o browser só usa credenciais públicas do Firebase e o SDK — a **autorização** é **Firestore Security Rules** + **Storage Rules** (e Auth).

| Princípio | Aplicação |
| --- | --- |
| Sem segredos no client | Apenas `apiKey` e ids de projeto (públicos por desenho do Firebase). **Service account / Admin SDK** só em ambiente controlado (CI, Functions, servidor), se um dia forem necessários. |
| Dados por usuário | **Leitura/escrita** em `users/{uid}/...` **somente** se `request.auth.uid == uid`. |
| Matrícula | Criação do doc `users/{uid}/courses/{courseId}` pode ser **só Admin** (compra/liberação) ou fluxo controlado; o aluno **não** pode auto-matricular em curso pago sem regra explícita. |
| Catálogo `courses/...` | **Leitura** permitida só se o usuário estiver **matriculado** naquele `courseId` (verificação `exists` nas rules ou padrão equivalente). **Escrita** negada no client. |
| PDFs | Mesma lógica de “só quem tem curso”: paths no Storage por `courseId` + rules espelhando matrícula, ou URL assinada gerada com segurança. |
| LGPD | Política de dados, base legal e retenção — responsabilidade de produto/negócio; a arquitetura acima **não expõe** catálogo nem respostas entre usuários se as rules estiverem corretas. |

---

## 6. Custos agregados

### 6.1 Firebase (Firestore — primeiro banco)

| | Gratuito (diário/mensal conforme doc) | Blaze (excedente) |
| --- | --- | --- |
| Reads | 50k/dia | ~US$ 0,03 / 100k (região típica; ver [tabela](https://cloud.google.com/firestore/pricing)) |
| Writes | 20k/dia | ~US$ 0,09 / 100k |
| Deletes | 20k/dia | ~US$ 0,01 / 100k |
| Armazenamento | 1 GiB | Preço por GiB-mês na região escolhida |

**Ordem de grandeza:** 1 save por módulo/aluno mantém writes baixos; **pico de muitos alunos no mesmo dia** é o que mais desafia a cota diária.

**Auth:** faixa gratuita ampla para MAUs em uso típico ([preços Firebase](https://firebase.google.com/pricing)); SMS e fluxos especiais podem cobrar.

**Storage (PDFs):** cotas gratuitas dependem do tipo de bucket (legado vs `firebasestorage.app`); acima disso, armazenamento + download conforme [Firebase Pricing](https://firebase.google.com/pricing) / Cloud Storage.

### 6.2 Vercel — Hobby vs Pro

| | Hobby | Pro |
| --- | --- | --- |
| **Uso** | Projetos **pessoais e não comerciais** ([fair use](https://vercel.com/docs/limits/fair-use-guidelines)) | Profissional / **comercial permitido** |
| **Taxa de plataforma** | US$ 0 | **US$ 20/mês** por time (1 assento de deploy incluso) inclui **US$ 20 em crédito** de uso ([Pro plan](https://vercel.com/docs/plans/pro-plan)) |
| **Infra inclusa (Pro)** | — | **1 TB** Fast Data Transfer + **10M** Edge Requests/mês antes de consumir crédito/on-demand ([mesma fonte](https://vercel.com/docs/plans/pro-plan)) |
| **Fair use (referência)** | ~100 GB Fast Data Transfer/mês | ~1 TB/mês |
| **Assentos extras** | — | **US$ 20/mês** cada (Owner/Member); viewers somente leitura gratuitos |

**Transição uso pessoal → comercial:** o **código e o fluxo de deploy** permanecem os mesmos; o que muda é o **plano/contrato na Vercel** (Hobby → **Pro**) para alinhar aos [termos de uso comercial](https://vercel.com/docs/limits/fair-use-guidelines). Ajuste também variáveis/domínio no painel se necessário. **Firebase** não é “trocado de plano” na mesma frase: você pode continuar no **Spark** enquanto couber; **Blaze** entra quando precisar de recursos pagos ou excedentes.

---

## 7. CI/CD (mínimo)

1. Push em `main` → Action: `npm ci`, lint, `npm run build`, deploy Vercel.  
2. Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.  
3. Env de build na Vercel: `VITE_*` do Firebase (sem segredos de admin).

---

## 8. Decisões pendentes (curtas)

- Gabarito das objetivas: **só no servidor/Admin** (recomendado para anti-fraude em score) vs hash no doc do módulo — impacta se haverá **Cloud Functions** ou processamento offline.  
- Bucket Storage: tipo e região (impacta cotas gratuitas).  
- Orçamentos e alertas no **Google Cloud** ao habilitar **Blaze**.

---

## 9. Links oficiais

- [Firebase Pricing](https://firebase.google.com/pricing) · [Firestore billing](https://firebase.google.com/docs/firestore/pricing) · [Firestore preços GCP](https://cloud.google.com/firestore/pricing)  
- [Vercel Pro](https://vercel.com/docs/plans/pro-plan) · [Vercel Pricing](https://vercel.com/pricing) · [Hobby](https://vercel.com/docs/plans/hobby) · [Fair use](https://vercel.com/docs/limits/fair-use-guidelines)
