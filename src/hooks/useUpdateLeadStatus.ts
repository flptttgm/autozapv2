import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const LEAD_STATUS_OPTIONS = [
    { value: "new", label: "Novo" },
    { value: "contacted", label: "Contatado" },
    { value: "qualified", label: "Qualificado" },
    { value: "proposal", label: "Proposta" },
    { value: "negotiation", label: "Negociação" },
    { value: "won", label: "Fechado" },
    { value: "lost", label: "Perdido" },
] as const;

export type LeadStatus = (typeof LEAD_STATUS_OPTIONS)[number]["value"];

export const useUpdateLeadStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            leadId,
            newStatus,
        }: {
            leadId: string;
            newStatus: string;
        }) => {
            const { error } = await supabase
                .from("leads")
                .update({ status: newStatus as any })
                .eq("id", leadId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            queryClient.invalidateQueries({ queryKey: ["leads-count"] });
            queryClient.invalidateQueries({ queryKey: ["leads-counts"] });
            queryClient.invalidateQueries({ queryKey: ["sales-funnel"] });
            queryClient.invalidateQueries({ queryKey: ["leads-status"] });
            queryClient.invalidateQueries({ queryKey: ["lead"] });
            toast.success("Status atualizado com sucesso!");
        },
        onError: () => {
            toast.error("Erro ao atualizar status");
        },
    });
};
