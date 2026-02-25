import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Phone, ArrowRight, Circle } from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
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

export const OptimizedHero = () => {
  const navigate = useNavigate();

  const handleCtaClick = () => {
    // Track conversion with Facebook Pixel if available
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Lead');
    }
    navigate('/auth');
  };

  const handleContactClick = () => {
    window.open("https://wa.me/5511999999999", "_blank"); // Replace with actual support number if available
  };

  return (
    <motion.div
      className="max-w-5xl mx-auto text-center flex flex-col items-center"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
        <Badge className="mb-8 bg-black/50 hover:bg-black/50 text-[#00ff88] border-[#00ff88]/30 px-4 py-1.5 text-xs font-semibold tracking-wider uppercase backdrop-blur-sm">
          <Circle className="w-2 h-2 mr-2 fill-[#00ff88]" />
          Tecnologia RAG de Última Geração
        </Badge>
      </motion.div>

      <motion.h1
        className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[0.9] tracking-tight uppercase italic"
        variants={fadeInUp}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        IA QUE NÃO <br className="md:hidden" />
        <span className="text-[#00ff88]">INVENTA</span>.
        <br />
        ELA APRENDE.
      </motion.h1>

      <motion.p
        className="text-lg md:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
        variants={fadeInUp}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Conecte os documentos da sua empresa ao WhatsApp com o motor de busca semântica mais avançado do mercado.
        Respostas 100% embasadas nos seus dados.
      </motion.p>

      {/* Feature Pills Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 w-full max-w-3xl"
        variants={fadeInUp}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {[
          "Conexão em 30 segundos",
          "ZERO cobrança por mensagem",
          "Captação de leads inclusa",
          "Cobranças automáticas PIX"
        ].map((feature, i) => (
          <div key={i} className="flex items-center gap-3 bg-card/50 border border-border/50 rounded-full px-5 py-3 backdrop-blur-sm">
            <Check className="w-5 h-5 text-[#00ff88] shrink-0" />
            <span className="font-medium text-sm md:text-base">{feature}</span>
          </div>
        ))}
      </motion.div>

      {/* CTA Buttons */}
      <motion.div
        className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl justify-center items-center"
        variants={fadeInUp}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Button
          size="lg"
          className="w-full sm:w-auto min-w-[240px] bg-[#00dd74] hover:bg-[#00c064] text-black font-bold text-lg h-14 rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,221,116,0.3)]"
          onClick={handleCtaClick}
        >
          Testar 48h Grátis
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
        <Button
          size="lg"
          className="w-full sm:w-auto min-w-[240px] bg-[#00dd74] hover:bg-[#00c064] text-black font-bold text-lg h-14 rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,221,116,0.3)]"
          onClick={handleContactClick}
        >
          <Phone className="mr-2 w-5 h-5" />
          Fale Conosco
        </Button>
      </motion.div>

      <motion.p
        className="mt-8 text-muted-foreground font-medium"
        variants={fadeInUp}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <span className="text-[#00ff88] font-bold">+ de 50 empresas</span> já usam o Autozap
      </motion.p>
    </motion.div>
  );
};
