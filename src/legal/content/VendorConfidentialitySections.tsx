import { useBrand } from '@/contexts/useBrand';

/** Termo de confidencialidade e obrigações do vendedor — base para o advogado. */
export function VendorConfidentialitySections() {
  const brand = useBrand();
  return (
    <>
      <p>
        Este instrumento estabelece obrigações de confidencialidade e conduta para pessoas autorizadas a atuar
        como <strong>vendedores ou representantes comerciais</strong> da {brand.platformDisplayName}, com acesso a
        informações sobre empresas clientes, colaboradores (no limite dos dados expostos nas funcionalidades da
        plataforma), conteúdos de cursos e relatórios.{' '}
        <strong>Texto-base para revisão jurídica.</strong>
      </p>

      <h2>1. Informações confidenciais</h2>
      <p>Consideram-se confidenciais, sem lista exaustiva:</p>
      <ul>
        <li>
          Conteúdos pedagógicos, roteiros, gabaritos, materiais de apoio e qualquer documentação não publicada
          ou marcada como restrita;
        </li>
        <li>
          Dados de empresas clientes (nome, CNPJ quando visível, estratégias de compra, prazos, valores,
          condições negociais);
        </li>
        <li>
          Dados de colaboradores e gestores obtidos através de relatórios da plataforma (nomes, e-mails,
          desempenho em cursos, indicadores agregados ou individuais conforme a tela);
        </li>
        <li>
          Credenciais de acesso, chaves, listas de contatos e qualquer informação obtida em razão da função.
        </li>
      </ul>

      <h2>2. Dever de sigilo</h2>
      <p>
        O vendedor obriga-se a manter sigilo absoluto sobre as informações confidenciais, utilizando-as apenas
        para as finalidades autorizadas pela {brand.platformDisplayName} (prospecção, relacionamento, suporte
        comercial e acompanhamento contratual permitido), não podendo divulgá-las, copiá-las, gravá-las em
        dispositivos não autorizados, transmiti-las a concorrentes ou utilizá-las em benefício próprio ou de
        terceiros.
      </p>

      <h2>3. Medidas de segurança</h2>
      <p>
        O vendedor deve proteger credenciais de acesso, ativar boas práticas de senha, não partilhar conta, e
        comunicar imediatamente à {brand.platformDisplayName} qualquer suspeita de acesso indevido ou vazamento.
      </p>

      <h2>4. Propriedade intelectual</h2>
      <p>
        Reconhece-se que conteúdos e materiais da {brand.platformDisplayName} permanecem de titularidade da{' '}
        {brand.platformDisplayName} ou de licenciadores, não podendo ser reproduzidos ou distribuídos fora do
        estritamente necessário à atividade autorizada.
      </p>

      <h2>5. Prazo</h2>
      <p>
        As obrigações de confidencialidade subsistem após o término do relacionamento comercial, pelo prazo e nas
        exceções previstos em lei e contrato de prestação de serviços a ser firmado (a integrar pelo advogado).
      </p>

      <h2>6. Consequências em caso de violação</h2>
      <p>
        O descumprimento pode ensejar advertência, suspensão imediata de acesso à plataforma, rescisão de
        eventuais contratos, indenização por perdas e danos, medidas judiciais ou extrajudiciais cabíveis, e
        comunicação às autoridades quando houver indício de ilícito ou obrigação legal, sem prejuízo de sanções
        penais caso configurados crimes de violação de sigilo ou concorrência desleal, conforme o caso concreto.
      </p>

      <h2>7. Lei e foro</h2>
      <p>
        Aplica-se a lei brasileira. Foro e competência a definir em contrato mestre (a cargo do advogado).
      </p>
    </>
  );
}
