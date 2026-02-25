import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background font-funnel">
      <PublicHeader />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-4">Política de Privacidade</h1>
              <p className="text-muted-foreground">Última atualização: Janeiro de 2026</p>
            </div>

            <div className="prose prose-invert max-w-none">
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">1. Controlador de Dados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Esta Política de Privacidade descreve como a Appi Company, pessoa jurídica de direito privado, 
                  inscrita no CNPJ sob nº 62.570.507/0001-38, na qualidade de <strong>Controlador de Dados</strong>, 
                  coleta, utiliza, armazena e protege suas informações pessoais em conformidade com a 
                  Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  <strong>Encarregado de Proteção de Dados (DPO):</strong><br />
                  Para questões relacionadas à privacidade e proteção de dados, entre em contato:<br />
                  E-mail:{" "}
                  <a href="mailto:contato@appicompany.com" className="text-primary hover:underline">
                    contato@appicompany.com
                  </a>
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">2. Dados Pessoais Coletados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Coletamos os seguintes tipos de dados pessoais:
                </p>
                
                <h3 className="text-lg font-semibold text-foreground mt-4">2.1. Dados fornecidos diretamente pelo Usuário:</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Dados cadastrais: nome completo, e-mail, telefone, nome da empresa</li>
                  <li>Dados de pagamento: processados por provedores seguros (Asaas), não armazenamos dados de cartão</li>
                  <li>Configurações dos Agentes de IA: prompts personalizados, base de conhecimento compartilhada, configurações de personalidade (tom, formalidade, emojis), avatares, regras de roteamento entre agentes</li>
                </ul>

                <h3 className="text-lg font-semibold text-foreground mt-4">2.2. Dados coletados automaticamente:</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Dados de uso: páginas acessadas, funcionalidades utilizadas, tempo de sessão</li>
                  <li>Dados técnicos: endereço IP, tipo de navegador, sistema operacional</li>
                  <li>Cookies e tecnologias similares (veja nossa Política de Cookies)</li>
                </ul>

                <h3 className="text-lg font-semibold text-foreground mt-4">2.3. Dados de conversas WhatsApp:</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Mensagens recebidas e enviadas através da integração</li>
                  <li>Dados dos Clientes Finais: nome, telefone, conteúdo das conversas</li>
                  <li>Metadados: data/hora das mensagens, status de leitura</li>
                  <li>Eventos de grupos: notificações de novos participantes para execução de automações de boas-vindas</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">3. Bases Legais para Tratamento (Art. 7º LGPD)</h2>
                <p className="text-muted-foreground leading-relaxed">
                  O tratamento de dados pessoais é realizado com base nas seguintes hipóteses legais:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-3 ml-4">
                  <li>
                    <strong>Execução de contrato (Art. 7º, V):</strong> Para fornecer os serviços contratados, 
                    processar pagamentos e manter sua conta ativa
                  </li>
                  <li>
                    <strong>Legítimo interesse (Art. 7º, IX):</strong> Para melhorar nossos serviços, 
                    prevenir fraudes, garantir segurança da plataforma e comunicar atualizações relevantes
                  </li>
                  <li>
                    <strong>Consentimento (Art. 7º, I):</strong> Para envio de comunicações de marketing, 
                    uso de dados para treinamento de IA (quando aplicável) e cookies não essenciais
                  </li>
                  <li>
                    <strong>Cumprimento de obrigação legal (Art. 7º, II):</strong> Para atender exigências 
                    fiscais, tributárias e regulatórias
                  </li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">4. Tratamento por Inteligência Artificial</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Nossa plataforma utiliza Inteligência Artificial para automatizar atendimentos. Sobre este tratamento:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    <strong>Processamento de mensagens:</strong> A IA analisa o conteúdo das mensagens recebidas 
                    para gerar respostas automatizadas conforme configurado pelo Usuário
                  </li>
                  <li>
                    <strong>Decisões automatizadas:</strong> O sistema pode classificar leads, agendar compromissos 
                    e direcionar conversas automaticamente
                  </li>
                  <li>
                    <strong>Direito à revisão humana:</strong> O titular dos dados pode solicitar revisão humana 
                    de decisões tomadas exclusivamente por meios automatizados (Art. 20 LGPD)
                  </li>
                  <li>
                    <strong>Treinamento de modelos:</strong> Dados podem ser utilizados de forma anonimizada para 
                    melhoria dos algoritmos. Usuários podem solicitar opt-out desta funcionalidade
                  </li>
                  <li>
                    <strong>Roteamento entre agentes:</strong> O sistema pode transferir automaticamente 
                    conversas entre diferentes agentes especializados (Vendas, Suporte, Agendamentos, 
                    Financeiro, Técnico) com base na análise do conteúdo das mensagens
                  </li>
                  <li>
                    <strong>Avatares gerados por IA:</strong> Os avatares dos agentes podem ser gerados 
                    automaticamente por inteligência artificial com base no nome e tipo do agente
                  </li>
                  <li>
                    <strong>Automações de grupos:</strong> Quando novos participantes ingressam em grupos WhatsApp configurados, 
                    o sistema envia automaticamente mensagens personalizadas de boas-vindas, podendo incluir nome do grupo, 
                    telefone do participante e data atual
                  </li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">5. Dados de Terceiros (Clientes Finais)</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Quanto aos dados dos Clientes Finais que interagem via WhatsApp com nossos Usuários:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    <strong>Responsabilidade do Usuário:</strong> O Usuário da plataforma é o Controlador 
                    dos dados de seus Clientes Finais e deve obter consentimento adequado
                  </li>
                  <li>
                    <strong>Appi AutoZap como Operador:</strong> Atuamos como Operador de dados, processando 
                    informações conforme instruções do Usuário-Controlador
                  </li>
                  <li>
                    <strong>Transparência:</strong> O Usuário deve informar seus Clientes Finais sobre 
                    o uso de IA no atendimento e o tratamento de dados
                  </li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">6. Finalidades do Tratamento</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Utilizamos os dados pessoais coletados para:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Fornecer, operar e manter os serviços da plataforma</li>
                  <li>Processar pagamentos e gerenciar assinaturas</li>
                  <li>Enviar notificações transacionais e de serviço</li>
                  <li>Oferecer suporte técnico e atendimento ao cliente</li>
                  <li>Melhorar e personalizar a experiência do usuário</li>
                  <li>Desenvolver novos recursos e funcionalidades</li>
                  <li>Treinar e aprimorar modelos de inteligência artificial</li>
                  <li>Prevenir fraudes e garantir segurança da plataforma</li>
                  <li>Cumprir obrigações legais e regulatórias</li>
                  <li>Enviar comunicações de marketing (mediante consentimento)</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">7. Compartilhamento de Dados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Não vendemos dados pessoais.</strong> Compartilhamos informações apenas nas seguintes situações:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    <strong>Prestadores de serviços:</strong> Empresas que nos auxiliam na operação 
                    (processamento de pagamentos, hospedagem, análises), sempre sob acordos de confidencialidade
                  </li>
                  <li>
                    <strong>Integrações:</strong> WhatsApp/Meta para funcionamento da integração de mensagens
                  </li>
                  <li>
                    <strong>Obrigações legais:</strong> Quando exigido por lei, ordem judicial ou autoridade competente
                  </li>
                  <li>
                    <strong>Proteção de direitos:</strong> Para proteger direitos, propriedade ou segurança da Appi Company, 
                    usuários ou terceiros
                  </li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">8. Transferência Internacional de Dados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Alguns de nossos prestadores de serviços podem estar localizados fora do Brasil. 
                  Nesses casos, garantimos que:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>A transferência ocorre apenas para países com nível adequado de proteção ou mediante garantias apropriadas</li>
                  <li>Utilizamos cláusulas contratuais padrão aprovadas para proteção dos dados</li>
                  <li>Os destinatários estão sujeitos a obrigações de confidencialidade equivalentes</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">9. Períodos de Retenção</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Mantemos seus dados pessoais pelos seguintes períodos:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    <strong>Dados cadastrais:</strong> Durante a vigência da conta e por 5 anos após o encerramento 
                    (obrigações fiscais)
                  </li>
                  <li>
                    <strong>Conversas e mensagens:</strong> 12 meses após o encerramento da conta
                  </li>
                  <li>
                    <strong>Leads e contatos:</strong> Durante a vigência da conta, exportáveis em até 30 dias após cancelamento
                  </li>
                  <li>
                    <strong>Logs de acesso:</strong> 6 meses (Marco Civil da Internet)
                  </li>
                  <li>
                    <strong>Dados de pagamento:</strong> 5 anos (legislação fiscal)
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Após os períodos indicados, os dados são excluídos ou anonimizados de forma irreversível.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">10. Medidas de Segurança</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Implementamos medidas técnicas e organizacionais para proteger seus dados:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>
                    <strong>Criptografia:</strong> Dados em trânsito (TLS 1.3) e em repouso (AES-256)
                  </li>
                  <li>
                    <strong>Controle de acesso:</strong> Autenticação multifator, princípio do menor privilégio
                  </li>
                  <li>
                    <strong>Monitoramento:</strong> Detecção de intrusões e análise contínua de vulnerabilidades
                  </li>
                  <li>
                    <strong>Backups:</strong> Cópias de segurança criptografadas em múltiplas localidades
                  </li>
                  <li>
                    <strong>Isolamento:</strong> Cada Workspace possui dados isolados de outros usuários
                  </li>
                  <li>
                    <strong>Conformidade:</strong> Infraestrutura hospedada em provedores certificados (SOC 2, ISO 27001)
                  </li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">11. Seus Direitos (LGPD)</h2>
                <p className="text-muted-foreground leading-relaxed">
                  De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem os seguintes direitos:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong>Confirmação e acesso:</strong> Confirmar a existência de tratamento e acessar seus dados</li>
                  <li><strong>Correção:</strong> Solicitar a correção de dados incompletos, inexatos ou desatualizados</li>
                  <li><strong>Anonimização ou eliminação:</strong> Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</li>
                  <li><strong>Portabilidade:</strong> Obter uma cópia de seus dados em formato estruturado</li>
                  <li><strong>Revogação do consentimento:</strong> Retirar consentimento a qualquer momento</li>
                  <li><strong>Informação sobre compartilhamento:</strong> Saber com quais entidades seus dados foram compartilhados</li>
                  <li><strong>Oposição:</strong> Opor-se ao tratamento quando aplicável</li>
                  <li><strong>Revisão de decisões automatizadas:</strong> Solicitar revisão humana de decisões tomadas por IA</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Para exercer seus direitos, entre em contato pelo e-mail:{" "}
                  <a href="mailto:contato@appicompany.com" className="text-primary hover:underline">
                    contato@appicompany.com
                  </a>
                  . Responderemos em até 15 dias.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">12. Cookies e Tecnologias de Rastreamento</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Utilizamos cookies e tecnologias similares para melhorar sua experiência. Para informações detalhadas, 
                  consulte nossa{" "}
                  <a href="/politica-de-cookies" className="text-primary hover:underline">
                    Política de Cookies
                  </a>
                  . Você pode gerenciar preferências de cookies através do seu navegador.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">13. Alterações nesta Política</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Podemos atualizar esta Política de Privacidade periodicamente. Alterações significativas serão 
                  comunicadas por e-mail ou notificação na plataforma com antecedência mínima de 30 dias. 
                  O uso continuado após as alterações constitui aceitação da nova política.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">14. Contato e Reclamações</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Para exercer seus direitos, tirar dúvidas ou registrar reclamações sobre esta política:
                </p>
                <ul className="list-none text-muted-foreground space-y-2 ml-4 mt-4">
                  <li><strong>Empresa:</strong> Appi Company</li>
                  <li><strong>CNPJ:</strong> 62.570.507/0001-38</li>
                  <li><strong>E-mail geral:</strong>{" "}
                    <a href="mailto:contato@appicompany.com" className="text-primary hover:underline">
                      contato@appicompany.com
                    </a>
                  </li>
                  <li><strong>E-mail de privacidade (DPO):</strong>{" "}
                    <a href="mailto:contato@appicompany.com" className="text-primary hover:underline">
                      contato@appicompany.com
                    </a>
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Caso não esteja satisfeito com nossa resposta, você pode apresentar reclamação à 
                  Autoridade Nacional de Proteção de Dados (ANPD).
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default PrivacyPolicy;
