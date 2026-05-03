# Plano de desenvolvimento: plataforma modular, multi-cliente e marketplace

Este documento é a **fonte única** para orientar implementação por **etapas**, com **critérios de validação** em cada fase. Deve ser atualizado quando decisões mudarem.

---

## Decisão de arquitetura (registro)

| Decisão | Escolha atual |
|---------|----------------|
| **Firebase** | **Um único projeto** Firebase para todos os clientes (**multi-tenant** no modelo de dados e nas Rules). |
| **Cobrança ao cliente final** | **Planos com limites** (usuários, armazenamento, vídeo, reads/writes onde fizer sentido), não repasse cru da fatura GCP por projeto. |
| **Marketplace (MVP)** | **Sem pagamento in-app**: solicitação (ticket/intenção) que chega ao usuário **master** para contratar manualmente; **catálogo** e estado “ativo/inativo” por tenant. |
| **Console master** | Login dedicado ao **gerenciador da sua empresa**: clientes (tenants), **plano/limites**, **módulos** por cliente — padrão de mercado para operação B2B (“operator console” / “internal admin”). |

**Última revisão conceitual**: alinhar produto ao modelo SaaS típico (multi-tenant + planos + entitlements). Projeto Firebase **por cliente** permanece como **opção futura** só para enterprise/compliance, não como padrão.

---

## 1. Validação da arquitetura

### 1.1 Por que um único projeto Firebase (padrão escolhido)

- **Alinhado ao que grandes empresas SaaS fazem na maior parte dos casos**: uma stack compartilhada, isolamento **lógico** por `tenantId` / organização.
- **Operação**: um deploy, um conjunto de Rules/indexes/Functions, um marketplace e um catálogo **no mesmo** Firestore.
- **Custo**: o gasto na nuvem escala com **uso agregado**; a **precificação para o cliente** é tratada por **planos e limites**, não obrigatoriamente por “projeto GCP separado”.
- **Segurança**: o desafio passa a ser **Firestore Rules + consultas sempre filtradas por tenant + revisão de Functions** — é o trabalho central do multi-tenant bem feito.

### 1.2 Objetivos de negócio e produto

| Objetivo | Implicação técnica |
|----------|-------------------|
| Vários clientes com módulos diferentes | **Entitlements por tenant** (`enabledModuleIds`, etc.). |
| Cobrança previsível + margem | **Planos** com **limites** mensurados no produto (ver §2 comercial); eventual **overage** ou upgrade quando atingir teto. |
| Novos módulos viram oferta para outros | **Catálogo global** + processo de publicação + visibilidade no marketplace. |
| Um código-base | Monólito modular; um artefato de app + Functions compartilhadas. |
| Execução sem se perder | Roadmap em **fases** com gates (este documento). |

### 1.3 Modelo comercial e limites por plano (base da precificação)

Objetivo: **não depender** da fatura GCP por cliente para saber quanto cobrar. O mercado costuma:

- Definir **tiers** (Starter / Pro / Enterprise) com **pacotes inclusos** de capacidade.
- **Estimar custo unitário interno** (por usuário, GB de vídeo, milhões de reads, minutos de processamento, egress) e embutir no preço do plano + margem.
- Quando o cliente **estoura** o pacote: **upgrade de plano**, **add-on** ou **taxa por unidade** — opcional no roadmap.

**Exemplos de dimensões de limite** (ajustar ao produto real):

- Usuários ativos ou assentos.
- Armazenamento total de vídeo/arquivos.
- Número de cursos, lives, ou horas de vídeo hospedado.
- Operações Firestore “caras” podem ser **abstraídas** para o cliente como “uso da plataforma” ou limitadas indiretamente (ex.: número de uploads/dia, tamanho máximo por upload), em vez de expor reads/writes crus.

**Conclusão**: a lógica **plano + limites + controle no app** é **coerente** com o mercado e **substitui** a necessidade de um projeto Firebase por cliente **para fins de cobrança**.

### 1.3.1 Fórmula de referência para o preço de um plano

O preço de venda do plano pode ser decomposto, **por tenant e por mês**, da seguinte forma (todos os valores **devem** ser recalibrados com base em medição real e na sua margem alvo):

