import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, ChevronRight, Clock, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLeadFolderAccess } from "@/hooks/useFolderAccess";

export const UpcomingAppointmentsCard = ({ className }: { className?: string }) => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { allowedFolderIds } = useLeadFolderAccess();

    const { data: appointments, isLoading } = useQuery({
        queryKey: ["upcoming-appointments", profile?.workspace_id, allowedFolderIds],
        queryFn: async () => {
            // If member has folder restrictions but no folders assigned, show nothing
            if (allowedFolderIds !== null && allowedFolderIds.length === 0) return [];

            const { data, error } = await supabase
                .from("appointments")
                .select(`
          id, 
          title, 
          start_time, 
          status,
          lead_id,
          leads (
            id,
            name,
            phone,
            avatar_url
          )
        `)
                .eq("workspace_id", profile?.workspace_id)
                .gte("start_time", new Date().toISOString())
                .neq("status", "cancelled")
                .order("start_time", { ascending: true })
                .limit(15);

            if (error) throw error;

            let filteredData = data || [];

            // Filter by allowed folders for restricted members
            if (allowedFolderIds !== null && allowedFolderIds.length > 0) {
                const leadIds = filteredData
                    .map((a: any) => a.lead_id)
                    .filter(Boolean);

                if (leadIds.length > 0) {
                    const { data: folderRelations } = await supabase
                        .from("lead_folder_relations")
                        .select("lead_id")
                        .in("folder_id", allowedFolderIds)
                        .in("lead_id", leadIds);

                    const allowedLeadIds = new Set(
                        (folderRelations || []).map((r: any) => r.lead_id)
                    );
                    filteredData = filteredData.filter(
                        (apt: any) => apt.lead_id && allowedLeadIds.has(apt.lead_id)
                    );
                } else {
                    filteredData = [];
                }
            }

            return filteredData.slice(0, 5);
        },
        enabled: !!profile?.workspace_id,
    });

    const formatAppointmentTime = (dateString: string) => {
        const date = new Date(dateString);
        let dayPrefix = "";
        if (isToday(date)) {
            dayPrefix = "Hoje, ";
        } else if (isTomorrow(date)) {
            dayPrefix = "Amanhã, ";
        } else {
            dayPrefix = format(date, "d 'de' MMM, ", { locale: ptBR });
        }
        return `${dayPrefix}${format(date, "HH:mm")}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return "bg-emerald-500/20 text-emerald-400";
            case 'scheduled': return "bg-sky-500/20 text-sky-400";
            case 'pending_owner':
            case 'pending_lead': return "bg-amber-500/20 text-amber-400";
            default: return "bg-muted text-muted-foreground";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'confirmed': return "Confirmado";
            case 'scheduled': return "Agendado";
            case 'pending_owner': return "Aguardando";
            case 'pending_lead': return "Pendente Cliente";
            default: return "Agendado";
        }
    }

    return (
        <Card className={cn("border-border shadow-sm overflow-hidden relative group", className)}>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px] -z-10 pointer-events-none group-hover:bg-purple-500/10 transition-colors duration-700" />

            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                <div>
                    <CardTitle className="flex items-center gap-2 text-xl font-bold">
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 shrink-0">
                            <CalendarDays className="h-4 w-4 text-purple-400" />
                        </div>
                        Próximos Agendamentos
                    </CardTitle>
                    <CardDescription className="font-medium mt-1">Evolução do seu calendário</CardDescription>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/appointments')}
                    className="shrink-0 group/btn hover:bg-purple-500/10 hover:text-purple-400"
                >
                    Ver agenda <ChevronRight className="ml-1 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
            </CardHeader>

            <CardContent className="p-0 z-10 relative">
                {isLoading ? (
                    <div className="space-y-4 p-6">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                ) : appointments && appointments.length > 0 ? (
                    <div className="divide-y divide-border/50">
                        {appointments.map((apt) => (
                            <div
                                key={apt.id}
                                className="group/item flex items-center justify-between p-4 sm:p-5 hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => navigate(`/appointments?open=${apt.id}`)}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <Avatar className="h-10 w-10 border border-border shadow-sm ring-2 ring-transparent group-hover/item:ring-purple-500/20 transition-all">
                                        {apt.leads?.avatar_url && <AvatarImage src={apt.leads.avatar_url} />}
                                        <AvatarFallback className="bg-purple-500/10 text-purple-400 font-bold shadow-inner">
                                            {(apt.leads?.name || apt.leads?.phone || '?').substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="flex flex-col min-w-0">
                                        <p className="font-semibold text-sm text-foreground truncate group-hover/item:text-purple-400 transition-colors">
                                            {apt.title || apt.leads?.name || apt.leads?.phone}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                            <Clock className="h-3 w-3" />
                                            <span className="truncate">{formatAppointmentTime(apt.start_time)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pl-4 shrink-0 flex flex-col items-end gap-2">
                                    <div className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full", getStatusColor(apt.status))}>
                                        {getStatusLabel(apt.status)}
                                    </div>
                                    {apt.leads?.name && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <User className="h-3 w-3" />
                                            <span className="truncate max-w-[100px] sm:max-w-xs">{apt.leads.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 flex flex-col items-center justify-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <CalendarDays className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-muted-foreground font-medium">Nenhum agendamento futuro</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/appointments')}>
                            Ver calendário completo
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
