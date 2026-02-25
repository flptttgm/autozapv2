import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PartyPopper, CheckCircle2, ArrowRight, Smartphone, Bot, Building2 } from "lucide-react";

interface CompletedStepProps {
  companyName: string;
  hasWhatsApp: boolean;
  personalityName: string;
  onFinish: () => void;
}

export const CompletedStep = ({ 
  companyName, 
  hasWhatsApp, 
  personalityName,
  onFinish 
}: CompletedStepProps) => {
  const completedItems = [
    {
      icon: Building2,
      label: "Nome do negócio",
      value: companyName || "Não definido",
      done: !!companyName
    },
    {
      icon: Smartphone,
      label: "WhatsApp",
      value: hasWhatsApp ? "Conectado" : "Pendente",
      done: hasWhatsApp
    },
    {
      icon: Bot,
      label: "Tom da IA",
      value: personalityName,
      done: true
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center text-center max-w-md mx-auto"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.2 }}
        className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6"
      >
        <PartyPopper className="w-10 h-10 text-primary" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold text-foreground mb-3"
      >
        Tudo pronto! 🎉
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-8"
      >
        Sua conta está configurada e pronta para usar
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full space-y-3 mb-8"
      >
        {completedItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className={`
              flex items-center gap-4 p-4 rounded-xl border
              ${item.done 
                ? 'bg-green-500/5 border-green-500/20' 
                : 'bg-amber-500/5 border-amber-500/20'
              }
            `}
          >
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${item.done ? 'bg-green-500/10' : 'bg-amber-500/10'}
            `}>
              <item.icon className={`w-5 h-5 ${item.done ? 'text-green-500' : 'text-amber-500'}`} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="font-medium text-foreground">{item.value}</p>
            </div>
            <CheckCircle2 className={`w-5 h-5 ${item.done ? 'text-green-500' : 'text-amber-500'}`} />
          </motion.div>
        ))}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-sm text-muted-foreground mb-6"
      >
        {!hasWhatsApp && "Você pode conectar o WhatsApp a qualquer momento nas configurações."}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Button onClick={onFinish} size="lg" className="gap-2 px-8">
          Continuar
          <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
};
