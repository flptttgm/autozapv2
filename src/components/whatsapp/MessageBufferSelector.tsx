import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Info, Timer } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface MessageBufferSelectorProps {
    instanceId: string;
    currentBufferSeconds: number;
    onBufferChange?: () => void;
}

export function MessageBufferSelector({
    instanceId,
    currentBufferSeconds,
    onBufferChange,
}: MessageBufferSelectorProps) {
    const queryClient = useQueryClient();
    const [value, setValue] = useState(currentBufferSeconds);

    const updateBufferMutation = useMutation({
        mutationFn: async (seconds: number) => {
            const { error } = await supabase
                .from("whatsapp_instances")
                .update({ message_buffer_seconds: seconds } as any)
                .eq("id", instanceId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
            onBufferChange?.();
            toast.success(
                value === 0
                    ? "Buffer desativado — respostas imediatas"
                    : `Buffer configurado para ${value}s`
            );
        },
        onError: () => {
            toast.error("Erro ao atualizar buffer");
        },
    });

    const handleCommit = (newValue: number[]) => {
        const seconds = newValue[0];
        setValue(seconds);
        updateBufferMutation.mutate(seconds);
    };

    const getLabel = () => {
        if (value === 0) return "Desativado";
        return `${value}s`;
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm font-medium">Buffer de Mensagens</Label>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                    <strong>O que é:</strong> Tempo de espera antes da IA responder.
                                    <br /><br />
                                    Quando ativado, a IA aguarda o tempo configurado para acumular
                                    múltiplas mensagens consecutivas e responder tudo de uma vez,
                                    evitando respostas fragmentadas.
                                    <br /><br />
                                    <strong>0s:</strong> Resposta imediata a cada mensagem.
                                    <br />
                                    <strong>10-30s:</strong> Recomendado para conversas rápidas.
                                    <br />
                                    <strong>60-120s:</strong> Para quem envia muitas mensagens seguidas.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${value === 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/15 text-primary"
                    }`}>
                    {getLabel()}
                </span>
            </div>

            <Slider
                defaultValue={[currentBufferSeconds]}
                value={[value]}
                onValueChange={(v) => setValue(v[0])}
                onValueCommit={handleCommit}
                max={120}
                min={0}
                step={5}
                disabled={updateBufferMutation.isPending}
                className="w-full"
            />

            <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                <span>0s</span>
                <span>30s</span>
                <span>60s</span>
                <span>90s</span>
                <span>120s</span>
            </div>
        </div>
    );
}
