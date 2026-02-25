import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const TermsOfUse = () => {
  return (
    <div className="min-h-screen bg-background font-funnel">
      <PublicHeader />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-4">Termos de Uso</h1>
              <p className="text-muted-foreground">Última atualização: Janeiro de 2026</p>
            </div>

            <div className="prose prose-invert max-w-none">
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">1. Aceitação dos Termos</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Ao acessar e usar a plataforma Appi AutoZap, operada pela Appi Company (CNPJ: 62.570.507/0001-38), você concorda em cumprir e ficar vinculado aos seguintes termos e condições de uso. 
                  Se você não concordar com qualquer parte destes termos, não poderá acessar o serviço.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">2. Definições</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Para fins destes Termos, consideram-se as seguintes definições:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong>"Plataforma"</strong>: O sistema Appi AutoZap, incluindo website, aplicativo e funcionalidades</li>
                  <li><strong>"Usuário"</strong>: Pessoa física ou jurídica que utiliza a Plataforma</li>
                  <li><strong>"Agente de IA"</strong>: Sistema de inteligência artificial especializado que processa e responde mensagens automaticamente. A Plataforma permite criar múltiplos agentes com personalidades e funções distintas (Vendas, Suporte, Agendamentos, Financeiro, Técnico)</li>
                  <li><strong>"Roteamento de Agentes"</strong>: Sistema que direciona automaticamente as conversas para o agente mais adequado com base em palavras-chave ou análise contextual por IA</li>
                  <li><strong>"Base de Conhecimento"</strong>: Conjunto de informações sobre o negócio do Usuário que os Agentes utilizam para responder perguntas</li>
                  <li><strong>"Conexão WhatsApp"</strong>: Integração entre a Plataforma e o WhatsApp Business do Usuário</li>
                  <li><strong>"Leads"</strong>: Contatos capturados através das conversas via WhatsApp</li>
                  <li><strong>"Workspace"</strong>: Ambiente de trabalho isolado do Usuário na Plataforma</li>
                  <li><strong>"Cliente Final"</strong>: Pessoa que entra em contato via WhatsApp com o Usuário</li>
                  <li><strong>"Automações de Grupos"</strong>: Funcionalidade que permite configurar mensagens automáticas enviadas quando novos participantes ingressam em grupos ou comunidades WhatsApp vinculadas ao Usuário</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">3. Descrição do Serviço</h2>
                <p className="text-muted-foreground leading-relaxed">
                  O Appi AutoZap é uma plataforma de automação de atendimento via WhatsApp com inteligência artificial, 
                  projetada para ajudar empresas a:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Automatizar respostas a clientes utilizando Agentes de IA personalizáveis</li>
                  <li>Capturar e gerenciar leads de forma automática</li>
                  <li>Agendar compromissos e consultas diretamente via chat</li>
                  <li>Transferir conversas para atendimento humano quando necessário</li>
                  <li>Analisar métricas de atendimento e conversão</li>
                  <li>Automatizar boas-vindas para novos membros em grupos e comunidades WhatsApp</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">4. Uso da Inteligência Artificial</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Ao utilizar os recursos de IA da Plataforma, o Usuário reconhece e concorda que:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>A IA processa mensagens recebidas para gerar respostas automatizadas baseadas nas configurações definidas pelo Usuário</li>
                  <li>As respostas geradas pela IA são de responsabilidade do Usuário, que deve revisar e ajustar o comportamento do Agente</li>
                  <li>A IA não substitui consultoria profissional (jurídica, médica, financeira ou outras áreas regulamentadas)</li>
                  <li>O Usuário é responsável por configurar limites e restrições adequados ao seu negócio</li>
                  <li>A precisão das respostas depende da qualidade da base de conhecimento configurada pelo Usuário</li>
                  <li>Em situações complexas, a transferência para atendimento humano deve ser configurada</li>
                  <li>A Plataforma permite criar <strong>múltiplos Agentes de IA</strong> especializados (Vendas, Suporte, Agendamentos, Financeiro, Técnico), cada um com personalidade e comportamento configuráveis</li>
                  <li>O <strong>Roteamento Inteligente</strong> pode transferir automaticamente conversas entre agentes com base em palavras-chave detectadas ou análise contextual por IA</li>
                  <li>Cada agente possui sua própria <strong>personalidade</strong> (tom, formalidade, uso de emojis) e <strong>prompt de instruções</strong> personalizável</li>
                  <li>A <strong>Base de Conhecimento</strong> é compartilhada entre todos os agentes e deve ser mantida atualizada pelo Usuário</li>
                  <li>Os <strong>avatares dos agentes</strong> podem ser gerados automaticamente por inteligência artificial</li>
                  <li>As <strong>Automações de Grupos</strong> enviam mensagens automaticamente quando novos participantes são detectados, conforme configurado pelo Usuário, podendo ser enviadas no grupo ou diretamente no privado</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">5. Integração com WhatsApp</h2>
                <p className="text-muted-foreground leading-relaxed">
                  A integração com WhatsApp está sujeita aos termos e políticas do WhatsApp Business. O Usuário concorda em:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Cumprir integralmente os Termos de Serviço e Políticas do WhatsApp Business</li>
                  <li>Não utilizar a Plataforma para envio de spam, mensagens em massa não solicitadas ou marketing não autorizado</li>
                  <li>Obter consentimento dos Clientes Finais antes de enviar mensagens promocionais</li>
                  <li>Não utilizar para atividades ilegais, fraudulentas ou que violem direitos de terceiros</li>
                  <li>Compreender que o Appi AutoZap não tem controle sobre ações do WhatsApp, incluindo banimentos ou restrições</li>
                  <li>Assumir total responsabilidade por eventuais penalidades aplicadas pelo WhatsApp devido ao mau uso</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  <strong>Aviso Importante:</strong> O uso inadequado pode resultar em banimento da conta WhatsApp do Usuário pelo próprio WhatsApp. 
                  O Appi AutoZap não se responsabiliza por tais penalidades.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">6. Tratamento de Dados de Conversas</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Sobre o tratamento de dados de conversas entre o Usuário e seus Clientes Finais:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>O Usuário é o <strong>Controlador</strong> dos dados pessoais de seus Clientes Finais</li>
                  <li>O Appi AutoZap atua como <strong>Operador</strong> de dados, processando informações conforme instruções do Usuário</li>
                  <li>O Usuário é responsável por informar seus Clientes Finais sobre o uso de IA no atendimento</li>
                  <li>O Usuário deve obter consentimento adequado de seus Clientes Finais para o tratamento de dados</li>
                  <li>Conversas podem ser utilizadas para melhoria dos algoritmos de IA, de forma anonimizada</li>
                  <li>O Usuário pode solicitar opt-out do uso de dados para treinamento de IA entrando em contato conosco</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">7. Uso Adequado</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Você concorda em usar o Appi AutoZap apenas para fins legais e de acordo com estes Termos. É expressamente proibido:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Enviar spam, mensagens não solicitadas ou praticar phishing</li>
                  <li>Violar qualquer lei local, estadual, nacional ou internacional</li>
                  <li>Violar os termos de uso do WhatsApp ou de outros serviços integrados</li>
                  <li>Transmitir material ofensivo, discriminatório, fraudulento ou ilegal</li>
                  <li>Tentar acessar contas ou dados de outros Usuários</li>
                  <li>Realizar engenharia reversa ou tentar burlar sistemas de segurança</li>
                  <li>Utilizar bots ou scripts não autorizados para automatizar ações</li>
                  <li>Sobrecarregar intencionalmente os servidores da Plataforma</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">8. Contas de Usuário</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Ao criar uma conta na Plataforma:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Você é responsável por manter a confidencialidade de sua senha e credenciais</li>
                  <li>Você deve fornecer informações verdadeiras, precisas e atualizadas</li>
                  <li>Você concorda em aceitar responsabilidade por todas as atividades realizadas em sua conta</li>
                  <li>Você deve notificar imediatamente qualquer uso não autorizado de sua conta</li>
                  <li>A Plataforma pode suspender contas que violem estes Termos</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">9. Planos, Pagamentos e Assinaturas</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Sobre planos e pagamentos:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>O período de trial é de 48 horas, sem necessidade de cartão de crédito</li>
                  <li>Após o trial, é necessário assinar um plano pago para continuar utilizando o serviço</li>
                  <li>As assinaturas são renovadas automaticamente ao final de cada período (mensal ou anual)</li>
                  <li>Os preços podem ser reajustados com aviso prévio de 30 dias</li>
                  <li>O pagamento pode ser realizado via Pix, boleto ou cartão de crédito</li>
                  <li>A inadimplência por mais de 3 dias pode resultar em suspensão do serviço</li>
                  <li>Cada plano possui limite específico de conexões WhatsApp</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">10. Cancelamento e Reembolso</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Política de cancelamento:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>O Usuário pode cancelar a assinatura a qualquer momento através das configurações da conta</li>
                  <li>O cancelamento será efetivado ao final do período já pago</li>
                  <li>Não há reembolso proporcional para cancelamentos antes do fim do período</li>
                  <li>Após o cancelamento, o Usuário terá 30 dias para exportar seus dados</li>
                  <li>Dados serão excluídos permanentemente após 90 dias do cancelamento</li>
                  <li>Reembolsos podem ser solicitados em casos excepcionais, sujeitos à análise</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">11. Disponibilidade e SLA</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Sobre a disponibilidade do serviço:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Nos esforçamos para manter disponibilidade de 99,5% (uptime)</li>
                  <li>Manutenções programadas serão comunicadas com antecedência mínima de 24 horas</li>
                  <li>Interrupções emergenciais podem ocorrer sem aviso prévio para segurança da Plataforma</li>
                  <li>O Appi AutoZap não se responsabiliza por indisponibilidades causadas por terceiros (WhatsApp, provedores de internet, etc.)</li>
                  <li>Não garantimos funcionamento ininterrupto ou livre de erros</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">12. Exportação de Dados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  O Usuário tem direito a exportar seus dados:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Leads e contatos podem ser exportados em formato CSV</li>
                  <li>Histórico de conversas pode ser solicitado mediante requisição</li>
                  <li>Relatórios e métricas estão disponíveis para download</li>
                  <li>A exportação completa pode levar até 5 dias úteis para ser processada</li>
                </ul>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">13. Propriedade Intelectual</h2>
                <p className="text-muted-foreground leading-relaxed">
                  O serviço e seu conteúdo original, recursos e funcionalidades são de propriedade exclusiva da Appi Company 
                  e estão protegidos por leis de direitos autorais, marcas registradas e outras leis de propriedade intelectual.
                  O Usuário não adquire nenhum direito sobre a Plataforma além da licença de uso durante a vigência da assinatura.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">14. Limitação de Responsabilidade</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Em nenhum caso a Appi Company, seus diretores, funcionários ou agentes serão responsáveis por:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Danos indiretos, incidentais, especiais, consequenciais ou punitivos</li>
                  <li>Perda de lucros, receitas, dados ou oportunidades de negócio</li>
                  <li>Ações do WhatsApp, incluindo banimentos ou restrições de conta</li>
                  <li>Respostas inadequadas geradas pela IA devido a configurações do Usuário</li>
                  <li>Interrupções causadas por terceiros ou força maior</li>
                  <li>Decisões tomadas com base em informações fornecidas pela Plataforma</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  A responsabilidade total da Appi Company está limitada ao valor pago pelo Usuário nos últimos 12 meses.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">15. Alterações nos Termos</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Reservamo-nos o direito de modificar ou substituir estes Termos a qualquer momento. 
                  Se uma revisão for material, forneceremos um aviso de pelo menos 30 dias antes de quaisquer novos termos entrarem em vigor.
                  O uso continuado da Plataforma após as alterações constitui aceitação dos novos Termos.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">16. Lei Aplicável e Foro</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Estes Termos serão regidos e interpretados de acordo com as leis da República Federativa do Brasil.
                  Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias decorrentes destes Termos,
                  com renúncia expressa a qualquer outro, por mais privilegiado que seja.
                </p>
              </section>

              <section className="space-y-4 mt-8">
                <h2 className="text-2xl font-semibold text-foreground">17. Contato</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Se você tiver alguma dúvida sobre estes Termos, entre em contato conosco:
                </p>
                <ul className="list-none text-muted-foreground space-y-2 ml-4 mt-4">
                  <li><strong>Empresa:</strong> Appi Company</li>
                  <li><strong>CNPJ:</strong> 62.570.507/0001-38</li>
                  <li><strong>E-mail:</strong>{" "}
                    <a href="mailto:contato@appicompany.com" className="text-primary hover:underline">
                      contato@appicompany.com
                    </a>
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default TermsOfUse;
