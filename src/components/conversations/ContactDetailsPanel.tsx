import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  MapPin,
  Plus,
  X,
  User,
  Calendar,
  MessageSquare,
  FileText,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  CalendarX2,
  Receipt,
  CircleDollarSign,
  UserPlus,
  Clock,
  Bot,
  Smartphone,
  TrendingUp,
  ArrowRightLeft,
  AlertTriangle,
  UserCheck,
  AtSign,
  Tag,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AddTagDialog } from "./AddTagDialog";
import { AddNoteDialog } from "./AddNoteDialog";

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  value?: number | null;
  date: string;
  icon: string;
  color: 'yellow' | 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'gray' | 'cyan' | 'teal' | 'indigo';
}

interface ContactDetailsPanelProps {
  lead: {
    id: string;
    name: string | null;
    phone: string;
    email?: string | null;
    status?: string | null;
    score?: number | null;
    created_at?: string | null;
    metadata?: any;
    avatar_url?: string | null;
  } | null;
  instancePhone?: string | null;
  workspaceId?: string | null;
  onClose?: () => void;
  onLeadUpdated?: () => void;
}

export const ContactDetailsPanel = memo(function ContactDetailsPanel({
  lead,
  instancePhone,
  workspaceId,
  onClose,
  onLeadUpdated,
}: ContactDetailsPanelProps) {
  const [showAddTagDialog, setShowAddTagDialog] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch tags assigned to this lead
  const { data: leadTags = [], refetch: refetchTags } = useQuery({
    queryKey: ["lead-tags", lead?.id],
    queryFn: async () => {
      if (!lead?.id) return [];
      const { data, error } = await supabase
        .from("lead_tag_assignments")
        .select("tag_id, lead_tags(id, name, color)")
        .eq("lead_id", lead.id);
      if (error) throw error;
      return data?.map((d) => d.lead_tags).filter(Boolean) || [];
    },
    enabled: !!lead?.id,
  });

  // Fetch timeline events (quotes, appointments, invoices, messages, tags, etc.)
  const { data: timelineEvents = [] } = useQuery({
    queryKey: ["lead-timeline", lead?.id],
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!lead?.id) return [];

      const events: TimelineEvent[] = [];

      // Fetch quotes
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, status, ai_summary, estimated_value, created_at, accepted_at, sent_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      quotes?.forEach(quote => {
        events.push({
          id: `quote-created-${quote.id}`,
          type: 'quote_created',
          title: 'Orçamento criado',
          description: quote.ai_summary || 'Orçamento registrado',
          value: quote.estimated_value,
          date: quote.created_at,
          icon: 'FileText',
          color: 'yellow'
        });

        if (quote.accepted_at) {
          events.push({
            id: `quote-accepted-${quote.id}`,
            type: 'quote_accepted',
            title: 'Orçamento aceito',
            description: quote.ai_summary,
            value: quote.estimated_value,
            date: quote.accepted_at,
            icon: 'CheckCircle2',
            color: 'green'
          });
        }

        if (quote.status === 'rejected') {
          events.push({
            id: `quote-rejected-${quote.id}`,
            type: 'quote_rejected',
            title: 'Orçamento rejeitado',
            description: quote.ai_summary,
            date: quote.created_at,
            icon: 'XCircle',
            color: 'red'
          });
        }
      });

      // Fetch appointments (including cancelled)
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, title, status, start_time, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      appointments?.forEach(apt => {
        if (apt.status === 'cancelled') {
          events.push({
            id: `apt-cancelled-${apt.id}`,
            type: 'appointment_cancelled',
            title: 'Agendamento cancelado',
            description: apt.title,
            date: apt.created_at,
            icon: 'CalendarX2',
            color: 'red'
          });
        } else {
          events.push({
            id: `apt-${apt.id}`,
            type: apt.status === 'completed' ? 'appointment_completed' : 'appointment_created',
            title: apt.status === 'completed' ? 'Agendamento concluído' : 'Agendamento marcado',
            description: apt.title,
            date: apt.created_at,
            icon: apt.status === 'completed' ? 'CalendarCheck' : 'Calendar',
            color: apt.status === 'completed' ? 'green' : 'blue'
          });
        }
      });

      // Fetch invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, amount, status, sent_at, paid_at, created_at, due_date")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      invoices?.forEach(invoice => {
        if (invoice.sent_at) {
          events.push({
            id: `invoice-sent-${invoice.id}`,
            type: 'invoice_sent',
            title: 'Cobrança enviada',
            value: invoice.amount,
            date: invoice.sent_at,
            icon: 'Receipt',
            color: 'orange'
          });
        }

        if (invoice.paid_at) {
          events.push({
            id: `invoice-paid-${invoice.id}`,
            type: 'invoice_paid',
            title: 'Pagamento recebido',
            value: invoice.amount,
            date: invoice.paid_at,
            icon: 'CircleDollarSign',
            color: 'green'
          });
        }

        // 8. Overdue invoice
        const dueDate = (invoice as any).due_date;
        if (dueDate && !invoice.paid_at && new Date(dueDate) < new Date()) {
          events.push({
            id: `invoice-overdue-${invoice.id}`,
            type: 'invoice_overdue',
            title: 'Cobrança vencida',
            description: 'Pagamento em atraso',
            value: invoice.amount,
            date: dueDate,
            icon: 'AlertTriangle',
            color: 'red'
          });
        }
      });

      // 3. First AI response
      const { data: firstAiMsg } = await supabase
        .from("messages")
        .select("id, created_at")
        .eq("lead_id", lead.id)
        .eq("direction", "outbound")
        .order("created_at", { ascending: true })
        .limit(1);

      if (firstAiMsg?.[0]) {
        events.push({
          id: 'first-ai-response',
          type: 'first_ai_response',
          title: 'Primeira resposta da IA',
          description: 'Agente IA iniciou atendimento',
          date: firstAiMsg[0].created_at,
          icon: 'Bot',
          color: 'cyan'
        });
      }

      // 4. First manual WhatsApp message (outbound_manual)
      const { data: firstManualMsg } = await supabase
        .from("messages")
        .select("id, created_at")
        .eq("lead_id", lead.id)
        .eq("direction", "outbound_manual")
        .order("created_at", { ascending: true })
        .limit(1);

      if (firstManualMsg?.[0]) {
        events.push({
          id: 'first-manual-msg',
          type: 'first_manual_message',
          title: 'Atendimento humano',
          description: 'Mensagem enviada diretamente pelo WhatsApp',
          date: firstManualMsg[0].created_at,
          icon: 'Smartphone',
          color: 'teal'
        });
      }

      // 2. Tags added
      const { data: tagAssignments } = await supabase
        .from("lead_tags" as any)
        .select("tag_id, created_at, tags(name, color)" as any)
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      (tagAssignments as any)?.forEach((assignment: any) => {
        const tagName = assignment.tags?.name || 'Tag';
        events.push({
          id: `tag-${assignment.tag_id}`,
          type: 'tag_added',
          title: 'Tag adicionada',
          description: tagName,
          date: assignment.created_at,
          icon: 'Tag',
          color: 'indigo'
        });
      });

      // 6. Agent transfer / AI pause from chat_memory
      const { data: chatMemory } = await supabase
        .from("chat_memory")
        .select("ai_paused, pause_reason, paused_at, current_agent_id, custom_templates(name)")
        .eq("lead_id", lead.id)
        .limit(1)
        .single();

      if (chatMemory?.ai_paused && chatMemory?.paused_at) {
        const reasonMap: Record<string, string> = {
          'manual_takeover': 'Atendente assumiu a conversa',
          'human_requested': 'Cliente solicitou atendente humano',
          'error': 'Pausa por erro no processamento',
        };
        events.push({
          id: 'ai-paused',
          type: 'agent_transfer',
          title: 'IA pausada',
          description: reasonMap[chatMemory.pause_reason || ''] || chatMemory.pause_reason || 'Transferência para atendente',
          date: chatMemory.paused_at,
          icon: 'ArrowRightLeft',
          color: 'orange'
        });
      }

      // Add lead creation event
      if (lead.created_at) {
        events.push({
          id: 'lead-created',
          type: 'lead_created',
          title: 'Primeiro contato',
          description: 'Lead criado',
          date: lead.created_at,
          icon: 'UserPlus',
          color: 'gray'
        });
      }

      // Add notes from metadata
      const notesData = (lead.metadata?.notes || []) as { content: string; date: string }[];
      notesData.forEach((note, index) => {
        events.push({
          id: `note-${index}`,
          type: 'note_added',
          title: 'Anotação',
          description: note.content,
          date: note.date,
          icon: 'MessageSquare',
          color: 'purple'
        });
      });

      // 1. Status changes from metadata.status_history
      const statusHistory = (lead.metadata?.status_history || []) as { from: string; to: string; date: string }[];
      const statusLabels: Record<string, string> = {
        new: 'Novo', contacted: 'Contatado', qualified: 'Qualificado',
        proposal: 'Proposta', negotiation: 'Negociação', won: 'Ganho', lost: 'Perdido'
      };
      statusHistory.forEach((change, index) => {
        events.push({
          id: `status-change-${index}`,
          type: 'status_changed',
          title: 'Status alterado',
          description: `${statusLabels[change.from] || change.from} → ${statusLabels[change.to] || change.to}`,
          date: change.date,
          icon: 'ShieldAlert',
          color: change.to === 'lost' ? 'red' : change.to === 'won' ? 'green' : 'blue'
        });
      });

      // 5. Score milestones from metadata.score_history
      const scoreHistory = (lead.metadata?.score_history || []) as { score: number; date: string }[];
      const milestones = [25, 50, 75, 100];
      const passedMilestones = new Set<number>();
      scoreHistory.forEach((entry) => {
        milestones.forEach(milestone => {
          if (entry.score >= milestone && !passedMilestones.has(milestone)) {
            passedMilestones.add(milestone);
            events.push({
              id: `score-milestone-${milestone}`,
              type: 'score_milestone',
              title: `Score atingiu ${milestone}%`,
              description: `Engajamento em alta — score passou de ${milestone}%`,
              date: entry.date,
              icon: 'TrendingUp',
              color: milestone >= 75 ? 'green' : milestone >= 50 ? 'blue' : 'yellow'
            });
          }
        });
      });

      // 9. Name identified
      const nameHistory = lead.metadata?.name_identified_at as string | undefined;
      if (nameHistory && lead.name) {
        events.push({
          id: 'name-identified',
          type: 'name_identified',
          title: 'Nome identificado',
          description: `Contato identificado como "${lead.name}"`,
          date: nameHistory,
          icon: 'UserCheck',
          color: 'teal'
        });
      }

      // 10. Email captured  
      const emailCapturedAt = lead.metadata?.email_captured_at as string | undefined;
      if (emailCapturedAt && lead.email) {
        events.push({
          id: 'email-captured',
          type: 'email_captured',
          title: 'Email capturado',
          description: lead.email,
          date: emailCapturedAt,
          icon: 'AtSign',
          color: 'indigo'
        });
      }

      // Sort by date descending
      return events.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
    enabled: !!lead?.id,
  });

  // Fetch notes from messages table (new system)
  const { data: messageNotes = [] } = useQuery({
    queryKey: ["lead-message-notes", lead?.id],
    queryFn: async () => {
      if (!lead?.id) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, created_at, metadata")
        .eq("lead_id", lead.id)
        .eq("message_type", "note")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!lead?.id,
  });

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Selecione uma conversa para ver os detalhes
      </div>
    );
  }

  const displayName = lead.name || "Sem nome";
  const metadata = lead.metadata || {};
  const origin = metadata.origin || metadata.source || null;
  // Merge notes from metadata (old) and messages table (new)
  const metadataNotes = (metadata.notes || []).map((n: any) => ({ content: n.content, date: n.date, source: 'metadata' as const }));
  const messagesNotes = messageNotes.map((n: any) => ({ content: n.content, date: n.created_at, source: 'messages' as const, messageId: n.id, attachment: n.metadata?.attachment }));
  const notes = [...metadataNotes, ...messagesNotes].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Generate avatar color from name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-rose-500', 'bg-pink-500', 'bg-fuchsia-500', 'bg-purple-500',
      'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-sky-500',
      'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500', 'bg-green-500',
      'bg-lime-500', 'bg-yellow-500', 'bg-amber-500', 'bg-orange-500'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case 'qualified':
        return { label: 'Qualificado', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' };
      case 'converted':
        return { label: 'Convertido', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' };
      case 'contacted':
        return { label: 'Contatado', className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' };
      case 'lost':
        return { label: 'Perdido', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' };
      case 'new':
      default:
        return { label: 'Novo', className: 'bg-muted text-muted-foreground border-border' };
    }
  };

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
      yellow: 'bg-yellow-500 text-yellow-50',
      green: 'bg-green-500 text-green-50',
      red: 'bg-red-500 text-red-50',
      blue: 'bg-blue-500 text-blue-50',
      orange: 'bg-orange-500 text-orange-50',
      purple: 'bg-purple-500 text-purple-50',
      gray: 'bg-gray-500 text-gray-50',
      cyan: 'bg-cyan-500 text-cyan-50',
      teal: 'bg-teal-500 text-teal-50',
      indigo: 'bg-indigo-500 text-indigo-50',
    };
    return colors[color] || colors.gray;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const statusConfig = getStatusConfig(lead.status);
  const leadPhoto = (lead as any).avatar_url || metadata?.photo;

  return (
    <div className="flex flex-col h-full bg-card/40 backdrop-blur-xl border-l border-white/5 relative overflow-hidden">
      {/* Header with close button */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between chat-header-bg backdrop-blur-md relative z-10">
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 bg-primary rounded-full" />
          <span className="font-semibold text-sm tracking-tight text-foreground/90">Detalhes do Contato</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Avatar and Name Section */}
          <div
            className="flex flex-col items-center text-center space-y-4 cursor-pointer group relative pt-4"
            onClick={() => navigate(`/leads/${lead.id}`)}
          >
            {/* Interactive avatar wrapper */}
            <div className="relative">
              <Avatar className="h-24 w-24 ring-2 ring-white/10 group-hover:ring-primary/50 group-hover:scale-105 transition-all duration-300 shadow-xl relative z-10">
                {leadPhoto ? (
                  <AvatarImage src={leadPhoto} alt={displayName} className="object-cover" />
                ) : null}
                <AvatarFallback className={`${getAvatarColor(displayName)} text-white text-2xl font-bold`}>
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors tracking-tight">{displayName}</h3>
              {lead.score !== null && lead.score !== undefined && (
                <div className="inline-flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                  <span className="text-xs font-medium text-muted-foreground">Score</span>
                  <span className="text-xs font-bold text-emerald-400">{lead.score}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex justify-center gap-2">
            {lead.email && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                onClick={() => window.open(`mailto:${lead.email}`, '_self')}
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
            )}
          </div>

          <Separator className="bg-white/5" />

          {/* Contact Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
                Sobre
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">
                  {lead.phone.replace(/^55/, "+55 ")}
                </span>
              </div>

              {lead.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}

              {origin && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{origin}</span>
                </div>
              )}

              {lead.created_at && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    Desde {format(new Date(lead.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-white/5" />

          {/* Tags Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
                  Tags & Status
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all rounded-md"
                onClick={() => setShowAddTagDialog(true)}
              >
                <Plus className="h-3 w-3" />
                Add Tag
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={statusConfig.className}>
                {statusConfig.label}
              </Badge>

              {leadTags?.map((tag: any) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="text-xs border"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    borderColor: `${tag.color}50`
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>

          <Separator className="bg-white/5" />

          {/* Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
                  Anotações
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all rounded-md"
                onClick={() => setShowAddNoteDialog(true)}
              >
                <Plus className="h-3 w-3" />
                Novo
              </Button>
            </div>

            <div className="space-y-3">
              {notes.length > 0 ? (
                notes.map((note: any, index: number) => (
                  <ContextMenu key={`note-${index}`}>
                    <ContextMenuTrigger asChild>
                      <div className="bg-white/5 border border-white/5 hover:border-white/10 transition-colors rounded-xl p-3.5 text-sm group/note relative overflow-hidden cursor-default">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/30 group-hover/note:bg-primary transition-colors" />
                        {note.content && <p className="whitespace-pre-wrap break-words text-foreground/90 pl-1">{note.content}</p>}
                        {note.attachment && (
                          <a href={note.attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-1.5 pl-1 text-xs text-primary hover:underline">
                            📎 {note.attachment.name}
                          </a>
                        )}
                        <span className="text-[10px] font-medium text-muted-foreground mt-2 block pl-1">
                          {format(new Date(note.date), "dd/MM/yyyy • HH:mm")}
                        </span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                        onClick={async () => {
                          try {
                            if (note.source === 'messages' && note.messageId) {
                              const { error } = await supabase
                                .from("messages")
                                .delete()
                                .eq("id", note.messageId);
                              if (error) throw error;
                              queryClient.invalidateQueries({ queryKey: ["lead-message-notes", lead?.id] });
                            } else {
                              // Remove from metadata
                              const currentNotes = (metadata.notes || []) as any[];
                              const updatedNotes = currentNotes.filter((_: any, i: number) => {
                                return !(_.content === note.content && _.date === note.date);
                              });
                              const { error } = await supabase
                                .from("leads")
                                .update({ metadata: { ...metadata, notes: updatedNotes } as any })
                                .eq("id", lead.id);
                              if (error) throw error;
                              onLeadUpdated?.();
                            }
                            queryClient.invalidateQueries({ queryKey: ["lead-timeline", lead?.id] });
                            toast.success("Anotação excluída!");
                          } catch (err: any) {
                            toast.error("Erro ao excluir: " + err.message);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir anotação
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-3 text-center text-muted-foreground">
                  <MessageSquare className="h-5 w-5 mb-1.5 opacity-50" />
                  <p className="text-xs">Nenhuma anotação ainda</p>
                  <p className="text-[10px]">Clique em "Novo" para adicionar</p>
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-white/5" />

          {/* Timeline Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
                Histórico
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            {timelineEvents.length > 0 ? (
              <div className="relative pl-2">
                {/* Vertical line with subtle gradient */}
                <div className="absolute left-[19px] top-6 bottom-4 w-px bg-gradient-to-b from-border via-border to-transparent" />

                <div className="space-y-5">
                  {timelineEvents.slice(0, 20).map((event) => (
                    <div key={event.id} className="relative flex gap-4 group/timeline">
                      {/* Icon circle */}
                      <div className={cn(
                        "relative z-10 h-7 w-7 rounded-full flex items-center justify-center shrink-0 border border-background shadow-sm transition-transform group-hover/timeline:scale-110",
                        getTimelineColor(event.color)
                      )}>
                        {getTimelineIcon(event.icon)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-0.5">
                          <span className="text-sm font-medium text-foreground">{event.title}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(event.date), "dd MMM, HH:mm", { locale: ptBR })}
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
                <p className="text-xs">Orçamentos e agendamentos aparecerão aqui</p>
              </div>
            )}
          </div>

          {/* Instance info */}
          {instancePhone && (
            <>
              <Separator className="bg-white/5" />
              <div className="space-y-3 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
                    Conectado via
                  </span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 text-sm text-foreground/80">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium tracking-tight">{instancePhone.replace(/^55/, "+55 ")}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Tag Dialog */}
      {workspaceId && (
        <AddTagDialog
          open={showAddTagDialog}
          onOpenChange={setShowAddTagDialog}
          leadId={lead.id}
          workspaceId={workspaceId}
          onTagsUpdated={() => refetchTags()}
        />
      )}

      {/* Note Dialog */}
      <AddNoteDialog
        open={showAddNoteDialog}
        onOpenChange={setShowAddNoteDialog}
        leadId={lead.id}
        onNoteAdded={() => onLeadUpdated?.()}
      />
    </div>
  );
});
