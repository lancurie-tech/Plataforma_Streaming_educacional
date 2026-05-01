# Plataforma de streaming educacional — Documentação de negócio, produto e enquadramento de conformidade

**Finalidade deste documento:** apresentar, de forma estruturada e acessível a decisores não técnicos, **o que a plataforma Plataforma de streaming educacional é**, **que problemas resolve**, **como funciona na prática**, **que cuidados de segurança e privacidade foram incorporados na conceção técnica** e **como se relacionam os textos legais publicados na aplicação** (termos de uso, política de privacidade, compromissos do participante e confidencialidade do vendedor).

**Público-alvo:** responsável pelo negócio, parceiro estratégico ou equipa jurídica que precise avaliar se o conjunto **produto + documentação + operação** está adequado antes de avançar para produção em escala.

**Leitura complementar:** [README principal do repositório](../README.md) (referência técnica para equipas de desenvolvimento e operações).

---

## 1. Aviso importante (limites deste documento)

- Este texto **descreve o estado atual da aplicação** e as **intenções de desenho** em matéria de proteção de dados e segurança. **Não substitui parecer jurídico**, auditoria de conformidade nem avaliação contratual frente a cada empresa cliente.
- Os textos legais exibidos no site foram elaborados como **bases para revisão por advogado** (há marcações explícitas no código-fonte dos conteúdos). **A validação final dos textos, da titularidade do tratamento (controlador / operador / co-controlador), das bases legais por finalidade, do canal de titulares e do contrato com empresas contratantes é responsabilidade da organização operadora da Plataforma de streaming educacional e do seu assessoramento jurídico.**
- Decisões comerciais (preços, SLAs, responsabilidade civil em contrato B2B) **não** estão integralmente refletidas neste documento, salvo quando mencionadas nos próprios termos publicados.

---

## 2. Resumo executivo

**Plataforma de streaming educacional** é uma plataforma **web** de **cursos corporativos (B2B)**. Empresas contratantes utilizam-na para **capacitar colaboradores** com conteúdo digital (vídeos, materiais, questionários), **acompanhar progresso e resultados** e, quando aplicável, **emitir certificados**. Existe ainda um **site público** de divulgação (experiência tipo “streaming” e catálogo de cursos) e um papel interno de **vendedor**, com acesso a **relatórios** apenas das empresas que lhe são atribuídas.

Do ponto de vista de **privacidade e boa governança**, a plataforma foi desenhada para:

- Exigir **aceite explícito** dos documentos legais aplicáveis no **cadastro do colaborador (aluno)**.
- Registar **versão e data** desses aceites de forma **validada no servidor** (não basta desmarcar validação só no navegador).
- Tratar **vendedores** com fluxo próprio: **troca de senha provisória** e **aceite de confidencialidade** antes do uso pleno do sistema.
- Aplicar **regras de permissão na base de dados** (quem lê o quê) e **evitar** criação direta de contas privilegiadas a partir do cliente.

---

## 3. Problema de negócio e proposta de valor

| Necessidade | Como a Plataforma de streaming educacional responde |
|-------------|-------------------------|
| Formação obrigatória ou estratégica em temas regulados (ex.: saúde e segurança, saúde mental no trabalho) | Cursos estruturados em módulos, com vídeo, materiais e avaliação quando configurados |
| Prova de participação e conclusão | Registo de progresso, certificados quando o curso e a lógica da plataforma o permitem |
| Gestão por empresa (unidades, contratos, prazos) | Liberação de cursos por empresa, com possibilidade de prazos de acesso |
| Visibilidade para gestão comercial ou parceiros | Papel de **vendedor** com carteira de empresas e relatórios agregados |
| Presença institucional e divulgação | Home pública e catálogo de cursos publicados |

---

## 4. Perfis de utilizador e responsabilidades

### 4.1. Visitante (sem conta)

- Consulta áreas públicas (home, catálogo, textos legais).
- Não acede a cursos fechados nem a dados de empresas ou colaboradores.
- O **assistente de IA** só pode ser utilizado após **início de sessão** (o visitante vê apenas o convite a autenticar-se).

### 4.2. Colaborador / aluno (`student`)

- **Criação de conta:** através do link da **empresa** (`/{identificador-da-empresa}/cadastro`), com **chave de acesso** fornecida pela empresa (perfil de gestor ou colaborador, conforme a chave usada).
- **Obrigação legal na aplicação:** antes de concluir o cadastro, deve aceitar **Termos de uso**, **Política de privacidade** e **Compromissos do participante** na versão exigida pelo sistema.
- **Utilização:** acede apenas aos cursos em que está matriculado e que a **sua empresa** tem liberados e válidos no tempo; consulta perfil e certificados próprios.

