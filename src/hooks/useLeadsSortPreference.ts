import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type LeadsSortOrder = "recent" | "alphabetical" | "score";

export const useLeadsSortPreference = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: sortOrder, isLoading } = useQuery({
    queryKey: ["leads_sort_preference", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return "recent" as LeadsSortOrder;

      const { data, error } = await supabase
        .from("system_config")
        .select("config_value")
        .eq("config_key", "leads_sort_order")
        .eq("workspace_id", profile.workspace_id)
        .maybeSingle();

      if (error) throw error;
      return (data?.config_value as { order: LeadsSortOrder })?.order || "recent";
    },
    enabled: !!profile?.workspace_id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: "recent" as LeadsSortOrder,
  });

  const updateSortOrder = useMutation({
    mutationFn: async (newOrder: LeadsSortOrder) => {
      if (!profile?.workspace_id) throw new Error("No workspace");

      const { error } = await supabase
        .from("system_config")
        .upsert(
          {
            config_key: "leads_sort_order",
            workspace_id: profile.workspace_id,
            config_value: { order: newOrder },
          },
          { onConflict: "config_key,workspace_id" }
        );

      if (error) throw error;
      return newOrder;
    },
    onMutate: async (newOrder) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["leads_sort_preference", profile?.workspace_id] });
      const previousOrder = queryClient.getQueryData(["leads_sort_preference", profile?.workspace_id]);
      queryClient.setQueryData(["leads_sort_preference", profile?.workspace_id], newOrder);
      return { previousOrder };
    },
    onError: (err, newOrder, context) => {
      queryClient.setQueryData(["leads_sort_preference", profile?.workspace_id], context?.previousOrder);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leads_sort_preference", profile?.workspace_id] });
    },
  });

  return {
    sortOrder: sortOrder || "recent",
    setSortOrder: (order: LeadsSortOrder) => updateSortOrder.mutate(order),
    isLoading,
  };
};
