import { useMemo } from "react";
import {
    format,
    isToday,
    isBefore,
    isAfter,
    isSameDay,
    parseISO,
    addDays,
    getDay,
    differenceInMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AppointmentData } from "./WeeklyAppointmentCard";
import { Button } from "@/components/ui/button";
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    User,
    CalendarCheck,
    Phone,
    Mail,
    Star,
} from "lucide-react";
import { useAgendaConfig } from "@/components/settings/AgendaSettings";

interface Appointment {
    id: string;
    title: string;
    description?: string | null;
    start_time: string;
    end_time: string;
    status: string | null;
    leads?: {
        name: string | null;
        phone: string;
        avatar_url?: string | null;
        email?: string | null;
        status?: string | null;
        score?: number | null;
    } | null;
}

interface DailyViewProps {
    selectedDate: Date;
    appointments: Appointment[];
    onSelectDate: (date: Date) => void;
    onAppointmentClick?: (appointment: AppointmentData) => void;
}

const STATUS_COLORS: Record<string, { border: string; bg: string; dot: string; text: string; barColor: string }> = {
    pending_owner: { border: "border-orange-400/50", bg: "bg-orange-500/5", dot: "bg-orange-500", text: "text-orange-600", barColor: "bg-orange-400" },
    pending_lead: { border: "border-purple-400/50", bg: "bg-purple-500/5", dot: "bg-purple-500", text: "text-purple-600", barColor: "bg-purple-400" },
    scheduled: { border: "border-sky-400/50", bg: "bg-sky-500/5", dot: "bg-sky-500", text: "text-sky-600", barColor: "bg-sky-400" },
    confirmed: { border: "border-emerald-400/50", bg: "bg-emerald-500/5", dot: "bg-emerald-500", text: "text-emerald-600", barColor: "bg-emerald-400" },
    completed: { border: "border-slate-400/50", bg: "bg-slate-500/5", dot: "bg-slate-400", text: "text-slate-500", barColor: "bg-slate-400" },
    rescheduled: { border: "border-amber-400/50", bg: "bg-amber-500/5", dot: "bg-amber-500", text: "text-amber-600", barColor: "bg-amber-400" },
    rejected: { border: "border-rose-400/50", bg: "bg-rose-500/5", dot: "bg-rose-400", text: "text-rose-500", barColor: "bg-rose-400" },
};

const STATUS_LABELS: Record<string, string> = {
    pending_owner: "Aguardando Aprovação",
    pending_lead: "Aguardando Cliente",
    scheduled: "Agendado",
    confirmed: "Confirmado",
    completed: "Concluído",
    rescheduled: "Reagendado",
    rejected: "Recusado",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
    new: "Novo",
    contacted: "Contatado",
    qualified: "Qualificado",
    negotiating: "Em Negociação",
    converted: "Convertido",
    lost: "Perdido",
};

