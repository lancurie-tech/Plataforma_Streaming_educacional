/**
 * Textos de referência em Markdown, alinhados aos componentes em `src/legal/content/*Sections.tsx`.
 * Usados no admin (“Preencher com texto de referência”) e podem ser colados no Firestore.
 */

import { PLATFORM_DISPLAY_NAME } from '@/lib/brand';

export const DEFAULT_TERMS_MARKDOWN = `Estes Termos de Uso ("Termos") regem o acesso e a utilização dos sites, aplicações e serviços oferecidos pela ${PLATFORM_DISPLAY_NAME} ("nós"), incluindo áreas de divulgação educacional de caráter público e a plataforma de cursos contratada por empresas para capacitação de colaboradores, nos termos aqui descritos.

## 1. Quem somos e aceitação dos Termos

Ao criar conta, aceder ou utilizar os serviços da ${PLATFORM_DISPLAY_NAME}, o utilizador declara ter lido e compreendido estes Termos e a Política de Privacidade aplicável. Se não concordar, não deve utilizar a plataforma. A ${PLATFORM_DISPLAY_NAME} poderá atualizar estes Termos; a continuidade de uso após comunicação de alterações relevantes poderá constituir aceitação, conforme a lei aplicável e a forma de aviso adotada (por exemplo, publicação na plataforma com indicação de versão e data).

## 2. Natureza do serviço

A ${PLATFORM_DISPLAY_NAME} disponibiliza conteúdos educacionais em formato digital (incluindo vídeos, textos, questionários e materiais de apoio), organizados em cursos e, quando aplicável, em trilhas de conteúdo de consulta pública. Os cursos contratados por empresas destinam-se à formação de colaboradores no âmbito das relações de trabalho e de obrigações legais e regulamentares que couberem a cada contratante (ex.: temas de saúde e segurança do trabalho, saúde mental no trabalho, conforme programas e cursos disponibilizados). A simples disponibilização de conteúdo sobre temas regulados não substitui assessoria jurídica, médica ou técnica específica ao caso concreto da empresa ou do participante.

## 3. Contas, perfis e acesso

O acesso pode exigir registo com dados verídicos. Empresas contratantes podem disponibilizar links e chaves de cadastro diferenciadas (por exemplo, para perfis de gestor ou colaborador), conforme configurado para cada contrato. O utilizador é responsável pela confidencialidade das credenciais e por todas as atividades realizadas na sua conta. A ${PLATFORM_DISPLAY_NAME} poderá suspender ou encerrar contas em caso de violação destes Termos, de fraude, de risco à segurança ou por determinação legal ou contratual envolvendo a empresa contratante.

## 4. Propriedade intelectual e licença de uso

Conteúdos, marcas, software, bases de dados e materiais da ${PLATFORM_DISPLAY_NAME} ou de licenciadores estão protegidos por direitos de propriedade intelectual. Salvo disposição expressa em contrato ou licença, concede-se apenas licença limitada, não exclusiva, intransferível e revogável para visualização e utilização pessoal no âmbito do curso contratado, sem cópia, distribuição, engenharia reversa, scraping ou exploração comercial não autorizada.

## 5. Conduta e uso aceitável

É vedado, entre outros comportamentos:

- Utilizar a plataforma de forma a violar lei, direitos de terceiros ou estes Termos;
- Tentar aceder a áreas, dados ou conteúdos não autorizados;
- Interferir na segurança ou no normal funcionamento dos serviços;
- Partilhar credenciais ou contornar controlos de acesso.

## 6. Certificados e registos educacionais

Quando previsto no curso, poderá ser emitido certificado ou comprovação de conclusão, conforme regras do curso e da plataforma. Tais documentos refletem a conclusão registrada na plataforma e não garantem, por si só, o cumprimento de todas as obrigações legais da empresa contratante perante terceiros (como autoridades reguladoras), que dependem de processos internos, documentação e conformidade além do escopo da ${PLATFORM_DISPLAY_NAME}.

## 7. Limitação de responsabilidade

Na medida máxima permitida pela lei aplicável, os serviços são fornecidos "no estado em que se encontram". A ${PLATFORM_DISPLAY_NAME} não se responsabiliza por lucros cessantes, danos indiretos ou consequenciais, salvo disposição legal em contrário. Em nenhuma hipótese a responsabilidade agregada excederá o montante pago pelo contratante pelo serviço discutido nos últimos doze meses, quando aplicável, salvo dolo ou culpa grave conforme definido em lei.

## 8. Lei aplicável e foro

Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de domicílio da ${PLATFORM_DISPLAY_NAME}, salvo prerrogativa legal especial do consumidor ou outra norma imperativa.

## 9. Contato

Para questões sobre estes Termos ou sobre exercício de direitos relacionados a dados pessoais, utilize o canal indicado na Política de Privacidade (e-mail institucional a ser definido pela ${PLATFORM_DISPLAY_NAME} e pelo advogado).
`;

