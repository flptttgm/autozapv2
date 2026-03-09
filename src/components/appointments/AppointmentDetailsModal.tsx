import { useState, useEffect } from "react";
import { format, addHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  User,
  Calendar,
  CalendarIcon,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Edit2,
  Save,
  X,
  Phone,
  FileText,
  ArrowLeft,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppointmentMetadata {
  cancelled_by?: string;
  cancelled_at?: string;
  cancellation_message?: string;
  reschedule_requested_by?: string;
  reschedule_requested_at?: string;
  reschedule_message?: string;
  rescheduled_from_whatsapp?: boolean;
  rescheduled_at?: string;
  extraction_confidence?: string;
  original_message?: string;
  has_conflicts?: boolean;
}

interface Appointment {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  status: string | null;
  source?: string | null;
  metadata?: AppointmentMetadata | null;
  leads?: {
    name: string | null;
    phone: string;
  } | null;
}

interface AppointmentDetailsModalProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: Partial<Appointment>) => void;
  onCancel: (id: string) => void;
}

const STATUS_OPTIONS = [
  { value: "pending_owner", label: "Aguardando Aprovação", color: "bg-orange-500", icon: Clock },
  { value: "pending_lead", label: "Aguardando Cliente", color: "bg-purple-500", icon: Clock },
  { value: "scheduled", label: "Agendado", color: "bg-sky-500", icon: Clock },
  { value: "confirmed", label: "Confirmado", color: "bg-emerald-500", icon: CheckCircle2 },
  { value: "completed", label: "Concluído", color: "bg-slate-400", icon: CheckCircle2 },
  { value: "rescheduled", label: "Reagendado", color: "bg-amber-500", icon: RefreshCw },
  { value: "cancelled", label: "Cancelado", color: "bg-rose-500", icon: XCircle },
  { value: "rejected", label: "Recusado", color: "bg-rose-400", icon: XCircle },
];

// Generate time options from 07:00 to 21:00
const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7;
  const minutes = (i % 2) * 30;
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
});

type ModalMode = "view" | "edit" | "reschedule";

