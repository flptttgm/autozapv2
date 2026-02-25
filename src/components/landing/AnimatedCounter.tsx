import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Users, MessageSquare, Clock, TrendingUp, Sparkles } from "lucide-react";

interface CounterProps {
  end: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}

const Counter = ({ end, duration = 2, suffix = "", prefix = "" }: CounterProps) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, isInView]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
};

const stats = [
  {
    icon: Users,
    value: 50,
    suffix: "+",
    label: "Clientes Ativos",
    description: "Empresas de diversos segmentos",
    gradient: "from-emerald-500/20 to-emerald-500/5",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    icon: MessageSquare,
    value: 277,
    suffix: "k+",
    label: "Mensagens/Mês",
    description: "Enviadas automaticamente",
    gradient: "from-blue-500/20 to-blue-500/5",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    icon: Clock,
    value: 30,
    suffix: "s",
    prefix: "<",
    label: "Tempo de Resposta",
    description: "Média de resposta da IA",
    gradient: "from-violet-500/20 to-violet-500/5",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
  },
  {
    icon: TrendingUp,
    value: 95,
    suffix: "%",
    label: "Taxa de Satisfação",
    description: "Clientes recomendam",
    gradient: "from-amber-500/20 to-amber-500/5",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

export const AnimatedStats = () => {
  return (
    <div className="relative">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-4">
          <Sparkles className="w-4 h-4" />
          Números que Impressionam
        </span>
        <h2 className="text-2xl md:text-3xl font-bold mb-3">
          Resultados Comprovados
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Transformando atendimento em resultados reais todos os dias
        </p>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={containerVariants}
      >
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative"
          >
            {/* Gradient background on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="relative bg-card border border-border/50 rounded-2xl p-5 md:p-6 group-hover:border-primary/20 transition-all duration-300 h-full">
              {/* Icon */}
              <motion.div
                className={`inline-flex p-3 rounded-xl ${stat.iconBg} mb-4`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.iconColor}`} />
              </motion.div>

              {/* Number */}
              <div className="text-2xl md:text-4xl font-bold text-foreground mb-1">
                <Counter end={stat.value} suffix={stat.suffix} prefix={stat.prefix} duration={2} />
              </div>

              {/* Label */}
              <div className="font-medium text-foreground mb-1">
                {stat.label}
              </div>

              {/* Description */}
              <div className="text-xs text-muted-foreground">
                {stat.description}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
