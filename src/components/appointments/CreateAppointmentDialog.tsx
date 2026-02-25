import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTerminology } from "@/hooks/useTerminology";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  selectedInstance?: string | null;
}

export const CreateAppointmentDialog = ({
  open,
  onOpenChange,
  initialDate,
  selectedInstance,
}: CreateAppointmentDialogProps) => {
  const { user } = useAuth();
  const { terminology } = useTerminology();
  const { logChange } = useAuditLog();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(initialDate || new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [leadId, setLeadId] = useState<string>("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Sincronizar data quando o modal abre ou initialDate muda
  useEffect(() => {
    if (open && initialDate) {
      setDate(initialDate);
    }
  }, [open, initialDate]);

  const { data: workspaceId } = useQuery({
    queryKey: ["user-workspace-id"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("workspace_id")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data?.workspace_id;
    },
    enabled: !!user?.id,
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-for-appointments", workspaceId, selectedInstance],
    queryFn: async () => {
      if (!workspaceId) return [];

      let query = supabase
        .from("leads")
        .select("id, name, phone, whatsapp_instance_id")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });
      
      // Filter by instance if selected
      if (selectedInstance) {
        query = query.eq("whatsapp_instance_id", selectedInstance);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  // Query to fetch appointments for the selected day
  const { data: dayAppointments, isLoading: loadingDayAppts } = useQuery({
    queryKey: ["day-appointments", workspaceId, date?.toDateString()],
    queryFn: async () => {
      if (!date || !workspaceId) return [];
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, start_time, end_time, lead_id, leads(name, phone)")
        .eq("workspace_id", workspaceId)
        .neq("status", "cancelled")
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId && !!date,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!date || !title.trim()) {
        throw new Error("Preencha os campos obrigatórios");
      }

      const startDateTime = new Date(date);
      const [startHour, startMinute] = startTime.split(":").map(Number);
      startDateTime.setHours(startHour, startMinute, 0, 0);

      const endDateTime = new Date(date);
      const [endHour, endMinute] = endTime.split(":").map(Number);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      if (endDateTime <= startDateTime) {
        throw new Error("O horário de término deve ser após o início");
      }

      // Check for conflicting appointments
      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id, title, start_time, end_time")
        .eq("workspace_id", workspaceId)
        .neq("status", "cancelled")
        .or(`and(start_time.lt.${endDateTime.toISOString()},end_time.gt.${startDateTime.toISOString()})`)
        .limit(1);

      if (conflicts && conflicts.length > 0) {
        const conflict = conflicts[0];
        const conflictStart = new Date(conflict.start_time);
        throw new Error(
          `Conflito: já existe "${conflict.title}" agendado para ${format(conflictStart, "HH:mm", { locale: ptBR })}`
        );
      }

      const { error } = await supabase.from("appointments").insert({
        title: title.trim(),
        description: description.trim() || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        lead_id: leadId || null,
        workspace_id: workspaceId,
        status: "scheduled",
        source: "manual",
        created_by: user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      logChange({
        action: 'create',
        entity_type: 'appointment',
        changes_summary: `Agendamento: ${title} em ${date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : ""} às ${startTime}`,
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["week-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["month-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-by-instance"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
      queryClient.invalidateQueries({ queryKey: ["confirmed-appointments-today"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao criar agendamento");
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDate(new Date());
    setStartTime("09:00");
    setEndTime("10:00");
    setLeadId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Consulta, Reunião..."
            />
          </div>

          <div className="grid gap-2">
            <Label>Data *</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => {
                    setDate(newDate);
                    setCalendarOpen(false);
                  }}
                  locale={ptBR}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Show occupied time slots for selected date */}
            {date && (
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 overflow-hidden">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Horários ocupados neste dia:</span>
                </div>
                
                {loadingDayAppts ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Carregando...</span>
                  </div>
                ) : dayAppointments && dayAppointments.length > 0 ? (
                  <div className="space-y-1.5">
                    {dayAppointments.map((apt) => {
                      const startTime = format(new Date(apt.start_time), "HH:mm");
                      const endTime = format(new Date(apt.end_time), "HH:mm");
                      const leadName = apt.leads?.name || apt.leads?.phone;
                      
                      return (
                        <div
                          key={apt.id}
                          className="flex items-center gap-2 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded px-2 py-1 min-w-0"
                        >
                          <span className="font-mono font-medium shrink-0 text-xs">
                            {startTime} - {endTime}
                          </span>
                          <span className="text-muted-foreground shrink-0">•</span>
                          <span className="truncate min-w-0">
                            {apt.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhum agendamento para esta data
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startTime">Início *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime">Término *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{terminology.singular} (opcional)</Label>
            <Select value={leadId || "none"} onValueChange={(val) => setLeadId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder={`Selecione um ${terminology.singularLower}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {leads?.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name || lead.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do agendamento..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !title.trim() || !date}
            className="w-full sm:w-auto"
          >
            {createMutation.isPending ? "Criando..." : "Criar Agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