| Componente | O que representa |
|------------|------------------|
| **A — Sustentação** | Custo **fixo** alocado ao tenant: monitoramento, suporte mínimo, rotinas de operação, fração de ferramentas (CI, erros, backup), **não** proporcional a um clique. |
| **B — Teto de uso (limites do plano)** | Custo **técnico estimado** se o cliente **usar até o limite** do plano (armazenamento, egress de vídeo, invocações de Functions, Firestore no padrão de uso esperado, processamento de mídia). |
| **C — Uso da plataforma (software + serviço)** | O que você cobra por **acesso ao produto** (IP, roadmap, módulos incluídos, experiência, melhoria contínua) — em outras palavras, **margem comercial** além do “custo de entregar o teto”. |

**Preço sugerido do plano (mensalidade)** ≈ **A + B + C**.

**Regras de validação (sanity check):**

- Se o cliente **esgotar** os limites, o **B** do mês **não** deveria, em média, ser superior ao **B** modelado; se a métrica real passar, ajuste **limites**, **preço** ou **arquitetura** (cache, agregação de leituras, etc.).
- **A** costuma crescer pouco entre planos; o que mais muda é **B** (teto) e **C** (posicionamento: Pro paga mais “plataforma” que Starter).
- **C** não precisa ser “lucro puro”: pode embutir risco, impostos, comissão e canais.

**Importante:** os números da tabela abaixo são **fictícios** (ilustração). Substitua por planilha interna com preços reais de Firebase, Storage, CDN, transcodificação, e horas de suporte.

#### Premissas de custo interno (fictícias — só para o exemplo)

| Item de premissa | Valor de exemplo (R$) | Uso no modelo |
|------------------|------------------------|---------------|
| Sustentação mínima por tenant ativo (A parcial) | 45,00 / mês | Base operacional atribuída a cada plano. |
| Estimativa de infra no “teto” (B) — **Essencial** | 35,00 / mês | Uso máximo do pacote pequeno (hospedagem leve, poucos vídeos, tráfego moderado). |
| Estimativa de infra no “teto” (B) — **Profissional** | 120,00 / mês | Mais storage, mais egress, mais funções. |
| Estimativa de infra no “teto” (B) — **Corporativo** | 420,00 / mês | Pacote grande + suporte a picos. |

*(Na prática, B vem de somar: R$/GB armazenado, R$/1000 minutos de streaming, R$/1M de leituras aproximadas, etc. — o plano acima só mostra o **total** de B.)*

#### Tabela de planos: limites de exemplo (fictícios)

| `planId` | Público-alvo | Usuários (máx.) | Armazenamento vídeo/arquivos (GB) | Horas de vídeo publicadas (catálogo) | Transmissões ao vivo / mês | Cursos ativos (máx.) | Módulos incluídos (exemplos) | Suporte |
|----------|--------------|------------------|-----------------------------------|--------------------------------------|----------------------------|------------------------|--------------------------------|---------|
| `essencial` | Pequena instituição / piloto | 150 | 80 | 200 h | 4 | 30 | Núcleo, cursos, banners | E-mail (48h) |
| `profissional` | Médio porte / operação contínua | 800 | 400 | 1.200 h | 20 | 150 | Núcleo, cursos, chat, lives, banners | E-mail + chat (24h úteis) |
| `corporativo` | Grande volume / exigência | 4.000 | 2.000 | 6.000 h | 80 | 800 | Todos os módulos atuais + prioridade de novos | Nomeado + SLAs (contrato) |

**Observação:** “Horas de vídeo publicadas” e “cursos ativos” são **limites de negócio** fáceis de explicar no contrato; “reads” do Firestore podem ser **derivados** desses limites (menos leitura bruta no material de venda).

#### Composição de preço (validação do modelo A + B + C)

Valores em **R$ / mês**, arredondados para comunicação comercial. Coluna **Validação**: coerência entre teto técnico e margem de plataforma.

