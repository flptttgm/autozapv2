import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConnectedWhatsAppInstance = {
  id: string;
  instance_id: string;
  phone: string | null;
  status: string | null;
  display_name: string | null;
  ai_template_id: string | null;
};

export function useConnectedWhatsAppInstances(workspaceId?: string) {
  const query = useQuery({
    queryKey: ["whatsapp-instances-connected", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as ConnectedWhatsAppInstance[];

      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_id, phone, status, display_name, ai_template_id")
        .eq("workspace_id", workspaceId)
        .eq("status", "connected");

      if (error) throw error;
      return (data || []) as ConnectedWhatsAppInstance[];
    },
    enabled: !!workspaceId,
  });

  const instances = query.data ?? [];

  return {
    instances,
    connectedCount: instances.length,
    isLoading: query.isLoading,
    error: query.error,
  };
}
