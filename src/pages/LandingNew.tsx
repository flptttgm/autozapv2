import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Bot, Check, ArrowRight, Phone, Clock, Shield, ChevronRight, Zap, Users, Smartphone, Calendar, Headphones, Sparkles, UserSearch, Receipt, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";
import YouTubeEmbed from "@/components/landing/YouTubeEmbed";
import Logo from "@/components/Logo";
import PublicFooter from "@/components/PublicFooter";
import { LandingAIDemo } from "@/components/landing/LandingAIDemo";
import { DemoCarousel } from "@/components/landing/DemoCarousel";
import videoThumbnail from "@/assets/video-thumbnail.png";
import { plans as planDefinitions, getShortFeatures, PLAN_PRICES } from "@/lib/plan-definitions";
import { TypingHeadline } from "@/components/landing/TypingHeadline";
import { ParticleBackground } from "@/components/landing/ParticleBackground";
import { ClientLogos, Testimonials, LiveCounter } from "@/components/landing/SocialProof";
import { FloatingElements, GlowOrbs } from "@/components/landing/FloatingElements";
import { AnimatedStats } from "@/components/landing/AnimatedCounter";
import { PricingCalculator, AnimatedPricingCard, ValueComparison } from "@/components/landing/PricingGamified";
import { HeroChatDemo } from "@/components/landing/HeroChatDemo";
import { TrustSignals, FAQ } from "@/components/landing/TrustAndFAQ";

const WHATSAPP_SALES_NUMBER = "556596312685";