| Plano | A — Sustentação (R$) | B — Infra no teto (R$) | C — Uso da plataforma (R$) | **Preço mensal sugerido (R$)** | Validação |
|-------|----------------------|-------------------------|----------------------------|--------------------------------|-----------|
| Essencial | 45 | 35 | 179 | **259** | B baixo: cliente pequeno; C cobre produto + margem sem competir com Pro. |
| Profissional | 45 | 120 | 534 | **699** | B sobe com storage/egress; C reflete mais módulos e suporte. |
| Corporativo | 95 | 420 | 2.385 | **2.899** | A maior (suporte/contas); B alto no teto; C enterprise (SLA, todos os módulos). |

**Conferência da fórmula (ex.: Profissional):** 45 + 120 + 534 = **699** ✓

**O que monitorar depois do lançamento:** custo GCP/Firebase **por tenant** e por plano (dashboard ou export mensal); se **custo real** ultrapassar **A + B** com frequência, revisar limites ou preços antes de escalar vendas nesse tier.

### 1.4 Quando ainda faria sentido projeto dedicado (não é o padrão agora)

- Contrato enterprise exigindo **isolamento de dados em conta/projeto dedicado**.
- **Regulatório** ou política do cliente.

Tratar como **exceção** com runbook próprio, não como linha base do roadmap.

### 1.5 Marketplace e “pedir módulo novo”

Com **um único Firebase**, o marketplace **continua fazendo sentido** e fica **mais simples**:

- **Catálogo** (`catalog/modules`) legível por admins.
- **Por tenant**: o que está **ativo** vs **disponível para solicitar**.
- **Fluxo MVP**: **Solicitar** → grava `requests/*` ou fila → **notifica / aparece no painel master** → após acordo comercial, master **ativa** módulo e ajusta plano/limites nas Functions ou pelo Admin SDK.

Quando um módulo novo é desenvolvido e entra no catálogo, **todos os tenants** podem **ver** a oferta; só quem tiver **entitlement** (ou contrato) usa.

### 1.6 Console master: essa linha é boa?

**Sim**, é **comum e recomendável** para o seu estágio:

- Operadores B2B precisam de um lugar para **cadastrar tenant**, **atribuir plano**, **ligar/desligar módulos**, ver **solicitações** do marketplace.
- No mercado isso aparece como **internal admin**, **operator dashboard**, **back-office** — às vezes é app separado ou mesmo código com **área `/master`** protegida por **custom claim** `master_admin` e rotas isoladas.

**Melhorias comuns** (evolução):

- Auditoria (quem ativou o quê e quando).
- Integração com CRM/contratos.
- Futuro: gateway de pagamento automático — **fora do escopo obrigatório do MVP** conforme decisão acima.

---

## 2. Glossário

| Termo | Significado |
|-------|-------------|
| **Tenant / cliente** | Organização na sua base; identificado por `tenantId`. **Não** implica projeto Firebase próprio no modelo padrão. |
| **Plano (`planId`)** | Pacote comercial com **limites** associados (definição em código ou coleção `plans`). |
| **Entitlement** | O que o tenant pode usar: `enabledModuleIds`, opcionalmente overrides; referência ao `planId`. |
| **Limites (`limits`)** | Cotas numéricas efetivas (podem ser cópia do plano + ajustes manuais). |
| **Módulo** | Pacote de funcionalidade identificado por `moduleId` estável. |
| **Catálogo** | Módulos **oferecidos** globalmente (metadados, versão, disponibilidade). |
| **Marketplace (in-app)** | Admin do tenant vê catálogo, o que já tem e **solicita** novos módulos ou upgrades (MVP **sem checkout**). |
| **Master admin** | Operador da sua empresa: tenants, planos, módulos, fila de solicitações. |
| **Admin do tenant** | Gestor do cliente: usuários internos, branding, uso dentro dos limites. |

---

## 3. Modelo conceitual de dados (um projeto Firebase)

**Princípio**: toda leitura/escrita de dados de negócio deve ser **filtrada por `tenantId`** nas Rules e no código. Documentação interna obrigatória: **nunca** query sem tenant em código de app.

### 3.1 Coleções / documentos sugeridos (ajustar nomes ao repo na implementação)

