import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Bot, User, ChevronLeft, ChevronRight, Filter, Calendar, Loader2, Users, Download, MessageCircle, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppointmentData } from "./WeeklyAppointmentCard";

const ITEMS_PER_PAGE = 20;

type SourceFilter = "all" | "manual" | "ai";
type StatusFilter = "all" | "pending_owner" | "pending_lead" | "scheduled" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "rejected";
type PeriodFilter = "7" | "30" | "90" | "all";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending_owner: { label: "Aguardando Aprovação", className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
  pending_lead: { label: "Aguardando Cliente", className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" },
  scheduled: { label: "Agendado", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20" },
  confirmed: { label: "Confirmado", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  completed: { label: "Concluído", className: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20" },
  cancelled: { label: "Cancelado", className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" },
  rescheduled: { label: "Reagendado", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  rejected: { label: "Recusado", className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20" },
};

interface AppointmentHistoryTableProps {
  selectedInstance?: string | null;
  onAppointmentClick?: (appointment: AppointmentData) => void;
}

export const AppointmentHistoryTable = ({
  selectedInstance,
  onAppointmentClick,
}: AppointmentHistoryTableProps) => {
  const { profile } = useAuth();
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30");
  const [leadFilter, setLeadFilter] = useState<string>("all");

  // Fetch leads for the filter dropdown
  const { data: leads } = useQuery({
    queryKey: ["leads-for-history-filter", profile?.workspace_id, selectedInstance],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      
      let query = supabase
        .from("leads")
        .select("id, name, phone")
        .eq("workspace_id", profile.workspace_id)
        .order("name", { ascending: true });
      
      if (selectedInstance) {
        query = query.eq("whatsapp_instance_id", selectedInstance);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.workspace_id,
  });

  // Calculate date range based on period filter
  const dateRange = useMemo(() => {
    if (periodFilter === "all") return null;
    const now = new Date();
    const days = parseInt(periodFilter);
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { start: startDate.toISOString(), end: now.toISOString() };
  }, [periodFilter]);

  // Fetch appointments with count
  const { data: historyData, isLoading } = useQuery({
    queryKey: [
      "appointment-history",
      profile?.workspace_id,
      selectedInstance,
      sourceFilter,
      statusFilter,
      periodFilter,
      leadFilter,
      page,
    ],
    queryFn: async () => {
      if (!profile?.workspace_id) return { appointments: [], count: 0 };

      let query = supabase
        .from("appointments")
        .select(
          "id, title, description, start_time, end_time, status, created_at, source, metadata, created_by, lead_id, leads(name, phone, whatsapp_instance_id)",
          { count: "exact" }
        )
        .eq("workspace_id", profile.workspace_id)
        .order("created_at", { ascending: false });

      // Apply source filter
      if (sourceFilter === "manual") {
        query = query.eq("source", "manual");
      } else if (sourceFilter === "ai") {
        query = query.eq("source", "ai");
      }

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Apply lead filter
      if (leadFilter !== "all") {
        query = query.eq("lead_id", leadFilter);
      }

      // Apply date range filter
      if (dateRange) {
        query = query.gte("created_at", dateRange.start);
      }

      // Apply pagination
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Filter by instance if selected
      let filteredData = data || [];
      if (selectedInstance) {
        filteredData = filteredData.filter(
          (app) => app.leads?.whatsapp_instance_id === selectedInstance
        );
      }

      return { appointments: filteredData, count: count || 0 };
    },
    enabled: !!profile?.workspace_id,
  });

  const totalPages = Math.ceil((historyData?.count || 0) / ITEMS_PER_PAGE);

  const handleFilterChange = () => {
    setPage(1); // Reset to first page when filters change
  };

  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      pending_owner: "Aguardando Aprovação",
      pending_lead: "Aguardando Cliente",
      scheduled: "Agendado",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
      rescheduled: "Reagendado",
      rejected: "Recusado",
    };
    return statusLabels[status] || status;
  };

  const exportToCSV = () => {
    if (!historyData?.appointments?.length) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const headers = ["Título", "Lead", "Telefone", "Data/Hora", "Origem", "Status", "Criado em"];
    
    const rows = historyData.appointments.map((appointment) => {
      const leadName = appointment.leads?.name || "-";
      const leadPhone = appointment.leads?.phone || "-";
      const dateTime = format(new Date(appointment.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR });
      const source = appointment.source === "ai" ? "IA" : "Manual";
      const status = getStatusLabel(appointment.status || "scheduled");
      const createdAt = format(new Date(appointment.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
      
      return [
        `"${appointment.title.replace(/"/g, '""')}"`,
        `"${leadName.replace(/"/g, '""')}"`,
        `"${leadPhone}"`,
        `"${dateTime}"`,
        `"${source}"`,
        `"${status}"`,
        `"${createdAt}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico-agendamentos-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`${historyData.appointments.length} agendamento(s) exportado(s)`);
  };

  return (
    <Card className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Agendamentos
              </h3>
              <p className="text-sm text-muted-foreground">
                {historyData?.count || 0} agendamento(s) encontrado(s)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={!historyData?.appointments?.length}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
          </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-1">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros:</span>
          </div>

          <Select
            value={sourceFilter}
            onValueChange={(value: SourceFilter) => {
              setSourceFilter(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="ai">🤖 IA</SelectItem>
              <SelectItem value="manual">👤 Manual</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value: StatusFilter) => {
              setStatusFilter(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pending_owner">Aguardando Aprovação</SelectItem>
              <SelectItem value="pending_lead">Aguardando Cliente</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="rescheduled">Reagendado</SelectItem>
              <SelectItem value="rejected">Recusado</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={leadFilter}
            onValueChange={(value: string) => {
              setLeadFilter(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <Users className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Lead" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos leads</SelectItem>
              {leads?.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {lead.name || lead.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={periodFilter}
            onValueChange={(value: PeriodFilter) => {
              setPeriodFilter(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !historyData?.appointments?.length ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <History className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum agendamento encontrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Ajuste os filtros ou crie novos agendamentos
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Título</TableHead>
                <TableHead className="hidden md:table-cell">Lead</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead className="w-[100px]">Criador</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="hidden lg:table-cell w-[130px]">Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyData.appointments.map((appointment) => {
                const startDate = new Date(appointment.start_time);
                const createdDate = new Date(appointment.created_at);
                const statusConfig = STATUS_CONFIG[appointment.status || "scheduled"];
                const isAi = appointment.source === "ai";
                const metadata = appointment.metadata as any;
                const wasCancelledByWhatsApp = metadata?.cancelled_by === 'customer_whatsapp';
                const wasRescheduledByWhatsApp = metadata?.rescheduled_from_whatsapp || 
                                                  metadata?.reschedule_requested_by === 'customer_whatsapp';

                return (
                  <TableRow
                    key={appointment.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      onAppointmentClick?.(appointment as unknown as AppointmentData)
                    }
                  >
                    <TableCell className="font-medium">
                      <div className="truncate max-w-[180px]" title={appointment.title}>
                        {appointment.title}
                      </div>
                      {appointment.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {appointment.description}
                        </p>
                      )}
                      {/* WhatsApp action indicators */}
                      {wasCancelledByWhatsApp && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-red-600 dark:text-red-400">
                          <XCircle className="h-3 w-3" />
                          <span>Cancelado via WhatsApp</span>
                        </div>
                      )}
                      {wasRescheduledByWhatsApp && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                          <RefreshCw className="h-3 w-3" />
                          <span>Reagendado via WhatsApp</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm">
                        {appointment.leads?.name || appointment.leads?.phone || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(startDate, "dd/MM/yy", { locale: ptBR })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(startDate, "HH:mm", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs gap-1",
                          isAi
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                            : "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20"
                        )}
                      >
                        {isAi ? (
                          <>
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3" />
                            Manual
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", statusConfig?.className)}>
                        {statusConfig?.label || appointment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-xs text-muted-foreground">
                        {format(createdDate, "dd/MM/yy HH:mm", { locale: ptBR })}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Mostrando {(page - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(page * ITEMS_PER_PAGE, historyData?.count || 0)} de{" "}
            {historyData?.count || 0}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