### 4.3. Vendedor (`vendedor`)

- **Criação de conta:** feita pelo **administrador** da plataforma (conta com senha provisória).
- **Primeiro acesso:** deve **definir senha definitiva** e **aceitar o termo de confidencialidade** específico do vendedor, antes de aceder ao painel principal.
- **Utilização:** vê relatórios e dados operacionais **somente** das empresas que lhe são atribuídas (carteira). Não deve ser confundido com “aluno”; o sistema **impede** misturar áreas.

### 4.4. Administrador (`admin`)

- **Criação da primeira conta:** processo técnico inicial (documentado no README técnico); em produção deve ser tratada como **conta de alto privilégio** (governação interna, MFA no e-mail institucional quando possível, etc.).
- **Utilização:** gestão completa de empresas, cursos, liberações, utilizadores vendedores, conteúdo da home pública e métricas globais.

---

## 5. Funcionalidades principais (visão de produto)

### 5.1. Site público e catálogo

- **Home** com experiência de conteúdo em trilhas (vídeos hospedados via integração com Vimeo, conforme configuração).
- **Catálogo** de cursos marcados como publicados para divulgação, sem expor conteúdo completo de forma indevida.
- **Assistente de IA** (chat) para utilizadores autenticados: apoio à descoberta de vídeos e cursos; no percurso de um curso, regras técnicas desencorajam respostas a **avaliações** (ver secção 10 e [ASSISTENTE_IA.md](./ASSISTENTE_IA.md)).

### 5.2. Cadastro e autenticação do colaborador

- Cadastro **vinculado à empresa** (slug na URL + validação de chave).
- Validação de **CPF** e regras de negócio no **servidor** (quando as funções em nuvem estão ativas), para reduzir cadastros inválidos ou duplicados indevidos na mesma empresa.
- **Recuperação de senha** pelo fluxo padrão do fornecedor de autenticação (Firebase).

### 5.3. Experiência de curso (aluno)

- Navegação por **módulos** e **passos** (vídeo, materiais/PDFs, questionários).
- **Controlo de audiência** por tipo de conteúdo (por exemplo, materiais ou questões específicas para “gestor” vs “colaborador”), quando o curso está assim configurado.
- **Progresso** registado de forma a suportar retomada de estudo e conclusão de módulos; a implementação técnica equilibra **escritas na base de dados** com **armazenamento local** para melhor desempenho, consolidando dados nos momentos adequados do fluxo pedagógico.
- **Certificados**, quando aplicável, com campos validados na criação.

### 5.4. Painel do vendedor

- **Relatórios e gráficos** sobre empresas da sua carteira (alunos, progresso, métricas educacionais).
- **Exportação** de relatórios em PDF para uso comercial ou de acompanhamento interno.
- **Demonstração de cursos** em modo que não confunde progresso oficial do colaborador.

### 5.5. Painel administrativo

- **Empresas:** criação (com geração de chaves de cadastro para gestor e colaborador), ativação/desativação, eliminação (operação destrutiva que remove dados associados conforme implementação).
- **Cursos:** editor, publicação no catálogo, gestão de “quais empresas têm acesso a qual curso” e prazos.
- **Dashboard** (métricas globais por curso e por empresa), com apresentação legível (ex.: títulos de módulos e enunciados de perguntas nas visualizações relevantes).
- **Streaming da home:** gestão das trilhas e vídeos da página inicial pública.
- **Vendedores:** criação, atribuição de carteira de empresas, remoção.

---

## 6. Documentos legais na aplicação: o que são e que papel desempenham

Todos os textos abaixo estão **integrados na aplicação** (páginas dedicadas) e podem ser atualizados no código-fonte. **Versões** são controladas em ficheiros de configuração e devem permanecer **sincronizadas** entre a parte visível ao utilizador e a validação no servidor, para que não haja discrepância entre o que a pessoa “aceitou” e o que o sistema registou.

### 6.1. Termos de uso

- **Função:** estabelecer as **regras de utilização** dos serviços Plataforma de streaming educacional (natureza educacional, contas e acesso, propriedade intelectual, conduta, limitações de responsabilidade, lei e foro, contacto).
- **Destinatários:** utilizadores em geral que criam conta ou utilizam os serviços.
- **Estado:** texto-base preparado para **revisão jurídica**; inclui menções a atualização de termos e relação com a política de privacidade.