const LandingNew = () => {
  const navigate = useNavigate();
  const {
    user,
    loading
  } = useAuth();
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);
  const handleWhatsAppClick = () => {
    const message = encodeURIComponent("Olá! Quero conhecer mais sobre o Autozap.");
    window.open(`https://wa.me/${WHATSAPP_SALES_NUMBER}?text=${message}`, "_blank");
  };
  const benefits = [{
    icon: Zap,
    text: "Conexão em 30 segundos"
  }, {
    icon: MessageSquare,
    text: "ZERO cobrança por mensagem"
  }, {
    icon: UserSearch,
    text: "Captação de leads inclusa"
  }, {
    icon: Receipt,
    text: "Cobranças automáticas PIX"
  }];
  const [isAnnual, setIsAnnual] = useState(false);

  // Usar definições centralizadas
  const plans = planDefinitions.map(plan => ({
    name: plan.name,
    connections: plan.connections,
    monthlyPrice: plan.price,
    annualPrice: plan.annualPrice,
    popular: plan.isPopular || false,
    features: getShortFeatures(plan.name),
  }));
  return <>
    <SEOHead
      title="AutoZap - Automação de WhatsApp com IA | Vendas no Piloto Automático"
      description="Automação de WhatsApp com IA. Zero cobrança por mensagem, atendimento 24/7, chatbot inteligente. Conecte em 30 segundos e teste grátis."
      keywords="automação whatsapp, chatbot whatsapp, atendimento automático, vendas whatsapp, bot whatsapp"
      url="https://appiautozap.com"
    />

    <div className="min-h-screen bg-background text-foreground font-funnel">
      {/* Premium Header with Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50">
        {/* Glassmorphism background */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-white/10" />

        <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
          {/* Logo */}
          <div
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
              document.body.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center group cursor-pointer"
          >
            <Logo size="md" />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <a
              href="#funcionalidades"
              onClick={(e) => { e.preventDefault(); document.getElementById('funcionalidades')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
            >
              Funcionalidades
            </a>
            <a
              href="#pricing"
              onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
            >
              Preços
            </a>

            <a
              href="#faq"
              onClick={(e) => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
            >
              FAQ
            </a>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-white/80 hover:text-white">
              <Link to="/auth?mode=login">Entrar</Link>
            </Button>
            <Button size="sm" asChild className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
              <Link to="/auth" className="flex items-center gap-1.5">
                Começar Grátis
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section - Premium Split Layout */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        {/* Animated Background */}
        <ParticleBackground />
        <GlowOrbs />
        <FloatingElements />

        {/* Static gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">

            {/* Left Side - Content */}
            <div className="text-center lg:text-left">
              {/* RAG Technology Badge - Animated */}
              <div className="inline-flex items-center gap-2 bg-black/50 border border-[#00ff88]/30 rounded-full px-4 py-1.5 mb-6 animate-fade-in backdrop-blur-sm animate-float">
                <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-xs font-semibold tracking-wider uppercase text-[#00ff88]">Tecnologia RAG de Última Geração</span>
              </div>

              {/* Headline with Typing Animation */}
              <TypingHeadline
                staticText="IA QUE"
                dynamicWords={["VENDE", "AGENDA", "QUALIFICA", "RESPONDE", "CONVERTE"]}
                className="text-4xl md:text-6xl lg:text-7xl tracking-tight mb-6 animate-fade-in leading-[0.95] uppercase italic font-black"
              />

              {/* Subheadline */}
              <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-fade-in leading-relaxed">
                Conecte os documentos da sua empresa ao WhatsApp com o motor de busca semântica mais avançado do mercado.
                Respostas 100% embasadas nos seus dados.
              </p>

              {/* Benefits Pills */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-3 mb-10 animate-fade-in">
                {benefits.map((benefit, index) => <div key={index} className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border/50 text-sm backdrop-blur-sm">
                  <Check className="w-4 h-4 text-[#00ff88]" />
                  {benefit.text}
                </div>)}
              </div>

              {/* CTA Buttons - Premium with Glow */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-delay-2">
                <Button
                  size="lg"
                  className="h-14 px-8 text-lg font-bold bg-[#00dd74] hover:bg-[#00c064] text-black rounded-xl transition-all hover:scale-105 animate-pulse-glow btn-shimmer"
                  onClick={() => navigate("/auth")}
                >
                  Testar 48h Grátis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <button
                  onClick={handleWhatsAppClick}
                  className="h-14 px-8 rounded-xl bg-card/80 hover:bg-card border border-border hover:border-primary/50 text-foreground text-lg font-bold transition-all hover:scale-105 flex items-center justify-center gap-2 backdrop-blur-sm"
                >
                  <Phone className="w-5 h-5" />
                  Fale Conosco
                </button>
              </div>

              {/* Live Counter + Social Proof */}
              <div className="mt-8 flex flex-col items-center lg:items-start gap-3 animate-fade-in-delay-3">
                <LiveCounter />
                <p className="text-sm text-muted-foreground">
                  <span className="text-[#00ff88] font-bold">+ de 50 empresas</span> já usam o Autozap
                </p>
              </div>
            </div>

            {/* Right Side - Interactive Chat Demo - Desktop Only */}
            <div className="hidden lg:flex justify-center lg:justify-end animate-fade-in">
              <HeroChatDemo />
            </div>

            {/* Mobile: Show video instead of chat demo */}
            <div className="lg:hidden flex justify-center animate-fade-in -mt-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">Veja uma demonstração rápida:</p>
                <YouTubeEmbed videoId="z-OR_7Kfn7Y" title="Demo do Autozap" customThumbnail={videoThumbnail} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Client Logos Section */}
      <ClientLogos />

      {/* Video Showcase Section */}
      <section className="py-16 md:py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Veja o Autozap em Ação
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Descubra como a IA transforma seu atendimento em menos de 2 minutos
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-6xl mx-auto">
            {/* Video */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-lg lg:max-w-xl">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-xl opacity-50" />
                <div className="relative">
                  <YouTubeEmbed videoId="z-OR_7Kfn7Y" title="Demo do Autozap" customThumbnail={videoThumbnail} />
                </div>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid gap-4">
              <div className="p-5 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Setup em 5 Minutos</h3>
                    <p className="text-sm text-muted-foreground">
                      Escaneie o QR Code e sua IA já está pronta para atender clientes 24 horas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Bot className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">IA que Aprende com Você</h3>
                    <p className="text-sm text-muted-foreground">
                      Treine a IA com seus documentos, FAQs e políticas. Respostas sempre precisas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Zero Cobrança Extra</h3>
                    <p className="text-sm text-muted-foreground">
                      Mensagens ilimitadas, sem surpresas na fatura. Preço fixo mensal.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Animated Stats */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <AnimatedStats />
        </div>
      </section>

      {/* Why Choose Section - Split Layout */}
      <section id="funcionalidades" className="py-16 md:py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que escolher o Autozap?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A plataforma mais completa para automatizar seu WhatsApp
            </p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto"
          >
            {/* Feature Block 1 - Conexão */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
              }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="p-8 rounded-3xl bg-background border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              {/* SVG Mockup - Phone with QR */}
              <div className="mb-6 flex justify-center">
                <svg width="200" height="160" viewBox="0 0 200 160" className="text-primary">
                  {/* Phone outline */}
                  <rect x="50" y="10" width="100" height="140" rx="12" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <rect x="55" y="25" width="90" height="110" rx="4" fill="currentColor" opacity="0.05" />
                  {/* QR Code pattern */}
                  <rect x="70" y="45" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                  <rect x="75" y="50" width="15" height="15" fill="currentColor" opacity="0.4" />
                  <rect x="95" y="50" width="10" height="10" fill="currentColor" opacity="0.3" />
                  <rect x="110" y="50" width="15" height="15" fill="currentColor" opacity="0.4" />
                  <rect x="75" y="70" width="10" height="10" fill="currentColor" opacity="0.3" />
                  <rect x="90" y="70" width="10" height="10" fill="currentColor" opacity="0.2" />
                  <rect x="105" y="70" width="10" height="10" fill="currentColor" opacity="0.3" />
                  <rect x="75" y="90" width="15" height="15" fill="currentColor" opacity="0.4" />
                  <rect x="95" y="90" width="10" height="10" fill="currentColor" opacity="0.2" />
                  <rect x="110" y="90" width="15" height="15" fill="currentColor" opacity="0.4" />
                  {/* Checkmark animation indicator */}
                  <circle cx="100" cy="75" r="25" fill="currentColor" opacity="0.1" />
                  <path d="M88 75 L96 83 L112 67" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Conexão Instantânea</h3>
              </div>

              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">QR Code pronto em 30 segundos</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Zero instalação ou configuração</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Funciona no seu WhatsApp atual</span>
                </li>
              </ul>
            </motion.div>

            {/* Feature Block 2 - Atendimento IA */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
              }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="p-8 rounded-3xl bg-background border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              {/* SVG Mockup - Chat bubbles */}
              <div className="mb-6 flex justify-center">
                <svg width="200" height="160" viewBox="0 0 200 160" className="text-primary">
                  {/* Incoming message bubble */}
                  <rect x="20" y="20" width="100" height="35" rx="12" fill="currentColor" opacity="0.1" />
                  <rect x="30" y="32" width="60" height="4" rx="2" fill="currentColor" opacity="0.3" />
                  <rect x="30" y="40" width="40" height="4" rx="2" fill="currentColor" opacity="0.2" />
                  {/* AI response bubble */}
                  <rect x="80" y="65" width="100" height="50" rx="12" fill="currentColor" opacity="0.2" />
                  <rect x="90" y="77" width="70" height="4" rx="2" fill="currentColor" opacity="0.4" />
                  <rect x="90" y="85" width="60" height="4" rx="2" fill="currentColor" opacity="0.3" />
                  <rect x="90" y="93" width="50" height="4" rx="2" fill="currentColor" opacity="0.2" />
                  {/* Bot icon */}
                  <circle cx="165" cy="90" r="12" fill="currentColor" opacity="0.3" />
                  <circle cx="162" cy="87" r="2" fill="currentColor" opacity="0.6" />
                  <circle cx="168" cy="87" r="2" fill="currentColor" opacity="0.6" />
                  <path d="M160 93 Q165 97 170 93" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
                  {/* Typing indicator */}
                  <rect x="20" y="125" width="60" height="25" rx="10" fill="currentColor" opacity="0.1" />
                  <circle cx="35" cy="137" r="4" fill="currentColor" opacity="0.4" />
                  <circle cx="50" cy="137" r="4" fill="currentColor" opacity="0.3" />
                  <circle cx="65" cy="137" r="4" fill="currentColor" opacity="0.2" />
                </svg>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Atendimento 24/7 com IA</h3>
              </div>

              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Responde clientes instantaneamente</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Qualifica leads automaticamente</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Agenda compromissos sozinho</span>
                </li>
              </ul>
            </motion.div>

            {/* Feature Block 3 - Captação de Leads */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
              }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="p-8 rounded-3xl bg-background border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              {/* SVG Mockup - Search leads */}
              <div className="mb-6 flex justify-center">
                <svg width="200" height="160" viewBox="0 0 200 160" className="text-primary">
                  {/* Search glass */}
                  <circle cx="90" cy="70" r="35" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <line x1="117" y1="97" x2="145" y2="125" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
                  {/* Profile cards inside */}
                  <rect x="65" y="55" width="50" height="30" rx="4" fill="currentColor" opacity="0.15" />
                  <circle cx="78" cy="67" r="6" fill="currentColor" opacity="0.3" />
                  <rect x="88" y="62" width="20" height="4" rx="2" fill="currentColor" opacity="0.3" />
                  <rect x="88" y="70" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
                  {/* Data points */}
                  <circle cx="45" cy="50" r="4" fill="currentColor" opacity="0.3" />
                  <circle cx="155" cy="40" r="3" fill="currentColor" opacity="0.2" />
                  <circle cx="160" cy="90" r="5" fill="currentColor" opacity="0.25" />
                  <circle cx="35" cy="100" r="3" fill="currentColor" opacity="0.2" />
                </svg>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UserSearch className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Captação de Leads</h3>
              </div>

              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Encontre leads qualificados automaticamente</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Créditos mensais inclusos no plano</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Dados completos: nome, email, telefone</span>
                </li>
              </ul>
            </motion.div>

            {/* Feature Block 4 - Cobranças e Disparos */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
              }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="p-8 rounded-3xl bg-background border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              {/* SVG Mockup - Payment and queue */}
              <div className="mb-6 flex justify-center">
                <svg width="200" height="160" viewBox="0 0 200 160" className="text-primary">
                  {/* PIX QR code */}
                  <rect x="30" y="30" width="60" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <rect x="38" y="38" width="18" height="18" fill="currentColor" opacity="0.25" />
                  <rect x="62" y="38" width="10" height="10" fill="currentColor" opacity="0.2" />
                  <rect x="38" y="62" width="10" height="10" fill="currentColor" opacity="0.2" />
                  <rect x="54" y="54" width="8" height="8" fill="currentColor" opacity="0.15" />
                  <rect x="66" y="66" width="18" height="18" fill="currentColor" opacity="0.25" />
                  {/* Queue arrows */}
                  <path d="M110 50 L140 50" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeLinecap="round" />
                  <path d="M135 45 L140 50 L135 55" stroke="currentColor" strokeWidth="2" opacity="0.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M110 80 L140 80" stroke="currentColor" strokeWidth="2" opacity="0.25" strokeLinecap="round" />
                  <path d="M135 75 L140 80 L135 85" stroke="currentColor" strokeWidth="2" opacity="0.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M110 110 L140 110" stroke="currentColor" strokeWidth="2" opacity="0.2" strokeLinecap="round" />
                  <path d="M135 105 L140 110 L135 115" stroke="currentColor" strokeWidth="2" opacity="0.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {/* WhatsApp icons */}
                  <circle cx="160" cy="50" r="12" fill="currentColor" opacity="0.2" />
                  <circle cx="160" cy="80" r="12" fill="currentColor" opacity="0.15" />
                  <circle cx="160" cy="110" r="12" fill="currentColor" opacity="0.1" />
                </svg>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Cobranças e Disparos</h3>
              </div>

              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Envie cobranças PIX automáticas</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Disparo de mensagens em fila segura</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Sem risco de bloqueio do WhatsApp</span>
                </li>
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Pricing Section - Gamified */}
      <section id="pricing" className="py-16 md:py-24 bg-secondary/30 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              Investimento
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha o Plano Ideal
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Todos os planos incluem uso ilimitado de mensagens e IA. Zero taxa por mensagem.
            </p>

            {/* Toggle Mensal/Anual - Enhanced */}
            <div className="inline-flex items-center gap-1 p-1.5 rounded-full bg-card border border-border shadow-sm">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${!isAnnual ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                Mensal
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${isAnnual ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                Anual
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isAnnual ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>
                  -17%
                </span>
              </button>
            </div>
          </div>

          {/* Animated Plans Grid */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {plans.map((plan, index) => (
              <AnimatedPricingCard
                key={index}
                name={plan.name}
                connections={plan.connections}
                monthlyPrice={plan.monthlyPrice}
                annualPrice={plan.annualPrice}
                popular={plan.popular}
                features={plan.features}
                isAnnual={isAnnual}
                onSelect={() => navigate("/auth")}
                index={index}
              />
            ))}
          </div>

          {/* Value Comparison */}
          <ValueComparison />

          {/* Calculator Section */}
          <div className="mt-16">
            <PricingCalculator />
          </div>

          {/* Additional info */}
          <div className="text-center mt-12">
            <p className="text-sm text-muted-foreground">
              Todos os planos incluem 48h de teste grátis • Cancele quando quiser
            </p>
            <button onClick={handleWhatsAppClick} className="mt-4 inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors">
              <Phone className="w-4 h-4" />
              Precisa de mais conexões? Fale conosco
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <Testimonials />

      {/* Demo Section - Experimente Nossa IA */}
      <section id="demo" className="py-16 md:py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Teste Agora</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Experimente nossa <span className="text-primary">IA</span> agora mesmo
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Converse com a mesma IA que vai atender seus clientes. Sem compromisso.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <DemoCarousel />
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <TrustSignals />

      {/* FAQ Section */}
      <FAQ />

      {/* Footer com selos de segurança */}
      <PublicFooter />

      {/* WhatsApp Floating Button */}
      <button onClick={handleWhatsAppClick} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50" aria-label="Falar com vendas via WhatsApp">
        <Phone className="w-6 h-6" />
      </button>
    </div>
  </>;
};
export default LandingNew;