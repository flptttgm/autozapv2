import { Card } from "@/components/ui/card";
import { Calendar, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";

interface CalendarIntegrationProps {
  workspaceId: string;
}

export const CalendarIntegration = ({ workspaceId }: CalendarIntegrationProps) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        <h2 className="text-xl sm:text-2xl font-semibold">Calendário</h2>
      </div>

      <p className="text-muted-foreground mb-6 text-sm sm:text-base">
        Gerencie seus agendamentos e exporte para seu calendário favorito.
      </p>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Os agendamentos são armazenados no Autozap e podem ser exportados como arquivo .ics 
          para importar no Google Calendar, Outlook, Apple Calendar ou qualquer outro aplicativo de calendário.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-muted/50">
          <h3 className="font-medium mb-2">Como funciona:</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">1.</span>
              A IA detecta agendamentos nas conversas do WhatsApp automaticamente
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">2.</span>
              Você pode criar agendamentos manualmente na página de Agendamentos
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">3.</span>
              Exporte os agendamentos como arquivo .ics para seu calendário
            </li>
          </ul>
        </div>

        <Button onClick={() => navigate("/appointments")} className="w-full">
          <Download className="h-4 w-4 mr-2" />
          Ir para Agendamentos
        </Button>
      </div>
    </Card>
  );
};
