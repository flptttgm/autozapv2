import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, Check } from "lucide-react";

interface AIPersonalityStepProps {
  onNext: (personality: string) => void;
  onSkip: () => void;
}

const personalities = [
  {
    id: "friendly",
    emoji: "😊",
    title: "Amigável",
    description: "Descontraído e usa emojis",
    tone: 30,
    verbosity: 60,
    proactivity: 70,
    useEmojis: true,
    example: "Oi! 👋 Como posso te ajudar hoje?"
  },
  {
    id: "professional",
    emoji: "🤝",
    title: "Profissional",
    description: "Formal e objetivo",
    tone: 70,
    verbosity: 40,
    proactivity: 50,
    useEmojis: false,
    example: "Olá, como posso ajudá-lo?"
  },
  {
    id: "balanced",
    emoji: "⚡",
    title: "Equilibrado",
    description: "Mix dos dois (recomendado)",
    tone: 50,
    verbosity: 50,
    proactivity: 60,
    useEmojis: true,
    example: "Olá! Como posso ajudar você hoje?"
  }
];

export const AIPersonalityStep = ({ onNext, onSkip }: AIPersonalityStepProps) => {
  const [selected, setSelected] = useState<string>("balanced");

  const handleNext = () => {
    onNext(selected);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center text-center max-w-lg mx-auto"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.2 }}
        className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6"
      >
        <Bot className="w-10 h-10 text-primary" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold text-foreground mb-3"
      >
        Como a IA deve falar?
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-8"
      >
        Escolha o tom de voz para conversar com seus clientes
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full space-y-3 mb-8"
      >
        {personalities.map((personality, index) => (
          <motion.button
            key={personality.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            onClick={() => setSelected(personality.id)}
            className={`
              w-full p-4 rounded-xl border-2 transition-all duration-200 text-left
              ${selected === personality.id 
                ? 'border-primary bg-primary/5 shadow-md' 
                : 'border-border hover:border-primary/50 bg-card'
              }
            `}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">{personality.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">
                    {personality.title}
                  </h3>
                  {selected === personality.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {personality.description}
                </p>
                <div className="text-xs text-muted-foreground italic bg-muted/50 px-3 py-2 rounded-lg">
                  "{personality.example}"
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col items-center gap-4"
      >
        <Button onClick={handleNext} size="lg" className="gap-2 px-8">
          Continuar
          <ArrowRight className="w-4 h-4" />
        </Button>
        
        <Button 
          onClick={onSkip} 
          variant="ghost" 
          className="text-muted-foreground text-sm"
        >
          Personalizar depois nas configurações
        </Button>
      </motion.div>
    </motion.div>
  );
};

export const getPersonalitySettings = (personalityId: string) => {
  const personality = personalities.find(p => p.id === personalityId);
  if (!personality) {
    return personalities.find(p => p.id === "balanced")!;
  }
  return personality;
};
