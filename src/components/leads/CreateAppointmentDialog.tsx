import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Calendar,
    Clock,
    FileText,
    MapPin,
    Tag,
    Sparkles,
    CalendarPlus,
    Video,
    Phone,
    Users,
    Coffee,
    Briefcase,
    Presentation,
    Stethoscope,
    GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { format, addHours, setHours, setMinutes } from "date-fns";

interface CreateAppointmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leadId: string;
    leadName: string | null;
    workspaceId: string;
}

const APPOINTMENT_TYPES = [
    { id: "meeting", label: "Reunião", shortLabel: "Reunião", icon: Users, color: "bg-blue-500" },
    { id: "call", label: "Ligação", shortLabel: "Ligação", icon: Phone, color: "bg-green-500" },
    { id: "video", label: "Videochamada", shortLabel: "Vídeo", icon: Video, color: "bg-purple-500" },
    { id: "consultation", label: "Consulta", shortLabel: "Consulta", icon: Stethoscope, color: "bg-red-500" },
    { id: "coffee", label: "Café", shortLabel: "Café", icon: Coffee, color: "bg-amber-500" },
    { id: "presentation", label: "Apresentação", shortLabel: "Apresent.", icon: Presentation, color: "bg-cyan-500" },
    { id: "training", label: "Treinamento", shortLabel: "Treino", icon: GraduationCap, color: "bg-indigo-500" },
];

const DURATION_OPTIONS = [
    { label: "15 min", minutes: 15 },
    { label: "30 min", minutes: 30 },
    { label: "45 min", minutes: 45 },
    { label: "1h", minutes: 60 },
    { label: "1h 30m", minutes: 90 },
    { label: "2h", minutes: 120 },
];

export function CreateAppointmentDialog({
    open,
    onOpenChange,
    leadId,
    leadName,
    workspaceId,
}: CreateAppointmentDialogProps) {
    const queryClient = useQueryClient();

    // Form state
    const [selectedType, setSelectedType] = useState("meeting");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [time, setTime] = useState(
        format(addHours(setMinutes(new Date(), 0), 1), "HH:mm")
    );
    const [duration, setDuration] = useState(60);
    const [location, setLocation] = useState("");

    const resetForm = () => {
        setSelectedType("meeting");
        setTitle("");
        setDescription("");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setTime(format(addHours(setMinutes(new Date(), 0), 1), "HH:mm"));
        setDuration(60);
        setLocation("");
    };

    const createAppointmentMutation = useMutation({
        mutationFn: async () => {
            const startTime = new Date(`${date}T${time}:00`);
            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

            const typeInfo = APPOINTMENT_TYPES.find((t) => t.id === selectedType);
            const finalTitle =
                title.trim() ||
                `${typeInfo?.label || "Reunião"} com ${leadName || "contato"}`;

            const { error } = await supabase.from("appointments").insert({
                workspace_id: workspaceId,
                lead_id: leadId,
                title: finalTitle,
                description: description.trim() || null,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                status: "scheduled" as any,
                metadata: {
                    type: selectedType,
                    location: location.trim() || null,
                    created_manually: true,
                },
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead-appointments", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-timeline", leadId] });
            toast.success("Agendamento criado com sucesso!");
            resetForm();
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error("Erro ao criar agendamento: " + err.message);
        },
    });

    const selectedTypeInfo = APPOINTMENT_TYPES.find((t) => t.id === selectedType);

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) resetForm();
                onOpenChange(v);
            }}
        >
            <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 overflow-hidden border-border/50 max-h-[90vh] overflow-y-auto">
                {/* Header com gradiente */}
                <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <DialogHeader className="relative">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                                <CalendarPlus className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg">Novo Agendamento</DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Agendar para{" "}
                                    <span className="font-medium text-foreground">
                                        {leadName || "contato"}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="px-6 pb-6 space-y-5">
                    {/* Tipo de agendamento */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Tipo
                        </Label>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                            {APPOINTMENT_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isSelected = selectedType === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setSelectedType(type.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden",
                                            isSelected
                                                ? "border-primary bg-primary/10 shadow-sm shadow-primary/10 scale-[1.02]"
                                                : "border-border/50 bg-card hover:border-border hover:bg-muted/50"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                                                isSelected
                                                    ? `${type.color} text-white`
                                                    : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <span
                                            className={cn(
                                                "text-[9px] font-medium leading-tight text-center w-full truncate",
                                                isSelected
                                                    ? "text-foreground"
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            {type.shortLabel}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Título */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Título
                        </Label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={`${selectedTypeInfo?.label || "Reunião"} com ${leadName || "contato"}`}
                                className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                            />
                        </div>
                    </div>

                    {/* Data e Hora */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                Data
                            </Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    min={format(new Date(), "yyyy-MM-dd")}
                                    className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                Horário
                            </Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Duração */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Duração
                        </Label>
                        <div className="grid grid-cols-6 gap-2">
                            {DURATION_OPTIONS.map((opt) => (
                                <button
                                    key={opt.minutes}
                                    type="button"
                                    onClick={() => setDuration(opt.minutes)}
                                    className={cn(
                                        "py-2 px-1 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer",
                                        duration === opt.minutes
                                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                                            : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/50"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Local */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Local{" "}
                            <span className="text-[10px] normal-case tracking-normal">
                                (opcional)
                            </span>
                        </Label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Ex: Escritório, Google Meet, Zoom..."
                                className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                            />
                        </div>
                    </div>

                    {/* Observações */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Observações{" "}
                            <span className="text-[10px] normal-case tracking-normal">
                                (opcional)
                            </span>
                        </Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Adicione detalhes sobre o agendamento..."
                            className="min-h-[80px] resize-none bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                        />
                    </div>

                    {/* Resumo preview */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                        <div
                            className={cn(
                                "h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0",
                                selectedTypeInfo?.color || "bg-blue-500"
                            )}
                        >
                            {selectedTypeInfo && <selectedTypeInfo.icon className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {title.trim() ||
                                    `${selectedTypeInfo?.label || "Reunião"} com ${leadName || "contato"}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {date
                                    ? format(new Date(`${date}T12:00:00`), "dd/MM/yyyy")
                                    : "--/--/----"}{" "}
                                às {time || "--:--"} •{" "}
                                {DURATION_OPTIONS.find((d) => d.minutes === duration)?.label ||
                                    `${duration}min`}
                                {location && ` • ${location}`}
                            </p>
                        </div>
                        <Sparkles className="h-4 w-4 text-primary/50 shrink-0" />
                    </div>

                    {/* Ações */}
                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="outline"
                            className="flex-1 h-11"
                            onClick={() => {
                                resetForm();
                                onOpenChange(false);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 h-11 gap-2 bg-primary hover:bg-primary/90"
                            onClick={() => createAppointmentMutation.mutate()}
                            disabled={createAppointmentMutation.isPending || !date || !time}
                        >
                            {createAppointmentMutation.isPending ? (
                                "Criando..."
                            ) : (
                                <>
                                    <CalendarPlus className="h-4 w-4" />
                                    Agendar
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
