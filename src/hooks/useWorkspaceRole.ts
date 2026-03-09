import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WorkspaceRole {
    role: "owner" | "admin" | "member" | null;
    isOwner: boolean;
    isAdmin: boolean;
    isMember: boolean;
    /** True if user is owner or admin */
    canManageTeam: boolean;
    /** True if user can access workspace-level settings (owner + admin) */
    canAccessSettings: boolean;
    /** True if user can manage workspace config — pages, integrations, billing (owner only) */
    canManageWorkspace: boolean;
    /** True if user can access AI agent settings (owner + admin) */
    canManageAgents: boolean;
    /** True if user can manage WhatsApp connections (owner + admin) */
    canManageConnections: boolean;
    memberId: string | null;
    isLoading: boolean;
}

export function useWorkspaceRole(): WorkspaceRole {
    const { user, profile } = useAuth();

    const { data, isLoading } = useQuery({
        queryKey: ["workspace-role", user?.id, profile?.workspace_id],
        queryFn: async () => {
            if (!user?.id || !profile?.workspace_id) return null;

            const { data, error } = await supabase
                .from("workspace_members")
                .select("id, role")
                .eq("workspace_id", profile.workspace_id)
                .eq("user_id", user.id)
                .single();

            if (error) {
                console.error("Error fetching workspace role:", error);
                return null;
            }

            return data as { id: string; role: string };
        },
        enabled: !!user?.id && !!profile?.workspace_id,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const role = (data?.role as "owner" | "admin" | "member") || null;
    const isOwner = role === "owner";
    const isAdmin = role === "admin" || role === "owner";

    return {
        role,
        isOwner,
        isAdmin,
        isMember: role === "member",
        canManageTeam: isOwner || role === "admin",
        canAccessSettings: isOwner || role === "admin",
        canManageWorkspace: isOwner,
        canManageAgents: isOwner || role === "admin",
        canManageConnections: isOwner || role === "admin",
        memberId: data?.id || null,
        isLoading,
    };
}
