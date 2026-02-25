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
  const { user } = useAuth();
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

  // Query para buscar workspace_id
  const { data: workspaceId } = useQuery({
    queryKey: ["user-workspace-id", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("workspace_id")
        .eq("id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data?.workspace_id || null;
    },
    enabled: !!user?.id,
  });

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
        .gte("end_time", newStart.toISOString())
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="pb-2 sm:pb-4">
          <DialogTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
            {mode !== "view" && (
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className={cn("p-1.5 sm:p-2 rounded-lg", mode === "reschedule" ? "bg-amber-500" : statusConfig.color)}>
              {mode === "reschedule" ? (
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              ) : (
                <StatusIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              )}
            </div>
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
          {mode === "edit" ? (
            // Edit Mode
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  placeholder="Título do agendamento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Descrição (opcional)"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Início</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={editData.start_time}
                    onChange={(e) => setEditData({ ...editData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Fim</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={editData.end_time}
                    onChange={(e) => setEditData({ ...editData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={editData.status}
                  onValueChange={(value) => setEditData({ ...editData, status: value })}
                >
                  <SelectTrigger>
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

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
                <Button variant="outline" onClick={handleBack}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : mode === "reschedule" ? (
            // Reschedule Mode
            <div className="space-y-3 sm:space-y-4 min-w-0">
              <div className="p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 min-w-0">
                <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 break-words">
                  <strong>{appointment.title}</strong>
                </p>
                <p className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-1">
                  Atual: {format(new Date(appointment.start_time), "dd/MM 'às' HH:mm")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Nova Data</Label>
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
                          "w-full justify-start text-left font-normal",
                          !rescheduleData.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
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
                  <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 sm:p-3 overflow-hidden">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Horários ocupados:</span>
                    </div>
                    
                    {loadingDayAppts ? (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Carregando...</span>
                      </div>
                    ) : dayAppointments && dayAppointments.length > 0 ? (
                      <div className="space-y-1 max-h-24 sm:max-h-32 overflow-y-auto overflow-x-hidden">
                        {dayAppointments.map((apt) => {
                          const startTime = format(new Date(apt.start_time), "HH:mm");
                          const endTime = format(new Date(apt.end_time), "HH:mm");
                          const leadName = apt.leads?.name || apt.leads?.phone;
                          
                          return (
                            <div
                              key={apt.id}
                              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded px-2 py-1 min-w-0"
                            >
                              <span className="font-mono font-medium whitespace-nowrap shrink-0">
                                {startTime}-{endTime}
                              </span>
                              <span className="text-muted-foreground hidden sm:inline shrink-0">•</span>
                              <span className="min-w-0 flex-1 truncate hidden sm:inline">
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
                      <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 italic">
                        Nenhum agendamento
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Início</Label>
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
                  <Label className="text-xs sm:text-sm">Fim</Label>
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

              <div className="flex gap-2 pt-4 min-w-0">
                <Button 
                  onClick={handleConfirmReschedule} 
                  className="flex-1 w-full bg-amber-600 hover:bg-amber-700"
                  disabled={isRescheduling}
                >
                  {isRescheduling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Verificando...</span>
                      <span className="sm:hidden">Aguarde...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Confirmar Reagendamento</span>
                      <span className="sm:hidden">Confirmar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // View Mode
            <>
              {/* Status Badge + WhatsApp indicator */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn("text-white text-xs", statusConfig.color)}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {appointment.source === 'ai' && (
                  <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] sm:text-xs">
                    <MessageCircle className="h-3 w-3 mr-1" />
                    WhatsApp
                  </Badge>
                )}
              </div>

              {/* Title */}
              <div>
                <h3 className="text-base sm:text-xl font-semibold leading-tight break-words">{appointment.title}</h3>
              </div>
              
              {/* WhatsApp cancellation info */}
              {appointment.metadata?.cancelled_by === 'customer_whatsapp' && (
                <div className="p-2.5 sm:p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                      Cancelado via WhatsApp
                    </span>
                  </div>
                  {appointment.metadata?.cancellation_message && (
                    <p className="text-xs sm:text-sm text-red-500/80 dark:text-red-400/80 italic mt-1 break-words">
                      "{appointment.metadata.cancellation_message}"
                    </p>
                  )}
                  {appointment.metadata?.cancelled_at && (
                    <p className="text-[10px] sm:text-xs text-red-400 dark:text-red-500 mt-2">
                      {format(new Date(appointment.metadata.cancelled_at), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  )}
                </div>
              )}
              
              {/* WhatsApp reschedule info */}
              {(appointment.metadata?.rescheduled_from_whatsapp || 
                appointment.metadata?.reschedule_requested_by === 'customer_whatsapp') && (
                <div className="p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-1">
                    <RefreshCw className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400">
                      Reagendado via WhatsApp
                    </span>
                  </div>
                  {appointment.metadata?.reschedule_message && (
                    <p className="text-xs sm:text-sm text-amber-500/80 dark:text-amber-400/80 italic mt-1 break-words">
                      "{appointment.metadata.reschedule_message}"
                    </p>
                  )}
                  {appointment.metadata?.rescheduled_at && (
                    <p className="text-[10px] sm:text-xs text-amber-400 dark:text-amber-500 mt-2">
                      {format(new Date(appointment.metadata.rescheduled_at), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  )}
                </div>
              )}

              {/* Date & Time */}
              <div className="flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-medium leading-tight">
                    <span className="sm:hidden">
                      {format(new Date(appointment.start_time), "EEE, d MMM yyyy", { locale: ptBR })}
                    </span>
                    <span className="hidden sm:inline">
                      {format(new Date(appointment.start_time), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 mt-0.5 sm:mt-1">
                    <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {format(new Date(appointment.start_time), "HH:mm")} - {format(new Date(appointment.end_time), "HH:mm")}
                  </p>
                </div>
              </div>

              {/* Description */}
              {appointment.description && (
                <div className="flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Descrição</p>
                    <div className="max-h-24 sm:max-h-32 overflow-y-auto">
                      <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{appointment.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact */}
              {appointment.leads && (
                <div className="flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1">Contato</p>
                    <p className="text-sm sm:text-base font-medium truncate">{appointment.leads.name || "Sem nome"}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 mt-0.5 sm:mt-1">
                      <Phone className="h-3 w-3" />
                      {appointment.leads.phone}
                    </p>
                  </div>
                </div>
              )}

              {/* Pending Owner: Approval Buttons */}
              {isPendingOwner && (
                <div className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <p className="text-sm text-orange-700 dark:text-orange-400 font-medium">
                      ⏳ Este agendamento aguarda sua aprovação
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                      Após aprovar, o cliente será notificado para confirmar sua presença.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="flex-1 h-10 sm:h-11 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isApproving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Aceitar Agendamento
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowRejectConfirm(true)}
                      disabled={isApproving}
                      className="flex-1 h-10 sm:h-11 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Recusar
                    </Button>
                  </div>
                </div>
              )}

              {/* Pending Lead: Info Message */}
              {isPendingLead && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <p className="text-sm text-purple-700 dark:text-purple-400 font-medium">
                    📩 Aguardando confirmação do cliente
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">
                    O cliente foi notificado e deve confirmar sua presença em breve.
                  </p>
                </div>
              )}

              {/* Action Buttons for other modifiable statuses */}
              {canModify && !isPendingOwner && (
                <div className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleEdit} className="flex-1 h-9 sm:h-10 text-xs sm:text-sm">
                      <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleStartReschedule} 
                      className="flex-1 h-9 sm:h-10 text-xs sm:text-sm border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                    >
                      <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Reagendar
                    </Button>
                  </div>
                  {appointment.status === "scheduled" && (
                    <Button onClick={handleConfirm} className="w-full h-9 sm:h-10 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Confirmar
                    </Button>
                  )}
                  {appointment.status === "confirmed" && (
                    <Button onClick={handleComplete} className="w-full h-9 sm:h-10 text-xs sm:text-sm bg-slate-600 hover:bg-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Concluir
                    </Button>
                  )}
                  {!isPendingLead && (
                    <Button
                      variant="destructive"
                      className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                      onClick={() => setShowCancelConfirm(true)}
                    >
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      <span className="hidden sm:inline">Cancelar Agendamento</span>
                      <span className="sm:hidden">Cancelar</span>
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