import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Stethoscope, Scale, Wrench, ShoppingBag, GraduationCap, 
  Briefcase, Smile, Sparkles, Dumbbell, Settings, UserCog,
  LayoutGrid, FolderHeart
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MyTemplates } from "./MyTemplates";

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
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: true,
        appointment_keywords: ["consulta", "agendar", "marcar", "horário disponível", "doutor"],
      }
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
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: true,
        appointment_keywords: ["consulta", "reunião", "caso", "advogado"],
      }
    }
  },
  {
    id: "service_provider",
    name: "Prestador de Serviços",
    icon: Wrench,
    description: "Orçamentos, visitas técnicas",
    config: {
      personality: { tone: 60, verbosity: 50, proactivity: 80, assistant_name: "Atendente", use_emojis: true },
      system_prompt: "Você é assistente de prestador de serviços. Seja cordial e objetivo. Foque em entender o problema, fornecer orçamentos e agendar visitas. Colete fotos se necessário. Seja proativo em sugerir soluções.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: true,
        appointment_keywords: ["orçamento", "visita", "técnico", "serviço", "reparo"],
      }
    }
  },
  {
    id: "retail",
    name: "Comércio/Loja",
    icon: ShoppingBag,
    description: "Produtos, preços, pedidos",
    config: {
      personality: { tone: 75, verbosity: 40, proactivity: 85, assistant_name: "Vendedor Virtual", use_emojis: true },
      system_prompt: "Você é vendedor virtual. Seja simpático e entusiasmado. Destaque produtos, promoções e diferenciais. Responda sobre preços, estoque e prazos. Facilite o fechamento de pedidos.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: false,
      }
    }
  },
  {
    id: "education",
    name: "Educação",
    icon: GraduationCap,
    description: "Matrículas, cursos, horários",
    config: {
      personality: { tone: 50, verbosity: 60, proactivity: 70, assistant_name: "Assistente Educacional", use_emojis: true },
      system_prompt: "Você é assistente educacional. Seja acolhedor e informativo. Forneça informações sobre cursos, matrículas, valores e metodologia. Agende visitas e tire dúvidas sobre processo de admissão.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: true,
        appointment_keywords: ["matrícula", "visita", "conhecer", "informações"],
      }
    }
  },
  {
    id: "consulting",
    name: "Consultoria",
    icon: Briefcase,
    description: "Reuniões, propostas",
    config: {
      personality: { tone: 20, verbosity: 70, proactivity: 60, assistant_name: "Assistente de Consultoria", use_emojis: false },
      system_prompt: "Você é assistente de consultoria. Mantenha tom profissional e consultivo. Qualifique leads fazendo perguntas sobre desafios e objetivos. Agende reuniões de diagnóstico e apresentação de propostas.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: true,
        appointment_keywords: ["reunião", "apresentação", "proposta", "diagnóstico"],
      }
    }
  },
  {
    id: "dentistry",
    name: "Odontologia",
    icon: Smile,
    description: "Tratamentos, convênios",
    config: {
      personality: { tone: 40, verbosity: 55, proactivity: 75, assistant_name: "Recepcionista", use_emojis: true },
      system_prompt: "Você é recepcionista de clínica odontológica. Seja acolhedor e tranquilizador. Informe sobre tratamentos, convênios aceitos e formas de pagamento. Agende consultas e retornos. Em emergências, priorize atendimento rápido.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: true,
        appointment_keywords: ["consulta", "avaliação", "dor", "tratamento", "limpeza"],
      }
    }
  },
  {
    id: "beauty",
    name: "Beleza/Estética",
    icon: Sparkles,
    description: "Serviços, pacotes",
    config: {
      personality: { tone: 80, verbosity: 45, proactivity: 85, assistant_name: "Assistente de Beleza", use_emojis: true },
      system_prompt: "Você é assistente de salão de beleza/estética. Seja caloroso e entusiasmado. Apresente serviços, pacotes e promoções. Destaque benefícios e resultados. Agende horários e sugira combinações de serviços.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: true,
        appointment_keywords: ["agendar", "horário", "procedimento", "pacote"],
      }
    }
  },
  {
    id: "fitness",
    name: "Academia/Fitness",
    icon: Dumbbell,
    description: "Planos, horários, personal",
    config: {
      personality: { tone: 75, verbosity: 50, proactivity: 80, assistant_name: "Coach Virtual", use_emojis: true },
      system_prompt: "Você é assistente de academia. Seja motivador e energético. Apresente planos, modalidades e horários. Destaque benefícios para saúde. Agende aulas experimentais e avaliações físicas.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: true,
        appointment_keywords: ["aula experimental", "avaliação", "treino", "plano"],
      }
    }
  },
  {
    id: "custom",
    name: "Personalizado",
    icon: Settings,
    description: "Configure do zero",
    config: {
      personality: { tone: 50, verbosity: 50, proactivity: 50, assistant_name: "Assistente", use_emojis: true },
      system_prompt: "Você é um assistente virtual prestativo. Ajude o cliente com suas dúvidas de forma clara e eficiente.",
      behavior: {
        business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
        appointment_detection: true,
        appointment_keywords: ["agendar", "marcar"],
      }
    }
  },
];

