import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Folder, FolderOpen, FolderPlus, MessageSquare, Plus, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";

export interface ChatFolder {
    id: string;
    name: string;
    color: string | null;
    chat_count: number;
    workspace_id: string;
}

const FOLDER_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
    "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

interface ChatFolderTabsProps {
    selectedFolderId: string | null; // null = "Todos"
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
    const queryClient = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState(FOLDER_COLORS[0]);

    const { data: folders = [] } = useQuery({
        queryKey: ["chat-folders", profile?.workspace_id],
        queryFn: async () => {
            if (!profile?.workspace_id) return [];
            const { data, error } = await supabase
                .from("chat_folders" as any)
                .select("*")
                .eq("workspace_id", profile.workspace_id)
                .order("name");
            if (error) throw error;
            return (data as unknown as ChatFolder[]) || [];
        },
        enabled: !!profile?.workspace_id,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            if (!newName.trim() || !profile?.workspace_id) throw new Error("Invalid");
            const { error } = await supabase
                .from("chat_folders" as any)
                .insert({
                    workspace_id: profile.workspace_id,
                    name: newName.trim(),
                    color: newColor,
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["chat-folders"] });
            toast.success("Pasta criada!");
            setNewName("");
            setShowCreate(false);
        },
        onError: () => {
            toast.error("Erro ao criar pasta");
        },
    });

    const visibleFolders = allowedFolderIds === null
        ? folders
        : folders.filter((f) => allowedFolderIds.includes(f.id));

    // Don't render anything if there are no folders and user can't create them
    if (visibleFolders.length === 0 && !canManageTeam) return null;

    return (
        <>
            <div className="px-3 pt-2 pb-1">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                    {/* Todos tab - admin only */}
                    {allowedFolderIds === null && (
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
                    )}

                    {/* User folders */}
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
                            {folder.chat_count > 0 && (
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        "h-4 min-w-4 px-1 text-[10px]",
                                        selectedFolderId === folder.id && "bg-primary-foreground/20 text-primary-foreground"
                                    )}
                                >
                                    {folder.chat_count}
                                </Badge>
                            )}
                        </button>
                    ))}

                    {/* Create folder button - admin only */}
                    {canManageTeam && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all whitespace-nowrap"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Create folder dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-w-[95vw] sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderPlus className="h-5 w-5" />
                            Nova Pasta de Conversas
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div>
                            <Input
                                placeholder="Nome da pasta"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                maxLength={40}
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {FOLDER_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setNewColor(color)}
                                    className={cn(
                                        "h-7 w-7 rounded-full transition-all",
                                        newColor === color ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                                    )}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                        <DialogClose asChild>
                            <Button variant="outline" className="w-full sm:w-auto">Cancelar</Button>
                        </DialogClose>
                        <Button
                            onClick={() => createMutation.mutate()}
                            disabled={!newName.trim() || createMutation.isPending}
                            className="w-full sm:w-auto"
                        >
                            {createMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4 mr-2" />
                            )}
                            Criar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
