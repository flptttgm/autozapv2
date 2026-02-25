import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, XCircle, RefreshCw, CheckCheck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

export interface MobileAppointmentData {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  status: string | null;
  leads?: {
    name: string | null;
    phone: string;
  } | null;
}

interface MobileAppointmentCardProps {
  appointment: MobileAppointmentData;
  onClick?: (appointment: MobileAppointmentData) => void;
  index?: number;
}

interface StatusConfig {
  gradient: string;
  bgLight: string;
  textColor: string;
  borderColor: string;
  icon: LucideIcon;
  label: string;
}

const statusColors: Record<string, StatusConfig> = {
  pending_owner: {
    gradient: "bg-gradient-to-r from-orange-500 to-orange-600",
    bgLight: "bg-orange-50 dark:bg-orange-950/30",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-200 dark:border-orange-800",
    icon: Clock,
    label: "Aguardando Aprovação",
  },
  pending_lead: {
    gradient: "bg-gradient-to-r from-purple-500 to-purple-600",
    bgLight: "bg-purple-50 dark:bg-purple-950/30",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-800",
    icon: Clock,
    label: "Aguardando Cliente",
  },
  scheduled: {
    gradient: "bg-gradient-to-r from-sky-500 to-sky-600",
    bgLight: "bg-sky-50 dark:bg-sky-950/30",
    textColor: "text-sky-600 dark:text-sky-400",
    borderColor: "border-sky-200 dark:border-sky-800",
    icon: Clock,
    label: "Agendado",
  },
  confirmed: {
    gradient: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
    label: "Confirmado",
  },
  completed: {
    gradient: "bg-gradient-to-r from-slate-400 to-slate-500",
    bgLight: "bg-slate-50 dark:bg-slate-900/30",
    textColor: "text-slate-600 dark:text-slate-400",
    borderColor: "border-slate-200 dark:border-slate-700",
    icon: CheckCheck,
    label: "Concluído",
  },
  cancelled: {
    gradient: "bg-gradient-to-r from-rose-500 to-rose-600",
    bgLight: "bg-rose-50 dark:bg-rose-950/30",
    textColor: "text-rose-600 dark:text-rose-400",
    borderColor: "border-rose-200 dark:border-rose-800",
    icon: XCircle,
    label: "Cancelado",
  },
  rescheduled: {
    gradient: "bg-gradient-to-r from-amber-500 to-amber-600",
    bgLight: "bg-amber-50 dark:bg-amber-950/30",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-200 dark:border-amber-800",
    icon: RefreshCw,
    label: "Reagendado",
  },
  rejected: {
    gradient: "bg-gradient-to-r from-rose-400 to-rose-500",
    bgLight: "bg-rose-50 dark:bg-rose-950/30",
    textColor: "text-rose-600 dark:text-rose-400",
    borderColor: "border-rose-200 dark:border-rose-800",
    icon: XCircle,
    label: "Recusado",
  },
};

export const MobileAppointmentCard = ({
  appointment,
  onClick,
  index = 0,
}: MobileAppointmentCardProps) => {
  const config = statusColors[appointment.status || "scheduled"] || statusColors.scheduled;
  const startTime = format(new Date(appointment.start_time), "HH:mm");
  const endTime = format(new Date(appointment.end_time), "HH:mm");
  const contactName = appointment.leads?.name || appointment.leads?.phone;
  const StatusIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      onClick={() => onClick?.(appointment as any)}
      className={cn(
        "relative rounded-xl border cursor-pointer transition-all duration-200",
        "hover:shadow-md active:scale-[0.98]",
        config.bgLight,
        config.borderColor
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Barra colorida de status */}
        <div className={cn("w-1 self-stretch rounded-full min-h-[60px]", config.gradient)} />

        <div className="flex-1 min-w-0">
          {/* Horário */}
          <div className={cn("flex items-center gap-2 text-sm mb-1.5", config.textColor)}>
            <Clock className="h-4 w-4" />
            <span className="font-semibold">{startTime} - {endTime}</span>
          </div>

          {/* Título */}
          <h4 className="font-semibold text-base text-foreground mb-1 line-clamp-2">
            {appointment.title}
          </h4>

          {/* Descrição (se houver) */}
          {appointment.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-1.5">
              {appointment.description}
            </p>
          )}

          {/* Contato */}
          {contactName && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span className="truncate">{contactName}</span>
            </div>
          )}
        </div>

        {/* Badge de status */}
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 text-xs font-medium gap-1",
            config.gradient,
            "text-white border-0"
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </Badge>
      </div>
    </motion.div>
  );
};
