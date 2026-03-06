import { useEffect, useState, useMemo } from "react";
import {
  addDays,
  format,
  getDay,
  getHours,
  getMinutes,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { WeeklyAppointmentCard, AppointmentData } from "./WeeklyAppointmentCard";
import { MobileAppointmentCard } from "./MobileAppointmentCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAgendaConfig } from "@/components/settings/AgendaSettings";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

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

interface WeeklyViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  onSelectDate: (date: Date) => void;
  onCancelAppointment?: (id: string) => void;
  onAppointmentClick?: (appointment: AppointmentData) => void;
}

const SLOTS_PER_HOUR = 2;

export const WeeklyView = ({
  selectedDate,
  appointments,
  onSelectDate,
  onCancelAppointment,
  onAppointmentClick,
}: WeeklyViewProps) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const isMobile = useIsMobile();
  const { data: agendaConfig } = useAgendaConfig();

  const START_HOUR = agendaConfig?.start_hour ?? 7;
  const END_HOUR = agendaConfig?.end_hour ?? 21;
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR;

  const TIME_SLOTS = useMemo(() => Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const hour = START_HOUR + Math.floor(i / 2);
    const minutes = (i % 2) * 30;
    return { hour, minutes, label: `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}` };
  }), [START_HOUR, TOTAL_SLOTS]);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const allWeekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekDays = allWeekDays.filter((day) => {
    const dow = getDay(day); // 0=Sun, 6=Sat
    if (dow === 0 && !agendaConfig?.show_sunday) return false;
    if (dow === 6 && !agendaConfig?.show_saturday) return false;
    return true;
  });

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const getAppointmentsForDay = (day: Date) => {
    return appointments
      .filter((apt) => isSameDay(new Date(apt.start_time), day))
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
  };

  const getAppointmentPosition = (appointment: Appointment) => {
    const start = new Date(appointment.start_time);
    const end = new Date(appointment.end_time);

    const startHour = getHours(start) + getMinutes(start) / 60;
    const endHour = getHours(end) + getMinutes(end) / 60;

    // The time labels use items-end + translate-y-1/2, so "07:00" visually
    // sits at the bottom edge of slot 0. That means the visual "07:00" line
    // is 1 slot down from the physical top of the grid.
    // We add 1 slot offset so the appointment card aligns with the label.
    const startSlot = (startHour - START_HOUR) * SLOTS_PER_HOUR + 1;
    const durationSlots = (endHour - startHour) * SLOTS_PER_HOUR;

    const topPercent = (startSlot / TOTAL_SLOTS) * 100;
    const heightPercent = (durationSlots / TOTAL_SLOTS) * 100;

    // Minimum height = 1 slot (30 min visual)
    const minHeightPercent = (1 / TOTAL_SLOTS) * 100;

    return {
      top: `${Math.max(0, topPercent)}%`,
      height: `${Math.max(minHeightPercent, heightPercent)}%`,
    };
  };

  const getCurrentTimePositionPercent = () => {
    const hours = getHours(currentTime) + getMinutes(currentTime) / 60;
    if (hours < START_HOUR || hours >= END_HOUR) return null;
    // Same 1-slot offset as appointments to align with the time label grid
    const slot = (hours - START_HOUR) * SLOTS_PER_HOUR + 1;
    return (slot / TOTAL_SLOTS) * 100;
  };

  const currentTimePositionPercent = getCurrentTimePositionPercent();
  const isTodayInView = weekDays.some((day) => isToday(day));

  const goToPreviousDay = () => {
    onSelectDate(addDays(selectedDate, -1));
  };

  const goToNextDay = () => {
    onSelectDate(addDays(selectedDate, 1));
  };

  const dayAppointments = getAppointmentsForDay(selectedDate);

  // Mobile: Lista de agendamentos
  if (isMobile) {
    return (
      <div className="flex-1 overflow-hidden bg-card flex flex-col">
        {/* Header com navegação de dias */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goToPreviousDay}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="text-xs font-medium text-muted-foreground capitalize">
              {format(selectedDate, "EEEE", { locale: ptBR })}
            </div>
            <div className="text-base font-bold text-foreground">
              {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goToNextDay}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Lista de agendamentos */}
        <div className="flex-1 overflow-y-auto p-3">
          {dayAppointments.length > 0 ? (
            <div className="space-y-3">
              {dayAppointments.map((apt, index) => (
                <MobileAppointmentCard
                  key={apt.id}
                  appointment={apt}
                  onClick={onAppointmentClick as any}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-medium text-base">
                Nenhum agendamento
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: Grade semanal
  const numDays = weekDays.length;
  const gridStyle = { gridTemplateColumns: `60px repeat(${numDays}, 1fr)` };

  return (
    <div className="flex-1 overflow-hidden bg-card flex flex-col">
      <div
        className="flex-1 overflow-y-auto flex flex-col"
        style={{ scrollbarGutter: "stable" }}
      >
        {/* Desktop: Sticky Header com 7 dias */}
        <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
          <div className="grid" style={gridStyle}>
            <div className="border-b border-border/30" />
            {weekDays.map((day) => {
              const dayIsToday = isToday(day);
              const dayIsSelected = isSameDay(day, selectedDate);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    "flex flex-col items-center justify-center py-4 transition-all duration-300 border-b border-border/30 relative group",
                    dayIsSelected ? "bg-primary/[0.02]" : "hover:bg-muted/30"
                  )}
                >
                  {dayIsToday && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-b-md" />
                  )}
                  <span
                    className={cn(
                      "text-[10px] sm:text-[11px] uppercase tracking-widest font-semibold mb-1.5 transition-colors",
                      dayIsToday ? "text-primary" : "text-muted-foreground group-hover:text-foreground/80"
                    )}
                  >
                    {format(day, "EEE", { locale: ptBR })}
                  </span>
                  <span
                    className={cn(
                      "text-lg sm:text-xl font-medium w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition-all duration-300",
                      dayIsToday ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105" :
                        dayIsSelected ? "bg-foreground text-background scale-105" :
                          "text-foreground group-hover:bg-muted font-normal"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div
          className="grid relative flex-1 min-h-[450px]"
          style={gridStyle}
        >
          {/* Current Time Indicator */}
          {isTodayInView && currentTimePositionPercent !== null && (
            <div
              className="absolute left-[60px] right-0 z-30 pointer-events-none"
              style={{ top: `${currentTimePositionPercent}%` }}
            >
              <div className="relative flex items-center">
                <div className="absolute -left-[5px] flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-red-500/50 animate-ping opacity-75" />
                </div>
                <div className="flex-1 h-[2px] bg-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
              </div>
            </div>
          )}

          {/* Time Labels Column */}
          <div className="flex flex-col bg-card relative z-20 pb-1">
            {TIME_SLOTS.map((slot) => (
              <div
                key={slot.label}
                className="flex-1 min-h-0 relative flex items-end justify-end pr-3"
              >
                <span className={cn(
                  "font-medium leading-none translate-y-1/2 bg-card px-1",
                  slot.minutes === 0
                    ? "text-[11px] text-muted-foreground"
                    : "text-[10px] text-muted-foreground/30"
                )}>
                  {slot.label}
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDays.map((day, dayIndex) => {
            const dayAppts = getAppointmentsForDay(day);
            const dayIsSelected = isSameDay(day, selectedDate);
            const dayIsToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-l border-border/30 transition-colors duration-300 flex flex-col group/col",
                  dayIsSelected
                    ? "bg-primary/[0.03]"
                    : dayIsToday
                      ? "bg-primary/[0.015]"
                      : dayIndex % 2 === 1 && "bg-muted/80"
                )}
              >
                {/* Time Slot Lines */}
                {TIME_SLOTS.map((slot) => (
                  <div
                    key={slot.label}
                    className={cn(
                      "flex-1 min-h-0 border-b",
                      slot.minutes === 0 ? "border-border/40" : "border-border/20 border-dashed"
                    )}
                  />
                ))}

                {/* Appointments */}
                {dayAppts.map((apt, aptIndex) => (
                  <div
                    key={apt.id}
                    className="absolute left-1 right-1 z-10"
                    style={getAppointmentPosition(apt)}
                  >
                    <WeeklyAppointmentCard
                      appointment={apt}
                      onCancel={onCancelAppointment}
                      onClick={onAppointmentClick}
                      compact
                      index={aptIndex}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};