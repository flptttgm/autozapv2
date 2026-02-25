import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Stethoscope, Scale, Wrench, ShoppingBag, GraduationCap, 
  Briefcase, Smile, Sparkles, Dumbbell, Settings, Bot, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const templates = [
  {
    id: "medical_clinic",
    name: "Clínica Médica",
    icon: Stethoscope,
    description: "Agendamentos, sigilo médico, urgências",
    config: {
      personality: { tone: 30, verbosity: 60, proactivity: 70, assistant_name: "Assistente Médico", use_emojis: false },
      system_prompt: "Você é um assistente de clínica médica. Mantenha tom profissional e empático. Priorize sigilo das informações. Foque em agendamentos e orientações básicas. Em casos de urgência, oriente buscar atendimento presencial imediato.",
      behavior: {
        business_hours: { start: "07:00", end: "19:00", weekdays_only: false },
        out_of_hours_message: "No momento estamos fora do horário de atendimento. Nosso horário é de segunda a domingo, das 7h às 19h. Em caso de urgência, procure o pronto-socorro mais próximo.",
        human_transfer_keywords: ["atendente", "humano", "falar com alguém", "reclamação"],
        appointment_detection: true,
        appointment_keywords: ["consulta", "agendar", "marcar", "horário disponível", "doutor", "médico"],
      },
      quick_replies: []
    }
  },
  {
    id: "law_firm",
    name: "Escritório de Advocacia",
    icon: Scale,
    description: "Linguagem formal, confidencialidade",
    config: {
      personality: { tone: 10, verbosity: 70, proactivity: 50, assistant_name: "Assistente Jurídico", use_emojis: false },
      system_prompt: "Você é assistente de escritório de advocacia. Mantenha linguagem formal e técnica. Enfatize confidencialidade. Não forneça orientações jurídicas específicas. Agende consultas e colete informações preliminares do caso.",
      behavior: {
        business_hours: { start: "09:00", end: "18:00", weekdays_only: true },
        out_of_hours_message: "Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Retornaremos o contato assim que possível.",
        human_transfer_keywords: ["advogado", "humano", "falar com alguém"],
        appointment_detection: true,
        appointment_keywords: ["consulta", "reunião", "caso", "advogado", "agendar"],
      },
      quick_replies: []
    }
  },
  {
    id: "service_provider",
    name: "Prestador de Serviços",
    icon: Wrench,
    description: "Orçamentos, visitas técnicas",
    config: {
      personality: { tone: 60, verbosity: 50, proactivity: 80, assistant_name: "Atendente", use_emojis: true },
      system_prompt: "Você é assistente de prestador de serviços. Seja cordial e objetivo. Foque em entender o problema, fornecer orçamentos e agendar visitas. Peça fotos ou vídeos se necessário. Seja proativo em sugerir soluções.",
      behavior: {
        business_hours: { start: "08:00", end: "18:00", weekdays_only: false },
        out_of_hours_message: "Estamos fora do horário de atendimento. Retornaremos seu contato amanhã a partir das 8h!",
        human_transfer_keywords: ["atendente", "humano", "falar com alguém", "responsável"],
        appointment_detection: true,
        appointment_keywords: ["orçamento", "visita", "técnico", "serviço", "reparo", "agendar"],
      },
      quick_replies: []
    }
  },
  {
    id: "retail",
    name: "Comércio/Loja",
    icon: ShoppingBag,
    description: "Produtos, preços, pedidos",
    config: {
      personality: { tone: 75, verbosity: 40, proactivity: 85, assistant_name: "Vendedor Virtual", use_emojis: true },
      system_prompt: "Você é vendedor virtual. Seja simpático e entusiasmado. Destaque produtos, promoções e diferenciais. Responda sobre preços, estoque e prazos. Facilite o fechamento de pedidos. Pergunte se pode ajudar com mais alguma coisa.",
      behavior: {
        business_hours: { start: "09:00", end: "20:00", weekdays_only: false },
        out_of_hours_message: "Obrigado pelo contato! 🛍️ Estamos fora do horário de atendimento. Retornaremos amanhã a partir das 9h!",
        human_transfer_keywords: ["atendente", "humano", "falar com vendedor", "reclamação"],
        appointment_detection: false,
        appointment_keywords: [],
      },
      quick_replies: []
    }
  },
  {
    id: "dentistry",
    name: "Odontologia",
    icon: Smile,
    description: "Tratamentos, convênios",
    config: {
      personality: { tone: 40, verbosity: 55, proactivity: 75, assistant_name: "Recepcionista", use_emojis: true },
      system_prompt: "Você é recepcionista de clínica odontológica. Seja acolhedor e tranquilizador. Informe sobre tratamentos, convênios aceitos e formas de pagamento. Agende consultas e retornos. Em emergências (dor intensa), priorize atendimento rápido.",
      behavior: {
        business_hours: { start: "08:00", end: "19:00", weekdays_only: false },
        out_of_hours_message: "Estamos fora do horário de atendimento. Nosso horário é de segunda a sábado, das 8h às 19h. Em caso de dor intensa, procure um pronto-socorro odontológico.",
        human_transfer_keywords: ["dentista", "humano", "falar com alguém", "reclamação"],
        appointment_detection: true,
        appointment_keywords: ["consulta", "avaliação", "dor", "tratamento", "limpeza", "agendar", "marcar"],
      },
      quick_replies: []
    }
  },
  {
    id: "beauty",
    name: "Beleza/Estética",
    icon: Sparkles,
    description: "Serviços, pacotes, agendamentos",
    config: {
      personality: { tone: 80, verbosity: 45, proactivity: 85, assistant_name: "Assistente de Beleza", use_emojis: true },
      system_prompt: "Você é assistente de salão de beleza/estética. Seja caloroso e entusiasmado. Apresente serviços, pacotes e promoções. Destaque benefícios e resultados. Agende horários e sugira combinações de serviços.",
      behavior: {
        business_hours: { start: "09:00", end: "20:00", weekdays_only: false },
        out_of_hours_message: "Olá! ✨ Estamos fora do horário de atendimento. Retornaremos amanhã a partir das 9h. Fique linda(o)! 💅",
        human_transfer_keywords: ["atendente", "humano", "falar com alguém"],
        appointment_detection: true,
        appointment_keywords: ["agendar", "horário", "procedimento", "pacote", "marcar"],
      },
      quick_replies: []
    }
  },
  {
    id: "fitness",
    name: "Academia/Fitness",
    icon: Dumbbell,
    description: "Planos, horários, personal",
    config: {
      personality: { tone: 75, verbosity: 50, proactivity: 80, assistant_name: "Coach Virtual", use_emojis: true },
      system_prompt: "Você é assistente de academia. Seja motivador e energético. Apresente planos, modalidades e horários. Destaque benefícios para saúde. Agende aulas experimentais e avaliações físicas. Motive o cliente a começar!",
      behavior: {
        business_hours: { start: "06:00", end: "22:00", weekdays_only: false },
        out_of_hours_message: "Estamos fora do horário de atendimento, mas logo voltamos! 💪 Nosso horário é das 6h às 22h.",
        human_transfer_keywords: ["personal", "humano", "falar com alguém"],
        appointment_detection: true,
        appointment_keywords: ["aula experimental", "avaliação", "treino", "plano", "agendar", "conhecer"],
      },
      quick_replies: []
    }
  },
  {
    id: "consulting",
    name: "Consultoria",
    icon: Briefcase,
    description: "Reuniões, propostas, B2B",
    config: {
      personality: { tone: 20, verbosity: 70, proactivity: 60, assistant_name: "Assistente de Consultoria", use_emojis: false },
      system_prompt: "Você é assistente de consultoria. Mantenha tom profissional e consultivo. Qualifique leads fazendo perguntas sobre desafios e objetivos. Agende reuniões de diagnóstico e apresentação de propostas.",
      behavior: {
        business_hours: { start: "09:00", end: "18:00", weekdays_only: true },
        out_of_hours_message: "Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Retornaremos o contato assim que possível.",
        human_transfer_keywords: ["consultor", "humano", "falar com alguém"],
        appointment_detection: true,
        appointment_keywords: ["reunião", "apresentação", "proposta", "diagnóstico", "agendar"],
      },
      quick_replies: []
    }
  },
  {
    id: "custom",
    name: "Personalizado",
    icon: Settings,
    description: "Configure do seu jeito",
    config: {
      personality: { tone: 50, verbosity: 50, proactivity: 50, assistant_name: "Assistente", use_emojis: true },
      system_prompt: "Você é um assistente virtual prestativo. Ajude o cliente com suas dúvidas de forma clara e eficiente. Seja educado e profissional.",
      behavior: {
        business_hours: { start: "08:00", end: "18:00", weekdays_only: true },
        out_of_hours_message: "No momento estamos fora do horário de atendimento. Retornaremos em breve!",
        human_transfer_keywords: ["atendente", "humano", "falar com alguém"],
        appointment_detection: true,
        appointment_keywords: ["agendar", "marcar"],
      },
      quick_replies: []
    }
  },
];

