# Assistente de IA (chat Medivox)

Referência para **desenvolvimento**, **operação** e **suporte**: o que é o chat, onde aparece, como é limitado e que variáveis de ambiente precisa.

---

## 1. Resumo

| Item | Descrição |
|------|-----------|
| **Fornecedor do modelo** | Google **Gemini** (API Generative Language), invocada **apenas** nas Cloud Functions — a chave **não** fica exposta no bundle do cliente. |
| **Callable** | `streamingAssistantChat` (`functions/src/index.ts`, lógica em `functions/src/streamingOps.ts`). |
| **Autenticação** | Obrigatória (`request.auth.uid`). Visitantes não enviam mensagens. |
| **Onde o utilizador vê o widget** | Rotas com `PublicLayout`: `/`, `/cursos`, `/curso/:courseId` — componente `StreamingAssistantWidget`. |

---

## 2. Comportamento por contexto

### 2.1. Home streaming (`/`)

- O modelo recebe o **catálogo** das trilhas com **resumos curtos** do texto indexado (para poupar tokens); o **vídeo em destaque** é tratado à parte.
- Se o utilizador tiver um **vídeo em destaque** (player em foco), o cliente envia `focusTrackId` e `focusEntryId` em **cada** mensagem; o servidor injeta no prompt o **texto indexado** desse vídeo (prioridade máxima): preferencialmente **legenda/transcrição** via API Vimeo, ou **descrição** do cadastro quando não há legenda.
- **Sem `VIMEO_ACCESS_TOKEN`** nas Cloud Functions **ou** sem faixas de texto no Vimeo, o texto pode ficar só na descrição do Firestore — ou vazio se também não houver descrição. Nesse caso o assistente não consegue resumir o que foi *dito* no áudio; configure o token e legendas no vídeo.

### 2.2. Catálogo / lista de cursos (`/cursos`)

- Contexto inclui **cursos publicados** (`catalogPublished`) para respostas sobre “há curso sobre X?” e links típicos `/curso/{id}`.
- Para **aluno autenticado**, a página lista os **cursos liberados**; o assistente continua a usar o mesmo endpoint, com o bloco de cursos do catálogo no servidor.

### 2.3. Página de um curso (`/curso/:courseId`)

- O cliente envia `courseId` e `courseTitle`.
- O servidor carrega **`courses/{courseId}`** e a subcoleção **`modules`** (títulos, texto do módulo, passos: vídeo/material/quiz) e injeta no prompt como **CURSO ATUAL — CONTEÚDO PEDAGÓGICO**, para o mentor não depender só do resumo do catálogo (evita invenção de temas).
- O *system prompt* inclui instruções **anti-cola**: o modelo **não deve** responder a pedidos de **respostas de testes, questionários ou avaliações**; pode ajudar com **conceitos**, estudo geral e reflexão pedagógica.
- Isto **não substitui** o desenho pedagógico do curso nem controla cópia fora da plataforma; é uma camada de **política de conteúdo** no servidor.

---

## 3. Quotas e custos

- **Limite global:** 30 mensagens por **utilizador autenticado** por **dia civil** em **`America/Sao_Paulo`**.
- **Modo curso** (`/curso/...`): limite adicional de **15 mensagens por dia por curso** (além do global).
- **Armazenamento:** documentos em `assistantQuota/{uid}/daily/{...}` e `assistantQuota/{uid}/course/{courseId}/daily/{...}`.
- **Ao exceder:** HTTP `resource-exhausted` com mensagem legível.

A quota existe para **controlar custo** da API Gemini e abuso de chamadas.

---

## 4. Configuração (deploy)

1. **Secret** `GOOGLE_API_KEY` no projeto Firebase (Gemini), definido antes do deploy, por exemplo:  
   `firebase functions:secrets:set GOOGLE_API_KEY`
2. Opcional: parâmetro **`GEMINI_MODEL`** (predefinição no código; pode ser sobrecarregado no deploy).
3. Opcional: **secret** **`VIMEO_ACCESS_TOKEN`** (igual ao `GOOGLE_API_KEY`): `firebase functions:secrets:set VIMEO_ACCESS_TOKEN` — legendas/transcrições via API Vimeo.

Ficheiro de referência local: `functions/.env.example` (não commitar segredos reais).

---

## 5. Ficheiros relevantes no repositório

| Caminho | Função |
|---------|--------|
| `functions/src/streamingOps.ts` | `handleStreamingAssistantChat`, `assertAssistantDailyQuota`, construção de contexto (catálogo, cursos, foco, modo curso). |
| `functions/src/index.ts` | Export `streamingAssistantChat`, ligação a secrets e modelo. |
| `src/components/public/StreamingAssistantWidget.tsx` | UI do chat, envio de mensagens e payloads (`focus*`, `course*`). |
| `src/components/layout/PublicLayout.tsx` | Contexto de foco do vídeo e do curso para o widget. |
| `src/lib/firebase/callables.ts` | Tipagem da callable `streamingAssistantChat`. |

---

## 6. Privacidade e conformidade (nota)

As mensagens e o contexto são processados pelo **Google** conforme os termos do produto Gemini / Google Cloud. A organização operadora da Medivox deve:

- Mencionar o uso de **IA** na **política de privacidade** e nos **termos**, se ainda não estiver refletido.
- Avaliar **localização de dados** e **contratos** com o fornecedor em relação a empresas clientes (B2B) e titulares (colaboradores).

Documento de negócio relacionado: [DOCUMENTACAO_NEGOCIO_CONFORMIDADE_MEDIVOX.md](./DOCUMENTACAO_NEGOCIO_CONFORMIDADE_MEDIVOX.md) (secção 10).

---

*Documento técnico — manter alinhado com o código ao alterar quotas, modelo ou regras de prompt.*
