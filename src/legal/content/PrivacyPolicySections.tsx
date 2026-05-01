import { useBrand } from '@/contexts/useBrand';

/** Texto-base para revisão pelo advogado — Política de privacidade (LGPD). */
export function PrivacyPolicySections() {
  const brand = useBrand();
  return (
    <>
      <p>
        Esta Política de Privacidade descreve como a {brand.platformDisplayName} trata dados pessoais no contexto
        dos seus serviços digitais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 —
        LGPD) e demais normas aplicáveis. <strong>Texto-base para revisão jurídica</strong>; ajuste de bases
        legais, titularidade, encarregado (DPO) e detalhes contratuais deve ser feito pelo advogado.
      </p>

      <h2>1. Controlador e encarregado</h2>
      <p>
        A {brand.platformDisplayName} atua como controladora dos dados pessoais tratados diretamente através da
        plataforma, na medida em que define as finalidades e os meios do tratamento. O nome corporativo
        completo, CNPJ, endereço e canal de contato do encarregado de dados (DPO ou canal equivalente) devem
        ser inseridos aqui pelo advogado. Quando o tratamento ocorrer em nome de empresas contratantes (por
        exemplo, relatórios de participação de colaboradores), poderá haver co-controlador ou encaminhamento
        de solicitações conforme contratos e lei.
      </p>

      <h2>2. Quais dados podemos tratar</h2>
      <p>Exemplos de categorias, conforme o caso:</p>
      <ul>
        <li>
          <strong>Identificação e cadastro:</strong> nome, e-mail, CPF (quando exigido ao cadastro), perfil de
          acesso (gestor/colaborador), vínculo com empresa contratante.
        </li>
        <li>
          <strong>Dados educacionais:</strong> progresso em cursos, respostas a questionários quando aplicável,
          emissão de certificados, datas de conclusão.
        </li>
        <li>
          <strong>Dados técnicos:</strong> registros de acesso, logs de segurança, identificadores de sessão,
          endereço IP, conforme necessário e proporcional.
        </li>
        <li>
          <strong>Dados de navegação em áreas públicas:</strong> conforme cookies e ferramentas eventualmente
          utilizadas (detalhar em adendo ou política de cookies, se houver).
        </li>
      </ul>

      <h2>3. Finalidades e bases legais (LGPD)</h2>
      <p>
        As finalidades incluem: prestação do serviço contratado; cumprimento de obrigação legal ou regulatória;
        execução de políticas públicas; proteção da vida; tutela da saúde em procedimento realizado por
        profissionais de saúde ou serviços de saúde (quando aplicável ao caso); legítimo interesse, após teste
        de balanceamento; consentimento, quando necessário para finalidade específica.{' '}
        <strong>O advogado deve qualificar cada tratamento com a base legal adequada.</strong>
      </p>

      <h2>4. Compartilhamento de dados</h2>
      <p>
        Dados podem ser compartilhados com: empresa contratante à qual o participante está vinculado (ex.:
        relatórios de adesão e desempenho agregado ou identificável conforme contrato); prestadores de serviços
        em nuvem e infraestrutura (ex.: Google Cloud / Firebase); autoridades quando exigido por lei. Não
        vendemos dados pessoais a terceiros para marketing livre.
      </p>

      <h2>5. Transferência internacional</h2>
      <p>
        Serviços de nuvem podem envolver transferência internacional de dados. Devem ser descritos garantias
        adequadas (cláusulas contratuais padrão, decisões de adequação, etc.), conforme orientação jurídica.
      </p>

      <h2>6. Prazos de retenção</h2>
      <p>
        Os dados serão mantidos pelo tempo necessário para cumprir as finalidades, obrigações legais e resolução
        de litígios. Prazos específicos por tipo de dado devem ser definidos pelo advogado e pela governança
        interna.
      </p>

      <h2>7. Direitos do titular</h2>
      <p>
        Nos termos da LGPD, o titular pode solicitar confirmação de tratamento, acesso, correção,
        anonimização, portabilidade, eliminação, informação sobre compartilhamento, revogação de consentimento
        quando aplicável, e oposição a tratamentos baseados em legítimo interesse. Pedidos devem ser feitos pelo
        canal indicado abaixo, com possível solicitação de informações para confirmação de identidade.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Adotamos medidas técnicas e administrativas proporcionais ao risco, incluindo controles de acesso,
        autenticação, comunicação cifrada (HTTPS) e regras de permissão na base de dados. Nenhum sistema é
        absolutamente seguro; em caso de incidente relevante, serão adotadas medidas conforme a lei.
      </p>

      <h2>9. Crianças e adolescentes</h2>
      <p>
        O serviço B2B de capacitação empresarial pressupõe público majoritariamente adulto. Se houver
        tratamento de menores, aplicar requisitos legais adicionais (consentimento assistido, melhor interesse,
        etc.) — a definir pelo advogado.
      </p>

      <h2>10. Alterações desta política</h2>
      <p>
        Esta política pode ser atualizada. Recomenda-se registrar versão e data de publicação e, quando
        necessário, obter novo consentimento ou realizar comunicação prévia conforme a lei.
      </p>

      <h2>11. Contato para privacidade</h2>
      <p>
        E-mail: <strong>[privacidade@exemplo.org — a definir]</strong>
      </p>
    </>
  );
}
