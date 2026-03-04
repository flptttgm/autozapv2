import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    FileText,
    CheckCircle2,
    XCircle,
    Calendar,
    CalendarCheck,
    CalendarX2,
    Receipt,
    CircleDollarSign,
    UserPlus,
    MessageSquare,
    Bot,
    Smartphone,
    TrendingUp,
    ArrowRightLeft,
    AlertTriangle,
    UserCheck,
    AtSign,
    Tag,
    ShieldAlert,
    Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TimelineEvent {
    id: string;
    type: string;
    title: string;
    description?: string | null;
    value?: number | null;
    date: string;
    icon: string;
    color:
    | "yellow"
    | "green"
    | "red"
    | "blue"
    | "orange"
    | "purple"
    | "gray"
    | "cyan"
    | "teal"
    | "indigo";
}

interface LeadTimelineProps {
    leadId: string;
    leadMetadata?: any;
    leadName?: string | null;
    leadEmail?: string | null;
    leadCreatedAt?: string | null;
}

const getTimelineIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
        FileText: <FileText className="h-3.5 w-3.5" />,
        CheckCircle2: <CheckCircle2 className="h-3.5 w-3.5" />,
        XCircle: <XCircle className="h-3.5 w-3.5" />,
        Calendar: <Calendar className="h-3.5 w-3.5" />,
        CalendarCheck: <CalendarCheck className="h-3.5 w-3.5" />,
        CalendarX2: <CalendarX2 className="h-3.5 w-3.5" />,
        Receipt: <Receipt className="h-3.5 w-3.5" />,
        CircleDollarSign: <CircleDollarSign className="h-3.5 w-3.5" />,
        UserPlus: <UserPlus className="h-3.5 w-3.5" />,
        MessageSquare: <MessageSquare className="h-3.5 w-3.5" />,
        Bot: <Bot className="h-3.5 w-3.5" />,
        Smartphone: <Smartphone className="h-3.5 w-3.5" />,
        TrendingUp: <TrendingUp className="h-3.5 w-3.5" />,
        ArrowRightLeft: <ArrowRightLeft className="h-3.5 w-3.5" />,
        AlertTriangle: <AlertTriangle className="h-3.5 w-3.5" />,
        UserCheck: <UserCheck className="h-3.5 w-3.5" />,
        AtSign: <AtSign className="h-3.5 w-3.5" />,
        Tag: <Tag className="h-3.5 w-3.5" />,
        ShieldAlert: <ShieldAlert className="h-3.5 w-3.5" />,
    };
    return icons[iconName] || <Clock className="h-3.5 w-3.5" />;
};

const getTimelineColor = (color: string) => {
    const colors: Record<string, string> = {
        yellow: "bg-yellow-500 text-yellow-50",
        green: "bg-green-500 text-green-50",
        red: "bg-red-500 text-red-50",
        blue: "bg-blue-500 text-blue-50",
        orange: "bg-orange-500 text-orange-50",
        purple: "bg-purple-500 text-purple-50",
        gray: "bg-gray-500 text-gray-50",
        cyan: "bg-cyan-500 text-cyan-50",
        teal: "bg-teal-500 text-teal-50",
        indigo: "bg-indigo-500 text-indigo-50",
    };
    return colors[color] || colors.gray;
};

const formatCurrency = (value: number | null | undefined) => {
    if (!value) return null;
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
};