export const DEFAULT_PRIVACY_MARKDOWN = `Esta Política de Privacidade descreve como a ${PLATFORM_DISPLAY_NAME} trata dados pessoais no contexto dos seus serviços digitais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD) e demais normas aplicáveis. **Texto-base para revisão jurídica**; ajuste de bases legais, titularidade, encarregado (DPO) e detalhes contratuais deve ser feito pelo advogado.

## 1. Controlador e encarregado

A ${PLATFORM_DISPLAY_NAME} atua como controladora dos dados pessoais tratados diretamente através da plataforma, na medida em que define as finalidades e os meios do tratamento. O nome corporativo completo, CNPJ, endereço e canal de contato do encarregado de dados (DPO ou canal equivalente) devem ser inseridos aqui pelo advogado. Quando o tratamento ocorrer em nome de empresas contratantes (por exemplo, relatórios de participação de colaboradores), poderá haver co-controlador ou encaminhamento de solicitações conforme contratos e lei.

## 2. Quais dados podemos tratar

Exemplos de categorias, conforme o caso:

- **Identificação e cadastro:** nome, e-mail, CPF (quando exigido ao cadastro), perfil de acesso (gestor/colaborador), vínculo com empresa contratante.
- **Dados educacionais:** progresso em cursos, respostas a questionários quando aplicável, emissão de certificados, datas de conclusão.
- **Dados técnicos:** registros de acesso, logs de segurança, identificadores de sessão, endereço IP, conforme necessário e proporcional.
- **Dados de navegação em áreas públicas:** conforme cookies e ferramentas eventualmente utilizadas (detalhar em adendo ou política de cookies, se houver).

## 3. Finalidades e bases legais (LGPD)

As finalidades incluem: prestação do serviço contratado; cumprimento de obrigação legal ou regulatória; execução de políticas públicas; proteção da vida; tutela da saúde em procedimento realizado por profissionais de saúde ou serviços de saúde (quando aplicável ao caso); legítimo interesse, após teste de balanceamento; consentimento, quando necessário para finalidade específica. **O advogado deve qualificar cada tratamento com a base legal adequada.**

## 4. Compartilhamento de dados

Dados podem ser compartilhados com: empresa contratante à qual o participante está vinculado (ex.: relatórios de adesão e desempenho agregado ou identificável conforme contrato); prestadores de serviços em nuvem e infraestrutura (ex.: Google Cloud / Firebase); autoridades quando exigido por lei. Não vendemos dados pessoais a terceiros para marketing livre.

## 5. Transferência internacional

Serviços de nuvem podem envolver transferência internacional de dados. Devem ser descritos garantias adequadas (cláusulas contratuais padrão, decisões de adequação, etc.), conforme orientação jurídica.

## 6. Prazos de retenção

Os dados serão mantidos pelo tempo necessário para cumprir as finalidades, obrigações legais e resolução de litígios. Prazos específicos por tipo de dado devem ser definidos pelo advogado e pela governança interna.

## 7. Direitos do titular

Nos termos da LGPD, o titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento, revogação de consentimento quando aplicável, e oposição a tratamentos baseados em legítimo interesse. Pedidos devem ser feitos pelo canal indicado abaixo, com possível solicitação de informações para confirmação de identidade.

## 8. Segurança

Adotamos medidas técnicas e administrativas proporcionais ao risco, incluindo controles de acesso, autenticação, comunicação cifrada (HTTPS) e regras de permissão na base de dados. Nenhum sistema é absolutamente seguro; em caso de incidente relevante, serão adotadas medidas conforme a lei.

## 9. Crianças e adolescentes

O serviço B2B de capacitação empresarial pressupõe público majoritariamente adulto. Se houver tratamento de menores, aplicar requisitos legais adicionais (consentimento assistido, melhor interesse, etc.) — a definir pelo advogado.

## 10. Alterações desta política

Esta política pode ser atualizada. Recomenda-se registrar versão e data de publicação e, quando necessário, obter novo consentimento ou realizar comunicação prévia conforme a lei.

## 11. Contato para privacidade

E-mail: **[privacidade@exemplo.org — a definir]**
`;

