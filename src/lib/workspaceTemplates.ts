import {
    Megaphone,
    TrendingUp,
    Wallet,
    Calendar,
    Headphones,
    Users,
    Monitor,
    Sparkles,
    Building2,
    Target,
    BarChart3,
    Mail,
    Filter,
    DollarSign,
    CreditCard,
    PiggyBank,
    Video,
    Clock,
    ClipboardList,
    LifeBuoy,
    Ticket,
    MessagesSquare,
    UserPlus,
    Briefcase,
    GraduationCap,
    Server,
    Bug,
    ShieldCheck,
    Layers,
    CalendarDays,
    CalendarCheck,
    Bell,
    CalendarRange,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface TemplateSidebarItem {
    name: string;
    href: string;
    icon: LucideIcon;
}

export interface WorkspaceTemplateConfig {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    color: string;       // text-color class
    bgColor: string;     // bg-color class for icon container
    borderColor: string; // border-color class for outline
    sidebarItems: TemplateSidebarItem[];
}

export const WORKSPACE_TEMPLATES: Record<string, WorkspaceTemplateConfig> = {
    marketing: {
        id: "marketing",
        name: "Marketing",
        description: "Campanhas, captação de leads e funil de marketing",
        icon: Megaphone,
        color: "text-pink-500",
        bgColor: "bg-pink-500/10",
        borderColor: "border-pink-500/40",
        sidebarItems: [
            { name: "Campanhas", href: "/campaigns", icon: Target },
            { name: "Funil", href: "/funnel", icon: Filter },
            { name: "Métricas", href: "/metrics", icon: BarChart3 },
            { name: "E-mail Marketing", href: "/email-marketing", icon: Mail },
        ],
    },
    vendas: {
        id: "vendas",
        name: "Vendas",
        description: "Pipeline comercial, follow-ups e orçamentos",
        icon: TrendingUp,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/40",
        sidebarItems: [
            { name: "Pipeline", href: "/pipeline", icon: Filter },
            { name: "Métricas", href: "/metrics", icon: BarChart3 },
            { name: "Metas", href: "/goals", icon: Target },
            { name: "Comissões", href: "/commissions", icon: DollarSign },
        ],
    },
    financeiro: {
        id: "financeiro",
        name: "Financeiro",
        description: "Cobranças, pagamentos e controle financeiro",
        icon: Wallet,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/40",
        sidebarItems: [
            { name: "Cobranças", href: "/invoices", icon: CreditCard },
            { name: "Pagamentos", href: "/payments", icon: DollarSign },
            { name: "Relatórios", href: "/reports", icon: BarChart3 },
            { name: "Caixa", href: "/cashflow", icon: PiggyBank },
        ],
    },
    reunioes: {
        id: "reunioes",
        name: "Reuniões",
        description: "Agendamentos, videoconferências e follow-ups",
        icon: Calendar,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/40",
        sidebarItems: [
            { name: "Agenda", href: "/appointments", icon: Calendar },
            { name: "Gravações", href: "/recordings", icon: Video },
            { name: "Horários", href: "/availability", icon: Clock },
            { name: "Atas", href: "/meeting-notes", icon: ClipboardList },
        ],
    },
    atendimento: {
        id: "atendimento",
        name: "Atendimento",
        description: "Suporte ao cliente, SAC e tickets",
        icon: Headphones,
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
        borderColor: "border-violet-500/40",
        sidebarItems: [
            { name: "Tickets", href: "/tickets", icon: Ticket },
            { name: "Base de Ajuda", href: "/help-center", icon: LifeBuoy },
            { name: "Satisfação", href: "/satisfaction", icon: BarChart3 },
            { name: "Respostas Rápidas", href: "/quick-replies", icon: MessagesSquare },
        ],
    },
    rh: {
        id: "rh",
        name: "RH",
        description: "Recrutamento, onboarding e comunicação interna",
        icon: Users,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
        borderColor: "border-cyan-500/40",
        sidebarItems: [
            { name: "Vagas", href: "/jobs", icon: Briefcase },
            { name: "Candidatos", href: "/candidates", icon: UserPlus },
            { name: "Onboarding", href: "/onboarding", icon: GraduationCap },
            { name: "Equipe", href: "/team", icon: Users },
        ],
    },
    ti: {
        id: "ti",
        name: "TI",
        description: "Suporte técnico, chamados e infraestrutura",
        icon: Monitor,
        color: "text-slate-500",
        bgColor: "bg-slate-500/10",
        borderColor: "border-slate-500/40",
        sidebarItems: [
            { name: "Chamados", href: "/tickets", icon: Bug },
            { name: "Infraestrutura", href: "/infrastructure", icon: Server },
            { name: "Segurança", href: "/security", icon: ShieldCheck },
            { name: "Inventário", href: "/inventory", icon: Layers },
        ],
    },
    agenda: {
        id: "agenda",
        name: "Agenda",
        description: "Agendamentos, compromissos e gerenciamento de horários",
        icon: CalendarDays,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/40",
        sidebarItems: [
            { name: "Compromissos", href: "/appointments", icon: CalendarCheck },
            { name: "Disponibilidade", href: "/availability", icon: Clock },
            { name: "Lembretes", href: "/reminders", icon: Bell },
            { name: "Calendário", href: "/calendar", icon: CalendarRange },
        ],
    },
    custom: {
        id: "custom",
        name: "Personalizado",
        description: "Comece do zero com nome e configuração livres",
        icon: Sparkles,
        color: "text-primary",
        bgColor: "bg-primary/10",
        borderColor: "border-primary/40",
        sidebarItems: [],
    },
};

// Ordered list for rendering template cards
export const WORKSPACE_TEMPLATE_LIST: WorkspaceTemplateConfig[] = [
    WORKSPACE_TEMPLATES.marketing,
    WORKSPACE_TEMPLATES.vendas,
    WORKSPACE_TEMPLATES.financeiro,
    WORKSPACE_TEMPLATES.reunioes,
    WORKSPACE_TEMPLATES.atendimento,
    WORKSPACE_TEMPLATES.rh,
    WORKSPACE_TEMPLATES.ti,
    WORKSPACE_TEMPLATES.agenda,
    WORKSPACE_TEMPLATES.custom,
];

// Default template for workspaces created without a template
export const DEFAULT_TEMPLATE: WorkspaceTemplateConfig = {
    id: "default",
    name: "Workspace",
    description: "Workspace padrão",
    icon: Building2,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/40",
    sidebarItems: [],
};

/**
 * Get template config by template ID.
 * Returns DEFAULT_TEMPLATE if not found.
 */
export function getWorkspaceTemplate(templateId?: string | null): WorkspaceTemplateConfig {
    if (!templateId) return DEFAULT_TEMPLATE;
    return WORKSPACE_TEMPLATES[templateId] || DEFAULT_TEMPLATE;
}
