import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Gift,
  Users,
  Clock,
  Infinity,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Share2,
  UserPlus,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import SEOHead from "@/components/SEOHead";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import YouTubeEmbed from "@/components/landing/YouTubeEmbed";
import videoThumbnail from "@/assets/video-thumbnail.png";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const stats = [
  {
    value: "R$50",
    label: "por indicação confirmada",
    icon: DollarSign
  },
  {
    value: "∞",
    label: "indicações ilimitadas",
    icon: Infinity
  },
  {
    value: "0",
    label: "créditos nunca expiram",
    icon: Clock
  }
];

const steps = [
  {
    number: "1",
    title: "Cadastre-se",
    description: "Crie sua conta grátis no Appi AutoZap",
    icon: UserPlus
  },
  {
    number: "2",
    title: "Compartilhe",
    description: "Acesse sua área de indicação e copie seu link exclusivo",
    icon: Share2
  },
  {
    number: "3",
    title: "Amigo Assina",
    description: "Seu indicado escolhe um plano pago",
    icon: CreditCard
  },
  {
    number: "4",
    title: "Você Ganha",
    description: "R$50 adicionados ao seu saldo automaticamente",
    icon: Wallet
  }
];

const benefits = [
  {
    title: "Indicações Ilimitadas",
    description: "Não há limite para quantas pessoas você pode indicar"
  },
  {
    title: "Créditos Nunca Expiram",
    description: "Use seus créditos quando quiser, sem prazo"
  },
  {
    title: "Acumulativo com Promoções",
    description: "Combine com outras ofertas e descontos"
  },
  {
    title: "Qualquer Pessoa Pode Participar",
    description: "Basta ter uma conta ativa no Appi AutoZap"
  },
  {
    title: "Use em Qualquer Plano",
    description: "Créditos válidos para todos os planos disponíveis"
  },
  {
    title: "Acompanhe pelo Dashboard",
    description: "Veja suas indicações e créditos em tempo real"
  }
];

const faqs = [
  {
    question: "Como recebo meus créditos?",
    answer: "Os créditos são adicionados automaticamente ao seu saldo assim que o indicado realiza o primeiro pagamento de um plano pago."
  },
  {
    question: "Quando o crédito é liberado?",
    answer: "O crédito de R$50 é liberado após a confirmação do pagamento do seu indicado. Para pagamentos via PIX ou cartão, isso acontece em minutos. Para boleto, após a compensação bancária."
  },
  {
    question: "Posso sacar os créditos em dinheiro?",
    answer: "Os créditos são utilizados para pagar sua própria assinatura do Appi AutoZap. Eles são aplicados automaticamente na renovação do seu plano."
  },
  {
    question: "Quanto posso ganhar?",
    answer: "Não há limite! Você ganha R$50 para cada indicação confirmada. Se indicar 10 pessoas, são R$500 em créditos."
  },
  {
    question: "Meu indicado também ganha algo?",
    answer: "Sim! Seu indicado recebe acesso ao período de teste gratuito normalmente, podendo conhecer a plataforma antes de assinar."
  },
  {
    question: "Como compartilho meu link?",
    answer: "Após criar sua conta, acesse a seção 'Indicação' no menu. Lá você encontra seu link exclusivo para compartilhar via WhatsApp, e-mail, redes sociais ou onde preferir."
  }
];

