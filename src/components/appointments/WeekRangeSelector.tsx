import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeekRangeSelectorProps {
  selectedDate: Date;
  onWeekChange: (date: Date) => void;
}

export const WeekRangeSelector = ({
  selectedDate,
  onWeekChange,
}: WeekRangeSelectorProps) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  const formatDateFull = (date: Date) => {
    return format(date, "d 'de' MMM, yyyy", { locale: ptBR });
  };

  const formatDateShort = () => {
    const startDay = format(weekStart, "d", { locale: ptBR });
    const endDay = format(weekEnd, "d", { locale: ptBR });
    const month = format(weekEnd, "MMM", { locale: ptBR });
    return `${startDay}-${endDay} ${month}`;
  };

  const goToPreviousWeek = () => {
    onWeekChange(subWeeks(selectedDate, 1));
  };

  const goToNextWeek = () => {
    onWeekChange(addWeeks(selectedDate, 1));
  };

  const goToToday = () => {
    onWeekChange(new Date());
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      {/* Navegação + Hoje */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8 sm:h-9 sm:w-9" 
          onClick={goToPreviousWeek}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8 sm:h-9 sm:w-9" 
          onClick={goToNextWeek}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={goToToday} 
          className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
        >
          Hoje
        </Button>
      </div>

      {/* Período - formato curto em mobile, completo em desktop */}
      <div className="flex items-center gap-1 sm:gap-2 text-sm sm:text-lg">
        {/* Mobile: formato curto */}
        <span className="font-semibold text-primary sm:hidden">
          {formatDateShort()}
        </span>
        
        {/* Desktop: formato completo */}
        <span className="font-semibold text-primary hidden sm:inline">
          {formatDateFull(weekStart)}
        </span>
        <span className="text-muted-foreground hidden sm:inline">→</span>
        <span className="font-semibold text-primary hidden sm:inline">
          {formatDateFull(weekEnd)}
        </span>
      </div>
    </div>
  );
};
