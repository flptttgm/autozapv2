import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/Logo";
import PublicFooter from "@/components/PublicFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useSeller } from "@/hooks/useSeller";
import { ParticleBackground } from "@/components/landing/ParticleBackground";
import { GlowOrbs, FloatingElements } from "@/components/landing/FloatingElements";
import { PLAN_PRICES } from "@/lib/plan-definitions";
import {
  DollarSign,
  Users,
  Zap,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Menu,
  X,
  Link2,
  CreditCard,
  BarChart3,
  Shield,
  Clock,
  Wallet,
  Check,
  Sparkles,
  Gift,
  Rocket,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const SellerLanding = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { isSeller, seller } = useSeller();
  const navigate = useNavigate();

  // Redirect logged-in sellers to dashboard
  useEffect(() => {
    if (user && isSeller && seller?.status === 'active') {
      navigate("/vendedores/dashboard");
    }
  }, [user, isSeller, seller, navigate]);

  const benefits = [
    {
      icon: DollarSign,
      title: "Taxa de Instalação",
      description: "Defina seu próprio valor de instalação (ex: R$100 a R$300) e receba 100% dele",
      gradient: "from-emerald-500 to-green-600",
    },
    {
      icon: Link2,
      title: "Link Personalizado",
      description: "Seu próprio link de vendas para compartilhar com potenciais clientes",
      gradient: "from-blue-500 to-cyan-600",
    },
    {
      icon: Wallet,
      title: "Pagamento Automático",
      description: "Receba sua taxa automaticamente via split de pagamento no ato da venda",
      gradient: "from-violet-500 to-purple-600",
    },
    {
      icon: BarChart3,
      title: "Dashboard Completo",
      description: "Acompanhe suas vendas e ganhos em tempo real",
      gradient: "from-orange-500 to-amber-600",
    },
    {
      icon: Clock,
      title: "Suporte Dedicado",
      description: "Acesso a materiais de vendas e suporte exclusivo para vendedores",
      gradient: "from-pink-500 to-rose-600",
    },
    {
      icon: Shield,
      title: "Produto Validado",
      description: "Venda uma solução já validada por centenas de empresas",
      gradient: "from-teal-500 to-emerald-600",
    },
  ];

  const howItWorks = [
    {
      step: "01",
      title: "Cadastre-se",
      description: "Preencha o formulário e aguarde a aprovação da sua conta de vendedor",
      icon: Users,
    },
    {
      step: "02",
      title: "Receba seu Link",
      description: "Após aprovação, você terá acesso ao seu link personalizado de vendas",
      icon: Link2,
    },
    {
      step: "03",
      title: "Compartilhe",
      description: "Divulgue para seus contatos, clientes ou nas redes sociais",
      icon: Rocket,
    },
    {
      step: "04",
      title: "Ganhe Taxa de Instalação",
      description: "Quando o cliente assinar, sua taxa é paga automaticamente no ato",
      icon: Gift,
    },
  ];

  // Usar preços centralizados do plan-definitions.ts
  const installationExamples = [
    {
      plan: "Start",
      price: `R$ ${PLAN_PRICES.start.monthly}`,
      fee: "R$ 100+",
      total: `R$ ${PLAN_PRICES.start.monthly + 100}+`,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-400"
    },
    {
      plan: "Pro",
      price: `R$ ${PLAN_PRICES.pro.monthly}`,
      fee: "R$ 150+",
      total: `R$ ${PLAN_PRICES.pro.monthly + 150}+`,
      color: "from-primary to-emerald-400",
      bgColor: "bg-primary/10",
      textColor: "text-primary",
      popular: true
    },
    {
      plan: "Business",
      price: `R$ ${PLAN_PRICES.business.monthly.toLocaleString('pt-BR')}`,
      fee: "R$ 200+",
      total: `R$ ${(PLAN_PRICES.business.monthly + 200).toLocaleString('pt-BR')}+`,
      color: "from-violet-500 to-purple-500",
      bgColor: "bg-violet-500/10",
      textColor: "text-violet-400"
    },
  ];

  const faqs = [
    {
      question: "Como funciona a taxa de instalação?",
      answer: "Você define quanto quer cobrar pela instalação (ex: R$100, R$200 ou mais). Esse valor é ADICIONADO ao preço do plano e você recebe 100% dele. O cliente paga o plano + sua taxa.",
    },
    {
      question: "Quanto tempo leva para aprovar meu cadastro?",
      answer: "O cadastro é analisado em até 48 horas úteis. Você receberá um email quando sua conta for aprovada.",
    },
    {
      question: "Como recebo minha taxa de instalação?",
      answer: "A taxa é paga automaticamente via split de pagamento no momento da venda. Você precisa cadastrar sua conta Asaas (gratuita) para receber os valores.",
    },
    {
      question: "Existe limite de vendas?",
      answer: "Não! Você pode vender quantos planos quiser. Quanto mais vendas, mais você ganha.",
    },
    {
      question: "Preciso ter CNPJ para ser vendedor?",
      answer: "Não é obrigatório. Você pode se cadastrar com CPF e receber suas comissões normalmente.",
    },
    {
      question: "Posso indicar outros vendedores?",
      answer: "Por enquanto não temos programa de indicação de vendedores, apenas de clientes finais.",
    },
  ];

  return (
    <div className="min-h-screen bg-background font-funnel">
      {/* Premium Header with Glassmorphism */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-white/10" />

        <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
          <Link to="/">
            <Logo size="md" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <a
              href="#benefits"
              className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              Benefícios
            </a>
            <a
              href="#how-it-works"
              className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              Como Funciona
            </a>
            <a
              href="#commissions"
              className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              Comissões
            </a>
            <a
              href="#faq"
              className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              FAQ
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/vendedores/login">
              <Button variant="ghost" className="text-white/80 hover:text-white">Entrar</Button>
            </Link>
            <Link to="/vendedores/login">
              <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                Quero Vender
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border p-4"
          >
            <nav className="flex flex-col gap-2">
              <a href="#benefits" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
                Benefícios
              </a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
                Como Funciona
              </a>
              <a href="#commissions" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
                Comissões
              </a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </a>
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                <Link to="/vendedores/login">
                  <Button variant="outline" className="w-full">Entrar</Button>
                </Link>
                <Link to="/vendedores/login">
                  <Button className="w-full bg-primary hover:bg-primary/90">Quero Vender</Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      {/* Hero Section - Premium Design */}
      <section className="pt-24 pb-20 md:pt-32 md:pb-28 px-4 relative overflow-hidden">
        {/* Animated Background */}
        <ParticleBackground />
        <GlowOrbs />
        <FloatingElements />

        {/* Static Gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />

        <div className="container mx-auto relative z-10">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-black/50 border border-primary/30 rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold tracking-wider uppercase text-primary">
                Programa de Vendedores Oficial
              </span>
            </motion.div>

            <motion.h1
              className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight"
              variants={fadeInUp}
            >
              Ganhe dinheiro vendendo{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-400 to-primary animate-gradient">
                AutoZap
              </span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed"
              variants={fadeInUp}
            >
              Torne-se um revendedor oficial e defina sua própria taxa de instalação.
              <span className="text-primary font-semibold"> Receba 100% do valor </span>
              no ato da venda.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link to="/vendedores/login">
                <Button
                  size="lg"
                  className="h-14 px-8 text-lg font-bold bg-[#00dd74] hover:bg-[#00c064] text-black rounded-xl transition-all hover:scale-105 shadow-lg shadow-primary/25"
                >
                  Começar a Vender
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="#commissions">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg rounded-xl border-border hover:border-primary/50 transition-all hover:scale-105"
                >
                  Ver Comissões
                </Button>
              </a>
            </motion.div>

            {/* Quick Stats - Premium Cards */}
            <motion.div
              className="grid grid-cols-3 gap-4 mt-8 max-w-2xl mx-auto"
              variants={staggerContainer}
            >
              {[
                { value: "100%", label: "Da Taxa é Seu", icon: DollarSign },
                { value: "Você", label: "Define o Valor", icon: Zap },
                { value: "0%", label: "Taxa p/ AutoZap", icon: Gift },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="relative group"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-emerald-500/50 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                  <div className="relative p-4 md:p-6 rounded-2xl bg-card/80 border border-border backdrop-blur-sm text-center">
                    <stat.icon className="w-5 h-5 text-primary mx-auto mb-2 opacity-60" />
                    <p className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section - Premium Cards */}
      <section id="benefits" className="py-20 px-4 bg-secondary/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto relative z-10">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              Benefícios
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Por que ser um <span className="text-primary">Vendedor AutoZap</span>?
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                <Card className="h-full border-border hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/5">
                  <CardContent className="p-6">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${benefit.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                      <benefit.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section - Timeline Design */}
      <section id="how-it-works" className="py-20 px-4 relative">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-4">
              <Rocket className="w-4 h-4" />
              Como Funciona
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">4 passos simples</h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-4 gap-6 lg:gap-8 relative"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {/* Connection Line (Desktop) */}
            <div className="hidden md:block absolute top-[60px] left-[12.5%] right-[12.5%] h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

            {howItWorks.map((step, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="text-center relative"
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                <div className="relative mx-auto mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto border border-primary/20 backdrop-blur-sm">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-black shadow-lg">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Installation Fee Examples Section - Premium Cards */}
      <section id="commissions" className="py-20 px-4 bg-secondary/30 relative overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto relative z-10">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-4">
              <DollarSign className="w-4 h-4" />
              Taxa de Instalação
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Você define quanto <span className="text-primary">ganhar</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Sua taxa de instalação é <strong className="text-foreground">ADICIONADA</strong> ao preço do plano.
              O cliente paga o valor total e você recebe 100% da taxa.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {installationExamples.map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="relative group"
              >
                {item.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-primary-foreground shadow-lg px-4 py-1">
                      Mais Vendido
                    </Badge>
                  </div>
                )}
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${item.color} rounded-3xl blur opacity-0 group-hover:opacity-50 transition duration-500`} />
                <Card className={`relative border-border text-center overflow-hidden ${item.popular ? 'border-primary/50' : ''}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-5`} />
                  <CardContent className="p-8 relative">
                    <Badge className={`mb-4 ${item.bgColor} ${item.textColor} border-0 text-base font-bold px-4 py-1`}>
                      {item.plan}
                    </Badge>
                    <p className="text-sm text-muted-foreground mb-1">Preço do Plano</p>
                    <p className="text-xl font-semibold mb-4">{item.price}<span className="text-sm text-muted-foreground">/mês</span></p>

                    <div className="py-4 border-t border-b border-border my-4">
                      <p className="text-sm text-muted-foreground mb-1">+ Sua Taxa</p>
                      <p className={`text-3xl font-bold ${item.textColor}`}>{item.fee}</p>
                      <p className="text-xs text-muted-foreground mt-1">Você define!</p>
                    </div>

                    <p className="text-sm text-muted-foreground mb-1">Cliente Paga</p>
                    <p className="text-2xl font-bold">{item.total}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="text-center mt-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-card/80 border border-border backdrop-blur-sm">
              <span className="text-2xl">💡</span>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Exemplo:</strong> Se você definir R$150 de taxa no Plano Pro,
                o cliente paga R${PLAN_PRICES.pro.monthly + 150} e você recebe R$150 automaticamente.
              </p>
            </div>
          </motion.div>

          <motion.div
            className="text-center mt-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <Link to="/vendedores/login">
              <Button
                size="lg"
                className="h-14 px-8 text-lg font-bold bg-[#00dd74] hover:bg-[#00c064] text-black rounded-xl transition-all hover:scale-105 shadow-lg shadow-primary/25"
              >
                Quero Ser Vendedor
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section - Premium Accordion */}
      <section id="faq" className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-4">
              <CheckCircle2 className="w-4 h-4" />
              FAQ
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">Dúvidas Frequentes</h2>
          </motion.div>

          <motion.div
            className="space-y-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {faqs.map((faq, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card
                  className={`border-border cursor-pointer transition-all duration-300 hover:border-primary/30 ${openFaq === index ? "border-primary/50 shadow-lg shadow-primary/5" : ""
                    }`}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base md:text-lg pr-4">{faq.question}</h3>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${openFaq === index ? 'bg-primary text-black' : 'bg-muted'}`}>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-300 ${openFaq === index ? "rotate-180" : ""
                            }`}
                        />
                      </div>
                    </div>
                    <motion.div
                      initial={false}
                      animate={{
                        height: openFaq === index ? "auto" : 0,
                        opacity: openFaq === index ? 1 : 0
                      }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="text-muted-foreground mt-4 leading-relaxed">{faq.answer}</p>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section - Premium Design */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto text-center relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="max-w-3xl mx-auto"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-4 py-1.5 mb-6">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Comece Hoje</span>
            </motion.div>

            <motion.h2 variants={fadeInUp} className="text-3xl md:text-5xl font-bold mb-6">
              Pronto para começar a <span className="text-primary">ganhar</span>?
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Junte-se aos nossos vendedores e comece a ganhar sua taxa de instalação hoje mesmo.
            </motion.p>
            <motion.div variants={fadeInUp}>
              <Link to="/vendedores/login">
                <Button
                  size="lg"
                  className="h-16 px-10 text-xl font-bold bg-[#00dd74] hover:bg-[#00c064] text-black rounded-xl transition-all hover:scale-105 shadow-2xl shadow-primary/30"
                >
                  Criar Minha Conta de Vendedor
                  <ArrowRight className="w-6 h-6 ml-3" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground mt-4">
                Cadastro gratuito • Aprovação em até 48h
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default SellerLanding;
