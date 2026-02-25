import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarVisibility {
  appointments: boolean;
  quotes: boolean;
  invoices: boolean;
}

const DEFAULT_VISIBILITY: SidebarVisibility = {
  appointments: true,
  quotes: true,
  invoices: true,
};

export function useSidebarVisibility() {
  const { profile } = useAuth();
  const workspaceId = profile?.workspace_id;

  const { data, isLoading } = useQuery({
    queryKey: ["sidebar-visibility", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return DEFAULT_VISIBILITY;

      const { data } = await supabase
        .from("system_config")
        .select("config_value")
        .eq("workspace_id", workspaceId)
        .eq("config_key", "sidebar_pages_visibility")
        .maybeSingle();

      if (!data?.config_value) return DEFAULT_VISIBILITY;

      const configValue = data.config_value as Record<string, boolean>;
      return {
        appointments: configValue.appointments ?? true,
        quotes: configValue.quotes ?? true,
        invoices: configValue.invoices ?? true,
      };
    },
    enabled: !!workspaceId,
  });

  return {
    isAppointmentsVisible: data?.appointments ?? true,
    isQuotesVisible: data?.quotes ?? true,
    isInvoicesVisible: data?.invoices ?? true,
    isLoading,
  };
}
