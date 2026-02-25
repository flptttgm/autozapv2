import { Zap, Users, Target, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import SEOHead from "@/components/SEOHead";

const About = () => {
  return (
    <div className="min-h-screen bg-background font-funnel">
      <SEOHead
        title="Sobre o AutoZap | Automação de WhatsApp com Inteligência Artificial"
        description="Conheça o AutoZap: plataforma de automação de WhatsApp com IA. Transformamos o atendimento de empresas com chatbots inteligentes e atendimento 24/7."
        url="https://appiautozap.com/sobre"
        keywords="sobre autozap, automação whatsapp, chatbot ia, atendimento automático, whatsapp business"
      />
      <PublicHeader />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-12">
            {/* Header */}
            <div className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Sobre o{" "}
                <span className="text-primary/70">{"{a}"}</span>
                <span className="text-primary">Appi AutoZap</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Transformando o atendimento ao cliente com inteligência artificial e automação
              </p>
            </div>

            {/* Mission */}
            <div className="bg-secondary/50 rounded-2xl p-8 border border-border">
              <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-3">
                <Target className="w-6 h-6 text-primary" />
                Nossa Missão
              </h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Democratizar o acesso à automação inteligente de atendimento, permitindo que empresas de todos os tamanhos 
                ofereçam suporte 24/7 de alta qualidade aos seus clientes, sem perder o toque humano que faz a diferença.
              </p>
            </div>

            {/* Story */}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-3">
                <Zap className="w-6 h-6 text-primary" />
                Nossa História
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                O Appi AutoZap nasceu da observação de que pequenas e médias empresas enfrentam um desafio constante: 
                atender seus clientes com agilidade e qualidade, mesmo com recursos limitados.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Fundado em 2024 pela Appi Company, desenvolvemos uma solução que combina o poder do WhatsApp 
                — o aplicativo de mensagens mais usado no Brasil — com inteligência artificial de última geração, 
                criando uma experiência de atendimento que funciona 24 horas por dia, 7 dias por semana.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Hoje, ajudamos centenas de empresas a capturar leads, agendar compromissos e responder 
                clientes automaticamente, tudo enquanto mantêm a personalidade única de cada negócio.
              </p>
            </div>

            {/* Values */}
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-3">
                <Award className="w-6 h-6 text-primary" />
                Nossos Valores
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-secondary/30 rounded-xl p-6 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2">Inovação Contínua</h3>
                  <p className="text-muted-foreground">
                    Estamos sempre aprimorando nossa tecnologia para oferecer as melhores soluções de IA do mercado.
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-6 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2">Foco no Cliente</h3>
                  <p className="text-muted-foreground">
                    Cada funcionalidade é desenvolvida pensando em resolver problemas reais das empresas.
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-6 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2">Simplicidade</h3>
                  <p className="text-muted-foreground">
                    Tecnologia poderosa não precisa ser complicada. Tornamos a automação acessível para todos.
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-6 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2">Transparência</h3>
                  <p className="text-muted-foreground">
                    Mantemos comunicação clara sobre preços, recursos e como tratamos os dados dos nossos clientes.
                  </p>
                </div>
              </div>
            </div>

            {/* Team */}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-3">
                <Users className="w-6 h-6 text-primary" />
                Nossa Equipe
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Somos uma equipe apaixonada por tecnologia e atendimento ao cliente. 
                Combinamos expertise em inteligência artificial, desenvolvimento de software e experiência do usuário 
                para criar uma plataforma que realmente faz a diferença no dia a dia das empresas.
              </p>
            </div>

            {/* Technology - RAG */}
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-3">
                <Zap className="w-6 h-6 text-primary" />
                Nossa Tecnologia
              </h2>
              <div className="bg-secondary/50 rounded-2xl p-8 border border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  RAG: Retrieval-Augmented Generation
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Utilizamos RAG (Retrieval-Augmented Generation), uma arquitetura de IA avançada 
                  que combina busca semântica inteligente com geração de linguagem natural.
                </p>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed font-medium">
                    Quando um cliente faz uma pergunta, o sistema:
                  </p>
                  <div className="grid gap-3">
                    <div className="flex items-start gap-3 bg-background/50 rounded-lg p-4 border border-border/50">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">1</span>
                      <div>
                        <p className="font-medium text-foreground">Busca informações relevantes</p>
                        <p className="text-sm text-muted-foreground">Procura na sua Base de Conhecimento o conteúdo mais relacionado à pergunta</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-background/50 rounded-lg p-4 border border-border/50">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">2</span>
                      <div>
                        <p className="font-medium text-foreground">Usa vetores semânticos</p>
                        <p className="text-sm text-muted-foreground">Entende o significado real da pergunta, não apenas palavras-chave literais</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-background/50 rounded-lg p-4 border border-border/50">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">3</span>
                      <div>
                        <p className="font-medium text-foreground">Gera uma resposta personalizada</p>
                        <p className="text-sm text-muted-foreground">Cria uma resposta natural baseada nas informações do seu negócio</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-foreground font-medium">
                    O resultado? Respostas precisas, contextualizadas e alinhadas com as informações do seu negócio — 
                    sem "alucinações" ou invenções.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-primary/10 rounded-2xl p-8 text-center border border-primary/30">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Pronto para transformar seu atendimento?
              </h2>
              <p className="text-muted-foreground mb-6">
                Junte-se a centenas de empresas que já automatizaram seu WhatsApp com o Appi AutoZap.
              </p>
              <Link to="/auth">
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  Começar Grátis
                </Button>
              </Link>
            </div>

            {/* Contact */}
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Entre em Contato</h2>
              <p className="text-muted-foreground">
                Tem alguma dúvida ou quer saber mais? Fale conosco!
              </p>
              <a 
                href="mailto:contato@appicompany.com" 
                className="text-primary hover:underline text-lg"
              >
                contato@appicompany.com
              </a>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default About;
