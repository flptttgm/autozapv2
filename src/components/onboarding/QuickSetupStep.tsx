import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope, Wrench, ShoppingBag, Briefcase, Settings,
  Sparkles, ArrowRight, Phone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/validators";

// Simplified business categories (5 instead of 9)
const businessCategories = [
  {
    id: "health",
    name: "Saúde",
    description: "Clínica, consultório, odonto",
    icon: Stethoscope,
    config: {
      personality: { tone: 30, verbosity: 60, proactivity: 70, use_emojis: false },
      system_prompt: "Você é um assistente de estabelecimento de saúde. Mantenha tom profissional e empático. Priorize sigilo das informações. Foque em agendamentos e orientações básicas.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        out_of_hours_message: "",
        human_transfer_keywords: ["atendente", "humano", "falar com alguém"],
        appointment_detection: true,
        appointment_keywords: ["consulta", "agendar", "marcar", "horário"],
      },
      quick_replies: []
    }
  },
  {
    id: "services",
    name: "Serviços",
    description: "Técnico, reparos, manutenção",
    icon: Wrench,
    config: {
      personality: { tone: 60, verbosity: 50, proactivity: 80, use_emojis: true },
      system_prompt: "Você é assistente de prestador de serviços. Seja cordial e objetivo. Foque em entender o problema, fornecer orçamentos e agendar visitas.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        out_of_hours_message: "",
        human_transfer_keywords: ["atendente", "humano", "falar com alguém"],
        appointment_detection: true,
        appointment_keywords: ["orçamento", "visita", "técnico", "serviço", "agendar"],
      },
      quick_replies: []
    }
  },
  {
    id: "commerce",
    name: "Comércio",
    description: "Loja, varejo, vendas",
    icon: ShoppingBag,
    config: {
      personality: { tone: 75, verbosity: 40, proactivity: 85, use_emojis: true },
      system_prompt: "Você é vendedor virtual. Seja simpático e entusiasmado. Destaque produtos, promoções e diferenciais. Facilite o fechamento de pedidos.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        out_of_hours_message: "",
        human_transfer_keywords: ["atendente", "humano", "falar com vendedor"],
        appointment_detection: false,
        appointment_keywords: [],
      },
      quick_replies: []
    }
  },
  {
    id: "professional",
    name: "Profissional",
    description: "Advocacia, consultoria, B2B",
    icon: Briefcase,
    config: {
      personality: { tone: 20, verbosity: 70, proactivity: 60, use_emojis: false },
      system_prompt: "Você é assistente profissional. Mantenha tom profissional e consultivo. Qualifique leads fazendo perguntas sobre necessidades. Agende reuniões.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        out_of_hours_message: "",
        human_transfer_keywords: ["consultor", "humano", "falar com alguém"],
        appointment_detection: true,
        appointment_keywords: ["reunião", "proposta", "agendar"],
      },
      quick_replies: []
    }
  },
  {
    id: "other",
    name: "Outro",
    description: "Configuração padrão",
    icon: Settings,
    config: {
      personality: { tone: 50, verbosity: 50, proactivity: 50, use_emojis: true },
      system_prompt: "Você é um assistente virtual prestativo. Ajude o cliente com suas dúvidas de forma clara e eficiente. Seja educado e profissional.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        out_of_hours_message: "",
        human_transfer_keywords: ["atendente", "humano", "falar com alguém"],
        appointment_detection: true,
        appointment_keywords: ["agendar", "marcar"],
      },
      quick_replies: []
    }
  },
];

interface QuickSetupStepProps {
  initialCompanyName?: string;
  initialWhatsappNumber?: string;
  onComplete: (companyName: string, whatsappNumber: string, categoryId: string, config: any) => void;
  onSkip?: () => void;
}

export const QuickSetupStep = ({ initialCompanyName = "", initialWhatsappNumber = "", onComplete, onSkip }: QuickSetupStepProps) => {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [whatsappNumber, setWhatsappNumber] = useState(initialWhatsappNumber);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (initialCompanyName) {
      setCompanyName(initialCompanyName);
    }
    if (initialWhatsappNumber) {
      setWhatsappNumber(initialWhatsappNumber);
    }
  }, [initialCompanyName, initialWhatsappNumber]);

  const handleContinue = () => {
    // Default to "other" if no category selected
    const categoryId = selectedCategory || "other";
    const category = businessCategories.find(c => c.id === categoryId) || businessCategories[4];

    // Build config with company name
    const config = {
      template: categoryId,
      ...category.config,
      personality: {
        ...category.config.personality,
        assistant_name: companyName ? `Assistente ${companyName}` : "Assistente Virtual"
      }
    };

    onComplete(companyName, whatsappNumber, categoryId, config);
  };

  // WhatsApp format: (XX) XXXXX-XXXX = 15 characters with mask
  const isValidWhatsapp = whatsappNumber.replace(/\D/g, '').length >= 10;
  const isValid = companyName.trim().length >= 2 && isValidWhatsapp;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
        >
          <Sparkles className="w-8 h-8 text-primary" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold mb-2"
        >
          Bem-vindo ao AutoZap! 👋
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground"
        >
          Vamos configurar tudo em menos de 1 minuto
        </motion.p>
      </div>

      {/* Company Name Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-6"
      >
        <Label htmlFor="company-name" className="text-sm font-medium mb-2 block">
          Nome do seu negócio
        </Label>
        <Input
          id="company-name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Ex: Clínica São Lucas, Studio Ana..."
          className="h-12 text-lg"
          autoFocus
        />
      </motion.div>

      {/* WhatsApp Number Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mb-8"
      >
        <Label htmlFor="whatsapp-number" className="text-sm font-medium mb-2 block">
          Número de WhatsApp
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="whatsapp-number"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(maskPhone(e.target.value))}
            placeholder="(11) 99999-9999"
            className="h-12 text-lg pl-10"
            maxLength={15}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Número que será conectado ao AutoZap
        </p>
      </motion.div>

      {/* Business Category Selection */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-6"
      >
        <Label className="text-sm font-medium mb-3 block">
          Tipo de negócio <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>

        <div className="flex flex-wrap gap-2">
          {businessCategories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(isSelected ? null : category.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all",
                  "text-sm font-medium",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <Icon className="w-4 h-4" />
                {category.name}
              </button>
            );
          })}
        </div>

        {selectedCategory && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-xs text-muted-foreground mt-2"
          >
            {businessCategories.find(c => c.id === selectedCategory)?.description}
          </motion.p>
        )}
      </motion.div>

      {/* Continue Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          onClick={handleContinue}
          disabled={!isValid}
          size="lg"
          className="w-full gap-2"
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </Button>
        {onSkip && (
          <Button
            onClick={onSkip}
            variant="ghost"
            size="lg"
            className="w-full mt-2 text-muted-foreground"
          >
            Fazer isso depois
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
};