export const DEFAULT_COMMITMENTS_MARKDOWN = `Este documento reúne declarações e compromissos do participante que se cadastra na ${PLATFORM_DISPLAY_NAME} por convite de empresa contratante, para fins de transparência e boa-fé contratual e educacional. **Não substitui os Termos de Uso nem a Política de Privacidade.**

## 1. Veracidade das informações

Declaro que os dados fornecidos no cadastro (incluindo nome, e-mail, CPF quando solicitado e chave de acesso fornecida pela empresa) são verdadeiros e atualizados, responsabilizando-me por informações falsas ou de terceiros utilizadas indevidamente.

## 2. Uso adequado da plataforma

Comprometo-me a utilizar os cursos e materiais apenas para fins de aprendizagem no âmbito da relação com a empresa contratante, sem reprodução, distribuição pública ou comercial não autorizada de conteúdos protegidos por direitos autorais ou segredos comerciais da ${PLATFORM_DISPLAY_NAME} ou de terceiros.

## 3. Confidencialidade de credenciais

Comprometo-me a não partilhar login e senha com outras pessoas e a comunicar à empresa ou à ${PLATFORM_DISPLAY_NAME} suspeitas de uso indevido da conta.

## 4. Natureza educacional do conteúdo

Entendo que os cursos têm caráter formativo e podem abordar temas de saúde, segurança do trabalho e regulamentações (como referências a normas e boas práticas aplicáveis ao contexto do curso), sem constituir consulta médica, jurídica ou técnica individualizada. Em caso de emergência ou crise pessoal, devo buscar canais adequados (serviços de saúde, emergência, apoio psicológico institucional da minha empresa, quando existir).

## 5. Dados e relatórios

Estou ciente de que a empresa contratante pode receber informações sobre progresso e resultados de aprendizagem necessários à gestão do programa de capacitação, nos termos da Política de Privacidade e da legislação aplicável.

## 6. Sanções em caso de violação

O descumprimento destes compromissos pode implicar suspensão de acesso, responsabilização civil ou administrativa conforme o caso, sem prejuízo de medidas previstas em contrato entre a ${PLATFORM_DISPLAY_NAME} e a empresa contratante.
`;

export const DEFAULT_VENDOR_CONFIDENTIALITY_MARKDOWN = `Este instrumento estabelece obrigações de confidencialidade e conduta para pessoas autorizadas a atuar como **vendedores ou representantes comerciais** da ${PLATFORM_DISPLAY_NAME}, com acesso a informações sobre empresas clientes, colaboradores (no limite dos dados expostos nas funcionalidades da plataforma), conteúdos de cursos e relatórios. **Texto-base para revisão jurídica.**

## 1. Informações confidenciais

Consideram-se confidenciais, sem lista exaustiva:

- Conteúdos pedagógicos, roteiros, gabaritos, materiais de apoio e qualquer documentação não publicada ou marcada como restrita;
- Dados de empresas clientes (nome, CNPJ quando visível, estratégias de compra, prazos, valores, condições negociais);
- Dados de colaboradores e gestores obtidos através de relatórios da plataforma (nomes, e-mails, desempenho em cursos, indicadores agregados ou individuais conforme a tela);
- Credenciais de acesso, chaves, listas de contatos e qualquer informação obtida em razão da função.

## 2. Dever de sigilo

O vendedor obriga-se a manter sigilo absoluto sobre as informações confidenciais, utilizando-as apenas para as finalidades autorizadas pela ${PLATFORM_DISPLAY_NAME} (prospecção, relacionamento, suporte comercial e acompanhamento contratual permitido), não podendo divulgá-las, copiá-las, gravá-las em dispositivos não autorizados, transmiti-las a concorrentes ou utilizá-las em benefício próprio ou de terceiros.

## 3. Medidas de segurança

O vendedor deve proteger credenciais de acesso, ativar boas práticas de senha, não partilhar conta, e comunicar imediatamente à ${PLATFORM_DISPLAY_NAME} qualquer suspeita de acesso indevido ou vazamento.

## 4. Propriedade intelectual

Reconhece-se que conteúdos e materiais da ${PLATFORM_DISPLAY_NAME} permanecem de titularidade da ${PLATFORM_DISPLAY_NAME} ou de licenciadores, não podendo ser reproduzidos ou distribuídos fora do estritamente necessário à atividade autorizada.

## 5. Prazo

As obrigações de confidencialidade subsistem após o término do relacionamento comercial, pelo prazo e nas exceções previstos em lei e contrato de prestação de serviços a ser firmado (a integrar pelo advogado).

## 6. Consequências em caso de violação

O descumprimento pode ensejar advertência, suspensão imediata de acesso à plataforma, rescisão de eventuais contratos, indenização por perdas e danos, medidas judiciais ou extrajudiciais cabíveis, e comunicação às autoridades quando houver indício de ilícito ou obrigação legal, sem prejuízo de sanções penais caso configurados crimes de violação de sigilo ou concorrência desleal, conforme o caso concreto.

## 7. Lei e foro

Aplica-se a lei brasileira. Foro e competência a definir em contrato mestre (a cargo do advogado).
`;
