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

    return {
        role,
        isOwner: role === "owner",
        isAdmin: role === "admin" || role === "owner",
        isMember: role === "member",
        canManageTeam: role === "owner" || role === "admin",
        memberId: data?.id || null,
        isLoading,
    };
}
