import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Info, Megaphone, Target, AlertTriangle, BookOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface AIModeSelectorProps {
  instanceId: string;
  workspaceId: string;
  currentMode: "all" | "selective";
  onModeChange?: () => void;
}

export function AIModeSelector({
  instanceId,
  workspaceId,
  currentMode,
  onModeChange,
}: AIModeSelectorProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"all" | "selective">(currentMode);
  const [showKBWarning, setShowKBWarning] = useState(false);

  // Query to check if KB has any ready items
  const { data: kbStats } = useQuery({
    queryKey: ["kb-ready-count", workspaceId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("knowledge_base")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .eq("embedding_status", "completed");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });

  const hasConfiguredKB = (kbStats ?? 0) >= 1;

  const updateModeMutation = useMutation({
    mutationFn: async (newMode: string) => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ ai_mode: newMode })
        .eq("id", instanceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      onModeChange?.();
      toast.success(mode === "selective"
        ? "Modo seletivo ativado"
        : "Modo todos ativado"
      );
    },
    onError: () => {
      toast.error("Erro ao atualizar modo");
    },
  });

  const handleModeChange = (newMode: "all" | "selective") => {
    // Intercept when trying to activate "all" without KB
    if (newMode === "all" && !hasConfiguredKB) {
      setShowKBWarning(true);
      return;
    }

    setMode(newMode);
    updateModeMutation.mutate(newMode);
  };

  const handleForceActivateAll = () => {
    setShowKBWarning(false);
    setMode("all");
    updateModeMutation.mutate("all");
    toast.warning("Modo 'Todos' ativado sem base de conhecimento. A IA pode dar respostas genéricas.");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Modo da IA</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>Todos:</strong> IA responde todas as conversas.
                <br />
                <strong>Seletivo:</strong> IA só responde leads com "IA pode responder" ativado.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === "all" ? "default" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => handleModeChange("all")}
          disabled={updateModeMutation.isPending}
        >
          <Megaphone className="h-4 w-4" />
          Todos
        </Button>

        <Button
          variant={mode === "selective" ? "default" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => handleModeChange("selective")}
          disabled={updateModeMutation.isPending}
        >
          <Target className="h-4 w-4" />
          Seletivo
        </Button>
      </div>

      {mode === "selective" && (
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠️ A IA responderá apenas leads que possuem "IA pode responder" ativado.
          </p>
        </div>
      )}

      {/* KB Warning AlertDialog */}
      <AlertDialog open={showKBWarning} onOpenChange={setShowKBWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Base de Conhecimento Vazia
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você ainda não configurou sua <strong>Base de Conhecimento</strong>.
                  Sem ela, a IA não terá informações sobre seu negócio e pode dar respostas genéricas ou incorretas.
                </p>
                <p className="text-sm text-muted-foreground">
                  Recomendamos adicionar pelo menos FAQs básicos sobre sua empresa, serviços e preços antes de ativar o modo "Todos".
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:gap-3">
            <AlertDialogAction
              onClick={() => navigate("/ai-settings?tab=knowledge")}
              className="w-full"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Configurar Base de Conhecimento
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault();
                handleForceActivateAll();
              }}
              className="w-full border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
            >
              Ativar mesmo assim
            </AlertDialogCancel>
            <AlertDialogCancel className="w-full">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