### 6.2. Política de privacidade

- **Função:** descrever **como dados pessoais são tratados**, em linha com a **LGPD** (Lei nº 13.709/2018): categorias de dados, finalidades, bases legais (a qualificar pelo advogado), partilhas (incluindo prestadores como infraestrutura em nuvem), transferência internacional, prazos de retenção, direitos do titular, segurança, menores, alterações e canal de contacto.
- **Estado:** explicitamente marcado como **texto-base** com campos a preencher (controlador, DPO, contactos institucionais, detalhes contratuais com empresas clientes).

### 6.3. Compromissos do participante (aluno)

- **Função:** recolher **declarações específicas do colaborador** que se cadastra por convite da empresa: veracidade dos dados, uso adequado dos conteúdos, confidencialidade de credenciais, natureza educacional do conteúdo (não substitui aconselhamento individual), ciência de que a **empresa contratante** pode receber informações de progresso, e consequências em caso de violação.
- **Relação com os outros documentos:** o próprio texto indica que **não substitui** os Termos nem a Política de Privacidade.

### 6.4. Termo de confidencialidade do vendedor

- **Função:** obrigar quem atua como **vendedor ou representante** a manter **sigilo** sobre informações comerciais, pedagógicas e de clientes/colaboradores acessíveis pela plataforma, com regras de segurança e consequências em caso de violação.
- **Momento de aceite:** após autenticação, **antes** do uso regular do painel do vendedor; o aceite é **validado no servidor** quanto à versão.

---

## 7. Fluxos de aceite e registo probatório (LGPD e governança)

### 7.1. Colaborador (cadastro)

1. O utilizador marca os aceites no formulário e submete os dados.
2. O **servidor** (função na nuvem) verifica se as **três versões** enviadas (termos, privacidade, compromissos) coincidem com as **versões oficiais** configuradas.
3. Se válido, cria-se a conta e regista-se no perfil a informação de aceite com **versões** e **data/hora** do servidor.

**Implicação para o negócio:** existe **rasto técnico** de qual versão foi aceite e quando, o que suporta **transparência** e **demonstração de boa-fé** perante titulares e auditores — **sujeito** à revisão jurídica dos textos e à definição correta de **bases legais** por finalidade.

### 7.2. Vendedor

1. O administrador cria o utilizador com senha provisória.
2. O vendedor define senha definitiva e aceita o **termo de confidencialidade** na versão exigida.
3. O servidor regista **versão** e **data/hora** do aceite.

### 7.3. Administrador

- **Não** há fluxo de aceite legal adicional na aplicação para a conta administrativa; a governança deve ser **organizacional** (acessos, contratos de trabalho ou prestação de serviço, confidencialidade interna).

---

## 8. Segurança: princípios e medidas adoptadas na concepção técnica

Esta secção resume **o racional de segurança** implementado no software e na infraestrutura escolhida. **Nenhum sistema é invulnerável**; a política de segurança da organização (password policy corporativa, revisão de contas, resposta a incidentes) complementa o desenho técnico.

### 8.1. Autenticação e senhas

- As **palavras-passe** são geridas pelo **Firebase Authentication** (indústria standard); **não** são armazenadas em texto claro na base de dados de documentos da aplicação.
- Existem **mínimos de complexidade** nos fluxos de cadastro e de criação de vendedores (comprimento mínimo de senha).
- **Vendedores** criados pelo admin usam senha provisória até definirem uma definitiva.

### 8.2. Chaves de acesso das empresas (cadastro B2B)

- As chaves não ficam guardadas de forma legível no documento principal da empresa: guardam-se **derivados criptográficos** (hash com salt). A validação compara o que o utilizador digitou com o valor derivado.
- Uma cópia legível das chaves pode existir num **arquivo administrativo** por empresa para **consulta do operador** após a criação — tratar como **informação sensível** de operação (acesso restrito, política interna de quem pode ver e como rotação é feita).

### 8.3. Regras de acesso à base de dados (Firestore)

- Apenas utilizadores **autenticados** acedem a dados privados; as **regras** impedem, por exemplo, que um aluno leia **gabaritos** de questionários ou que um vendedor leia dados de empresas **fora** da sua carteira.
- A **criação** de documentos de utilizador **não** é feita arbitrariamente pelo navegador: o cadastro de colaborador passa por **função no servidor** com privilégios administrativos.

