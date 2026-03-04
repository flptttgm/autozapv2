import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Folder, FolderOpen } from "lucide-react";

export interface ChatFolder {
    id: string;
    name: string;
    color: string | null;
    workspace_id: string;
}

interface ChatFolderTabsProps {
    selectedFolderId: string | null; // null = "Todas"
    onSelectFolder: (folderId: string | null) => void;
    /** null = no filter (admin), [] = show none */
    allowedFolderIds?: string[] | null;
    canManageTeam?: boolean;
}

export function ChatFolderTabs({
    selectedFolderId,
    onSelectFolder,
    allowedFolderIds = null,
    canManageTeam = true,
}: ChatFolderTabsProps) {
    const { profile } = useAuth();

    // Fetch LEAD folders instead of chat folders
    const { data: folders = [] } = useQuery({
        queryKey: ["lead-folders", profile?.workspace_id],
        queryFn: async () => {
            if (!profile?.workspace_id) return [];
            const { data, error } = await supabase
                .from("lead_folders")
                .select("id, name, color, workspace_id")
                .eq("workspace_id", profile.workspace_id)
                .order("name");
            if (error) throw error;
            return (data as ChatFolder[]) || [];
        },
        enabled: !!profile?.workspace_id,
    });

    const visibleFolders = allowedFolderIds === null
        ? folders
        : folders.filter((f) => allowedFolderIds.includes(f.id));

    // Don't render anything if there are no folders
    if (visibleFolders.length === 0) return null;

    return (
        <div className="px-3 pt-2 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
                {/* Todas tab */}
                <button
                    onClick={() => onSelectFolder(null)}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all",
                        selectedFolderId === null
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Todas
                </button>

                {/* Lead folders */}
                {visibleFolders.map((folder) => (
                    <button
                        key={folder.id}
                        onClick={() => onSelectFolder(folder.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all",
                            selectedFolderId === folder.id
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                    >
                        <Folder
                            className="h-3.5 w-3.5"
                            style={selectedFolderId !== folder.id ? { color: folder.color || "#6366f1" } : undefined}
                        />
                        {folder.name}
                    </button>
                ))}
            </div>
        </div>
    );
}