interface BusinessTemplateStepProps {
  companyName: string;
  onNext: (templateId: string, config: any) => void;
  onSkip: () => void;
}

export const BusinessTemplateStep = ({ companyName, onNext, onSkip }: BusinessTemplateStepProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<any>(null);

  const handleSelect = (templateId: string, config: any) => {
    setSelectedTemplate(templateId);
    // Personalizar o nome do assistente com o nome da empresa
    const personalizedConfig = {
      ...config,
      personality: {
        ...config.personality,
        assistant_name: companyName 
          ? `${config.personality.assistant_name} - ${companyName}` 
          : config.personality.assistant_name
      }
    };
    setSelectedConfig(personalizedConfig);
  };

  const handleContinue = () => {
    if (selectedTemplate && selectedConfig) {
      onNext(selectedTemplate, selectedConfig);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-4xl"
    >
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Tipo de Negócio</h1>
        <p className="text-muted-foreground">
          Selecione um template para configurar a IA automaticamente
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {templates.map((template) => {
          const Icon = template.icon;
          const isSelected = selectedTemplate === template.id;
          
          return (
            <Card
              key={template.id}
              className={cn(
                "p-4 cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary bg-primary/5"
              )}
              onClick={() => handleSelect(template.id, template.config)}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-3 rounded-full shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold truncate">{template.name}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {template.description}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center gap-4">
        <Button
          variant="outline"
          onClick={onSkip}
        >
          Pular
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedTemplate}
          className="gap-2"
        >
          Continuar
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export { templates };
