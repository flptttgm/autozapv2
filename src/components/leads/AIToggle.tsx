import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIToggleProps {
  leadId: string;
  initialValue: boolean;
  size?: "sm" | "lg";
  showLabel?: boolean;
  onToggle?: (newValue: boolean) => void;
}

export function AIToggle({ 
  leadId, 
  initialValue, 
  size = "sm",
  showLabel = true,
  onToggle 
}: AIToggleProps) {
  const queryClient = useQueryClient();
  const [isEnabled, setIsEnabled] = useState(initialValue);

  // Sync state with prop when it changes (e.g., after refetch)
  useEffect(() => {
    setIsEnabled(initialValue);
  }, [initialValue]);

  const toggleMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const { error } = await supabase
        .from("leads")
        .update({ ai_enabled: newValue })
        .eq("id", leadId);
      
      if (error) throw error;
      return newValue;
    },
    onSuccess: (newValue) => {
      setIsEnabled(newValue);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      onToggle?.(newValue);
      toast.success(
        newValue 
          ? "IA ativada para este contato" 
          : "IA desativada para este contato"
      );
    },
    onError: () => {
      toast.error("Erro ao atualizar configuração");
    },
  });

  const handleToggle = (checked: boolean) => {
    console.log('[AIToggle] Toggling ai_enabled:', { leadId, from: isEnabled, to: checked });
    toggleMutation.mutate(checked);
  };

  const isSmall = size === "sm";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "flex items-center gap-2",
              isSmall ? "gap-1.5" : "gap-3"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {toggleMutation.isPending ? (
              <Loader2 className={cn(
                "animate-spin text-muted-foreground",
                isSmall ? "h-3 w-3" : "h-4 w-4"
              )} />
            ) : (
              <Bot className={cn(
                isEnabled ? "text-primary" : "text-muted-foreground/50",
                isSmall ? "h-3.5 w-3.5" : "h-5 w-5",
                "transition-colors"
              )} />
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={toggleMutation.isPending}
              className={cn(
                isSmall && "scale-75 origin-left"
              )}
            />
            {showLabel && !isSmall && (
              <Label className="text-sm cursor-pointer select-none">
                IA pode responder
              </Label>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">
            {isEnabled 
              ? "IA ativada: a IA pode responder este contato"
              : "IA desativada: a IA não responderá este contato (no modo Todos)"
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}