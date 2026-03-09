import { useMemo, useState, useEffect, useCallback } from "react";
import { format, isSameDay, parseISO, isToday, isBefore, differenceInMinutes, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import {
    Lightbulb, CalendarCheck, Clock, Sparkles, Timer,
    CheckSquare, Square, Plus, X, StickyNote, Trash2, Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

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

interface ChecklistItem {
    id: string;
    text: string;
    done: boolean;
}

interface DayPreparationPanelProps {
    selectedDate: Date;
    appointments: Appointment[];
}



// ─── Greeting helper ────────────────────────────
const getGreeting = (): { text: string; emoji: string } => {
    const h = new Date().getHours();
    if (h < 12) return { text: "Bom dia", emoji: "☀️" };
    if (h < 18) return { text: "Boa tarde", emoji: "🌤️" };
    return { text: "Boa noite", emoji: "🌙" };
};

// ─── Countdown formatter ────────────────────────
const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return "agora";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
    if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
};

export const DayPreparationPanel = ({
    selectedDate,
    appointments,
}: DayPreparationPanelProps) => {
    const dayIsToday = isToday(selectedDate);
    const [now, setNow] = useState(new Date());
    const greeting = getGreeting();

    // Live clock tick (every second for countdown)
    useEffect(() => {
        if (!dayIsToday) return;
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, [dayIsToday]);

    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const formattedDate = format(selectedDate, "yyyy-MM-dd");

    // Fetch daily notes from Supabase
    const { data: dailyData } = useQuery({
        queryKey: ["daily-notes", profile?.workspace_id, formattedDate],
        queryFn: async () => {
            if (!profile?.workspace_id) return null;
            const { data, error } = await supabase
                .from("daily_notes")
                .select("*")
                .eq("workspace_id", profile.workspace_id)
                .eq("date", formattedDate)
                .maybeSingle();

            if (error) {
                console.error("Error fetching daily notes:", error);
                return null;
            }
            return data;
        },
        enabled: !!profile?.workspace_id,
    });

    // Update mutation
    const updateNotesMutation = useMutation({
        mutationFn: async (vars: { notes?: string, checklist?: ChecklistItem[] }) => {
            if (!profile?.workspace_id) return;
            const payload: any = {
                workspace_id: profile.workspace_id,
                date: formattedDate,
            };
            if (vars.notes !== undefined) payload.notes = vars.notes;
            if (vars.checklist !== undefined) payload.checklist = vars.checklist;

            const { error } = await supabase
                .from("daily_notes")
                .upsert(payload, { onConflict: "workspace_id,date" });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["daily-notes", profile?.workspace_id, formattedDate] });
        }
    });

    // ─── Notes state ──────────────────────────────
    const [notes, setNotes] = useState("");
    useEffect(() => {
        if (dailyData) setNotes(dailyData.notes || "");
        else setNotes(""); // Clear on date change when no data exists yet
    }, [dailyData, formattedDate]);

    // Save notes with debounce
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (notes !== (dailyData?.notes || "") && profile?.workspace_id) {
                updateNotesMutation.mutate({ notes });
            }
        }, 800);
        return () => clearTimeout(timeout);
    }, [notes, dailyData, profile?.workspace_id, updateNotesMutation, formattedDate]);

    // ─── Checklist state ──────────────────────────
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    useEffect(() => {
        if (dailyData) setChecklist((dailyData.checklist as any) || []);
        else setChecklist([]);
    }, [dailyData, formattedDate]);

    const [newItemText, setNewItemText] = useState("");
    const [showAddItem, setShowAddItem] = useState(false);

    const updateChecklistInDb = useCallback((newList: ChecklistItem[]) => {
        if (profile?.workspace_id) {
            updateNotesMutation.mutate({ checklist: newList });
        }
    }, [profile?.workspace_id, updateNotesMutation]);

    const addChecklistItem = useCallback(() => {
        if (!newItemText.trim()) return;
        const newList = [...checklist, { id: Date.now().toString(), text: newItemText.trim(), done: false }];
        setChecklist(newList);
        updateChecklistInDb(newList);
        setNewItemText("");
        setShowAddItem(false);
    }, [newItemText, checklist, updateChecklistInDb]);

    const toggleChecklistItem = useCallback((id: string) => {
        const newList = checklist.map(i => i.id === id ? { ...i, done: !i.done } : i);
        setChecklist(newList);
        updateChecklistInDb(newList);
    }, [checklist, updateChecklistInDb]);

    const removeChecklistItem = useCallback((id: string) => {
        const newList = checklist.filter(i => i.id !== id);
        setChecklist(newList);
        updateChecklistInDb(newList);
    }, [checklist, updateChecklistInDb]);

    // ─── Appointments data ────────────────────────
    const dayAppointments = useMemo(
        () => appointments.filter((apt) => isSameDay(parseISO(apt.start_time), selectedDate)),
        [appointments, selectedDate]
    );

    const totalMeetings = dayAppointments.length;
    const confirmedCount = dayAppointments.filter(a => a.status === "confirmed").length;
    const pendingCount = dayAppointments.filter(a => a.status === "pending_owner" || a.status === "pending_lead").length;
    const completedCount = dayAppointments.filter(a => a.status === "completed").length;

    const totalMinutes = useMemo(() => {
        return dayAppointments.reduce((acc, apt) => {
            const start = parseISO(apt.start_time);
            const end = parseISO(apt.end_time);
            return acc + (end.getTime() - start.getTime()) / 60000;
        }, 0);
    }, [dayAppointments]);

    // ─── AI Summary Logic ─────────────────────────
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);

    const generateAiSummary = async () => {
        try {
            setIsGeneratingAi(true);
            setShowAiModal(true);
            setAiSummary(null);

            const prompt = `Você é um assistente organizado de negócios. Gere um briefing rápido para o meu dia.
Hoje é: ${format(selectedDate, "dd/MM/yyyy")}

Aqui estão os agendamentos de hoje:
${dayAppointments.length > 0 ? dayAppointments.map(a => `- ${format(parseISO(a.start_time), 'HH:mm')} às ${format(parseISO(a.end_time), 'HH:mm')}: ${a.title} (Cliente: ${a.leads?.name || 'N/A'}, Status: ${a.status})`).join('\n') : 'Nenhum agendamento.'}

Checklist (Tarefas):
${checklist.length > 0 ? checklist.map(c => `- [${c.done ? 'x' : ' '}] ${c.text}`).join('\n') : 'Nenhuma tarefa.'}

Notas do Dia:
${notes || 'Sem notas.'}

O briefing deve ser cordial, encorajador, listando o foco principal do dia, pontuando os agendamentos importantes, e dando alguma dica com base nas tarefas ligando com os agendamentos. NUNCA repita essas informações como uma lista pura, entregue como texto explicativo e resumido como um executivo leria. Use formatação markdown simples.`;

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Usuário não autenticado");

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
            });

            if (!response.ok) {
                let errorData;
                try { errorData = await response.json(); } catch { errorData = null; }
                throw new Error(errorData?.error || "Falha na resposta da IA");
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("Nenhum dado recebido");

            const decoder = new TextDecoder();
            let textBuffer = "";
            let finalSummary = "";
            let streamDone = false;

            while (!streamDone) {
                const { done, value } = await reader.read();
                if (done) break;

                textBuffer += decoder.decode(value, { stream: true });

                let newlineIndex: number;
                while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
                    let line = textBuffer.slice(0, newlineIndex);
                    textBuffer = textBuffer.slice(newlineIndex + 1);

                    if (line.endsWith("\r")) line = line.slice(0, -1);
                    if (!line.startsWith("data: ")) continue;

                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === "[DONE]") { streamDone = true; break; }

                    try {
                        const parsed = JSON.parse(jsonStr);
                        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                        if (content) {
                            finalSummary += content;
                            setAiSummary(finalSummary);
                        }
                    } catch {
                        // Do not break here, just continue parsing next lines
                    }
                }
            }
        } catch (error) {
            console.error("Error generating AI summary:", error);
            toast.error("Erro ao gerar resumo da IA. Tente novamente.");
            setShowAiModal(false);
        } finally {
            setIsGeneratingAi(false);
        }
    };

    // ─── Render calculations ────────────────────────
    const formatTotalTime = () => {
        if (totalMinutes === 0) return "0min";
        const h = Math.floor(totalMinutes / 60);
        const m = Math.round(totalMinutes % 60);
        if (h === 0) return `${m}min`;
        return m > 0 ? `${h}h${m}` : `${h}h`;
    };

    // ─── Progress ─────────────────────────────────
    const progressPercent = totalMeetings > 0
        ? Math.round((completedCount / totalMeetings) * 100)
        : 0;

    // ─── Countdown to next ────────────────────────
    const nextAppointment = useMemo(() => {
        if (!dayIsToday) return null;
        const upcoming = dayAppointments
            .filter(apt => isBefore(now, parseISO(apt.start_time)))
            .sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime());
        return upcoming[0] || null;
    }, [dayAppointments, dayIsToday, now]);

    const countdownSeconds = useMemo(() => {
        if (!nextAppointment) return 0;
        return Math.max(0, differenceInSeconds(parseISO(nextAppointment.start_time), now));
    }, [nextAppointment, now]);

    // ─── Upcoming appointments ────────────────────
    const upcomingAppointments = useMemo(() => {
        if (!dayIsToday) return dayAppointments;
        return dayAppointments.filter(apt => !isBefore(parseISO(apt.end_time), now));
    }, [dayAppointments, dayIsToday, now]);

    // ─── Checklist progress ───────────────────────
    const checklistDone = checklist.filter(i => i.done).length;
    const checklistTotal = checklist.length;

    return (
        <div className="hidden lg:flex w-[270px] xl:w-[320px] shrink-0 flex-col transition-all duration-300 overflow-hidden">
            <ScrollArea className="flex-1">
                <div className="flex flex-col space-y-3 pr-2">
                    {/* ═══ Header ════════════════════════════ */}
                    <div className="flex items-center gap-2 px-1">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        <h3 className="font-bold text-sm">
                            {dayIsToday ? "Preparação do Dia" : format(selectedDate, "EEEE", { locale: ptBR })}
                        </h3>
                    </div>

                    {/* ═══ Overview + Progress ═════════════════ */}
                    <Card className="p-4 glass border-border/40 shadow-sm">
                        <p className="text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-3">
                            Visão Geral
                        </p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="text-center">
                                <p className="text-2xl font-black text-primary">
                                    {String(totalMeetings).padStart(2, "0")}
                                </p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Reuniões</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-black text-primary">{formatTotalTime()}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Tempo Total</p>
                            </div>
                        </div>
                        {/* Progress bar */}
                        {totalMeetings > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] text-muted-foreground font-medium">Progresso</span>
                                    <span className="text-[10px] font-bold text-primary">
                                        {completedCount}/{totalMeetings}
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-500"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* ═══ Countdown to next ═══════════════════ */}
                    {dayIsToday && nextAppointment && (() => {
                        const nextStart = parseISO(nextAppointment.start_time);
                        const nextEnd = parseISO(nextAppointment.end_time);
                        const durationMin = Math.round((nextEnd.getTime() - nextStart.getTime()) / 60000);
                        const durationLabel = durationMin >= 60
                            ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? durationMin % 60 + 'min' : ''}`
                            : `${durationMin}min`;
                        return (
                            <Card className="p-4 glass border-primary/20 shadow-sm bg-primary/5">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Timer className="h-3.5 w-3.5 text-primary animate-pulse" />
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                                            Próximo em
                                        </p>
                                    </div>
                                    <p className="text-sm font-black text-primary tabular-nums">
                                        {formatCountdown(countdownSeconds)}
                                    </p>
                                </div>
                                <div className="bg-background/50 rounded-lg p-3 space-y-1.5">
                                    <p className="text-sm font-bold truncate">
                                        {nextAppointment.title}
                                    </p>
                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {format(nextStart, "HH:mm")} - {format(nextEnd, "HH:mm")}
                                        </span>
                                        <span className="text-muted-foreground/60">•</span>
                                        <span>{durationLabel}</span>
                                    </div>
                                </div>
                            </Card>
                        );
                    })()}

                    {/* ═══ Status breakdown ═════════════════════ */}
                    {totalMeetings > 0 && (confirmedCount > 0 || pendingCount > 0 || completedCount > 0) && (
                        <Card className="p-4 glass border-border/40 shadow-sm">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                                Status
                            </p>
                            <div className="space-y-2.5">
                                {confirmedCount > 0 && (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-xs text-muted-foreground">Confirmados</span>
                                        </div>
                                        <span className="text-xs font-bold">{confirmedCount}</span>
                                    </div>
                                )}
                                {pendingCount > 0 && (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                                            <span className="text-xs text-muted-foreground">Pendentes</span>
                                        </div>
                                        <span className="text-xs font-bold">{pendingCount}</span>
                                    </div>
                                )}
                                {completedCount > 0 && (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                                            <span className="text-xs text-muted-foreground">Concluídos</span>
                                        </div>
                                        <span className="text-xs font-bold">{completedCount}</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}


                    {/* ═══ Checklist ════════════════════════════ */}
                    <Card className="p-4 glass border-border/40 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <CheckSquare className="h-3 w-3 text-primary" />
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Checklist
                                </p>
                                {checklistTotal > 0 && (
                                    <span className="text-[10px] text-primary font-bold">
                                        {checklistDone}/{checklistTotal}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAddItem(!showAddItem)}
                                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted/50 transition-colors"
                            >
                                <Plus className="h-3 w-3 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Add item input */}
                        {showAddItem && (
                            <div className="flex items-center gap-1.5 mb-2">
                                <input
                                    type="text"
                                    value={newItemText}
                                    onChange={(e) => setNewItemText(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                                    placeholder="Nova tarefa..."
                                    className="flex-1 min-w-0 bg-muted/30 border border-border/50 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    autoFocus
                                />
                                <button
                                    onClick={addChecklistItem}
                                    className="h-6 w-6 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/80 transition-colors shrink-0"
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            </div>
                        )}

                        {/* Checklist items */}
                        {checklist.length > 0 ? (
                            <div className="space-y-1.5">
                                {checklist.map(item => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-2 group"
                                    >
                                        <button
                                            onClick={() => toggleChecklistItem(item.id)}
                                            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            {item.done ? (
                                                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                            ) : (
                                                <Square className="h-3.5 w-3.5" />
                                            )}
                                        </button>
                                        <span
                                            className={cn(
                                                "text-xs flex-1 min-w-0 truncate transition-all",
                                                item.done && "line-through text-muted-foreground/50"
                                            )}
                                        >
                                            {item.text}
                                        </span>
                                        <button
                                            onClick={() => removeChecklistItem(item.id)}
                                            className="shrink-0 opacity-0 group-hover:opacity-100 h-4 w-4 flex items-center justify-center hover:text-destructive transition-all"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : !showAddItem && (
                            <p className="text-[10px] text-muted-foreground/50 text-center py-1">
                                Adicione tarefas para o dia
                            </p>
                        )}

                        {/* Checklist progress bar */}
                        {checklistTotal > 0 && (
                            <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden mt-3">
                                <div
                                    className="h-full bg-primary/60 rounded-full transition-all duration-300"
                                    style={{ width: `${(checklistDone / checklistTotal) * 100}%` }}
                                />
                            </div>
                        )}
                    </Card>

                    {/* ═══ Notes ═══════════════════════════════ */}
                    <Card className="p-4 glass border-border/40 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-2">
                            <StickyNote className="h-3 w-3 text-primary" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                Notas do Dia
                            </p>
                        </div>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Anote lembretes, ideias, metas..."
                            className="w-full min-h-[60px] max-h-[120px] bg-muted/20 border border-border/30 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                        />
                    </Card>

                    {/* ═══ Empty day ════════════════════════════ */}
                    {totalMeetings === 0 && (
                        <Card className="p-5 glass border-border/40 shadow-sm border-dashed">
                            <div className="flex flex-col items-center text-center">
                                <CalendarCheck className="h-7 w-7 text-muted-foreground/30 mb-2" />
                                <p className="text-sm font-bold text-muted-foreground">Agenda livre</p>
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                    Nenhum compromisso agendado
                                </p>
                            </div>
                        </Card>
                    )}

                    {/* ═══ AI Summary CTA ══════════════════════ */}
                    <button
                        onClick={generateAiSummary}
                        className="w-full py-2.5 bg-primary/10 border border-primary/20 rounded-xl text-xs font-bold text-primary hover:bg-primary/20 hover:shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Gerar Resumo por IA
                    </button>
                </div>
            </ScrollArea>

            {/* AI Summary Modal */}
            <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
                <DialogContent className="max-w-md p-0 overflow-hidden border-border/40 glass">
                    <DialogHeader className="px-5 pt-5 pb-3 bg-card/50 border-b border-border/40">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-base">Briefing do Dia</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Resumo inteligente para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {isGeneratingAi && !aiSummary ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                <Sparkles className="h-8 w-8 text-primary/50 animate-pulse" />
                                <div className="space-y-1 text-center">
                                    <p className="text-sm font-medium text-foreground">Analisando sua agenda...</p>
                                    <p className="text-xs text-muted-foreground">Cruzando reuniões, notas e tarefas para montar seu briefing ideal.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-p:text-sm prose-li:text-sm max-w-none prose-headings:text-base prose-headings:font-semibold prose-a:text-primary prose-strong:text-foreground">
                                <ReactMarkdown>{aiSummary || ""}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