| Caminho | Conteúdo |
|---------|----------|
| `tenants/{tenantId}` | `displayName`, `planId`, `status`, `createdAt`, contatos. |
| `tenants/{tenantId}/settings` ou subdoc | Branding, preferências. |
| `tenants/{tenantId}/entitlements` | `enabledModuleIds[]`, `limits{}`, `updatedAt`. |
| `catalog/modules/{moduleId}` | Nome, descrição, `status`, `minAppVersion`, `dependencies[]`, texto comercial (preço “a partir de” para UI). |
| `plans/{planId}` | Limites default por plano (`maxUsers`, `maxStorageGb`, …). |
| `requests/modulePurchase` ou `tenants/{tenantId}/requests/*` | Solicitações do marketplace (tenant, módulo, data, status `pending/approved/rejected`). |

**Master** lê/agrega solicitações `pending` de todos os tenants (via query indexada ou coleção global `marketplaceRequests` com `tenantId`).

### 3.2 Custom Claims (Auth)

- Usuários **do tenant**: claim `tenantId` + role (`tenant_admin` | `user` …).
- Usuários **master**: claim `master_admin: true` **sem** `tenantId` (ou com tenant dedicado só para testes — decisão de implementação).

Rules: só `master_admin` lê/escreve tenants globalmente; usuários normais só `resource.data.tenantId == request.auth.token.tenantId`.

---

## 4. Catálogo de módulos

**Verdade única**: coleção global `catalog/modules` **no mesmo projeto**. Sem sincronizar N projetos.

Atualização do catálogo: deploy + seed administrativo ou painel master “publicar módulo”.

---

## 5. Provisionamento de **novo cliente** (tenant), não novo projeto GCP

### 5.1 O que o fluxo deve fazer (MVP)

1. Master cria documento em `tenants/{tenantId}` com `planId` inicial e `status`.
2. Define `entitlements` e `limits` (cópia do plano ou manual).
3. Convidar primeiro `tenant_admin` (email/link) com claim `tenantId`.

### 5.2 Automação desejável

- Script ou Cloud Function **idempotente**: “criar tenant” com defaults.
- Checklist: índices Firestore necessários para queries do master e do marketplace.

### 5.3 O que **não** é mais premissa deste plano

- Criar um **novo projeto Firebase** por cliente (exceto exceção enterprise documentada à parte).

---

## 6. Papéis: Master vs admin do tenant

### 6.1 Master admin

- CRUD de **tenants** (cadastro, suspensão).
- Atribuir **plano** e **limites** (ou editar `limits` manualmente).
- Ligar/desligar **módulos** (`enabledModuleIds`).
- Processar **solicitações** vindas do marketplace (aprovar → atualizar entitlements / registrar no contrato).

### 6.2 Admin do tenant

- Gestão de usuários e conteúdo **dentro do tenant**.
- Marketplace: **ver** catálogo e **solicitar** módulos ou mais capacidade (MVP).

### 6.3 Segurança

- Separação forte por Rules; operações sensíveis apenas via **Cloud Functions** + Admin SDK quando necessário.
- Área master em **rotas separadas** e claims estritos; preferível não misturar UI master com UI tenant no mesmo bundle sem lazy loading e guards explícitos.

---

## 7. Marketplace

### 7.1 MVP (decidido)

| Item | Comportamento |
|------|----------------|
| Listagem | Catálogo de módulos + indicação do que já está ativo para aquele tenant. |
| CTA | **Solicitar** (ou “Falar com comercial”) — **sem** pagamento integrado. |
| Backend | Criar registro de solicitação; **lista no painel master** (ou notificação por e-mail/Slack em evolução). |
| Ativação | Somente após ação do **master** (espelha contrato/manual). |

### 7.2 Evolução (opcional)

- Stripe / webhook → atualização automática de plano e entitlements.
- Overage medido e faturado (billing de uso).
- Notificações in-app para o admin do tenant quando o pedido for aprovado.

### 7.3 Novo módulo desenvolvido internamente

1. Código do módulo protegido por `moduleId` + entitlement.
2. Entrada no **catálogo** com descrição e estado (`beta/active`).
3. Primeiro cliente pode ser onboard manual; depois **visível** no marketplace para solicitação pelos demais.

---

## 8. Modularização do código (direção técnica)

