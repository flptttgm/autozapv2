import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserWorkspace {
    id: string;
    name: string;
    avatar_url: string | null;
    role: "owner" | "admin" | "member";
    template: string | null;
}

export function useUserWorkspaces() {
    const { user, profile, refreshProfile } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: workspaces, isLoading } = useQuery({
        queryKey: ["user-workspaces", user?.id],
        queryFn: async (): Promise<UserWorkspace[]> => {
            if (!user?.id) return [];

            // Step 1: Get all workspace memberships for this user
            const { data: memberships, error: memberError } = await supabase
                .from("workspace_members")
                .select("workspace_id, role")
                .eq("user_id", user.id);

            if (memberError) {
                console.error("[WorkspaceSwitcher] Error fetching memberships:", memberError);
                return [];
            }

            if (!memberships || memberships.length === 0) {
                console.warn("[WorkspaceSwitcher] No memberships found for user");
                return [];
            }

            const workspaceIds = memberships.map((m) => m.workspace_id);

            // Step 2: Get workspace names + settings (template)
            const { data: workspaceData, error: wsError } = await supabase
                .from("workspaces")
                .select("id, name, settings")
                .in("id", workspaceIds);

            if (wsError) {
                console.error("[WorkspaceSwitcher] Error fetching workspaces:", wsError);
            }

            const wsMap = new Map<string, { name: string; template: string | null }>();
            if (workspaceData) {
                workspaceData.forEach((ws: any) => {
                    wsMap.set(ws.id, {
                        name: ws.name || "Sem nome",
                        template: ws.settings?.template || null,
                    });
                });
            }

            // Step 3: Get workspace profiles (avatars + display name)
            const { data: profiles } = await supabase
                .from("workspace_profiles" as any)
                .select("workspace_id, avatar_url, name")
                .in("workspace_id", workspaceIds);

            const profileMap = new Map<string, { avatar_url: string | null; name: string | null }>();
            if (profiles) {
                (profiles as any[]).forEach((p) => {
                    profileMap.set(p.workspace_id, {
                        avatar_url: p.avatar_url || null,
                        name: p.name || null,
                    });
                });
            }

            return memberships.map((m) => {
                const wp = profileMap.get(m.workspace_id);
                const ws = wsMap.get(m.workspace_id);
                return {
                    id: m.workspace_id,
                    name: wp?.name || ws?.name || "Sem nome",
                    avatar_url: wp?.avatar_url || null,
                    role: m.role as "owner" | "admin" | "member",
                    template: ws?.template || null,
                };
            });
        },
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000,
    });

    const switchWorkspaceMutation = useMutation({
        mutationFn: async (workspaceId: string) => {
            if (!user?.id) throw new Error("User not authenticated");

            // Update profile's active workspace
            const { error } = await supabase
                .from("profiles" as any)
                .update({ workspace_id: workspaceId } as any)
                .eq("user_id", user.id);

            if (error) throw error;
            return workspaceId;
        },
        onSuccess: async (workspaceId) => {
            const targetWorkspace = workspaces?.find((w) => w.id === workspaceId);

            // Refresh auth context
            await refreshProfile();

            // Clear all cached data to force refetch with new workspace
            queryClient.clear();

            toast.success(
                `Workspace alterado para ${targetWorkspace?.name || "novo workspace"}`
            );

            navigate("/dashboard");
        },
        onError: (error: Error) => {
            console.error("Error switching workspace:", error);
            toast.error("Erro ao trocar workspace");
        },
    });

    const activeWorkspace = workspaces?.find(
        (w) => w.id === profile?.workspace_id
    );

    // Fallback: if workspaces loaded but activeWorkspace not found,
    // create a fallback from the profile data
    const fallbackWorkspace: UserWorkspace | null =
        !activeWorkspace && profile?.workspace_id
            ? {
                id: profile.workspace_id,
                name: profile.company_name || "Meu Workspace",
                avatar_url: null,
                role: "owner",
                template: null,
            }
            : null;

    return {
        workspaces: workspaces || [],
        activeWorkspace: activeWorkspace || fallbackWorkspace,
        isLoading,
        switchWorkspace: switchWorkspaceMutation.mutate,
        isSwitching: switchWorkspaceMutation.isPending,
    };
}
