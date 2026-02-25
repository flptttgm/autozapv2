import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentData } from "./WeeklyAppointmentCard";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

interface Appointment {
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

interface MonthlyViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  onSelectDate: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  onCancelAppointment?: (id: string) => void;
  onAppointmentClick?: (appointment: AppointmentData) => void;
}

const statusDotColors: Record<string, string> = {
  pending_owner: "bg-orange-500",
  pending_lead: "bg-purple-500",
  scheduled: "bg-sky-500",
  confirmed: "bg-emerald-500",
  completed: "bg-slate-400",
  cancelled: "bg-rose-500",
  rescheduled: "bg-amber-500",
  rejected: "bg-rose-400",
};

export const MonthlyView = ({
  selectedDate,
  appointments,
  onSelectDate,
  onMonthChange,
  onCancelAppointment,
  onAppointmentClick,
}: MonthlyViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const isMobile = useIsMobile();
  const maxVisibleAppointments = isMobile ? 1 : 3;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Generate all days for the calendar grid
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  // Group appointments by date
  const appointmentsByDate: Record<string, Appointment[]> = {};
  appointments.forEach((apt) => {
    const dateKey = format(new Date(apt.start_time), "yyyy-MM-dd");
    if (!appointmentsByDate[dateKey]) {
      appointmentsByDate[dateKey] = [];
    }
    appointmentsByDate[dateKey].push(apt);
  });

  // Sort appointments by time within each day
  Object.keys(appointmentsByDate).forEach((dateKey) => {
    appointmentsByDate[dateKey].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  });

  const prevMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const nextMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onSelectDate(today);
    onMonthChange?.(today);
  };

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 sm:p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} className="ml-1 sm:ml-2 text-xs sm:text-sm">
            Hoje
          </Button>
        </div>
        <h2 className="text-base sm:text-lg font-semibold capitalize order-first sm:order-none">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="hidden sm:block w-24" /> {/* Spacer for centering - desktop only */}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/20">
        {weekDays.map((dayName) => (
          <div
            key={dayName}
            className="p-1 sm:p-2 text-center text-[10px] sm:text-xs font-medium text-muted-foreground"
          >
            <span className="hidden sm:inline">{dayName}</span>
            <span className="sm:hidden">{dayName.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-auto">
        <AnimatePresence mode="wait">
          {days.map((dayDate, idx) => {
            const dateKey = format(dayDate, "yyyy-MM-dd");
            const dayAppointments = appointmentsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(dayDate, currentMonth);
            const isSelected = isSameDay(dayDate, selectedDate);
            const isTodayDate = isToday(dayDate);

            return (
              <motion.div
                key={`${currentMonth.getMonth()}-${idx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: idx * 0.008 }}
                onClick={() => onSelectDate(dayDate)}
                className={cn(
                  "border-r border-b border-border p-1 cursor-pointer transition-colors min-h-[60px] sm:min-h-[80px] md:min-h-[100px]",
                  "hover:bg-muted/50 overflow-hidden",
                  !isCurrentMonth && "bg-muted/20",
                  isSelected && "bg-primary/5 ring-2 ring-primary ring-inset",
                  isTodayDate && !isSelected && "bg-primary/10"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-medium w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full",
                      !isCurrentMonth && "text-muted-foreground/50",
                      isTodayDate && "bg-primary text-primary-foreground",
                      isSelected && !isTodayDate && "font-bold text-primary"
                    )}
                  >
                    {format(dayDate, "d")}
                  </span>
                  {dayAppointments.length > maxVisibleAppointments && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          "text-[9px] sm:text-[10px] text-muted-foreground bg-muted px-1 sm:px-1.5 py-0.5 rounded-full cursor-help",
                          !isCurrentMonth && "opacity-30"
                        )}>
                          +{dayAppointments.length - maxVisibleAppointments}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs p-2">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            Mais {dayAppointments.length - maxVisibleAppointments} agendamento{dayAppointments.length - maxVisibleAppointments > 1 ? 's' : ''}:
                          </p>
                          {dayAppointments.slice(maxVisibleAppointments).map((apt) => (
                            <div key={apt.id} className="flex items-center gap-1.5 text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{format(new Date(apt.start_time), "HH:mm")}</span>
                              <span className="truncate">{apt.title}</span>
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Appointments */}
                <div className="space-y-0.5 sm:space-y-1 overflow-hidden">
                  {dayAppointments.slice(0, maxVisibleAppointments).map((apt, aptIdx) => (
                    <AppointmentPill
                      key={apt.id}
                      appointment={apt}
                      onCancel={onCancelAppointment}
                      onClick={onAppointmentClick}
                      index={aptIdx}
                      isMuted={!isCurrentMonth}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Compact appointment pill for monthly view
const AppointmentPill = ({
  appointment,
  onCancel,
  onClick,
  index = 0,
  isMuted = false,
}: {
  appointment: Appointment;
  onCancel?: (id: string) => void;
  onClick?: (appointment: AppointmentData) => void;
  index?: number;
  isMuted?: boolean;
}) => {
  const startTime = format(new Date(appointment.start_time), "HH:mm");
  const endTime = format(new Date(appointment.end_time), "HH:mm");
  const contactName = appointment.leads?.name || appointment.leads?.phone;
  const status = appointment.status || "scheduled";

  const statusGradients: Record<string, string> = {
    pending_owner: "bg-gradient-to-r from-orange-500 to-orange-600",
    pending_lead: "bg-gradient-to-r from-purple-500 to-purple-600",
    scheduled: "bg-gradient-to-r from-sky-500 to-sky-600",
    confirmed: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    completed: "bg-gradient-to-r from-slate-400 to-slate-500",
    cancelled: "bg-gradient-to-r from-rose-500 to-rose-600",
    rescheduled: "bg-gradient-to-r from-amber-500 to-amber-600",
    rejected: "bg-gradient-to-r from-rose-400 to-rose-500",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: isMuted ? 0.5 : 1, x: 0 }}
          transition={{ duration: 0.2, delay: index * 0.05 }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(appointment);
          }}
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium text-white truncate cursor-pointer",
            "shadow-sm hover:shadow-md transition-shadow",
            statusGradients[status] || statusGradients.scheduled
          )}
        >
          <span className="opacity-80">{startTime}</span>
          <span className="mx-1">·</span>
          <span className="truncate">{appointment.title}</span>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs p-3">
        <div className="space-y-2">
          <p className="font-semibold">{appointment.title}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{startTime} - {endTime}</span>
          </div>
          {appointment.description && (
            <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
              {appointment.description}
            </p>
          )}
          {contactName && (
            <div className="flex items-center gap-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{contactName}</span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