const Affiliates = () => {
  return (
    <>
      <SEOHead
        title="Programa de Afiliados | Appi AutoZap - Ganhe R$50 por Indicação"
        description="Indique amigos para o Appi AutoZap e ganhe R$50 em créditos para cada assinatura confirmada. Sem limites, créditos nunca expiram. Comece a ganhar agora!"
        url="https://appiautozap.com/afiliados"
      />

      <div className="relative min-h-screen bg-background overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] ambient-glow-primary blur-[120px] rounded-full pointer-events-none -translate-y-1/3 translate-x-1/4 z-0" />
        <div className="absolute top-[40%] left-0 w-[500px] h-[500px] ambient-glow-secondary blur-[120px] rounded-full pointer-events-none -translate-x-1/3 z-0" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none translate-y-1/3 z-0" />

        <div className="relative z-10">
          <PublicHeader />

          {/* Hero Section */}
          <section className="pt-24 pb-16 md:pt-32 md:pb-24 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="container mx-auto px-4 relative">
              <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
                {/* Left Side - Content */}
                <motion.div
                  className="text-center lg:text-left"
                  initial="initial"
                  animate="animate"
                  variants={staggerContainer}
                >
                  <motion.div
                    variants={fadeInUp}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6"
                  >
                    <Gift className="w-4 h-4" />
                    <span className="text-sm font-medium">Programa de Afiliados</span>
                  </motion.div>

                  <motion.h1
                    variants={fadeInUp}
                    className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6"
                  >
                    Ganhe{" "}
                    <span className="text-primary">R$50</span>
                    <br />
                    por cada indicação
                  </motion.h1>

                  <motion.p
                    variants={fadeInUp}
                    className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0"
                  >
                    Indique amigos, colegas e clientes. Receba créditos toda vez que
                    alguém assinar um plano. Sem limites, seus créditos nunca expiram.
                  </motion.p>

                  <motion.div
                    variants={fadeInUp}
                    className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                  >
                    <Link to="/auth?redirect=/indicacao&skip_onboarding=true">
                      <Button size="lg" className="w-full sm:w-auto gap-2">
                        Quero ser Afiliado
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link to="/auth?redirect=/indicacao">
                      <Button size="lg" variant="outline" className="w-full sm:w-auto">
                        Já tenho conta
                      </Button>
                    </Link>
                  </motion.div>
                </motion.div>

                {/* Right Side - Video */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="flex justify-center lg:justify-end"
                >
                  <YouTubeEmbed
                    videoId="z-OR_7Kfn7Y"
                    title="Demo do Appi AutoZap"
                    customThumbnail={videoThumbnail}
                  />
                </motion.div>
              </div>
            </div>
          </section>

          {/* Stats Section */}
          <section className="py-16 bg-muted/30">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="text-center glass border border-border/40 shadow-xl">
                      <CardContent className="pt-6">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <stat.icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="text-4xl font-bold text-foreground mb-2">
                          {stat.value}
                        </div>
                        <div className="text-muted-foreground">{stat.label}</div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Como Funciona
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Ganhar dinheiro com indicações nunca foi tão simples
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="relative"
                  >
                    <Card className="h-full border-2 border-dashed border-border/50 glass hover:border-primary/50 transition-all duration-300 shadow-sm">
                      <CardContent className="pt-6 text-center">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 font-bold">
                          {step.number}
                        </div>
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <step.icon className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </CardContent>
                    </Card>
                    {index < steps.length - 1 && (
                      <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                        <ArrowRight className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Benefits */}
          <section className="py-16 bg-muted/30">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Benefícios do Programa
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Vantagens exclusivas para nossos afiliados
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-4 p-4 rounded-xl glass border border-border/40 shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Perguntas Frequentes
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Tire suas dúvidas sobre o programa de afiliados
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="max-w-3xl mx-auto"
              >
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </motion.div>
            </div>
          </section>

          {/* Program Terms */}
          <section className="py-16 bg-muted/30">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="max-w-3xl mx-auto"
              >
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">
                  Termos e Condições do Programa
                </h2>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="eligibility">
                    <AccordionTrigger className="text-left font-semibold">
                      Elegibilidade
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground space-y-2">
                      <p>Para participar do programa de afiliados, você deve:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Ter uma conta ativa no Appi AutoZap</li>
                        <li>Ser maior de 18 anos ou ter autorização legal</li>
                        <li>Concordar com os Termos de Uso da plataforma</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="bonus">
                    <AccordionTrigger className="text-left font-semibold">
                      Como Funciona a Bonificação
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground space-y-2">
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Você recebe R$50 em créditos para cada indicação que assinar um plano pago</li>
                        <li>O crédito é liberado após a confirmação do primeiro pagamento do indicado</li>
                        <li>Os créditos são aplicados automaticamente na renovação da sua assinatura</li>
                        <li>Créditos não podem ser convertidos em dinheiro ou transferidos para terceiros</li>
                        <li>Não há limite de indicações nem prazo de validade para os créditos</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="prohibitions">
                    <AccordionTrigger className="text-left font-semibold">
                      Proibições
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground space-y-2">
                      <p>É expressamente proibido:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Auto-referência (indicar a si mesmo com outra conta)</li>
                        <li>Enviar spam ou mensagens não solicitadas para promover seu link</li>
                        <li>Criar contas falsas para obter créditos</li>
                        <li>Utilizar práticas enganosas ou fraudulentas</li>
                        <li>Fazer promessas falsas sobre os benefícios da plataforma</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="cancellation">
                    <AccordionTrigger className="text-left font-semibold">
                      Cancelamento e Modificações
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground space-y-2">
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>A Appi Company reserva-se o direito de cancelar a participação de afiliados que violarem estes termos</li>
                        <li>Créditos obtidos de forma fraudulenta serão cancelados</li>
                        <li>Podemos modificar as regras do programa com aviso prévio de 30 dias</li>
                        <li>O programa pode ser descontinuado a qualquer momento, mantendo-se os créditos já adquiridos</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="full-terms">
                    <AccordionTrigger className="text-left font-semibold">
                      Termos Completos
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      <p>
                        Este programa está sujeito aos{" "}
                        <Link to="/termos-de-uso" className="text-primary hover:underline">
                          Termos de Uso
                        </Link>
                        {" "}e à{" "}
                        <Link to="/politica-de-privacidade" className="text-primary hover:underline">
                          Política de Privacidade
                        </Link>
                        {" "}do Appi AutoZap. Em caso de dúvidas, entre em contato pelo e-mail{" "}
                        <a href="mailto:contato@appicompany.com" className="text-primary hover:underline">
                          contato@appicompany.com
                        </a>.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </motion.div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="py-16 md:py-24 bg-primary/5">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="max-w-3xl mx-auto text-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Comece a Ganhar Agora
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Crie sua conta grátis e comece a indicar. Cada indicação confirmada
                  são R$50 no seu bolso.
                </p>
                <Link to="/auth?redirect=/indicacao&skip_onboarding=true">
                  <Button size="lg" className="gap-2">
                    Criar Conta Grátis
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </motion.div>
            </div>
          </section>

          <PublicFooter />
        </div>
      </div>
    </>
  );
};

export default Affiliates;
