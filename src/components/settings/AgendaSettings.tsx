import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, Clock, Loader2 } from "lucide-react";

export interface AgendaConfig {
    show_saturday: boolean;
    show_sunday: boolean;
    start_hour: number;
    end_hour: number;
}

const DEFAULT_AGENDA_CONFIG: AgendaConfig = {
    show_saturday: true,
    show_sunday: false,
    start_hour: 7,
    end_hour: 21,
};

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0-24

export const useAgendaConfig = () => {
    const { profile } = useAuth();
    const workspaceId = profile?.workspace_id;

    return useQuery({
        queryKey: ["agenda-config", workspaceId],
        queryFn: async () => {
            if (!workspaceId) return DEFAULT_AGENDA_CONFIG;

            const { data, error } = await supabase
                .from("workspaces" as any)
                .select("settings")
                .eq("id", workspaceId)
                .single();

            if (error) throw error;

            const settings = (data?.settings as Record<string, any>) || {};
            return {
                show_saturday: settings.agenda_show_saturday ?? DEFAULT_AGENDA_CONFIG.show_saturday,
                show_sunday: settings.agenda_show_sunday ?? DEFAULT_AGENDA_CONFIG.show_sunday,
                start_hour: settings.agenda_start_hour ?? DEFAULT_AGENDA_CONFIG.start_hour,
                end_hour: settings.agenda_end_hour ?? DEFAULT_AGENDA_CONFIG.end_hour,
            } as AgendaConfig;
        },
        enabled: !!workspaceId,
    });
};

export const AgendaSettings = () => {
    const { profile } = useAuth();
    const workspaceId = profile?.workspace_id;
    const queryClient = useQueryClient();

    const { data: config, isLoading } = useAgendaConfig();

    const [showSaturday, setShowSaturday] = useState(DEFAULT_AGENDA_CONFIG.show_saturday);
    const [showSunday, setShowSunday] = useState(DEFAULT_AGENDA_CONFIG.show_sunday);
    const [startHour, setStartHour] = useState(DEFAULT_AGENDA_CONFIG.start_hour);
    const [endHour, setEndHour] = useState(DEFAULT_AGENDA_CONFIG.end_hour);

    useEffect(() => {
        if (config) {
            setShowSaturday(config.show_saturday);
            setShowSunday(config.show_sunday);
            setStartHour(config.start_hour);
            setEndHour(config.end_hour);
        }
    }, [config]);

    const updateMutation = useMutation({
        mutationFn: async (updates: Partial<AgendaConfig>) => {
            if (!workspaceId) throw new Error("Workspace não encontrado");

            // Fetch current settings first
            const { data: current } = await supabase
                .from("workspaces" as any)
                .select("settings")
                .eq("id", workspaceId)
                .single();

            const currentSettings = (current?.settings as Record<string, any>) || {};

            const newSettings = {
                ...currentSettings,
                ...(updates.show_saturday !== undefined && { agenda_show_saturday: updates.show_saturday }),
                ...(updates.show_sunday !== undefined && { agenda_show_sunday: updates.show_sunday }),
                ...(updates.start_hour !== undefined && { agenda_start_hour: updates.start_hour }),
                ...(updates.end_hour !== undefined && { agenda_end_hour: updates.end_hour }),
            };

            const { error } = await supabase
                .from("workspaces" as any)
                .update({ settings: newSettings })
                .eq("id", workspaceId);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Configurações da agenda atualizadas!");
            queryClient.invalidateQueries({ queryKey: ["agenda-config"] });
        },
        onError: (error) => {
            toast.error("Erro ao salvar: " + (error instanceof Error ? error.message : "Erro desconhecido"));
        },
    });

    const handleToggleSaturday = (checked: boolean) => {
        setShowSaturday(checked);
        updateMutation.mutate({ show_saturday: checked });
    };

    const handleToggleSunday = (checked: boolean) => {
        setShowSunday(checked);
        updateMutation.mutate({ show_sunday: checked });
    };

    const handleStartHourChange = (value: string) => {
        const hour = parseInt(value);
        setStartHour(hour);
        updateMutation.mutate({ start_hour: hour });
    };

    const handleEndHourChange = (value: string) => {
        const hour = parseInt(value);
        setEndHour(hour);
        updateMutation.mutate({ end_hour: hour });
    };

    if (isLoading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse h-32 bg-muted rounded"></div>
            </Card>
        );
    }

    const formatHour = (h: number) => `${h.toString().padStart(2, "0")}:00`;

    return (
        <Card className="p-6 relative">
            {updateMutation.isPending && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Salvando...</span>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold">Agenda</h2>
                    <p className="text-sm text-muted-foreground">
                        Configure os dias visíveis e horário de atendimento
                    </p>
                </div>
            </div>

            {/* Days visibility */}
            <div className="space-y-4">
                <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
                        Dias visíveis
                    </p>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">Sábado</span>
                            </div>
                            <Switch
                                checked={showSaturday}
                                onCheckedChange={handleToggleSaturday}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">Domingo</span>
                            </div>
                            <Switch
                                checked={showSunday}
                                onCheckedChange={handleToggleSunday}
                            />
                        </div>
                    </div>
                </div>

                {/* Working hours */}
                <div className="pt-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
                        Horário de atendimento
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Início
                            </Label>
                            <Select value={startHour.toString()} onValueChange={handleStartHourChange}>
                                <SelectTrigger className="h-11 bg-muted/30 border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {HOURS.filter(h => h < endHour).map((h) => (
                                        <SelectItem key={h} value={h.toString()}>
                                            {formatHour(h)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Fim
                            </Label>
                            <Select value={endHour.toString()} onValueChange={handleEndHourChange}>
                                <SelectTrigger className="h-11 bg-muted/30 border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {HOURS.filter(h => h > startHour).map((h) => (
                                        <SelectItem key={h} value={h.toString()}>
                                            {formatHour(h)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                        A agenda exibirá horários de <strong>{formatHour(startHour)}</strong> até <strong>{formatHour(endHour - 1)}:30</strong>
                    </p>
                </div>
            </div>
        </Card>
    );
};
