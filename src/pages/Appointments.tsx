import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useRealtimeAppointments } from "@/hooks/useRealtimeAppointments";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Download,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  History,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppointmentCalendar } from "@/components/appointments/AppointmentCalendar";
import { WeeklyView } from "@/components/appointments/WeeklyView";
import { DailyView } from "@/components/appointments/DailyView";
import { MonthlyView } from "@/components/appointments/MonthlyView";
import { WeekRangeSelector } from "@/components/appointments/WeekRangeSelector";
import { CreateAppointmentDialog } from "@/components/appointments/CreateAppointmentDialog";
import { AppointmentDetailsModal } from "@/components/appointments/AppointmentDetailsModal";
import { AppointmentHistoryTable } from "@/components/appointments/AppointmentHistoryTable";
import { DayPreparationPanel } from "@/components/appointments/DayPreparationPanel";
import { downloadICS } from "@/lib/ics-utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AppointmentData } from "@/components/appointments/WeeklyAppointmentCard";

type ViewMode = "day" | "week" | "month" | "history";
type AppointmentStatus =
  | "pending_owner"
  | "pending_lead"
  | "scheduled"
  | "confirmed"
  | "completed"
  | "rescheduled"
  | "rejected";

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string; activeColor: string }
> = {
  pending_owner: {
    label: "Aguardando Aprovação",
    color: "bg-orange-500",
    activeColor: "bg-orange-500 text-white",
  },
  pending_lead: {
    label: "Aguardando Cliente",
    color: "bg-purple-500",
    activeColor: "bg-purple-500 text-white",
  },
  scheduled: {
    label: "Agendado",
    color: "bg-sky-500",
    activeColor: "bg-sky-500 text-white",
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-emerald-500",
    activeColor: "bg-emerald-500 text-white",
  },
  completed: {
    label: "Concluído",
    color: "bg-slate-400",
    activeColor: "bg-slate-500 text-white",
  },
  rescheduled: {
    label: "Reagendado",
    color: "bg-amber-500",
    activeColor: "bg-amber-500 text-white",
  },
  rejected: {
    label: "Recusado",
    color: "bg-rose-400",
    activeColor: "bg-rose-400 text-white",
  },
};