export function LeadTimeline({
    leadId,
    leadMetadata,
    leadName,
    leadEmail,
    leadCreatedAt,
}: LeadTimelineProps) {
    const { data: timelineEvents = [] } = useQuery({
        queryKey: ["lead-timeline", leadId],
        queryFn: async (): Promise<TimelineEvent[]> => {
            if (!leadId) return [];

            const events: TimelineEvent[] = [];

            // Fetch quotes
            const { data: quotes } = await supabase
                .from("quotes")
                .select(
                    "id, status, ai_summary, estimated_value, created_at, accepted_at, sent_at"
                )
                .eq("lead_id", leadId)
                .order("created_at", { ascending: false });

            quotes?.forEach((quote) => {
                events.push({
                    id: `quote-created-${quote.id}`,
                    type: "quote_created",
                    title: "Orçamento criado",
                    description: quote.ai_summary || "Orçamento registrado",
                    value: quote.estimated_value,
                    date: quote.created_at,
                    icon: "FileText",
                    color: "yellow",
                });
                if (quote.accepted_at) {
                    events.push({
                        id: `quote-accepted-${quote.id}`,
                        type: "quote_accepted",
                        title: "Orçamento aceito",
                        description: quote.ai_summary,
                        value: quote.estimated_value,
                        date: quote.accepted_at,
                        icon: "CheckCircle2",
                        color: "green",
                    });
                }
                if (quote.status === "rejected") {
                    events.push({
                        id: `quote-rejected-${quote.id}`,
                        type: "quote_rejected",
                        title: "Orçamento rejeitado",
                        description: quote.ai_summary,
                        date: quote.created_at,
                        icon: "XCircle",
                        color: "red",
                    });
                }
            });

            // Fetch appointments
            const { data: appointments } = await supabase
                .from("appointments")
                .select("id, title, status, start_time, created_at")
                .eq("lead_id", leadId)
                .order("created_at", { ascending: false });

            appointments?.forEach((apt) => {
                if (apt.status === "cancelled") {
                    events.push({
                        id: `apt-cancelled-${apt.id}`,
                        type: "appointment_cancelled",
                        title: "Agendamento cancelado",
                        description: apt.title,
                        date: apt.created_at,
                        icon: "CalendarX2",
                        color: "red",
                    });
                } else {
                    events.push({
                        id: `apt-${apt.id}`,
                        type:
                            apt.status === "completed"
                                ? "appointment_completed"
                                : "appointment_created",
                        title:
                            apt.status === "completed"
                                ? "Agendamento concluído"
                                : "Agendamento marcado",
                        description: apt.title,
                        date: apt.created_at,
                        icon: apt.status === "completed" ? "CalendarCheck" : "Calendar",
                        color: apt.status === "completed" ? "green" : "blue",
                    });
                }
            });

            // Fetch invoices
            const { data: invoices } = await supabase
                .from("invoices")
                .select("id, amount, status, sent_at, paid_at, created_at, due_date")
                .eq("lead_id", leadId)
                .order("created_at", { ascending: false });

            invoices?.forEach((invoice) => {
                if (invoice.sent_at) {
                    events.push({
                        id: `invoice-sent-${invoice.id}`,
                        type: "invoice_sent",
                        title: "Cobrança enviada",
                        value: invoice.amount,
                        date: invoice.sent_at,
                        icon: "Receipt",
                        color: "orange",
                    });
                }
                if (invoice.paid_at) {
                    events.push({
                        id: `invoice-paid-${invoice.id}`,
                        type: "invoice_paid",
                        title: "Pagamento recebido",
                        value: invoice.amount,
                        date: invoice.paid_at,
                        icon: "CircleDollarSign",
                        color: "green",
                    });
                }
                const dueDate = (invoice as any).due_date;
                if (dueDate && !invoice.paid_at && new Date(dueDate) < new Date()) {
                    events.push({
                        id: `invoice-overdue-${invoice.id}`,
                        type: "invoice_overdue",
                        title: "Cobrança vencida",
                        description: "Pagamento em atraso",
                        value: invoice.amount,
                        date: dueDate,
                        icon: "AlertTriangle",
                        color: "red",
                    });
                }
            });

            // First AI response
            const { data: firstAiMsg } = await supabase
                .from("messages")
                .select("id, created_at")
                .eq("lead_id", leadId)
                .eq("direction", "outbound")
                .order("created_at", { ascending: true })
                .limit(1);

            if (firstAiMsg?.[0]) {
                events.push({
                    id: "first-ai-response",
                    type: "first_ai_response",
                    title: "Primeira resposta da IA",
                    description: "Agente IA iniciou atendimento",
                    date: firstAiMsg[0].created_at,
                    icon: "Bot",
                    color: "cyan",
                });
            }

            // First manual message
            const { data: firstManualMsg } = await supabase
                .from("messages")
                .select("id, created_at")
                .eq("lead_id", leadId)
                .eq("direction", "outbound_manual")
                .order("created_at", { ascending: true })
                .limit(1);

            if (firstManualMsg?.[0]) {
                events.push({
                    id: "first-manual-msg",
                    type: "first_manual_message",
                    title: "Atendimento humano",
                    description: "Mensagem enviada diretamente pelo WhatsApp",
                    date: firstManualMsg[0].created_at,
                    icon: "Smartphone",
                    color: "teal",
                });
            }

            // Agent transfer / AI pause
            const { data: chatMemory } = await supabase
                .from("chat_memory")
                .select(
                    "ai_paused, pause_reason, paused_at, current_agent_id, custom_templates(name)"
                )
                .eq("lead_id", leadId)
                .limit(1)
                .single();

            if (chatMemory?.ai_paused && chatMemory?.paused_at) {
                const reasonMap: Record<string, string> = {
                    manual_takeover: "Atendente assumiu a conversa",
                    human_requested: "Cliente solicitou atendente humano",
                    error: "Pausa por erro no processamento",
                };
                events.push({
                    id: "ai-paused",
                    type: "agent_transfer",
                    title: "IA pausada",
                    description:
                        reasonMap[chatMemory.pause_reason || ""] ||
                        chatMemory.pause_reason ||
                        "Transferência para atendente",
                    date: chatMemory.paused_at,
                    icon: "ArrowRightLeft",
                    color: "orange",
                });
            }

            // Lead creation
            if (leadCreatedAt) {
                events.push({
                    id: "lead-created",
                    type: "lead_created",
                    title: "Primeiro contato",
                    description: "Lead criado",
                    date: leadCreatedAt,
                    icon: "UserPlus",
                    color: "gray",
                });
            }

            // Notes from metadata
            const notesData = (leadMetadata?.notes || []) as {
                content: string;
                date: string;
            }[];
            notesData.forEach((note, index) => {
                events.push({
                    id: `note-${index}`,
                    type: "note_added",
                    title: "Anotação",
                    description: note.content,
                    date: note.date,
                    icon: "MessageSquare",
                    color: "purple",
                });
            });

            // Status changes
            const statusHistory = (leadMetadata?.status_history || []) as {
                from: string;
                to: string;
                date: string;
            }[];
            const statusLabels: Record<string, string> = {
                new: "Novo",
                contacted: "Contatado",
                qualified: "Qualificado",
                proposal: "Proposta",
                negotiation: "Negociação",
                won: "Ganho",
                lost: "Perdido",
            };
            statusHistory.forEach((change, index) => {
                events.push({
                    id: `status-change-${index}`,
                    type: "status_changed",
                    title: "Status alterado",
                    description: `${statusLabels[change.from] || change.from} → ${statusLabels[change.to] || change.to}`,
                    date: change.date,
                    icon: "ShieldAlert",
                    color:
                        change.to === "lost"
                            ? "red"
                            : change.to === "won"
                                ? "green"
                                : "blue",
                });
            });

            // Score milestones
            const scoreHistory = (leadMetadata?.score_history || []) as {
                score: number;
                date: string;
            }[];
            const milestones = [25, 50, 75, 100];
            const passedMilestones = new Set<number>();
            scoreHistory.forEach((entry) => {
                milestones.forEach((milestone) => {
                    if (entry.score >= milestone && !passedMilestones.has(milestone)) {
                        passedMilestones.add(milestone);
                        events.push({
                            id: `score-milestone-${milestone}`,
                            type: "score_milestone",
                            title: `Score atingiu ${milestone}%`,
                            description: `Engajamento em alta — score passou de ${milestone}%`,
                            date: entry.date,
                            icon: "TrendingUp",
                            color: milestone >= 75 ? "green" : milestone >= 50 ? "blue" : "yellow",
                        });
                    }
                });
            });

            // Name identified
            const nameHistory = leadMetadata?.name_identified_at as string | undefined;
            if (nameHistory && leadName) {
                events.push({
                    id: "name-identified",
                    type: "name_identified",
                    title: "Nome identificado",
                    description: `Contato identificado como "${leadName}"`,
                    date: nameHistory,
                    icon: "UserCheck",
                    color: "teal",
                });
            }

            // Email captured
            const emailCapturedAt = leadMetadata?.email_captured_at as string | undefined;
            if (emailCapturedAt && leadEmail) {
                events.push({
                    id: "email-captured",
                    type: "email_captured",
                    title: "Email capturado",
                    description: leadEmail,
                    date: emailCapturedAt,
                    icon: "AtSign",
                    color: "indigo",
                });
            }

            return events.sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
        },
        enabled: !!leadId,
    });

    return (
        <Card>
            <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
                    Histórico
                </p>

                {timelineEvents.length > 0 ? (
                    <div className="relative pl-2">
                        {/* Vertical line */}
                        <div className="absolute left-[19px] top-6 bottom-4 w-px bg-gradient-to-b from-border via-border to-transparent" />

                        <div className="space-y-5">
                            {timelineEvents.slice(0, 20).map((event) => (
                                <div
                                    key={event.id}
                                    className="relative flex gap-4 group/timeline"
                                >
                                    {/* Icon circle */}
                                    <div
                                        className={cn(
                                            "relative z-10 h-7 w-7 rounded-full flex items-center justify-center shrink-0 border border-background shadow-sm transition-transform group-hover/timeline:scale-110",
                                            getTimelineColor(event.color)
                                        )}
                                    >
                                        {getTimelineIcon(event.icon)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-0.5">
                                            <span className="text-sm font-medium text-foreground">
                                                {event.title}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {format(new Date(event.date), "dd MMM, HH:mm", {
                                                    locale: ptBR,
                                                })}
                                            </span>
                                        </div>
                                        {event.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {event.description}
                                            </p>
                                        )}
                                        {event.value && (
                                            <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-medium text-xs">
                                                {formatCurrency(event.value)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {timelineEvents.length > 20 && (
                            <p className="text-xs text-muted-foreground text-center mt-3">
                                +{timelineEvents.length - 20} eventos anteriores
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                        <Clock className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma interação registrada</p>
                        <p className="text-xs">
                            Orçamentos, agendamentos e eventos aparecerão aqui
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
