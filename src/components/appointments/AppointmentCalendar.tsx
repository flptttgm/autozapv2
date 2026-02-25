import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addMonths, subMonths, isToday } from "date-fns";

interface AppointmentCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date | undefined) => void;
  month: Date;
  onMonthChange: (date: Date) => void;
  datesWithAppointments: string[];
}

export const AppointmentCalendar = ({
  selectedDate,
  onSelectDate,
  month,
  onMonthChange,
  datesWithAppointments,
}: AppointmentCalendarProps) => {
  return (
    <div className="p-3 sm:p-4">
      {/* Custom Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary/10 hover:text-primary"
          onClick={() => onMonthChange(subMonths(month, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs sm:text-sm font-semibold capitalize">
          {format(month, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary/10 hover:text-primary"
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onSelectDate}
        month={month}
        onMonthChange={onMonthChange}
        locale={ptBR}
        className="rounded-md w-full pointer-events-auto p-0"
        classNames={{
          months: "flex flex-col",
          month: "space-y-2 w-full",
          caption: "hidden",
          nav: "hidden",
          table: "w-full border-collapse",
          head_row: "flex w-full",
          head_cell: "text-muted-foreground rounded-md w-full font-semibold text-[10px] uppercase tracking-wider",
          row: "flex w-full mt-1",
          cell: cn(
            "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 w-full",
          ),
          day: cn(
            "h-9 w-full p-0 font-normal inline-flex items-center justify-center rounded-full text-sm transition-all",
            "hover:bg-primary/10 hover:text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            "disabled:pointer-events-none disabled:opacity-50"
          ),
          day_selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-md",
          day_today: "bg-accent text-accent-foreground font-bold ring-1 ring-primary/30",
          day_outside: "text-muted-foreground/40",
          day_disabled: "text-muted-foreground opacity-50",
          day_hidden: "invisible",
        }}
        modifiers={{
          hasAppointment: (date) =>
            datesWithAppointments.includes(date.toDateString()),
        }}
        modifiersClassNames={{
          hasAppointment: "has-appointment",
        }}
        components={{
          DayContent: ({ date }) => {
            const hasAppointment = datesWithAppointments.includes(date.toDateString());
            const todayDate = isToday(date);
            return (
              <div className="relative w-full h-full flex items-center justify-center">
                <span>{date.getDate()}</span>
                {hasAppointment && (
                  <span className={cn(
                    "absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
                    todayDate ? "bg-primary-foreground" : "bg-primary"
                  )} />
                )}
              </div>
            );
          },
        }}
      />
    </div>
  );
};