export const DailyView = ({
    selectedDate,
    appointments,
    onSelectDate,
    onAppointmentClick,
}: DailyViewProps) => {
    const { data: agendaConfig } = useAgendaConfig();
    const now = new Date();
    const dayIsToday = isToday(selectedDate);

    // Generate nearby days for the mini day strip
    const nearbyDays = useMemo(() => {
        const days = [];
        for (let i = -2; i <= 4; i++) {
            const day = addDays(selectedDate, i);
            const dow = getDay(day);
            if (dow === 0 && !agendaConfig?.show_sunday) continue;
            if (dow === 6 && !agendaConfig?.show_saturday) continue;
            days.push(day);
        }
        return days;
    }, [selectedDate, agendaConfig]);

    // Sort and categorize appointments for the selected day
    const { upcoming, later, past } = useMemo(() => {
        const dayAppts = appointments.filter((apt) =>
            isSameDay(parseISO(apt.start_time), selectedDate)
        );
        const sorted = [...dayAppts].sort(
            (a, b) =>
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        if (!dayIsToday) {
            return { upcoming: sorted, later: [], past: [] };
        }

        const pastItems: Appointment[] = [];
        const upcomingItems: Appointment[] = [];
        const laterItems: Appointment[] = [];

        sorted.forEach((apt) => {
            const end = parseISO(apt.end_time);
            const start = parseISO(apt.start_time);

            if (isBefore(end, now)) {
                pastItems.push(apt);
            } else if (
                isBefore(start, now) ||
                differenceInMinutes(start, now) <= 60
            ) {
                upcomingItems.push(apt);
            } else {
                laterItems.push(apt);
            }
        });

        return { upcoming: upcomingItems, later: laterItems, past: pastItems };
    }, [appointments, dayIsToday, now, selectedDate]);

    const goToPreviousDay = () => onSelectDate(addDays(selectedDate, -1));
    const goToNextDay = () => onSelectDate(addDays(selectedDate, 1));

    const formatDuration = (startStr: string, endStr: string) => {
        const mins = differenceInMinutes(parseISO(endStr), parseISO(startStr));
        if (mins < 60) return `${mins} min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m}min` : `${h}h`;
    };

    const getInitials = (name: string | null) => {
        if (!name) return "?";
        return name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    };

    const renderAppointmentCard = (
        apt: Appointment,
        isNext: boolean = false
    ) => {
        const colors =
            STATUS_COLORS[apt.status || "scheduled"] || STATUS_COLORS.scheduled;
        const statusLabel = STATUS_LABELS[apt.status || "scheduled"] || apt.status;
        const startTime = format(parseISO(apt.start_time), "HH:mm");
        const endTime = format(parseISO(apt.end_time), "HH:mm");
        const duration = formatDuration(apt.start_time, apt.end_time);
        const leadStatusLabel = apt.leads?.status
            ? LEAD_STATUS_LABELS[apt.leads.status] || apt.leads.status
            : null;

        return (
            <button
                key={apt.id}
                onClick={() =>
                    onAppointmentClick?.({
                        ...apt,
                        leads: apt.leads || undefined,
                    } as AppointmentData)
                }
                className={cn(
                    "w-full text-left rounded-2xl border transition-all duration-300 overflow-hidden group",
                    isNext
                        ? "border-primary/40 bg-card shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10"
                        : cn("hover:shadow-md", colors.border, "bg-card")
                )}
            >
                <div className="flex">
                    {/* Color indicator bar */}
                    <div
                        className={cn(
                            "w-1.5 shrink-0",
                            isNext ? "bg-primary" : colors.barColor
                        )}
                    />

                    <div className="flex-1 p-4 sm:p-5">
                        {/* Next badge */}
                        {isNext && (
                            <span className="inline-block px-2.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded uppercase tracking-wider mb-3">
                                Próximo
                            </span>
                        )}

                        <div className="flex gap-4">
                            {/* Lead photo/avatar */}
                            <div className="shrink-0">
                                {apt.leads?.avatar_url ? (
                                    <img
                                        src={apt.leads.avatar_url}
                                        alt={apt.leads?.name || "Lead"}
                                        className={cn(
                                            "rounded-xl object-cover border",
                                            isNext ? "w-14 h-14 border-primary/20" : "w-11 h-11 border-border/40"
                                        )}
                                    />
                                ) : (
                                    <div
                                        className={cn(
                                            "rounded-xl flex items-center justify-center font-bold text-primary-foreground",
                                            isNext
                                                ? "w-14 h-14 text-lg bg-primary/80"
                                                : "w-11 h-11 text-sm bg-muted-foreground/30"
                                        )}
                                    >
                                        {getInitials(apt.leads?.name || apt.title)}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        {/* Lead name */}
                                        <h4
                                            className={cn(
                                                "font-bold truncate",
                                                isNext ? "text-lg" : "text-base"
                                            )}
                                        >
                                            {apt.leads?.name || apt.title}
                                        </h4>

                                        {/* Title / description as subtitle */}
                                        {apt.leads?.name && (
                                            <p className="text-sm text-muted-foreground truncate">
                                                {apt.title}
                                            </p>
                                        )}
                                    </div>

                                    {/* Status label */}
                                    {apt.status && apt.status !== "scheduled" && (
                                        <span
                                            className={cn(
                                                "shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                colors.bg,
                                                colors.text
                                            )}
                                        >
                                            {statusLabel}
                                        </span>
                                    )}
                                </div>

                                {/* Time info */}
                                <div
                                    className={cn(
                                        "flex items-center gap-1.5 text-sm font-medium mt-1.5",
                                        isNext ? "text-primary" : "text-muted-foreground"
                                    )}
                                >
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>
                                        {startTime} - {endTime}
                                    </span>
                                    <span className="text-xs font-normal text-muted-foreground">
                                        ({duration})
                                    </span>
                                </div>

                                {/* Lead details row */}
                                {apt.leads && (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                                        {apt.leads.phone && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Phone className="h-3 w-3" />
                                                <span>{apt.leads.phone}</span>
                                            </div>
                                        )}
                                        {apt.leads.email && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Mail className="h-3 w-3" />
                                                <span className="truncate max-w-[180px]">
                                                    {apt.leads.email}
                                                </span>
                                            </div>
                                        )}
                                        {leadStatusLabel && (
                                            <span className="px-1.5 py-0.5 bg-muted/50 text-muted-foreground text-[10px] rounded font-medium">
                                                {leadStatusLabel}
                                            </span>
                                        )}
                                        {apt.leads.score != null && apt.leads.score > 0 && (
                                            <div className="flex items-center gap-0.5 text-xs text-amber-500">
                                                <Star className="h-3 w-3 fill-amber-500" />
                                                <span className="font-medium">{apt.leads.score}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Description for next appointment */}
                                {apt.description && isNext && (
                                    <p className="mt-2.5 text-sm text-muted-foreground line-clamp-2 italic">
                                        "{apt.description}"
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </button>
        );
    };

    const renderSection = (
        title: string,
        items: Appointment[],
        showNext: boolean = false
    ) => {
        if (items.length === 0) return null;
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                        {title}
                    </span>
                    <div className="h-px w-full bg-border/50" />
                </div>
                <div className="space-y-3">
                    {items.map((apt, i) =>
                        renderAppointmentCard(apt, showNext && i === 0)
                    )}
                </div>
            </div>
        );
    };

    const allAppointments = [...past, ...upcoming, ...later];

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-card">
            {/* Header: Date + Navigation + Mini day strip */}
            <div className="border-b border-border/30 px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-2">
                    {/* Date + nav */}
                    <div className="flex items-center gap-2 shrink-0">
                        <h2 className="text-base font-bold text-foreground whitespace-nowrap">
                            {dayIsToday ? "Hoje, " : ""}
                            {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                        </h2>
                        <div className="flex items-center gap-0.5">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={goToPreviousDay}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={goToNextDay}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* Mini day strip */}
                    <div className="hidden sm:flex items-center gap-0.5 overflow-hidden">
                        {nearbyDays.map((day) => {
                            const isSelected =
                                format(day, "yyyy-MM-dd") ===
                                format(selectedDate, "yyyy-MM-dd");
                            const isDayToday = isToday(day);
                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => onSelectDate(day)}
                                    className={cn(
                                        "flex flex-col items-center px-1.5 py-1 rounded-lg transition-all duration-200 shrink-0",
                                        isSelected
                                            ? "bg-primary/10 border border-primary/20"
                                            : "hover:bg-muted/50"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "text-[10px] font-bold uppercase",
                                            isSelected
                                                ? "text-primary/70"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {format(day, "EEE", { locale: ptBR })}
                                    </span>
                                    <span
                                        className={cn(
                                            "text-sm font-bold",
                                            isSelected
                                                ? "text-primary"
                                                : isDayToday
                                                    ? "text-primary"
                                                    : "text-muted-foreground"
                                        )}
                                    >
                                        {format(day, "dd")}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Appointments list */}
            <div
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
                style={{ scrollbarGutter: "stable" }}
            >
                {allAppointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-dashed border-border flex items-center justify-center mb-4">
                            <CalendarCheck className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <h4 className="font-bold text-muted-foreground">Agenda livre</h4>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                            Nenhum agendamento para{" "}
                            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </p>
                    </div>
                ) : dayIsToday ? (
                    <>
                        {renderSection("Passados", past)}
                        {renderSection(
                            upcoming.length > 0 ? `Agora` : "",
                            upcoming,
                            true
                        )}
                        {renderSection("Mais tarde hoje", later)}
                    </>
                ) : (
                    <div className="space-y-3">
                        {allAppointments.map((apt, i) =>
                            renderAppointmentCard(
                                apt,
                                i === 0 && isAfter(parseISO(apt.start_time), now)
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
