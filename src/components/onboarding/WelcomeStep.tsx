import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowRight } from "lucide-react";

interface WelcomeStepProps {
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  onNext: () => void;
}

export const WelcomeStep = ({ companyName, onCompanyNameChange, onNext }: WelcomeStepProps) => {
  const [localName, setLocalName] = useState(companyName);

  useEffect(() => {
    setLocalName(companyName);
  }, [companyName]);

  const handleNext = () => {
    onCompanyNameChange(localName);
    onNext();
  };

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
        <Sparkles className="w-10 h-10 text-primary" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold text-foreground mb-3"
      >
        Bem-vindo ao AutoZap! 👋
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-8"
      >
        Vamos configurar tudo em menos de 2 minutos
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full space-y-4 mb-8"
      >
        <div className="text-left">
          <Label htmlFor="company" className="text-sm font-medium">
            Nome do seu negócio
          </Label>
          <Input
            id="company"
            placeholder="Ex: Loja da Maria"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            A IA usará esse nome para se apresentar aos seus clientes
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Button onClick={handleNext} size="lg" className="gap-2 px-8">
          Vamos começar
          <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
};