### 8.4. Comunicações e funções em nuvem

- As **funções** expostas na internet aplicam controlos de **origem (CORS)** e verificação de **quem chama** (incluindo operações exclusivas de administrador autenticado como tal no sistema).

### 8.5. Reforços opcionais recomendados em produção

- **App Check** e outras camadas anti-abuso descritos na documentação técnica.
- **HTTPS** obrigatório em produção (ambiente de alojamento típico).
- **Segredos** (chaves de API, contas de serviço) **nunca** em repositório público; gestão por variáveis de ambiente e segredos do fornecedor de cloud.

---

## 9. Dados pessoais: categorias e fluxos (alinhamento com a política)

A **Política de Privacidade** na aplicação já enumera categorias típicas. Em síntese, para decisão de negócio:

| Categoria | Exemplos na plataforma | Nota |
|-----------|------------------------|------|
| Identificação e cadastro | Nome, e-mail, CPF quando exigido, vínculo com empresa, perfil gestor/colaborador | CPF é dado sensível no âmbito da LGPD; a finalidade e a base legal devem estar bem fundamentadas juridicamente |
| Dados educacionais | Progresso, respostas, certificados | Partilha com a empresa contratante conforme política e contrato |
| Dados técnicos | Logs, sessões, IP conforme infraestrutura | Proporcionalidade e transparência na política e em cookies/analytics, se aplicável |

**Transferência internacional:** o uso de fornecedores globais de nuvem pode implicar fluxos fora do Brasil; a política aponta a necessidade de **garantias** adequadas — ponto típico de **revisão jurídica** e de **anexos contratuais** com empresas clientes.

---

## 10. Assistente de IA (chat Plataforma de streaming educacional)

A plataforma inclui um **assistente conversacional** (modelo **Google Gemini**), disponível na **home pública (streaming)**, na **lista de cursos** e **durante a navegação num curso**, para utilizadores **autenticados**.

- **Finalidade:** apoio à descoberta de conteúdos (vídeos em trilhas, cursos do catálogo), esclarecimento de conceitos e estudo; na página de um curso, o desenho técnico **reforça no servidor** que o modelo **não deve** responder a pedidos que constituam **resposta a avaliações ou questionários** (integridade formativa).
- **Dados enviados ao fornecedor de IA:** mensagens do utilizador, contexto agregado no *backend* (metadados e textos públicos já presentes no Firestore, transcrições de vídeos quando aplicável). **Não** é garantido que o fornecedor trate os dados apenas na UE; a organização operadora deve avaliar **cláusulas contratuais** com Google Cloud / Google AI e informar titulares na política de privacidade se necessário.
- **Quota:** limite diário de mensagens por conta (ver [ASSISTENTE_IA.md](./ASSISTENTE_IA.md)) para controlo de custo e uso razoável.
- **Detalhe técnico:** [README principal](../README.md) (secção *Assistente de IA*) e [ASSISTENTE_IA.md](./ASSISTENTE_IA.md).

---

## 11. O que falta ou depende de decisão externa ao código

Para o responsável pelo negócio fechar a avaliação “está legal / falta X”, convém verificar explicitamente:

1. **Revisão jurídica** dos quatro textos publicados e preenchimento de placeholders (Razão social, CNPJ, DPO, e-mails, foro, bases legais por tratamento).
2. **Contrato com empresas B2B** (SLA, responsabilidade, suboperadores, incidentes de segurança, portabilidade e eliminação, papel da empresa cliente no tratamento de dados dos colaboradores).
3. **Processo interno** de atendimento a titulares (prazos, identificação, registo de pedidos).
4. **Política de retenção** por tipo de dado e backup.
5. **Nome de domínio, marca e propriedade intelectual** dos conteúdos pedagógicos.

---

## 12. Conclusão

A Plataforma de streaming educacional foi desenhada como **produto B2B de formação**, com **separação clara de papéis**, **aceites legais registados com versão** nos fluxos de colaborador e vendedor, e **controlo de acessos** na base de dados. O conjunto oferece uma **base sólida de transparência e segurança técnica**, que deve ser **completada** pela **revisão jurídica dos textos**, pela **governança da entidade operadora** e pelos **contratos** com clientes e fornecedores.

Para detalhes de implementação (rotas, funções, comandos de deploy), usar o [README principal](../README.md).

---

*Documento de apoio à decisão — Plataforma de streaming educacional. Mantido junto da documentação do repositório.*
