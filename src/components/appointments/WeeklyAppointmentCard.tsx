import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { X, Download, Clock, CheckCircle2, XCircle, RefreshCw, CheckCheck, User, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadICS } from "@/lib/ics-utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

export interface AppointmentMetadata {
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

export interface AppointmentData {
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
}

interface WeeklyAppointmentCardProps {
  appointment: AppointmentData;
  onCancel?: (id: string) => void;
  onClick?: (appointment: AppointmentData) => void;
  compact?: boolean;
  index?: number; // For staggered animation
}

interface StatusConfig {
  gradient: string;
  shadow: string;
  hoverShadow: string;
  textColor: string;
  icon: LucideIcon;
  label: string;
}

const statusColors: Record<string, StatusConfig> = {
  pending_owner: {
    gradient: "bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700",
    shadow: "shadow-lg shadow-orange-500/20",
    hoverShadow: "hover:shadow-xl hover:shadow-orange-500/35",
    textColor: "text-white",
    icon: Clock,
    label: "Aguardando Aprovação",
  },
  pending_lead: {
    gradient: "bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700",
    shadow: "shadow-lg shadow-purple-500/20",
    hoverShadow: "hover:shadow-xl hover:shadow-purple-500/35",
    textColor: "text-white",
    icon: Clock,
    label: "Aguardando Cliente",
  },
  scheduled: {
    gradient: "bg-gradient-to-br from-sky-500 to-sky-600 dark:from-sky-600 dark:to-sky-700",
    shadow: "shadow-lg shadow-sky-500/20",
    hoverShadow: "hover:shadow-xl hover:shadow-sky-500/35",
    textColor: "text-white",
    icon: Clock,
    label: "Agendado",
  },
  confirmed: {
    gradient: "bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700",
    shadow: "shadow-lg shadow-emerald-500/20",
    hoverShadow: "hover:shadow-xl hover:shadow-emerald-500/35",
    textColor: "text-white",
    icon: CheckCircle2,
    label: "Confirmado",
  },
  completed: {
    gradient: "bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600",
    shadow: "shadow-lg shadow-slate-400/20",
    hoverShadow: "hover:shadow-xl hover:shadow-slate-400/30",
    textColor: "text-white",
    icon: CheckCheck,
    label: "Concluído",
  },
  cancelled: {
    gradient: "bg-gradient-to-br from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-700",
    shadow: "shadow-lg shadow-rose-500/20",
    hoverShadow: "hover:shadow-xl hover:shadow-rose-500/35",
    textColor: "text-white",
    icon: XCircle,
    label: "Cancelado",
  },
  rescheduled: {
    gradient: "bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700",
    shadow: "shadow-lg shadow-amber-500/20",
    hoverShadow: "hover:shadow-xl hover:shadow-amber-500/35",
    textColor: "text-white",
    icon: RefreshCw,
    label: "Reagendado",
  },
  rejected: {
    gradient: "bg-gradient-to-br from-rose-400 to-rose-500 dark:from-rose-500 dark:to-rose-600",
    shadow: "shadow-lg shadow-rose-400/20",
    hoverShadow: "hover:shadow-xl hover:shadow-rose-400/35",
    textColor: "text-white",
    icon: XCircle,
    label: "Recusado",
  },
};

export const WeeklyAppointmentCard = ({
  appointment,
  onCancel,
  onClick,
  compact = false,
  index = 0,
}: WeeklyAppointmentCardProps) => {
  const config = statusColors[appointment.status || "scheduled"] || statusColors.scheduled;
  const startTime = format(new Date(appointment.start_time), "HH:mm");
  const endTime = format(new Date(appointment.end_time), "HH:mm");
  const contactName = appointment.leads?.name || appointment.leads?.phone;
  const StatusIcon = config.icon;

  const isFromWhatsApp = appointment.source === 'ai';
  const wasCancelledByWhatsApp = appointment.metadata?.cancelled_by === 'customer_whatsapp';
  const wasRescheduledByWhatsApp = appointment.metadata?.rescheduled_from_whatsapp || 
                                    appointment.metadata?.reschedule_requested_by === 'customer_whatsapp';

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadICS([appointment], `agendamento-${appointment.id.slice(0, 8)}`);
    toast.success("Arquivo .ics baixado!");
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancel?.(appointment.id);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.3,
            delay: index * 0.05,
            ease: [0.4, 0, 0.2, 1],
          }}
          onClick={() => onClick?.(appointment)}
          className={cn(
            "group relative rounded-xl cursor-pointer transition-all duration-200 h-full overflow-hidden",
            "hover:scale-[1.02] hover:z-20",
            config.gradient,
            config.shadow,
            config.hoverShadow,
            compact ? "p-1.5" : "p-2.5"
          )}
        >
          {/* Time Row with Status Icon */}
          <div className={cn(
            "flex items-center gap-1 font-medium",
            config.textColor,
            compact ? "text-[10px]" : "text-xs"
          )}>
            <Clock className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "opacity-80")} />
            <span className="opacity-90">{startTime}</span>
            {!compact && (
              <>
                <span className="opacity-60">-</span>
                <span className="opacity-90">{endTime}</span>
              </>
            )}
          </div>

          {/* Title */}
          <div className={cn(
            "font-semibold line-clamp-2 leading-tight mt-1",
            config.textColor,
            compact ? "text-xs" : "text-sm"
          )}>
            {appointment.title}
          </div>

          {/* Contact with icon - only show if not compact */}
          {contactName && !compact && (
            <div className={cn(
              "flex items-center gap-1 mt-1.5 text-[11px] opacity-80",
              config.textColor
            )}>
              <User className="h-3 w-3" />
              <span className="truncate">{contactName}</span>
            </div>
          )}

          {/* Status Badge + WhatsApp indicator - bottom right corner */}
          {!compact && (
            <div className={cn(
              "absolute bottom-1.5 right-1.5 flex items-center gap-1 text-[9px] font-medium opacity-80",
              config.textColor
            )}>
              {isFromWhatsApp && (
                <MessageCircle className="h-2.5 w-2.5" />
              )}
              <StatusIcon className="h-2.5 w-2.5" />
            </div>
          )}
          {/* Subtle shine effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </motion.div>
      </TooltipTrigger>
      <TooltipContent 
        side="right" 
        sideOffset={12}
        className={cn(
          "max-w-xs p-4 z-[100] shadow-2xl border-l-4",
          appointment.status === "scheduled" && "border-l-sky-500",
          appointment.status === "confirmed" && "border-l-emerald-500",
          appointment.status === "completed" && "border-l-slate-400",
          appointment.status === "cancelled" && "border-l-rose-500",
          appointment.status === "rescheduled" && "border-l-amber-500",
          !appointment.status && "border-l-sky-500"
        )}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusIcon className={cn(
              "h-4 w-4",
              appointment.status === "scheduled" && "text-sky-500",
              appointment.status === "confirmed" && "text-emerald-500",
              appointment.status === "completed" && "text-slate-400",
              appointment.status === "cancelled" && "text-rose-500",
              appointment.status === "rescheduled" && "text-amber-500",
              !appointment.status && "text-sky-500"
            )} />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {config.label}
            </span>
            {isFromWhatsApp && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </span>
            )}
          </div>
          <p className="font-semibold text-base">{appointment.title}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
            <Clock className="h-4 w-4" />
            <span className="font-medium">{startTime} - {endTime}</span>
          </div>
          
          {/* WhatsApp cancellation info */}
          {wasCancelledByWhatsApp && (
            <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                <XCircle className="h-3 w-3" />
                Cancelado pelo cliente via WhatsApp
              </div>
              {appointment.metadata?.cancellation_message && (
                <p className="text-xs text-red-500/80 dark:text-red-400/80 italic mt-1 line-clamp-2">
                  "{appointment.metadata.cancellation_message}"
                </p>
              )}
            </div>
          )}
          
          {/* WhatsApp reschedule info */}
          {wasRescheduledByWhatsApp && (
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <RefreshCw className="h-3 w-3" />
                Reagendado pelo cliente via WhatsApp
              </div>
              {appointment.metadata?.reschedule_message && (
                <p className="text-xs text-amber-500/80 dark:text-amber-400/80 italic mt-1 line-clamp-2">
                  "{appointment.metadata.reschedule_message}"
                </p>
              )}
            </div>
          )}
          
          {appointment.description && (
            <p className="text-sm text-muted-foreground border-t border-border pt-3">{appointment.description}</p>
          )}
          {contactName && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-2 py-1.5">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{contactName}</span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