export const AppointmentDetailsModal = ({
  appointment,
  open,
  onOpenChange,
  onUpdate,
  onCancel,
}: AppointmentDetailsModalProps) => {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<ModalMode>("view");
  const [editData, setEditData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    status: "",
  });
  const [rescheduleData, setRescheduleData] = useState({
    date: new Date(),
    startTime: "09:00",
    endTime: "10:00",
  });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // workspace_id from profile context
  const workspaceId = profile?.workspace_id;

  // Query para buscar agendamentos do dia selecionado (excluindo o próprio)
  const { data: dayAppointments, isLoading: loadingDayAppts } = useQuery({
    queryKey: ["day-appointments-reschedule", workspaceId, rescheduleData.date?.toDateString(), appointment?.id],
    queryFn: async () => {
      if (!rescheduleData.date || !workspaceId) return [];

      const startOfDay = new Date(rescheduleData.date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(rescheduleData.date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, start_time, end_time, lead_id, leads(name, phone)")
        .eq("workspace_id", workspaceId)
        .neq("status", "cancelled")
        .neq("id", appointment?.id || "")
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId && !!rescheduleData.date && mode === "reschedule" && !!appointment,
  });

  if (!appointment) return null;

  const statusConfig = STATUS_OPTIONS.find((s) => s.value === appointment.status) || STATUS_OPTIONS[0];
  const StatusIcon = statusConfig.icon;

  const handleEdit = () => {
    setEditData({
      title: appointment.title,
      description: appointment.description || "",
      start_time: format(new Date(appointment.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(new Date(appointment.end_time), "yyyy-MM-dd'T'HH:mm"),
      status: appointment.status || "scheduled",
    });
    setMode("edit");
  };

  const handleSave = () => {
    onUpdate(appointment.id, {
      title: editData.title,
      description: editData.description || null,
      start_time: new Date(editData.start_time).toISOString(),
      end_time: new Date(editData.end_time).toISOString(),
      status: editData.status,
    });
    setMode("view");
  };

  const handleConfirm = () => {
    onUpdate(appointment.id, { status: "confirmed" });
  };

  const handleStartReschedule = () => {
    const currentStart = new Date(appointment.start_time);
    const currentEnd = new Date(appointment.end_time);
    setRescheduleData({
      date: currentStart,
      startTime: format(currentStart, "HH:mm"),
      endTime: format(currentEnd, "HH:mm"),
    });
    setMode("reschedule");
  };

  const handleConfirmReschedule = async () => {
    setIsRescheduling(true);

    try {
      if (!workspaceId) {
        toast.error("Erro ao verificar disponibilidade");
        return;
      }

      const [startHour, startMin] = rescheduleData.startTime.split(":").map(Number);
      const [endHour, endMin] = rescheduleData.endTime.split(":").map(Number);

      const newStart = new Date(rescheduleData.date);
      newStart.setHours(startHour, startMin, 0, 0);

      const newEnd = new Date(rescheduleData.date);
      newEnd.setHours(endHour, endMin, 0, 0);

      // Validar se horário de término é após o início
      if (newEnd <= newStart) {
        toast.error("O horário de término deve ser após o início");
        return;
      }

      // Verificar conflitos com outros agendamentos (exceto o próprio)
      // Conflito existe quando: existingStart < newEnd AND existingEnd > newStart
      const { data: conflicts, error: conflictError } = await supabase
        .from("appointments")
        .select("id, title, start_time, end_time")
        .eq("workspace_id", workspaceId)
        .neq("status", "cancelled")
        .neq("id", appointment.id)
        .lt("start_time", newEnd.toISOString())
        .gt("end_time", newStart.toISOString())
        .limit(1);

      if (conflictError) {
        console.error("Erro ao verificar conflitos:", conflictError);
        toast.error(conflictError.message || "Erro ao verificar disponibilidade");
        return;
      }

      if (conflicts && conflicts.length > 0) {
        const conflict = conflicts[0];
        const conflictStart = new Date(conflict.start_time);
        const conflictEnd = new Date(conflict.end_time);
        toast.error(
          `Horário indisponível: "${conflict.title}" já está agendado das ${format(conflictStart, "HH:mm")} às ${format(conflictEnd, "HH:mm")}`,
          { duration: 5000 }
        );
        return;
      }

      // Sem conflitos, prosseguir com o reagendamento
      onUpdate(appointment.id, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        status: "rescheduled",
      });
      setMode("view");
    } catch (error: any) {
      console.error("Erro ao reagendar:", error);
      toast.error(error?.message || "Erro ao verificar disponibilidade");
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleComplete = () => {
    onUpdate(appointment.id, { status: "completed" });
  };

  const handleCancelAppointment = () => {
    onCancel(appointment.id);
    onOpenChange(false);
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("approve-appointment", {
        body: { appointmentId: appointment.id, action: "approve" },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Agendamento aprovado! Aguardando confirmação do cliente.");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao aprovar agendamento");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsApproving(true);
    try {
      const response = await supabase.functions.invoke("approve-appointment", {
        body: { appointmentId: appointment.id, action: "reject", reason: rejectReason },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Agendamento recusado. O cliente foi notificado.");
      setShowRejectConfirm(false);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao recusar agendamento");
    } finally {
      setIsApproving(false);
    }
  };

  const handleBack = () => {
    setMode("view");
  };

  const canModify = appointment.status !== "cancelled" && appointment.status !== "completed" && appointment.status !== "rejected";
  const isPendingOwner = appointment.status === "pending_owner";
  const isPendingLead = appointment.status === "pending_lead";

  const getTitle = () => {
    switch (mode) {
      case "edit":
        return "Editar Agendamento";
      case "reschedule":
        return "Reagendar";
      default:
        return "Detalhes do Agendamento";
    }
  };

  // Map status to gradient colors for the header
  const statusGradients: Record<string, string> = {
    pending_owner: "from-orange-500/15 via-orange-500/5",
    pending_lead: "from-purple-500/15 via-purple-500/5",
    scheduled: "from-sky-500/15 via-sky-500/5",
    confirmed: "from-emerald-500/15 via-emerald-500/5",
    completed: "from-slate-400/15 via-slate-400/5",
    rescheduled: "from-amber-500/15 via-amber-500/5",
    cancelled: "from-rose-500/15 via-rose-500/5",
    rejected: "from-rose-400/15 via-rose-400/5",
  };

  const headerGradient = mode === "reschedule"
    ? "from-amber-500/15 via-amber-500/5"
    : statusGradients[appointment.status || "scheduled"] || statusGradients.scheduled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 overflow-hidden border-border/50 max-h-[90vh] overflow-y-auto">
        {/* Premium gradient header */}
        <div className={cn("relative px-6 pt-6 pb-4 bg-gradient-to-br to-transparent", headerGradient)}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-3 text-lg">
              {mode !== "view" && (
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shadow-sm", mode === "reschedule" ? "bg-amber-500" : statusConfig.color)}>
                {mode === "reschedule" ? (
                  <RefreshCw className="h-5 w-5 text-white" />
                ) : (
                  <StatusIcon className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <span className="font-semibold">{getTitle()}</span>
                {mode === "view" && (
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {statusConfig.label}
                  </p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {mode === "edit" ? (
            // Edit Mode
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Título</Label>
                <Input
                  id="title"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  placeholder="Título do agendamento"
                  className="h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Descrição</Label>
                <Textarea
                  id="description"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Descrição (opcional)"
                  rows={3}
                  className="min-h-[80px] resize-none bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Início</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={editData.start_time}
                    onChange={(e) => setEditData({ ...editData, start_time: e.target.value })}
                    className="h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Fim</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={editData.end_time}
                    onChange={(e) => setEditData({ ...editData, end_time: e.target.value })}
                    className="h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</Label>
                <Select
                  value={editData.status}
                  onValueChange={(value) => setEditData({ ...editData, status: value })}
                >
                  <SelectTrigger className="h-11 bg-muted/30 border-border/50">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", option.color)} />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleBack} className="flex-1 h-11">
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="flex-1 h-11 gap-2 shadow-md shadow-primary/20">
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
              </div>
            </div>
          ) : mode === "reschedule" ? (
            // Reschedule Mode
            <div className="space-y-4 min-w-0">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{appointment.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Atual: {format(new Date(appointment.start_time), "dd/MM 'às' HH:mm")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Nova Data</Label>
                {isMobile ? (
                  <>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !rescheduleData.date && "text-muted-foreground"
                      )}
                      onClick={() => setCalendarOpen(true)}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rescheduleData.date ? (
                        format(rescheduleData.date, "PPP", { locale: ptBR })
                      ) : (
                        <span>Selecione uma data</span>
                      )}
                    </Button>
                    <Drawer open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <DrawerContent className="pb-safe">
                        <DrawerHeader className="text-left">
                          <DrawerTitle>Selecione a nova data</DrawerTitle>
                        </DrawerHeader>
                        <div className="flex justify-center px-4 pb-6">
                          <CalendarComponent
                            mode="single"
                            selected={rescheduleData.date}
                            onSelect={(date) => {
                              if (date) {
                                setRescheduleData({ ...rescheduleData, date });
                                setCalendarOpen(false);
                              }
                            }}
                            initialFocus
                            className="rounded-md border"
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          />
                        </div>
                      </DrawerContent>
                    </Drawer>
                  </>
                ) : (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-11 bg-muted/30 border-border/50",
                          !rescheduleData.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {rescheduleData.date ? (
                          format(rescheduleData.date, "PPP", { locale: ptBR })
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={rescheduleData.date}
                        onSelect={(date) => {
                          if (date) {
                            setRescheduleData({ ...rescheduleData, date });
                            setCalendarOpen(false);
                          }
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {/* Mostrar horários ocupados neste dia */}
                {rescheduleData.date && (
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
                      <div className="space-y-1.5 max-h-28 overflow-y-auto overflow-x-hidden">
                        {dayAppointments.map((apt) => {
                          const startTime = format(new Date(apt.start_time), "HH:mm");
                          const endTime = format(new Date(apt.end_time), "HH:mm");
                          const leadName = apt.leads?.name || apt.leads?.phone;

                          return (
                            <div
                              key={apt.id}
                              className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-2.5 py-1.5 min-w-0 border border-amber-500/10"
                            >
                              <span className="font-mono font-semibold whitespace-nowrap shrink-0">
                                {startTime}-{endTime}
                              </span>
                              <span className="text-amber-500/50 hidden sm:inline shrink-0">•</span>
                              <span className="min-w-0 flex-1 truncate hidden sm:inline opacity-80">
                                {apt.title}
                                {leadName && (
                                  <span className="text-muted-foreground ml-1">({leadName})</span>
                                )}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Início</Label>
                  <Select
                    value={rescheduleData.startTime}
                    onValueChange={(value) => setRescheduleData({ ...rescheduleData, startTime: value })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Fim</Label>
                  <Select
                    value={rescheduleData.endTime}
                    onValueChange={(value) => setRescheduleData({ ...rescheduleData, endTime: value })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleBack} className="flex-1 h-11">
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmReschedule}
                  className="flex-1 h-11 gap-2 bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20"
                  disabled={isRescheduling}
                >
                  {isRescheduling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Confirmar Reagendamento
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // View Mode
            <>
              {/* Title */}
              <h3 className="text-lg font-semibold leading-tight break-words">{appointment.title}</h3>

              {/* WhatsApp cancellation info */}
              {appointment.metadata?.cancelled_by === 'customer_whatsapp' && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="h-8 w-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      Cancelado via WhatsApp
                    </p>
                    {appointment.metadata?.cancellation_message && (
                      <p className="text-xs text-red-500/80 dark:text-red-400/80 italic mt-1 break-words">
                        "{appointment.metadata.cancellation_message}"
                      </p>
                    )}
                    {appointment.metadata?.cancelled_at && (
                      <p className="text-[10px] text-red-400/70 mt-1.5">
                        {format(new Date(appointment.metadata.cancelled_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* WhatsApp reschedule info */}
              {(appointment.metadata?.rescheduled_from_whatsapp ||
                appointment.metadata?.reschedule_requested_by === 'customer_whatsapp') && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                      <RefreshCw className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Reagendado via WhatsApp
                      </p>
                      {appointment.metadata?.reschedule_message && (
                        <p className="text-xs text-amber-500/80 dark:text-amber-400/80 italic mt-1 break-words">
                          "{appointment.metadata.reschedule_message}"
                        </p>
                      )}
                      {appointment.metadata?.rescheduled_at && (
                        <p className="text-[10px] text-amber-400/70 mt-1.5">
                          {format(new Date(appointment.metadata.rescheduled_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                    </div>
                  </div>
                )}

              {/* Date & Time */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 border border-border/30">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight capitalize">
                    <span className="sm:hidden">
                      {format(new Date(appointment.start_time), "EEE, d MMM yyyy", { locale: ptBR })}
                    </span>
                    <span className="hidden sm:inline">
                      {format(new Date(appointment.start_time), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(appointment.start_time), "HH:mm")} - {format(new Date(appointment.end_time), "HH:mm")}
                  </p>
                </div>
              </div>

              {/* Description */}
              {appointment.description && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 border border-border/30">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descrição</p>
                    <div className="max-h-28 overflow-y-auto">
                      <p className="text-sm whitespace-pre-wrap break-words">{appointment.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact */}
              {appointment.leads && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 border border-border/30">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{appointment.leads.name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Phone className="h-3 w-3" />
                      {appointment.leads.phone}
                    </p>
                  </div>
                </div>
              )}

              {/* Pending Owner: Approval Buttons */}
              {isPendingOwner && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                        Aguardando sua aprovação
                      </p>
                      <p className="text-xs text-orange-600/80 dark:text-orange-500/80 mt-0.5">
                        Após aprovar, o cliente será notificado.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 gap-2"
                    >
                      {isApproving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Aceitar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectConfirm(true)}
                      disabled={isApproving}
                      className="flex-1 h-11 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950 gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Recusar
                    </Button>
                  </div>
                </div>
              )}

              {/* Pending Lead: Info Message */}
              {isPendingLead && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageCircle className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                      Aguardando confirmação do cliente
                    </p>
                    <p className="text-xs text-purple-600/80 dark:text-purple-500/80 mt-0.5">
                      O cliente foi notificado e deve confirmar em breve.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons for other modifiable statuses */}
              {canModify && !isPendingOwner && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleEdit} className="flex-1 h-10 gap-2 text-sm">
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleStartReschedule}
                      className="flex-1 h-10 gap-2 text-sm border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reagendar
                    </Button>
                  </div>
                  {(appointment.status === "scheduled" || appointment.status === "rescheduled") && (
                    <Button onClick={handleConfirm} className="w-full h-10 gap-2 text-sm bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20">
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar
                    </Button>
                  )}
                  {appointment.status === "confirmed" && (
                    <Button onClick={handleComplete} className="w-full h-10 gap-2 text-sm bg-slate-600 hover:bg-slate-700 shadow-md shadow-slate-600/20">
                      <CheckCircle2 className="h-4 w-4" />
                      Concluir
                    </Button>
                  )}
                  {!isPendingLead && (
                    <Button
                      variant="destructive"
                      className="w-full h-10 gap-2 text-sm"
                      onClick={() => setShowCancelConfirm(true)}
                    >
                      <X className="h-4 w-4" />
                      Cancelar Agendamento
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o agendamento "{appointment.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelAppointment}
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente será notificado de que o horário não está disponível. Você pode informar um motivo (opcional):
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo da recusa (opcional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason("")}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReject}
              disabled={isApproving}
            >
              {isApproving ? "Recusando..." : "Recusar Agendamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};