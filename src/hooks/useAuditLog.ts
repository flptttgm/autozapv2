import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

interface AuditLogEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  changes_summary?: string;
}

export const useAuditLog = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-for-audit", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("workspace_id, full_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const logChange = async (entry: AuditLogEntry) => {
    if (!user?.id || !profile?.workspace_id) {
      console.warn("Cannot log audit: missing user or workspace");
      return;
    }

    try {
      const { error } = await supabase.from("audit_logs").insert({
        workspace_id: profile.workspace_id,
        user_id: user.id,
        user_name: profile.full_name || user.email || "Usuário",
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        old_value: entry.old_value,
        new_value: entry.new_value,
        changes_summary: entry.changes_summary,
      });

      if (error) {
        console.error("Error logging audit:", error);
      }
    } catch (err) {
      console.error("Failed to log audit:", err);
    }
  };

  return { logChange };
};
