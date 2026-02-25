import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Download, X, MessageCircle, RefreshCw, XCircle } from "lucide-react";
import { useTerminology } from "@/hooks/useTerminology";
import { downloadICS } from "@/lib/ics-utils";
import { toast } from "sonner";

interface AppointmentMetadata {
  cancelled_by?: string;
  cancelled_at?: string;
  cancellation_message?: string;
  reschedule_requested_by?: string;
  reschedule_requested_at?: string;
  reschedule_message?: string;
  rescheduled_from_whatsapp?: boolean;
  rescheduled_at?: string;
  extraction_confidence?: string;
  original_message?: string;
  has_conflicts?: boolean;
}

interface AppointmentCardProps {
  appointment: {
    id: string;
    title: string;
    description?: string | null;
    start_time: string;
    end_time: string;
    status: string | null;
    source?: string | null;
    metadata?: AppointmentMetadata | null;
    leads?: {
      name: string | null;
      phone: string;
    } | null;
  };
  onCancel?: (id: string) => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Agendado", className: "bg-blue-500" },
  confirmed: { label: "Confirmado", className: "bg-green-500" },
  completed: { label: "Concluído", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", className: "bg-destructive" },
  rescheduled: { label: "Reagendado", className: "bg-yellow-500" },
};

export const AppointmentCard = ({
  appointment,
  onCancel,
}: AppointmentCardProps) => {
  const { terminology } = useTerminology();
  const status = statusConfig[appointment.status || "scheduled"] || statusConfig.scheduled;
  
  // Check if action was from WhatsApp
  const isFromWhatsApp = appointment.source === 'ai';
  const wasCancelledByWhatsApp = appointment.metadata?.cancelled_by === 'customer_whatsapp';
  const wasRescheduledByWhatsApp = appointment.metadata?.rescheduled_from_whatsapp || 
                                    appointment.metadata?.reschedule_requested_by === 'customer_whatsapp';

  const handleExportICS = () => {
    downloadICS([appointment], `agendamento-${appointment.id.slice(0, 8)}`);
    toast.success("Arquivo .ics baixado!");
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              {new Date(appointment.start_time).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" - "}
              {new Date(appointment.end_time).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <Badge className={status.className}>{status.label}</Badge>
            
            {/* WhatsApp origin indicator */}
            {isFromWhatsApp && (
              <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                <MessageCircle className="h-3 w-3 mr-1" />
                WhatsApp
              </Badge>
            )}
          </div>

          <h4 className="font-semibold truncate">{appointment.title}</h4>

          {appointment.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{appointment.description}</p>
          )}

          {appointment.leads && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {terminology.singular}: {appointment.leads.name || appointment.leads.phone}
              </span>
            </div>
          )}
          
          {/* WhatsApp cancellation indicator */}
          {wasCancelledByWhatsApp && (
            <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-medium text-red-600 dark:text-red-400">Cancelado pelo cliente via WhatsApp</span>
                {appointment.metadata?.cancellation_message && (
                  <p className="text-red-500/80 dark:text-red-400/80 mt-0.5 italic line-clamp-2">
                    "{appointment.metadata.cancellation_message}"
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* WhatsApp reschedule indicator */}
          {wasRescheduledByWhatsApp && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
              <RefreshCw className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-medium text-amber-600 dark:text-amber-400">Reagendado pelo cliente via WhatsApp</span>
                {appointment.metadata?.reschedule_message && (
                  <p className="text-amber-500/80 dark:text-amber-400/80 mt-0.5 italic line-clamp-2">
                    "{appointment.metadata.reschedule_message}"
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExportICS}
            title="Exportar para calendário (.ics)"
          >
            <Download className="h-4 w-4" />
          </Button>

          {onCancel && appointment.status !== "cancelled" && appointment.status !== "completed" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCancel(appointment.id)}
              className="text-destructive hover:text-destructive"
              title="Cancelar agendamento"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
