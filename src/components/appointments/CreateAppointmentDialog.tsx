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
  const { user, profile } = useAuth();
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

  const workspaceId = profile?.workspace_id;

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
      const { data: conflicts, error: checkError } = await supabase
        .from("appointments")
        .select("id, title, start_time, end_time")
        .eq("workspace_id", workspaceId)
        .neq("status", "cancelled")
        .lt("start_time", endDateTime.toISOString())
        .gt("end_time", startDateTime.toISOString())
        .limit(1);

      if (checkError) {
        console.error("Conflict check error:", checkError);
      }

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
    onError: (error: any) => {
      console.error("Mutation create erro:", error);
      toast.error(error?.message || "Erro ao criar agendamento");
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
      <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 overflow-hidden border-border/50 max-h-[90vh] overflow-y-auto">
        {/* Premium gradient header */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shadow-sm">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold">Novo Agendamento</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Preencha os detalhes do compromisso
                </p>
              </div>
            </div>
            {/* Action buttons in header */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-border/30">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 gap-1.5 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !title.trim() || !date}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Criar Agendamento
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Título */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Título *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Consulta, Reunião..."
              className="h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
            />
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Data *
            </Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-11 bg-muted/30 border-border/50 hover:bg-muted/50 transition-colors",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
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

            {/* Occupied time slots - premium style */}
            {date && (
              <div className="rounded-xl border border-border/40 bg-gradient-to-b from-muted/20 to-muted/40 p-3 overflow-hidden">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2.5">
                  <div className="h-6 w-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <span>Horários ocupados</span>
                </div>

                {loadingDayAppts ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Carregando...</span>
                  </div>
                ) : dayAppointments && dayAppointments.length > 0 ? (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {dayAppointments.map((apt) => {
                      const aptStart = format(new Date(apt.start_time), "HH:mm");
                      const aptEnd = format(new Date(apt.end_time), "HH:mm");

                      return (
                        <div
                          key={apt.id}
                          className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-2.5 py-1.5 min-w-0 border border-amber-500/10"
                        >
                          <span className="font-mono font-semibold shrink-0">
                            {aptStart} - {aptEnd}
                          </span>
                          <span className="text-amber-500/50 shrink-0">•</span>
                          <span className="truncate min-w-0 opacity-80">
                            {apt.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 italic flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Dia livre — nenhum compromisso
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Horário início / fim */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Início *
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Término *
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Lead */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              {terminology.singular}{" "}
              <span className="text-[10px] normal-case tracking-normal font-normal">(opcional)</span>
            </Label>
            <Select value={leadId || "none"} onValueChange={(val) => setLeadId(val === "none" ? "" : val)}>
              <SelectTrigger className="h-11 bg-muted/30 border-border/50">
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

          {/* Descrição */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Descrição{" "}
              <span className="text-[10px] normal-case tracking-normal font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione detalhes sobre o agendamento..."
              rows={3}
              className="min-h-[80px] resize-none bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
            />
          </div>

          {/* Summary preview */}
          {title.trim() && date && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-primary/[0.02] border border-primary/10">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <CalendarIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{title.trim()}</p>
                <p className="text-xs text-muted-foreground">
                  {format(date, "dd/MM/yyyy", { locale: ptBR })} às {startTime} - {endTime}
                </p>
              </div>
            </div>
          )}


        </div>
      </DialogContent>
    </Dialog>
  );
};
