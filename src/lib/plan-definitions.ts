import { Zap, Crown, Gem, LucideIcon } from "lucide-react";

export interface PlanDefinition {
  name: string;
  price: number;
  annualPrice: number;
  connections: number;
  membersLimit: number;
  features: string[];
  isPopular?: boolean;
  icon: LucideIcon;
}

// Preços centralizados - fonte única de verdade
// Start: R$687/mês | Pro: R$997/mês | Business: R$2.497/mês
// Descontos anuais: Start 15%, Pro 17%, Business 20%, Conexão 12%
export const PLAN_PRICES = {
  start: { monthly: 687, annual: 584 },
  pro: { monthly: 997, annual: 827 },
  business: { monthly: 2497, annual: 1997 },
  connection: { monthly: 297, annual: 261 },
};

// Limites de membros por plano
export const PLAN_MEMBER_LIMITS = {
  trial: 1,
  start: 3,
  pro: 10,
  business: 30,
};

// Features que TODOS os planos têm (Start, Pro, Business)
const baseFeatures = [
  "IA com tecnologia RAG (respostas precisas)",
  "Atendimento automático 24/7",
  "Personalização completa do tom e respostas",
  "Agentes de IA ilimitados",
  "Base de conhecimento ilimitada",
  "Captura automática de leads",
  "Agendamentos integrados ao Google Calendar",
  "Orçamentos gerados pela IA",
  "Cobranças PIX automáticas via WhatsApp",
  "Disparo de mensagens em fila segura",
  "Transferência humanizada quando necessário",
  "Dashboard com métricas em tempo real",
  "Histórico completo de conversas",
  "Mensagens e IA ilimitados",
];

// Definição completa dos planos
export const plans: PlanDefinition[] = [
  {
    name: "Start",
    price: PLAN_PRICES.start.monthly,
    annualPrice: PLAN_PRICES.start.annual,
    connections: 1,
    membersLimit: PLAN_MEMBER_LIMITS.start,
    icon: Zap,
    features: [
      "1 Conexão WhatsApp",
      `Até ${PLAN_MEMBER_LIMITS.start} membros na equipe`,
      ...baseFeatures,
      "Suporte por email",
    ],
  },
  {
    name: "Pro",
    price: PLAN_PRICES.pro.monthly,
    annualPrice: PLAN_PRICES.pro.annual,
    connections: 3,
    membersLimit: PLAN_MEMBER_LIMITS.pro,
    isPopular: true,
    icon: Crown,
    features: [
      "3 Conexões WhatsApp",
      `Até ${PLAN_MEMBER_LIMITS.pro} membros na equipe`,
      ...baseFeatures,
      "Gestão centralizada de múltiplos WhatsApps",
      "Configuração independente por número",
      "Suporte prioritário",
    ],
  },
  {
    name: "Business",
    price: PLAN_PRICES.business.monthly,
    annualPrice: PLAN_PRICES.business.annual,
    connections: 10,
    membersLimit: PLAN_MEMBER_LIMITS.business,
    icon: Gem,
    features: [
      "10 Conexões WhatsApp",
      `Até ${PLAN_MEMBER_LIMITS.business} membros na equipe`,
      ...baseFeatures,
      "Gestão centralizada de múltiplos WhatsApps",
      "Configuração independente por número",
      "Infraestrutura prioritária",
      "Suporte prioritário máximo",
      "Preparado para alto volume",
    ],
  },
];

// Features para exibição resumida (landing pages)
export const getShortFeatures = (planName: string): string[] => {
  switch (planName.toLowerCase()) {
    case "start":
      return [
        "1 Conexão WhatsApp",
        `Equipe de até ${PLAN_MEMBER_LIMITS.start} pessoas`,
        "IA com tecnologia RAG",
        "Atendimento 24/7 automático",
        "Agendamentos automáticos",
        "Cobranças PIX pelo WhatsApp",
        "Orçamentos gerados por IA",
        "Base de conhecimento ilimitada",
        "Dashboard completo",
        "Suporte por email",
      ];
    case "pro":
      return [
        "3 Conexões WhatsApp",
        `Equipe de até ${PLAN_MEMBER_LIMITS.pro} pessoas`,
        "Tudo do Start +",
        "Disparo em massa seguro",
        "50 leads de prospecção/mês",
        "Gestão centralizada multi-número",
        "Roteamento inteligente",
        "Suporte prioritário",
      ];
    case "business":
      return [
        "10 Conexões WhatsApp",
        `Equipe de até ${PLAN_MEMBER_LIMITS.business} pessoas`,
        "Tudo do Pro +",
        "100 leads de prospecção/mês",
        "Infraestrutura dedicada",
        "Alto volume de disparos",
        "Onboarding personalizado",
        "Suporte VIP com prioridade máxima",
      ];
    default:
      return [];
  }
};

// Features para checkout (mais detalhadas)
export const getCheckoutFeatures = (planName: string): string[] => {
  const plan = plans.find(p => p.name.toLowerCase() === planName.toLowerCase());
  return plan?.features || [];
};

// Preço de conexão extra
export const CONNECTION_PRICE = {
  monthly: PLAN_PRICES.connection.monthly,
  annual: PLAN_PRICES.connection.annual,
};

export const connectionFeatures = [
  "1 número WhatsApp adicional",
  "Atendimento automático com IA",
  "Configuração independente",
  "Mesmas funcionalidades do plano",
];