- **Core**: shell, auth (incluindo resolução de `tenantId` e claims), router base, helpers multi-tenant.
- **Módulos**: pastas/pacotes com lazy routes; cada um com **guard** de entitlement e checagem de **limites** quando aplicável (ex.: feature só disponível se plano permitir).
- **Bootstrap**: carregar plano + entitlements + limites do tenant após login.

**Gate**: tenant A sem módulo X não acessa rotas nor APIs do módulo X; tenant B com módulo ativo passa.

---

## 9. Roadmap por etapas (com validação)

### Fase 0 — Alinhamento e inventário

**Entregas**: mapa “feature atual → `moduleId`”; lista de **dimensões de limite** por plano (rascunho comercial + técnico).

**Validação**: aprovado o mapa de módulos e os eixos de plano (pelo menos 2 tiers fictícios).

---

### Fase 1 — Multi-tenant mínimo no dado

**Entregas**: schema `tenants`, `entitlements`, `plans` (mesmo que seed fixo); documento `tenantId` nas Rules para **uma** coleção piloto.

**Validação**: dois tenants de teste no **mesmo** projeto; usuário de um não acessa dados do outro (teste manual + Rules).

---

### Fase 2 — Modularização incremental

**Entregas**: um módulo piloto extraído; router condicionado a `enabledModuleIds`.

**Validação**: tenant 1 com módulo, tenant 2 sem — comportamento correto.

---

### Fase 3 — Console Master (MVP)

**Entregas**: autenticação `master_admin`; telas: **lista de tenants**, **detalhe** (plano, limites, módulos); edição via Functions ou regras restritas.

**Validação**: master altera plano/módulo de um tenant de teste e o app desse tenant reflete após reload.

---

### Fase 4 — Marketplace (solicitação)

**Entregas**: UI no admin do tenant (catálogo + solicitar); coleção de **requests**; **inbox** no master (lista de pendentes + aprovar/arquivar).

**Validação**: fluxo ponta a ponta **sem** pagamento — solicitação aparece para master e aprovação altera entitlements.

---

### Fase 5 — Limites por plano no produto

**Entregas**: enforcement mínimo (ex.: bloquear convite de usuário acima do `maxUsers`, ou warning); métricas agregadas por tenant se necessário.

**Validação**: simular tenant que atinge limite e ver comportamento acordado (bloqueio ou mensagem).

---

### Fase 6 — Hardening

**Entregas**: revisão de Rules, auditoria de queries sem tenant, logs e observabilidade.

**Validação**: checklist de segurança multi-tenant revisado.

---

## 10. Revisão periódica deste documento

- [ ] Limites dos planos continuam **coerentes** com custo real interno (revisar trimestralmente).
- [ ] Rules cobrem **todos** os caminhos de escrita sensíveis.
- [ ] Marketplace MVP (solicitação) ainda atende comercial ou precisa de gateway.
- [ ] Algum cliente exige **projeto dedicado** — se sim, documentar exceção fora do fluxo padrão.

---

## 11. Referências internas do repositório

Atualizar quando novos guias existirem:

- `docs/GUIA_SETUP_MANUAL.md` — baseline de ambiente.
- `docs/MODULOS_IDS.md` — contrato comercial (`streaming` / `cursos` / `chat` / `vendedores`) e mapeamento interno.
- `docs/PLANOS_LIMITES_RASCUNHO.md` — dimensões de limites por plano (Fase 0).
- `docs/FASE1_MULTI_TENANT_MINIMO.md` — schema e validação inicial de isolamento por tenant.
- `docs/FASE3_CONSOLE_MASTER.md` — claim `master_admin`, Rules e UI `/master`.
- `docs/FASE4_MARKETPLACE.md` — catálogo `catalog/platform/modules`, `marketplaceRequests`, UI `/admin/marketplace` e `/master/marketplace`.
- *(adicionar)* `docs/RUNBOOK_NOVO_TENANT.md` — após Fase 3–5.

---

*Última atualização: exemplo de planos (Essencial / Profissional / Corporativo), limites fictícios e composição de preço (sustentação + teto de infra + valor da plataforma); demais inalterado (multi-tenant, marketplace por solicitação, console master).*