const Appointments = () => {
  const { user, profile } = useAuth();
  const { logChange } = useAuditLog();

  // Enable realtime updates for appointments
  useRealtimeAppointments(profile?.workspace_id);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedInstance = searchParams.get("instance");
  const openAppointmentId = searchParams.get("open");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("appointments-view-mode");
    return saved === "day" || saved === "week" || saved === "month" || saved === "history"
      ? saved
      : "month";
  });
  const [activeFilters, setActiveFilters] = useState<AppointmentStatus[]>([]);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Fetch appointments for the visible week
  const { data: weekAppointments } = useQuery({
    queryKey: [
      "week-appointments",
      format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      profile?.workspace_id,
      selectedInstance,
    ],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

      let query = supabase
        .from("appointments")
        .select(
          "id, title, description, start_time, end_time, status, metadata, leads(name, phone, whatsapp_instance_id, avatar_url, email, status, score)",
        )
        .eq("workspace_id", profile.workspace_id)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // Filter by instance if selected
      if (selectedInstance) {
        return (
          data?.filter(
            (app) => app.leads?.whatsapp_instance_id === selectedInstance,
          ) || []
        );
      }

      return data;
    },
    enabled: !!profile?.workspace_id,
  });

  // Fetch appointments for the visible calendar grid (includes days from adjacent months)
  const { data: monthAppointments } = useQuery({
    queryKey: [
      "month-appointments",
      format(
        startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }),
        "yyyy-MM-dd",
      ),
      format(
        endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 }),
        "yyyy-MM-dd",
      ),
      profile?.workspace_id,
      selectedInstance,
    ],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];

      // Calculate the actual visible range of the calendar grid
      const monthStart = startOfMonth(calendarMonth);
      const monthEnd = endOfMonth(calendarMonth);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // First visible day
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Last visible day

      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, title, description, start_time, end_time, status, metadata, leads(name, phone, whatsapp_instance_id, avatar_url, email, status, score)",
        )
        .eq("workspace_id", profile.workspace_id)
        .gte("start_time", calendarStart.toISOString())
        .lte("start_time", calendarEnd.toISOString())
        .neq("status", "cancelled");

      if (error) throw error;

      // Filter by instance if selected
      if (selectedInstance) {
        return (
          data?.filter(
            (app) => app.leads?.whatsapp_instance_id === selectedInstance,
          ) || []
        );
      }

      return data;
    },
    enabled: !!profile?.workspace_id,
  });

  const datesWithAppointments =
    monthAppointments?.map((a) => new Date(a.start_time).toDateString()) || [];

  // Filter appointments based on active filters
  const filteredWeekAppointments = useMemo(() => {
    if (!weekAppointments) return [];
    if (activeFilters.length === 0) return weekAppointments;
    return weekAppointments.filter((apt) =>
      activeFilters.includes(apt.status as AppointmentStatus),
    );
  }, [weekAppointments, activeFilters]);

  const filteredMonthAppointments = useMemo(() => {
    if (!monthAppointments) return [];
    if (activeFilters.length === 0) return monthAppointments;
    return monthAppointments.filter((apt) =>
      activeFilters.includes(apt.status as AppointmentStatus),
    );
  }, [monthAppointments, activeFilters]);

  const toggleFilter = (status: AppointmentStatus) => {
    setActiveFilters((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  const clearFilters = () => setActiveFilters([]);

  const cancelMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);
      if (error) throw error;
      return appointmentId;
    },
    onSuccess: (appointmentId) => {
      toast.success("Agendamento cancelado");

      // Registrar no histórico de auditoria
      logChange({
        action: "delete",
        entity_type: "appointment",
        entity_id: appointmentId,
        new_value: { status: "cancelled" },
        changes_summary: "Agendamento cancelado",
      });

      queryClient.invalidateQueries({ queryKey: ["week-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["month-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-by-instance"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
      queryClient.invalidateQueries({
        queryKey: ["confirmed-appointments-today"],
      });
    },
    onError: () => {
      toast.error("Erro ao cancelar agendamento");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AppointmentData>;
    }) => {
      // Only send fields that are actually being updated.
      // Important: appointments.title is NOT nullable, so sending title: undefined breaks updates.
      const updateData: Record<string, unknown> = {};

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.start_time !== undefined)
        updateData.start_time = data.start_time;
      if (data.end_time !== undefined) updateData.end_time = data.end_time;
      if (data.status !== undefined) updateData.status = data.status;

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success("Agendamento atualizado");

      // Registrar no histórico de auditoria
      const actionDescription =
        variables.data.status === "rescheduled"
          ? "Agendamento reagendado"
          : variables.data.status === "confirmed"
            ? "Agendamento confirmado"
            : variables.data.status === "completed"
              ? "Agendamento concluído"
              : "Agendamento atualizado";

      logChange({
        action: "update",
        entity_type: "appointment",
        entity_id: variables.id,
        new_value: variables.data,
        changes_summary: actionDescription,
      });

      queryClient.invalidateQueries({ queryKey: ["week-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["month-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-by-instance"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
      queryClient.invalidateQueries({
        queryKey: ["confirmed-appointments-today"],
      });
      setDetailsModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro ao atualizar agendamento");
    },
  });

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setCalendarMonth(date);
    }
  };

  const handleWeekChange = (date: Date) => {
    setSelectedDate(date);
    setCalendarMonth(date);
  };

  useEffect(() => {
    const handleCreate = () => setCreateDialogOpen(true);
    const handleExport = () => {
      if (viewMode === "month") {
        if (!filteredMonthAppointments || filteredMonthAppointments.length === 0) {
          toast.error("Nenhum agendamento no mês para exportar");
          return;
        }
        const monthStr = format(selectedDate, "yyyy-MM");
        downloadICS(filteredMonthAppointments, `agendamentos-mes-${monthStr}`);
        toast.success("Arquivo .ics baixado!");
      } else {
        if (!filteredWeekAppointments || filteredWeekAppointments.length === 0) {
          toast.error("Nenhum agendamento para exportar");
          return;
        }
        const weekStr = format(selectedDate, "yyyy-'W'ww");
        downloadICS(filteredWeekAppointments, `agendamentos-${weekStr}`);
        toast.success("Arquivo .ics baixado!");
      }
    };

    window.addEventListener("open-create-appointment", handleCreate);
    window.addEventListener("export-appointments", handleExport);

    return () => {
      window.removeEventListener("open-create-appointment", handleCreate);
      window.removeEventListener("export-appointments", handleExport);
    };
  }, [viewMode, filteredWeekAppointments, filteredMonthAppointments, selectedDate]);

  const handleAppointmentClick = (appointment: AppointmentData) => {
    setSelectedAppointment(appointment);
    setDetailsModalOpen(true);
  };

  const handleUpdateAppointment = (
    id: string,
    data: Partial<AppointmentData>,
  ) => {
    updateMutation.mutate({ id, data });
  };

  // Deep linking: open appointment modal when ?open=<id> is in URL
  useEffect(() => {
    if (!openAppointmentId || !profile?.workspace_id) return;

    const fetchAndOpenAppointment = async () => {
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, title, description, start_time, end_time, status, source, metadata, leads(name, phone)",
        )
        .eq("id", openAppointmentId)
        .eq("workspace_id", profile.workspace_id)
        .maybeSingle();

      if (data) {
        setSelectedAppointment(data as AppointmentData);
        setDetailsModalOpen(true);
        // Clear the param to avoid re-opening on navigation
        setSearchParams(
          (prev) => {
            prev.delete("open");
            return prev;
          },
          { replace: true },
        );
      }
    };

    fetchAndOpenAppointment();
  }, [openAppointmentId, profile?.workspace_id, setSearchParams]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full flex flex-col p-4 sm:p-6 overflow-hidden relative">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-0 w-full h-[300px] ambient-glow-primary blur-[120px] rounded-full pointer-events-none -translate-y-1/2 z-0" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] ambient-glow-secondary blur-[120px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/2 z-0" />

        <div className="relative z-10 flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Linha 1: Título e botões */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl sm:text-2xl md:text-3xl font-bold text-foreground">
                  Agenda
                </h1>
                {/* View Mode Toggle */}
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => {
                    if (value) {
                      setViewMode(value as ViewMode);
                      localStorage.setItem("appointments-view-mode", value);
                    }
                  }}
                  className="bg-muted/40 backdrop-blur-sm p-0.5 sm:p-1 rounded-xl border border-border/30 shadow-sm"
                >
                  <ToggleGroupItem
                    value="day"
                    aria-label="Visualização diária"
                    className="px-3 sm:px-3 rounded-lg text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-md transition-all duration-200"
                  >
                    <Sun className="h-4 w-4 sm:mr-1.5" />
                    <span className="text-sm sm:text-sm hidden sm:inline">
                      Dia
                    </span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="week"
                    aria-label="Visualização semanal"
                    className="px-3 sm:px-3 rounded-lg text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-md transition-all duration-200"
                  >
                    <Calendar className="h-4 w-4 sm:mr-1.5" />
                    <span className="text-sm sm:text-sm hidden sm:inline">
                      Semana
                    </span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="month"
                    aria-label="Visualização mensal"
                    className="px-3 sm:px-3 rounded-lg text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-md transition-all duration-200"
                  >
                    <CalendarDays className="h-4 w-4 sm:mr-1.5" />
                    <span className="text-sm sm:text-sm hidden sm:inline">
                      Mês
                    </span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="history"
                    aria-label="Histórico de agendamentos"
                    className="px-3 sm:px-3 rounded-lg text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-md transition-all duration-200"
                  >
                    <History className="h-4 w-4 sm:mr-1.5" />
                    <span className="text-sm sm:text-sm hidden sm:inline">
                      Histórico
                    </span>
                  </ToggleGroupItem>
                </ToggleGroup>
                {/* Removed Botões de ação -> Moved to global header */}
              </div>
            </div>
            {/* Linha 2: < > Hoje + Filtros */}
            {viewMode !== "history" && viewMode !== "day" && (
              <div className="hidden sm:flex items-center gap-3">
                {/* Week navigation - only in week mode */}
                {viewMode === "week" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => handleWeekChange(subWeeks(selectedDate, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => handleWeekChange(addWeeks(selectedDate, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleWeekChange(new Date())} className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
                      Hoje
                    </Button>
                  </div>
                )}

                {/* Filtros de status */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    Object.entries(STATUS_CONFIG) as [
                      AppointmentStatus,
                      (typeof STATUS_CONFIG)[AppointmentStatus],
                    ][]
                  ).map(([status, config]) => (
                    <button
                      key={status}
                      onClick={() => toggleFilter(status)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200",
                        "border hover:scale-105 active:scale-95",
                        activeFilters.includes(status)
                          ? cn(config.activeColor, "border-transparent shadow-md ring-2 ring-current/20")
                          : "bg-background/80 backdrop-blur-sm border-border/50 text-muted-foreground hover:border-primary/50 hover:shadow-sm",
                      )}
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          activeFilters.includes(status)
                            ? "bg-white/80"
                            : config.color,
                        )}
                      />
                      {config.label}
                    </button>
                  ))}
                  {activeFilters.length > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0 overflow-hidden">
            {viewMode === "history" ? (
              <AppointmentHistoryTable
                selectedInstance={selectedInstance}
                onAppointmentClick={handleAppointmentClick}
              />
            ) : (
              <>
                {/* Calendar View */}
                <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0 min-w-0 gap-4">
                  <Card className="flex-1 overflow-hidden flex flex-col glass border-border/40 shadow-sm">
                    {viewMode === "day" ? (
                      <DailyView
                        selectedDate={selectedDate}
                        appointments={filteredWeekAppointments}
                        onSelectDate={setSelectedDate}
                        onAppointmentClick={handleAppointmentClick}
                      />
                    ) : viewMode === "week" ? (
                      <WeeklyView
                        selectedDate={selectedDate}
                        appointments={filteredWeekAppointments}
                        onSelectDate={setSelectedDate}
                        onCancelAppointment={(id) => cancelMutation.mutate(id)}
                        onAppointmentClick={handleAppointmentClick}
                      />
                    ) : (
                      <MonthlyView
                        selectedDate={selectedDate}
                        appointments={filteredMonthAppointments}
                        onSelectDate={setSelectedDate}
                        onMonthChange={setCalendarMonth}
                        onCancelAppointment={(id) => cancelMutation.mutate(id)}
                        onAppointmentClick={handleAppointmentClick}
                      />
                    )}
                  </Card>

                  {/* Mobile: Controles abaixo do calendário */}
                  <div className="flex sm:hidden flex-col gap-3">
                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.dispatchEvent(new CustomEvent("export-appointments"))}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => setCreateDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo
                      </Button>
                    </div>

                    {/* Filtros de status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      {(
                        Object.entries(STATUS_CONFIG) as [
                          AppointmentStatus,
                          (typeof STATUS_CONFIG)[AppointmentStatus],
                        ][]
                      ).map(([status, config]) => (
                        <button
                          key={status}
                          onClick={() => toggleFilter(status)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                            "border hover:scale-105",
                            activeFilters.includes(status)
                              ? cn(
                                config.activeColor,
                                "border-transparent shadow-sm",
                              )
                              : "bg-background border-border text-muted-foreground hover:border-primary/50",
                          )}
                        >
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full",
                              activeFilters.includes(status)
                                ? "bg-white/80"
                                : config.color,
                            )}
                          />
                          {config.label}
                        </button>
                      ))}
                      {activeFilters.length > 0 && (
                        <button
                          onClick={clearFilters}
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop: Sidebar - DayPreparationPanel for day mode, Calendar for week mode */}
                {viewMode === "day" && (
                  <DayPreparationPanel
                    selectedDate={selectedDate}
                    appointments={weekAppointments || []}
                  />
                )}
                {viewMode === "week" && (
                  <div className="hidden lg:flex lg:w-72 flex-shrink-0 flex-col space-y-3">
                    {/* Date range aligned above calendar */}
                    <div className="flex items-center justify-center gap-2 text-sm px-2">
                      <span className="font-semibold text-primary">
                        {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "d 'de' MMM, yyyy", { locale: ptBR })}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold text-primary">
                        {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "d 'de' MMM, yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <Card className="p-0 overflow-hidden shadow-sm glass border-border/40">
                      <AppointmentCalendar
                        selectedDate={selectedDate}
                        onSelectDate={handleDateSelect}
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        datesWithAppointments={datesWithAppointments}
                      />
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>

          <CreateAppointmentDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            initialDate={selectedDate}
            selectedInstance={selectedInstance}
          />

          <AppointmentDetailsModal
            appointment={selectedAppointment}
            open={detailsModalOpen}
            onOpenChange={setDetailsModalOpen}
            onUpdate={handleUpdateAppointment}
            onCancel={(id) => cancelMutation.mutate(id)}
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Appointments;
