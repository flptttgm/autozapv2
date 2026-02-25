import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingAIDemo } from "@/components/landing/LandingAIDemo";
import YouTubeEmbed from "@/components/landing/YouTubeEmbed";
import videoThumbnail from "@/assets/video-thumbnail.png";
import { AnimatedStats } from "@/components/landing/AnimatedCounter";
import { OptimizedHero } from "@/components/landing/OptimizedHero";
import Logo from "@/components/Logo";
import { plans as planDefinitions, getShortFeatures } from "@/lib/plan-definitions";
import SEOHead from "@/components/SEOHead";
import {
  Bot,
  Users,
  Calendar,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Star,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon,
  Stethoscope,
  Building2,
  Scale,
  ShoppingBag,
  Wrench,
  Scissors,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const features = [
    {
      icon: Bot,
      title: "IA com RAG",
      description: "Tecnologia RAG: respostas precisas baseadas na sua Base de Conhecimento, não em achismos",
    },
    {
      icon: Users,
      title: "Gestão de Leads e Contatos",
      description: "Organize seus contatos automaticamente a partir das conversas",
    },
    {
      icon: Calendar,
      title: "Agendamentos",
      description: "Sistema integrado para agendar consultas e serviços via WhatsApp",
    },
    {
      icon: Clock,
      title: "24/7 Disponível",
      description: "Atendimento ininterrupto, mesmo fora do horário comercial",
    },
    {
      icon: Zap,
      title: "Respostas Rápidas",
      description: "Respostas personalizadas para perguntas frequentes",
    },
    {
      icon: Shield,
      title: "Segurança Total",
      description: "Dados criptografados e conformidade com LGPD garantida",
    },
  ];

  const howItWorks = [
    {
      step: "01",
      title: "Conecte seu WhatsApp",
      description: "Escaneie o QR Code e conecte seu número em segundos",
    },
    {
      step: "02",
      title: "Configure a IA",
      description: "Personalize as respostas e comportamento do assistente",
    },
    {
      step: "03",
      title: "Comece a Atender",
      description: "A IA responde automaticamente enquanto você foca no que importa",
    },
  ];

  const testimonials = [
    {
      name: "Maria Silva",
      role: "Proprietária, Clínica Estética",
      content: "O Autozap reduziu nosso tempo de resposta de horas para segundos. Nossos clientes adoram!",
      rating: 5,
    },
    {
      name: "João Santos",
      role: "Gerente, Imobiliária Premium",
      content: "Triplicamos nossos agendamentos desde que implementamos o Autozap. Ferramenta essencial!",
      rating: 5,
    },
    {
      name: "Ana Costa",
      role: "CEO, Consultoria Digital",
      content: "A IA entende perfeitamente o contexto e responde de forma natural. Impressionante!",
      rating: 5,
    },
  ];

  // Usar definições centralizadas
  const plans = planDefinitions.map(plan => ({
    name: plan.name,
    monthlyPrice: plan.price,
    annualPrice: plan.annualPrice,
    connections: plan.connections,
    description: plan.name === "Start"
      ? "Ideal para começar a automatizar"
      : plan.name === "Pro"
        ? "Para empresas com múltiplos atendimentos"
        : "Para operações de alto volume",
    features: getShortFeatures(plan.name),
    popular: plan.isPopular || false,
  }));

  const formatPrice = (price: number) => {
    return price.toLocaleString("pt-BR");
  };

  const faqs = [
    {
      question: "O que é uma Conexão de WhatsApp?",
      answer:
        "Uma Conexão de WhatsApp é o seu próprio número de WhatsApp (da empresa ou pessoal) conectado à plataforma Autozap. Não vendemos números ou chips — você usa seu WhatsApp existente que passa a funcionar automaticamente com IA.",
    },
    {
      question: "Como funciona a integração com WhatsApp?",
      answer:
        "É simples! Basta escanear um QR Code e seu número estará conectado em segundos. Não há instalação local, não vendemos números ou chips. A conexão é feita diretamente do seu WhatsApp.",
    },
    {
      question: "O que é RAG e como funciona a Base de Conhecimento?",
      answer:
        "RAG (Retrieval-Augmented Generation) é a tecnologia que usamos para garantir respostas precisas. Você cadastra informações sobre seu negócio (preços, serviços, políticas) na Base de Conhecimento. Quando um cliente pergunta algo, a IA busca semanticamente o conteúdo mais relevante e gera uma resposta baseada nessas informações — não em dados genéricos da internet. Isso evita respostas inventadas e garante que a IA fale exatamente o que você configurou.",
    },
    {
      question: "Existe limite de mensagens ou atendimentos?",
      answer:
        "Não! O uso é totalmente ilimitado. Você pode enviar quantas mensagens quiser, atender quantos clientes precisar, capturar leads e agendar sem nenhuma limitação. A única diferença entre os planos é a quantidade de Conexões de WhatsApp.",
    },
    {
      question: "A IA substitui completamente o atendimento humano?",
      answer:
        "Não! A IA auxilia no atendimento inicial e perguntas frequentes, mas você pode configurar palavras-chave para transferir automaticamente para um atendente humano quando necessário.",
    },
    {
      question: "Posso adicionar mais Conexões de WhatsApp?",
      answer:
        "Sim! Além das conexões inclusas no plano, você pode contratar conexões adicionais por R$ 197/mês cada. Você pode adicionar ou remover a qualquer momento.",
    },
    {
      question: "Como funciona o teste gratuito?",
      answer:
        "Você tem 48 horas grátis com acesso a todas as funcionalidades e 1 Conexão de WhatsApp. Não precisa de cartão de crédito — basta escanear o QR Code e começar a usar imediatamente.",
    },
    {
      question: "Posso personalizar as respostas da IA?",
      answer:
        "Absolutamente! Você pode configurar o tom de voz, criar respostas para perguntas específicas, definir horários de funcionamento e muito mais.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="{a}AutoZap - Automação de WhatsApp com IA | Atendimento 24/7"
        description="Automação de WhatsApp com inteligência artificial. Seu WhatsApp vendendo enquanto você dorme. Chatbot, leads e agendamentos automáticos."
        keywords="automação whatsapp, chatbot whatsapp, atendimento automático, whatsapp business, ia whatsapp"
        url="https://appiautozap.com"
      />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="md" />

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              Como Funciona
            </a>
            <a href="#demo" className="text-muted-foreground hover:text-foreground transition-colors">
              Demo
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Moon className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              ) : (
                <Sun className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              )}
            </button>
            {!user ? (
              <>
                <Link to="/auth">
                  <Button variant="ghost">Entrar</Button>
                </Link>
                <Link to="/auth">
                  <Button className="bg-primary hover:bg-primary/90">
                    Começar Grátis
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/dashboard">
                <Button className="bg-primary hover:bg-primary/90">
                  Acessar Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border p-4">
            <nav className="flex flex-col gap-4">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Recursos
              </a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                Como Funciona
              </a>
              <a href="#demo" className="text-muted-foreground hover:text-foreground transition-colors">
                Demo
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Preços
              </a>
              <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </a>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {theme === "dark" ? (
                  <>
                    <Moon className="w-5 h-5" />
                    Modo Claro
                  </>
                ) : (
                  <>
                    <Sun className="w-5 h-5" />
                    Modo Escuro
                  </>
                )}
              </button>
              {!user ? (
                <>
                  <Link to="/auth">
                    <Button variant="outline" className="w-full">
                      Entrar
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button className="w-full bg-primary hover:bg-primary/90">Começar Grátis</Button>
                  </Link>
                </>
              ) : (
                <Link to="/dashboard">
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    Acessar Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden min-h-screen">
        {/* Static Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />

        {/* CSS Animated Orbs - No JS, GPU accelerated */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float-medium" />
        <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-secondary/20 rounded-full blur-3xl animate-float-fast hidden md:block" />

        {/* Animated Particles - Desktop only to reduce mobile TBT */}
        <div className="hidden md:block">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-primary/30 rounded-full animate-particle"
              style={{
                top: `${20 + i * 20}%`,
                left: `${15 + i * 20}%`,
                animationDelay: `${i * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Static Grid Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5QzkyQUMiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

        <div className="container mx-auto relative z-10">
          <OptimizedHero />

          {/* Ideal Para - MOBILE ONLY */}
          <motion.div
            className="mt-8 md:hidden text-center"
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Ideal para</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { icon: Stethoscope, label: "Clínicas" },
                { icon: Building2, label: "Imobiliárias" },
                { icon: Scale, label: "Advogados" },
                { icon: ShoppingBag, label: "E-commerce" },
                { icon: Wrench, label: "Serviços" },
                { icon: Scissors, label: "Salões de Beleza" },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-full border border-border/50"
                >
                  <item.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Animated Stats Counter */}
          <AnimatedStats />

          {/* Hero Visual - Video */}
          <motion.div
            className="mt-16 relative max-w-4xl mx-auto flex justify-center"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            <YouTubeEmbed
              videoId="KLDL6p8HNK8"
              title="Conheça o Autozap"
              customThumbnail={videoThumbnail}
            />
          </motion.div>
        </div>
      </section>

      {/* Ideal Para Section - DESKTOP ONLY */}
      <section className="hidden md:block py-12 px-4 border-b border-border/30">
        <div className="container mx-auto">
          <motion.div
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.p
              className="text-sm font-medium text-muted-foreground mb-6 uppercase tracking-wider"
              variants={fadeInUp}
            >
              Ideal para
            </motion.p>
            <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
              {[
                { icon: Stethoscope, label: "Clínicas e Consultórios" },
                { icon: Building2, label: "Imobiliárias" },
                { icon: Scale, label: "Advogados" },
                { icon: ShoppingBag, label: "E-commerce" },
                { icon: Wrench, label: "Prestadores de Serviço" },
                { icon: Scissors, label: "Salões de Beleza" },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full border border-border/50"
                  variants={fadeInUp}
                  transition={{ delay: index * 0.1 }}
                >
                  <item.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4 bg-secondary text-secondary-foreground border-0">Recursos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Tudo que você precisa para <span className="text-primary">escalar</span> seu atendimento
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Ferramentas poderosas para automatizar, organizar e melhorar seu relacionamento com clientes
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={scaleIn} transition={{ duration: 0.4 }}>
                <Card className="group relative border-border/50 h-full overflow-hidden transition-all duration-300 hover:shadow-glow hover:-translate-y-1">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10 group-hover:bg-primary/20 transition-colors duration-500" />
                  <CardContent className="p-6 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors shadow-sm">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                    <p className="text-muted-foreground font-medium">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4 bg-secondary text-secondary-foreground border-0">Como Funciona</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Comece a usar em <span className="text-primary">3 passos simples</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Configuração rápida e intuitiva para você começar a automatizar hoje mesmo
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {howItWorks.map((item, index) => (
              <motion.div
                key={index}
                className="text-center relative"
                variants={fadeInUp}
                transition={{ duration: 0.5 }}
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl font-bold text-primary">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-[2px] bg-border" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Demo Section - Experimente Nossa IA */}
      <section id="demo" className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-0">Teste Agora</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Experimente nossa <span className="text-primary">IA</span> agora mesmo
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Converse com a mesma IA que vai atender seus clientes. Sem compromisso.
            </p>
          </motion.div>

          <motion.div
            className="max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <LandingAIDemo />
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4 bg-secondary text-secondary-foreground border-0">Depoimentos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              O que nossos <span className="text-primary">clientes</span> dizem
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Empresas de todos os tamanhos já transformaram seu atendimento com o Autozap
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {testimonials.map((testimonial, index) => (
              <motion.div key={index} variants={scaleIn} transition={{ duration: 0.4 }}>
                <Card className="relative border-border/50 h-full overflow-hidden group hover:shadow-glow transition-all duration-300">
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl -z-10 group-hover:bg-primary/10 transition-colors duration-500" />
                  <CardContent className="p-6 relative z-10">
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-primary text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      ))}
                    </div>
                    <p className="text-foreground font-medium mb-6 italic">"{testimonial.content}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-sm">
                        <span className="text-primary font-bold">{testimonial.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-bold">{testimonial.name}</p>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4 bg-secondary text-secondary-foreground border-0">Preços</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Pague apenas por <span className="text-primary">Conexões de WhatsApp</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
              Uso ilimitado em todos os planos. Teste grátis por 48 horas, sem cartão.
            </p>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-8">
              Cada Conexão = seu WhatsApp funcionando automaticamente com IA 24/7
            </p>

            {/* Toggle Mensal/Anual */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
                Mensal
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative w-14 h-7 rounded-full transition-colors ${isAnnual ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${isAnnual ? "translate-x-7" : "translate-x-0"
                    }`}
                />
              </button>
              <span className={`text-sm font-medium ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
                Anual
              </span>
              {isAnnual && <Badge className="bg-primary/20 text-primary border-0">Economize 17%</Badge>}
            </div>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {plans.map((plan, index) => (
              <motion.div key={index} variants={scaleIn} transition={{ duration: 0.4 }}>
                <Card
                  className={`relative border-border/50 flex flex-col h-full overflow-hidden transition-all duration-300 ${plan.popular ? "ring-2 ring-primary shadow-glow scale-105" : "hover:border-primary/30"
                    }`}
                >
                  <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] -z-10 ${plan.popular ? "bg-primary/20" : "bg-primary/5"}`} />
                  {plan.popular && (
                    <div className="absolute top-0 inset-x-0 flex justify-center transform -translate-y-1/2">
                      <Badge className="bg-primary text-primary-foreground font-bold px-3 py-1 text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.5)]">Mais Popular</Badge>
                    </div>
                  )}
                  <CardContent className={`p-8 flex flex-col flex-1 relative z-10 ${plan.popular ? "pt-10" : ""}`}>
                    <h3 className="text-2xl font-black mb-1 tracking-tight">{plan.name}</h3>
                    <p className="text-sm font-medium text-muted-foreground mb-6">{plan.description}</p>

                    <div className="mb-2 flex items-baseline gap-1">
                      <span className="text-primary font-bold">R$</span>
                      <span className="text-5xl font-black tracking-tighter text-foreground">
                        {formatPrice(isAnnual ? plan.annualPrice : plan.monthlyPrice)}
                      </span>
                      <span className="text-muted-foreground font-medium">/mês</span>
                    </div>
                    {isAnnual && (
                      <p className="text-xs font-semibold text-primary/80 mb-6 bg-primary/10 inline-block px-2 py-1 rounded-md">
                        cobrado anualmente (R$ {formatPrice((isAnnual ? plan.annualPrice : plan.monthlyPrice) * 12)})
                      </p>
                    )}
                    {!isAnnual && <div className="h-[28px] mb-6" />} {/* Spacer to maintain alignment when not annual */}

                    <div className="bg-muted/50 border border-border/50 rounded-xl p-4 mb-8 relative overflow-hidden group/plan">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover/plan:opacity-100 transition-opacity duration-300" />
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Zap className="w-5 h-5 text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        </div>
                        <span className="font-bold text-foreground">
                          {plan.connections} {plan.connections === 1 ? "Conexão" : "Conexões"} de WhatsApp
                        </span>
                      </div>
                    </div>

                    <div className="flex-1">
                      <ul className="space-y-4">
                        {plan.features.slice(1).map((feature, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]" />
                            <span className="text-sm font-medium text-muted-foreground/90">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link to="/auth" className="mt-8">
                      <Button
                        className={`w-full h-12 text-base font-bold ${plan.popular
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-shadow"
                          : "bg-muted text-foreground hover:bg-muted/80 border border-border transition-colors"
                          }`}
                      >
                        Começar Agora
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Conexão Adicional */}
          <motion.div
            className="mt-12 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <Card className="inline-block bg-muted/50 border-border/50">
              <CardContent className="p-6">
                <p className="text-muted-foreground mb-2">Precisa de mais Conexões de WhatsApp?</p>
                <p className="text-lg font-semibold">
                  <span className="text-primary">+ R$ 197</span>
                  <span className="text-muted-foreground">/mês por Conexão adicional</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">Adicione ou remova a qualquer momento</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4 bg-secondary text-secondary-foreground border-0">FAQ</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Perguntas <span className="text-primary">Frequentes</span>
            </h2>
            <p className="text-xl text-muted-foreground">Tire suas dúvidas sobre o Autozap</p>
          </motion.div>

          <motion.div
            className="space-y-4 max-w-3xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {faqs.map((faq, index) => (
              <motion.div key={index} variants={fadeInUp} transition={{ duration: 0.3 }}>
                <Card
                  className={`border-border/50 cursor-pointer overflow-hidden transition-all duration-300 ${openFaq === index ? "ring-1 ring-primary/50 shadow-glow" : "hover:border-primary/30"
                    }`}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold pr-4 transition-colors ${openFaq === index ? "text-primary" : "text-foreground group-hover:text-primary/80"}`}>
                        {faq.question}
                      </h3>
                      <div className={`p-1.5 rounded-full transition-colors ${openFaq === index ? "bg-primary/20" : "bg-muted"}`}>
                        <ChevronDown
                          className={`w-5 h-5 transition-transform duration-300 ${openFaq === index ? "rotate-180 text-primary" : "text-muted-foreground"
                            }`}
                        />
                      </div>
                    </div>
                    {openFaq === index && (
                      <motion.p
                        className="mt-4 text-muted-foreground font-medium leading-relaxed"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.2 }}
                      >
                        {faq.answer}
                      </motion.p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="bg-neutral-950 dark:bg-black rounded-3xl p-12 md:p-20 text-center relative border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className="absolute top-[-50%] left-[-10%] w-[60%] h-[100%] rounded-full bg-primary/20 blur-[120px]" />
              <div className="absolute bottom-[-50%] right-[-10%] w-[60%] h-[100%] rounded-full bg-primary/20 blur-[120px]" />
            </div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="p-4 rounded-full bg-primary/10 mb-8 border border-primary/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <Zap className="w-10 h-10 text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight">
                Pronto para transformar seu atendimento?
              </h2>
              <p className="text-xl text-neutral-400 font-medium mb-10 max-w-2xl mx-auto">
                Junte-se a dezenas de empresas que já automatizaram seu WhatsApp e escalaram suas vendas com o Autozap
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md mx-auto">
                <Link to="/auth" className="w-full">
                  <Button
                    size="lg"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8 py-6 font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-shadow"
                  >
                    Começar Grátis Agora
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            {/* Brand Column */}
            <div className="space-y-6">
              <Logo size="md" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                Automação de WhatsApp com IA para vendas e atendimento inteligente
              </p>
              {/* Social Icons */}
              <div className="flex gap-4">
                <a
                  href="https://www.instagram.com/appiautozap/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-secondary hover:bg-primary/20 flex items-center justify-center transition-all duration-300 group"
                >
                  <svg
                    className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a
                  href="https://www.linkedin.com/company/appicompany"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-secondary hover:bg-primary/20 flex items-center justify-center transition-all duration-300 group"
                >
                  <svg
                    className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Produto Column */}
            <div className="space-y-4">
              <h4 className="text-foreground font-semibold">Produto</h4>
              <ul className="space-y-3">
                <li>
                  <a href="#features" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                    Funcionalidades
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                    Planos e Preços
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                    Trial Gratuito
                  </a>
                </li>
              </ul>
            </div>

            {/* Empresa Column */}
            <div className="space-y-4">
              <h4 className="text-foreground font-semibold">Empresa</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/sobre" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                    Sobre Nós
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                    Blog
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                    Carreiras
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal Column */}
            <div className="space-y-4">
              <h4 className="text-foreground font-semibold">Legal</h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    to="/termos-de-uso"
                    className="text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <Link
                    to="/politica-de-privacidade"
                    className="text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    Política de Privacidade
                  </Link>
                </li>
                <li>
                  <Link
                    to="/politica-de-cookies"
                    className="text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    Política de Cookies
                  </Link>
                </li>
                <li>
                  <a
                    href="https://crm-appi-company.lovable.app/suporte-publico"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    Suporte
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              © 2025 {"{a}"}AutoZap. Desenvolvido por{" "}
              <a
                href="https://appicompany.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Appi Company
              </a>
              .
            </p>
            <a
              href="mailto:contato@appicompany.com"
              className="text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              contato@appicompany.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
