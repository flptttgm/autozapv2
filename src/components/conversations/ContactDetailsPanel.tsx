import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Receipt,
  CircleDollarSign,
  UserPlus,
  Clock
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
  color: 'yellow' | 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'gray';
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

  // Fetch timeline events (quotes, appointments, invoices)
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

      // Fetch appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, title, status, start_time, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      appointments?.forEach(apt => {
        events.push({
          id: `apt-${apt.id}`,
          type: apt.status === 'completed' ? 'appointment_completed' : 'appointment_created',
          title: apt.status === 'completed' ? 'Agendamento concluído' : 'Agendamento marcado',
          description: apt.title,
          date: apt.created_at,
          icon: apt.status === 'completed' ? 'CalendarCheck' : 'Calendar',
          color: apt.status === 'completed' ? 'green' : 'blue'
        });
      });

      // Fetch invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, amount, status, sent_at, paid_at, created_at")
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
      });

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

      // Sort by date descending
      return events.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
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
  const notes = metadata.notes || [];

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
      Receipt: <Receipt className="h-3.5 w-3.5" />,
      CircleDollarSign: <CircleDollarSign className="h-3.5 w-3.5" />,
      UserPlus: <UserPlus className="h-3.5 w-3.5" />,
      MessageSquare: <MessageSquare className="h-3.5 w-3.5" />,
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
    <div className="flex flex-col h-full bg-card">
      {/* Header with close button */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <span className="font-semibold text-sm">Detalhes do Contato</span>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Avatar and Name Section */}
          <div
            className="flex flex-col items-center text-center space-y-3 cursor-pointer group"
            onClick={() => navigate(`/leads/${lead.id}`)}
          >
            <Avatar className="h-20 w-20 ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
              {leadPhoto ? (
                <AvatarImage src={leadPhoto} alt={displayName} />
              ) : null}
              <AvatarFallback className={`${getAvatarColor(displayName)} text-white text-xl font-semibold`}>
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{displayName}</h3>
              {lead.score !== null && lead.score !== undefined && (
                <p className="text-sm text-muted-foreground">
                  Score: {lead.score}%
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex justify-center gap-2">
            {lead.email && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(`mailto:${lead.email}`, '_self')}
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
            )}
          </div>

          <Separator />

          {/* Contact Details Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Detalhes do Contato
            </h4>

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

          <Separator />

          {/* Tags Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tags
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
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

          <Separator />

          {/* Notes Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Anotações
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowAddNoteDialog(true)}
              >
                <Plus className="h-3 w-3" />
                Novo
              </Button>
            </div>

            <div className="space-y-2">
              {notes.length > 0 ? (
                [...notes].reverse().map((note: { content: string; date: string }, index: number) => (
                  <div key={index} className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="whitespace-pre-wrap break-words">{note.content}</p>
                    <span className="text-xs text-muted-foreground mt-1 block">
                      {format(new Date(note.date), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma anotação ainda</p>
                  <p className="text-xs">Clique em "Novo" para adicionar</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Timeline Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Timeline
            </h4>

            {timelineEvents.length > 0 ? (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

                <div className="space-y-4">
                  {timelineEvents.slice(0, 10).map((event) => (
                    <div key={event.id} className="relative flex gap-3">
                      {/* Icon circle */}
                      <div className={`relative z-10 h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${getTimelineColor(event.color)}`}>
                        {getTimelineIcon(event.icon)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{event.title}</span>
                          {event.value && (
                            <span className="text-xs font-medium text-emerald-500">
                              {formatCurrency(event.value)}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {event.description}
                          </p>
                        )}
                        <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                          {format(new Date(event.date), "dd MMM, HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {timelineEvents.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    +{timelineEvents.length - 10} eventos anteriores
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
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Conexão
                </h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{instancePhone.replace(/^55/, "+55 ")}</span>
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
        currentMetadata={metadata}
        onNoteAdded={() => onLeadUpdated?.()}
      />
    </div>
  );
});
