import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PROSPECT_CREDITS, ProspectAction, calculateCreditCost } from "@/lib/prospect-credits";

export interface ProspectCreditsData {
  id: string;
  balance: number;
  monthly_allocation: number;
  last_monthly_reset: string | null;
}

export function useProspectCredits() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: credits, isLoading, refetch } = useQuery({
    queryKey: ["prospect-credits", profile?.workspace_id],
    queryFn: async (): Promise<ProspectCreditsData | null> => {
      if (!profile?.workspace_id) return null;
      
      const { data, error } = await supabase
        .from("prospect_credits")
        .select("id, balance, monthly_allocation, last_monthly_reset")
        .eq("workspace_id", profile.workspace_id)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching prospect credits:", error);
        return null;
      }
      
      return data;
    },
    enabled: !!profile?.workspace_id,
  });

  /**
   * Verifica se há saldo suficiente para uma ação
   */
  const canAfford = (action: ProspectAction, quantity: number = 1): boolean => {
    const cost = calculateCreditCost(action, quantity);
    return (credits?.balance || 0) >= cost;
  };

  /**
   * Calcula custo de uma ação
   */
  const getCost = (action: ProspectAction, quantity: number = 1): number => {
    return calculateCreditCost(action, quantity);
  };

  /**
   * Debita créditos (chamado pelo backend, mas podemos usar para otimistic update)
   */
  const debitCredits = useMutation({
    mutationFn: async ({ amount, action, description }: { 
      amount: number; 
      action: string;
      description?: string;
    }) => {
      if (!profile?.workspace_id) throw new Error("No workspace");
      
      const { data, error } = await supabase.rpc("debit_prospect_credits", {
        p_workspace_id: profile.workspace_id,
        p_amount: amount,
        p_action: action,
        p_description: description || null,
      });
      
      if (error) throw error;
      return data as number; // Retorna novo saldo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect-credits", profile?.workspace_id] });
    },
  });

  return {
    balance: credits?.balance || 0,
    monthlyAllocation: credits?.monthly_allocation || 0,
    isLoading,
    refetch,
    canAfford,
    getCost,
    debitCredits,
    costs: PROSPECT_CREDITS.costs,
    packages: PROSPECT_CREDITS.packages,
  };
}
