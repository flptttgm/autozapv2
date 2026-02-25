import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Hook that provides the current AI mode state and toggle functionality.
 * Used by the DashboardHeader to show the Seletivo/Todos toggle on the Conversations page.
 */
export function useAIMode() {
    const { profile } = useAuth();
    const queryClient = useQueryClient();

    // Fetch all whatsapp instances for this workspace
    const { data: instances } = useQuery({
        queryKey: ["whatsapp-instances", profile?.workspace_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("whatsapp_instances")
                .select("id, instance_id, status, ai_mode")
                .eq("workspace_id", profile!.workspace_id);

            if (error) throw error;
            return data || [];
        },
        enabled: !!profile?.workspace_id,
        staleTime: 30000,
    });

    // Only connected instances matter for AI mode
    const connectedInstances = useMemo(
        () => instances?.filter((i) => i.status === "connected") || [],
        [instances]
    );

    // Determine current AI mode
    const currentAIMode = useMemo(() => {
        const modes = connectedInstances.map((i) => i.ai_mode ?? "selective");
        if (modes.length === 0) return null;

        const allSame = modes.every((m) => m === modes[0]);
        if (allSame) return modes[0];

        return "mixed";
    }, [connectedInstances]);

    // Can toggle if there's exactly 1 connected instance
    const canToggleAIMode = connectedInstances.length === 1;

    // Mutation to toggle between "all" and "selective"
    const toggleMutation = useMutation({
        mutationFn: async () => {
            if (connectedInstances.length !== 1) throw new Error("Cannot toggle");

            const newMode = currentAIMode === "all" ? "selective" : "all";
            const uuid = connectedInstances[0].id;

            const { error } = await supabase
                .from("whatsapp_instances")
                .update({ ai_mode: newMode })
                .eq("id", uuid);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
            const newMode = currentAIMode === "all" ? "seletivo" : "todos";
            toast.success(`Modo da IA alterado para "${newMode}"`);
        },
        onError: (error: Error) => {
            console.error("Error toggling AI mode:", error);
            toast.error("Erro ao alterar modo da IA");
        },
    });

    return {
        currentAIMode,
        canToggleAIMode,
        toggleAIMode: toggleMutation.mutate,
        isToggling: toggleMutation.isPending,
    };
}
