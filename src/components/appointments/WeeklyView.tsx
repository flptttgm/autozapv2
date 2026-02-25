import { useEffect, useState } from "react";
import {
  addDays,
  format,
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

const START_HOUR = 7;
const END_HOUR = 21;
const SLOT_HEIGHT_PX = 30;
const SLOTS_PER_HOUR = 2;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR;

const TIME_SLOTS = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
  const hour = START_HOUR + Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  return { hour, minutes, label: `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}` };
});

export const WeeklyView = ({
  selectedDate,
  appointments,
  onSelectDate,
  onCancelAppointment,
  onAppointmentClick,
}: WeeklyViewProps) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const isMobile = useIsMobile();

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

    const topPx = (startHour - START_HOUR) * SLOTS_PER_HOUR * SLOT_HEIGHT_PX;
    const heightPx = (endHour - startHour) * SLOTS_PER_HOUR * SLOT_HEIGHT_PX;

    return {
      top: `${Math.max(0, topPx)}px`,
      height: `${Math.max(30, heightPx)}px`,
    };
  };

  const getCurrentTimePositionPx = () => {
    const hours = getHours(currentTime) + getMinutes(currentTime) / 60;
    if (hours < START_HOUR || hours >= END_HOUR) return null;
    return (hours - START_HOUR) * SLOTS_PER_HOUR * SLOT_HEIGHT_PX;
  };

  const currentTimePositionPx = getCurrentTimePositionPx();
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
  const gridCols = "grid-cols-[60px_repeat(7,1fr)]";

  return (
    <div className="flex-1 overflow-hidden bg-card flex flex-col">
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        {/* Desktop: Sticky Header com 7 dias */}
        <div className="sticky top-0 z-40 bg-muted/30 backdrop-blur supports-[backdrop-filter]:bg-muted/20 border-b border-border">
          <div className={cn("grid", gridCols)}>
            <div className="border-r border-border" />
            {weekDays.map((day) => {
              const dayIsToday = isToday(day);
              const dayIsSelected = isSameDay(day, selectedDate);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    "flex flex-col items-center py-3 transition-all border-r border-border last:border-r-0",
                    "hover:bg-primary/5",
                    dayIsSelected && "bg-primary/10"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs uppercase tracking-wider font-medium",
                      dayIsToday ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {format(day, "EEE", { locale: ptBR })}
                  </span>
                  <span
                    className={cn(
                      "text-2xl font-semibold mt-0.5 w-10 h-10 flex items-center justify-center rounded-full transition-colors",
                      dayIsToday && "bg-primary text-primary-foreground",
                      !dayIsToday && dayIsSelected && "bg-muted"
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
          className={cn("grid relative", gridCols)}
          style={{ height: `${TOTAL_SLOTS * SLOT_HEIGHT_PX}px` }}
        >
          {/* Current Time Indicator */}
          {isTodayInView && currentTimePositionPx !== null && (
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none"
              style={{ top: `${currentTimePositionPx}px` }}
            >
              <div className="relative flex items-center pl-[52px]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/40" />
                <div className="flex-1 h-[2px] bg-red-500 shadow-sm shadow-red-500/30" />
              </div>
            </div>
          )}

          {/* Time Labels Column */}
          <div className="border-r border-border bg-muted/20">
            {TIME_SLOTS.map((slot) => (
              <div
                key={slot.label}
                className={cn(
                  "h-[30px] border-b flex items-start justify-end pr-2 pt-0.5",
                  slot.minutes === 0 ? "border-border/50" : "border-border/20"
                )}
              >
                <span className={cn(
                  "text-[10px] font-medium",
                  slot.minutes === 0 ? "text-muted-foreground" : "text-muted-foreground/50"
                )}>
                  {slot.label}
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDays.map((day) => {
            const dayAppts = getAppointmentsForDay(day);
            const dayIsSelected = isSameDay(day, selectedDate);
            const dayIsToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-r border-border last:border-r-0",
                  dayIsSelected && "bg-primary/5",
                  dayIsToday && !dayIsSelected && "bg-accent/30"
                )}
              >
                {/* Time Slot Lines */}
                {TIME_SLOTS.map((slot) => (
                  <div
                    key={slot.label}
                    className={cn(
                      "h-[30px] border-b",
                      slot.minutes === 0 ? "border-border/50" : "border-border/20"
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