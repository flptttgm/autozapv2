import { Card } from "@/components/ui/card";
import { CalendarIntegration } from "./CalendarIntegration";
import { AppointmentReminders } from "./AppointmentReminders";

interface CalendarSettingsProps {
  workspaceId: string | null;
}

export const CalendarSettings = ({ workspaceId }: CalendarSettingsProps) => {
  if (!workspaceId) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Carregando...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AppointmentReminders workspaceId={workspaceId} />
      <CalendarIntegration workspaceId={workspaceId} />
    </div>
  );
};
