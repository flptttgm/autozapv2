import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentCard } from "./AppointmentCard";
import { downloadICS } from "@/lib/ics-utils";
import { toast } from "sonner";

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

interface AppointmentListProps {
  selectedDate: Date;
  appointments: Appointment[];
  isLoading: boolean;
  onCancel?: (id: string) => void;
}

export const AppointmentList = ({
  selectedDate,
  appointments,
  isLoading,
  onCancel,
}: AppointmentListProps) => {
  const formattedDate = format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR });

  const handleExportDay = () => {
    if (appointments.length === 0) {
      toast.error("Nenhum agendamento para exportar");
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    downloadICS(appointments, `agendamentos-${dateStr}`);
    toast.success("Arquivo .ics baixado!");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 className="font-semibold text-base sm:text-lg capitalize">{formattedDate}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}
          </p>
        </div>
        {appointments.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExportDay} className="w-full sm:w-auto">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Exportar dia</span>
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">Nenhum agendamento para este dia</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onCancel={onCancel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
