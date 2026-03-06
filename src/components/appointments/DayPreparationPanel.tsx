import { useMemo } from "react";
import { format, isSameDay, parseISO, isToday, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Lightbulb, CalendarCheck, Clock, Sparkles } from "lucide-react";

interface Appointment {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    status: string | null;
    leads?: {
        name: string | null;
    } | null;
}

interface DayPreparationPanelProps {
    selectedDate: Date;
    appointments: Appointment[];
}

export const DayPreparationPanel = ({
    selectedDate,
    appointments,
}: DayPreparationPanelProps) => {
    const dayIsToday = isToday(selectedDate);
    const now = new Date();

    const dayAppointments = useMemo(
        () =>
            appointments.filter((apt) =>
                isSameDay(parseISO(apt.start_time), selectedDate)
            ),
        [appointments, selectedDate]
    );

    // Stats
    const totalMeetings = dayAppointments.length;
    const confirmedCount = dayAppointments.filter(
        (a) => a.status === "confirmed"
    ).length;
    const pendingCount = dayAppointments.filter(
        (a) => a.status === "pending_owner" || a.status === "pending_lead"
    ).length;
    const completedCount = dayAppointments.filter(
        (a) => a.status === "completed"
    ).length;

    // Calculate total scheduled time
    const totalMinutes = useMemo(() => {
        return dayAppointments.reduce((acc, apt) => {
            const start = parseISO(apt.start_time);
            const end = parseISO(apt.end_time);
            return acc + (end.getTime() - start.getTime()) / 60000;
        }, 0);
    }, [dayAppointments]);

    const formatTotalTime = () => {
        if (totalMinutes === 0) return "0min";
        const h = Math.floor(totalMinutes / 60);
        const m = Math.round(totalMinutes % 60);
        if (h === 0) return `${m}min`;
        return m > 0 ? `${h}h${m}` : `${h}h`;
    };

    // Upcoming (not yet happened)
    const upcomingAppointments = useMemo(() => {
        if (!dayIsToday) return dayAppointments;
        return dayAppointments.filter(
            (apt) => !isBefore(parseISO(apt.end_time), now)
        );
    }, [dayAppointments, dayIsToday, now]);

    return (
        <div className="hidden lg:flex lg:w-[270px] xl:w-[420px] shrink min-w-[100px] flex-col space-y-3 transition-all duration-300 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-1">
                <Lightbulb className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">
                    {dayIsToday ? "Preparação do Dia" : format(selectedDate, "EEEE", { locale: ptBR })}
                </h3>
            </div>

            {/* Overview Stats */}
            <Card className="p-4 glass border-border/40 shadow-sm">
                <p className="text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-3">
                    Visão Geral
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                        <p className="text-2xl font-black text-primary">
                            {String(totalMeetings).padStart(2, "0")}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">
                            Reuniões
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-black text-primary">
                            {formatTotalTime()}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">
                            Tempo Total
                        </p>
                    </div>
                </div>
            </Card>

            {/* Status breakdown */}
            {totalMeetings > 0 && (
                <Card className="p-4 glass border-border/40 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                        Status
                    </p>
                    <div className="space-y-2.5">
                        {confirmedCount > 0 && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-xs text-muted-foreground">
                                        Confirmados
                                    </span>
                                </div>
                                <span className="text-xs font-bold">{confirmedCount}</span>
                            </div>
                        )}
                        {pendingCount > 0 && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                                    <span className="text-xs text-muted-foreground">
                                        Pendentes
                                    </span>
                                </div>
                                <span className="text-xs font-bold">{pendingCount}</span>
                            </div>
                        )}
                        {completedCount > 0 && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                                    <span className="text-xs text-muted-foreground">
                                        Concluídos
                                    </span>
                                </div>
                                <span className="text-xs font-bold">{completedCount}</span>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Upcoming timeline */}
            {upcomingAppointments.length > 0 && (
                <Card className="p-4 glass border-border/40 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                        {dayIsToday ? "Próximos" : "Programados"}
                    </p>
                    <div className="space-y-3">
                        {upcomingAppointments.slice(0, 5).map((apt) => (
                            <div key={apt.id} className="flex items-start gap-3">
                                <div className="flex flex-col items-center shrink-0 mt-0.5">
                                    <Clock className="h-3 w-3 text-primary mb-0.5" />
                                    <div className="w-px h-full bg-border/50" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold">
                                        {format(parseISO(apt.start_time), "HH:mm")}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {apt.leads?.name || apt.title}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Empty day */}
            {totalMeetings === 0 && (
                <Card className="p-6 glass border-border/40 shadow-sm border-dashed">
                    <div className="flex flex-col items-center text-center">
                        <CalendarCheck className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm font-bold text-muted-foreground">
                            Agenda livre
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                            Nenhum compromisso agendado
                        </p>
                    </div>
                </Card>
            )}

            {/* AI Summary CTA */}
            <button className="w-full py-2.5 bg-card border border-border/40 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:shadow-sm transition-all flex items-center justify-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Resumo por IA
            </button>
        </div>
    );
};
