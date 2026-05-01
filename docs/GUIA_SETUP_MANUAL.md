# Plataforma de streaming educacional — Guia manual (Firebase, Vercel, GitHub)

Checklist do que **você** precisa executar nos consoles e serviços. O assistente não substitui login na sua conta Google/GitHub/Vercel.

**Entendimento alinhado com o produto**

- **Login, cadastro e “esqueci minha senha”** no mesmo espírito do MRBarber: e-mail/senha no Firebase Auth, fluxo de **redefinição de senha** por e-mail (`sendPasswordResetEmail`), formulários com validação no cliente.
- **Gabarito das questões objetivas:** fica **somente no Firebase**, na área do **curso/módulo**, em estrutura que o **aluno não consegue ler** (ver nota abaixo sobre Firestore). O app do aluno exibe enunciado e opções **sem** expor índice ou resposta correta. **Comparação com respostas** e **dashboard** ficam para uma fase posterior (ex.: Admin SDK, Cloud Function ou app interno).
- **Respostas do usuário** continuam em `users/{uid}/courses/{courseId}/modules/{moduleId}` (ou equivalente), separadas do gabarito.

**Nota técnica — gabarito e Security Rules**

No Firestore, se o aluno tiver permissão de **ler** um documento, ele lê **todas** as chaves daquele documento. Por isso o gabarito **não** deve ficar no mesmo documento que o aluno lê para montar a prova. Opções usuais: (1) documento **irmão** ou subcoleção **só leitura Admin** (regras `allow read: if false` para client autenticado aluno); (2) segundo documento com sufixo path diferente e regras restritivas. O repositório Plataforma de streaming educacional, quando existir, deve trazer **regras** e **modelo de campos** coerentes com isso.

---

## 1. Pré-requisitos

- Conta **Google** (Firebase / GCP).
- Conta **GitHub** (repositório do código Plataforma de streaming educacional).
- Conta **Vercel** (hospedagem do front Vite).
- Navegador e acesso aos e-mails da conta de teste (para reset de senha).

---

## 2. Firebase — projeto e produtos

1. Acesse [Firebase Console](https://console.firebase.google.com/) → **Adicionar projeto** (ou use um projeto existente dedicado ao Plataforma de streaming educacional).
2. Anote o **Project ID** (útil para variáveis de ambiente e documentação).

### 2.1 Authentication

1. No menu **Authentication** → **Sign-in method** → habilite **E-mail/senha** (provedor Email/Password).
2. **Templates de e-mail** (Authentication → Templates): revise o template **Redefinição de senha** (texto e remetente exibido ao usuário).
3. **Domínios autorizados** (Authentication → Settings → Authorized domains): além de `localhost`, inclua o domínio de **produção** da Vercel (ex.: `seu-projeto.vercel.app`) quando existir; sem isso, links de reset podem falhar em produção.

### 2.2 Firestore Database

1. Crie o banco **Cloud Firestore** (modo **produção** recomendado para já pensar em regras; em desenvolvimento você pode usar emulador depois, se quiser).
2. Escolha a **região** (idealmente a mesma que pretende usar para Storage, para latência e custo).
3. Quando o repositório Plataforma de streaming educacional tiver arquivos `firestore.rules` (ou instruções na documentação), **publique as regras** no console (Firestore → Rules) ou via Firebase CLI — garantindo:
   - aluno lê **catálogo** só dos cursos em que está matriculado;
   - aluno **não** lê documentos/coleções onde está o **gabarito**;
   - aluno escreve só em **próprios** dados de progresso/respostas.

### 2.3 Storage (PDFs)

1. Ative **Storage** se usar arquivos PDF no bucket (conforme arquitetura).
2. Ajuste **Storage Rules** quando o projeto indicar (download só para usuários autenticados / matriculados).
3. Se o console exigir **plano Blaze** para o tipo de bucket padrão do projeto, habilite faturamento com **orçamento e alertas** no Google Cloud Billing.

### 2.4 App Web e variáveis de ambiente

1. Configurações do projeto → **Seus apps** → ícone **Web** (`</>`) → registre o app e copie o objeto de configuração.
2. Você precisará destes valores no **Vercel** e no **`.env` local** (nomes típicos com prefixo `VITE_` no Vite):
   - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`
3. **Nunca** commite arquivo `.env` com segredos; use apenas variáveis públicas do Firebase no client (padrão oficial do SDK web).

### 2.5 Índices Firestore

Se as queries do Plataforma de streaming educacional exigirem índices compostos, o console ou o build mostrará um link para **criar índice**. Crie quando solicitado.

### 2.6 Dados iniciais (esqueleto)

Enquanto não houver script no repositório, você pode criar manualmente no Firestore (ou esperar o seed documentado no projeto):

- `courses/{courseId}` e `courses/{courseId}/modules/{moduleId}` com conteúdo, vídeo, PDF, perguntas **para exibição** e documento/caminho separado para **gabarito** (conforme modelo do código).
- `users/{uid}/courses/{courseId}` de matrícula para seu usuário de teste.

---

## 3. Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project** → importe o repositório GitHub do Plataforma de streaming educacional.
2. **Framework Preset:** **Vite** (ou “Other” com build `npm run build` e pasta de saída `dist`).
3. **Root Directory:** se o app estiver na raiz do repo, deixe em branco; se estiver em subpasta, informe-a.
4. **Environment Variables:** cadastre todas as variáveis `VITE_FIREBASE_*` (ou nomes que o projeto definir), **iguais** às do Firebase Web App, para **Production** (e **Preview** se quiser previews funcionando).
5. Faça o **primeiro deploy**; anote a URL (`*.vercel.app`).
6. Volte ao Firebase → **Authorized domains** e adicione esse domínio (item 2.1).
7. Uso **comercial** futuro: avaliar plano **Pro** da Vercel conforme [termos de uso](https://vercel.com/docs/limits/fair-use-guidelines); para testes pessoais, **Hobby** costuma bastar tecnicamente.

---

## 4. GitHub — CI/CD (quando o workflow existir no repo)

1. No repositório: **Settings → Secrets and variables → Actions**.
2. Crie os secrets que o workflow `.github/workflows/*.yml` exigir (exemplo comum, como no MRBarber):
   - `VERCEL_TOKEN` (gerado em Vercel → Settings → Tokens)
   - `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` (visíveis ao rodar `vercel link` localmente ou no painel do projeto)
3. Confirme que o workflow dispara no branch correto (ex.: `main`).

---

## 5. Checklist rápido antes do primeiro teste ponta a ponta

- [ ] E-mail/senha ativo no Firebase Auth  
- [ ] Domínio Vercel (e `localhost`) nos domínios autorizados  
- [ ] Firestore criado; regras publicadas conforme o repositório Plataforma de streaming educacional  
- [ ] Storage ativo e rules alinhadas (se usar PDF no bucket)  
- [ ] Variáveis `VITE_*` na Vercel e no `.env` local  
- [ ] Pelo menos um curso, módulos, matrícula de teste e separação gabarito/conteúdo aluno  
- [ ] Teste: cadastro → login → reset de senha pelo e-mail → login de novo  

---

## 6. O que fica para depois (fora deste guia)

- Dashboard administrativo e lógica de **correção** usando gabarito.  
- Domínio próprio na Vercel (DNS).  
- Política de privacidade / LGPD e e-mails transacionais customizados.

---

*Documento de apoio ao Plataforma de streaming educacional; revisar após o primeiro commit do código, pois nomes exatos de variáveis e paths podem ser ajustados no repositório.*