interface CurrentSettings {
  template?: string | null;
  personality?: {
    tone: number;
    verbosity: number;
    proactivity: number;
    assistant_name: string;
    use_emojis: boolean;
  };
  system_prompt?: string;
  behavior?: {
    business_hours?: {
      start: string;
      end: string;
      weekdays_only: boolean;
    };
  };
  quick_replies?: any;
}

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  currentSettings?: CurrentSettings;
  workspaceId?: string;
  onSelectTemplate: (templateId: string, config: any) => void;
}

const getSettingsSummary = (settings?: CurrentSettings): string => {
  if (!settings?.personality) return "Configurações padrão";
  
  const { personality, behavior } = settings;
  const parts: string[] = [];
  
  // Tone description
  if (personality.tone <= 30) parts.push("Tom Formal");
  else if (personality.tone >= 70) parts.push("Tom Casual");
  else parts.push("Tom Equilibrado");
  
  // Emojis
  parts.push(personality.use_emojis ? "Com emojis" : "Sem emojis");
  
  // Business hours
  if (behavior?.business_hours) {
    const { start, end } = behavior.business_hours;
    parts.push(`${start}-${end}`);
  }
  
  return parts.join(" • ");
};

export const TemplateSelector = ({ 
  selectedTemplate, 
  currentSettings, 
  workspaceId,
  onSelectTemplate 
}: TemplateSelectorProps) => {
  const [pendingTemplate, setPendingTemplate] = useState<{ id: string; config: any } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("ready");

  const hasCustomSettings = currentSettings && (
    currentSettings.system_prompt || 
    currentSettings.personality?.assistant_name !== "Assistente" ||
    (currentSettings.template && !templates.find(t => t.id === currentSettings.template))
  );

  const handleTemplateClick = (templateId: string, config: any) => {
    // If clicking on "current" profile card, do nothing
    if (templateId === "current") return;
    
    // If user has custom settings or a selected template, show confirmation
    if (hasCustomSettings || selectedTemplate) {
      setPendingTemplate({ id: templateId, config });
      setShowConfirmDialog(true);
    } else {
      // First time selecting, apply directly
      onSelectTemplate(templateId, { ...config, template: templateId });
    }
  };

  const handleConfirmChange = () => {
    if (pendingTemplate) {
      onSelectTemplate(pendingTemplate.id, { ...pendingTemplate.config, template: pendingTemplate.id });
    }
    setShowConfirmDialog(false);
    setPendingTemplate(null);
  };

  const handleCancelChange = () => {
    setShowConfirmDialog(false);
    setPendingTemplate(null);
  };

  const handleApplyCustomTemplate = (config: any) => {
    onSelectTemplate(config.template, config);
  };

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 w-full sm:w-auto flex">
          <TabsTrigger value="ready" className="gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
            <LayoutGrid className="w-4 h-4 shrink-0" />
            <span className="truncate">Templates Prontos</span>
          </TabsTrigger>
          <TabsTrigger value="my" className="gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
            <FolderHeart className="w-4 h-4 shrink-0" />
            <span className="truncate">Meus Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready">
          <h3 className="text-xl font-semibold mb-2">Escolha um Template</h3>
          <p className="text-muted-foreground mb-6">
            Selecione um template pré-configurado para seu tipo de negócio
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Current Profile Card - Always first */}
            <Card
              className={cn(
                "p-6 transition-all border-2",
                "ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500/30"
              )}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-4 rounded-full bg-emerald-500 text-white">
                  <UserCog className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2">
                    <h4 className="font-semibold text-lg">
                      {currentSettings?.personality?.assistant_name || "Perfil Atual"}
                    </h4>
                    <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                      Ativo
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getSettingsSummary(currentSettings)}
                  </p>
                </div>
              </div>
            </Card>

            {/* Template Cards */}
            {templates.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedTemplate === template.id;
              
              return (
                <Card
                  key={template.id}
                  className={cn(
                    "p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-105",
                    isSelected && "ring-2 ring-primary bg-primary/5"
                  )}
                  onClick={() => handleTemplateClick(template.id, template.config)}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={cn(
                      "p-4 rounded-full",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{template.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="my">
          {workspaceId ? (
            <MyTemplates
              workspaceId={workspaceId}
              onApplyTemplate={handleApplyCustomTemplate}
            />
          ) : (
            <p className="text-muted-foreground">Carregando...</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir configurações atuais?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao aplicar este template, suas configurações atuais de personalidade, prompt e comportamento serão substituídas. 
              <br /><br />
              <strong>Dica:</strong> Salve suas configurações atuais em "Meus Templates" antes de trocar, assim você não perde nada!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelChange}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChange}>
              Aplicar Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
