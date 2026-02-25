import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceRole } from "./useWorkspaceRole";

/**
 * Returns the list of lead folder IDs the current member has access to.
 * Admin/Owner have access to everything (returns null = no filtering).
 * Regular members get their specific folder access list.
 */
export function useLeadFolderAccess() {
    const { isAdmin, memberId, isLoading: roleLoading } = useWorkspaceRole();

    const { data: allowedFolderIds, isLoading: accessLoading } = useQuery({
        queryKey: ["member-lead-folder-access", memberId],
        queryFn: async () => {
            if (!memberId) return [];

            const { data, error } = await supabase
                .from("member_folder_access" as any)
                .select("folder_id")
                .eq("member_id", memberId);

            if (error) {
                console.error("Error fetching folder access:", error);
                return [];
            }

            return (data as any[])?.map((d: any) => d.folder_id as string) || [];
        },
        enabled: !!memberId && !isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    return {
        // null means "no filtering" (admin sees all)
        allowedFolderIds: isAdmin ? null : (allowedFolderIds || []),
        isLoading: roleLoading || accessLoading,
        isAdmin,
    };
}

/**
 * Returns the list of chat folder IDs the current member has access to.
 * Admin/Owner have access to everything (returns null = no filtering).
 */
export function useChatFolderAccess() {
    const { isAdmin, memberId, isLoading: roleLoading } = useWorkspaceRole();

    const { data: allowedFolderIds, isLoading: accessLoading } = useQuery({
        queryKey: ["member-chat-folder-access", memberId],
        queryFn: async () => {
            if (!memberId) return [];

            const { data, error } = await supabase
                .from("member_chat_folder_access" as any)
                .select("folder_id")
                .eq("member_id", memberId);

            if (error) {
                console.error("Error fetching chat folder access:", error);
                return [];
            }

            return (data as any[])?.map((d: any) => d.folder_id as string) || [];
        },
        enabled: !!memberId && !isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    return {
        allowedFolderIds: isAdmin ? null : (allowedFolderIds || []),
        isLoading: roleLoading || accessLoading,
        isAdmin,
    };
}
