import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Folder, MessageSquare, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

interface MemberAccessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: {
        id: string; // workspace_members.id
        name: string;
        role: string;
    };
}

interface FolderItem {
    id: string;
    name: string;
    color: string | null;
}

export function MemberAccessDialog({
    open,
    onOpenChange,
    member,
}: MemberAccessDialogProps) {
    const { profile } = useAuth();
    const queryClient = useQueryClient();

    // Fetch lead folders
    const { data: leadFolders = [] } = useQuery({
        queryKey: ["lead-folders", profile?.workspace_id],
        queryFn: async () => {
            if (!profile?.workspace_id) return [];
            const { data, error } = await supabase
                .from("lead_folders" as any)
                .select("id, name, color")
                .eq("workspace_id", profile.workspace_id)
                .order("name");
            if (error) throw error;
            return (data as unknown as FolderItem[]) || [];
        },
        enabled: !!profile?.workspace_id && open,
    });

    // Fetch chat folders
    const { data: chatFolders = [] } = useQuery({
        queryKey: ["chat-folders", profile?.workspace_id],
        queryFn: async () => {
            if (!profile?.workspace_id) return [];
            const { data, error } = await supabase
                .from("chat_folders" as any)
                .select("id, name, color")
                .eq("workspace_id", profile.workspace_id)
                .order("name");
            if (error) throw error;
            return (data as unknown as FolderItem[]) || [];
        },
        enabled: !!profile?.workspace_id && open,
    });

    // Fetch current lead folder access
    const { data: currentLeadAccess = [] } = useQuery({
        queryKey: ["member-lead-access", member.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("member_folder_access" as any)
                .select("folder_id")
                .eq("member_id", member.id);
            if (error) throw error;
            return (data as any[])?.map((d: any) => d.folder_id as string) || [];
        },
        enabled: !!member.id && open,
    });

    // Fetch current chat folder access
    const { data: currentChatAccess = [] } = useQuery({
        queryKey: ["member-chat-access", member.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("member_chat_folder_access" as any)
                .select("folder_id")
                .eq("member_id", member.id);
            if (error) throw error;
            return (data as any[])?.map((d: any) => d.folder_id as string) || [];
        },
        enabled: !!member.id && open,
    });

    const [leadSelections, setLeadSelections] = useState<Set<string>>(new Set());
    const [chatSelections, setChatSelections] = useState<Set<string>>(new Set());
    const [initialized, setInitialized] = useState(false);

    // Sync from server data to local state when data arrives
    if (open && !initialized && currentLeadAccess.length >= 0 && currentChatAccess.length >= 0) {
        setLeadSelections(new Set(currentLeadAccess));
        setChatSelections(new Set(currentChatAccess));
        setInitialized(true);
    }

    // Reset when dialog closes
    const handleOpenChange = (value: boolean) => {
        if (!value) {
            setInitialized(false);
        }
        onOpenChange(value);
    };

    const toggleLeadFolder = (folderId: string) => {
        const next = new Set(leadSelections);
        if (next.has(folderId)) {
            next.delete(folderId);
        } else {
            next.add(folderId);
        }
        setLeadSelections(next);
    };

    const toggleChatFolder = (folderId: string) => {
        const next = new Set(chatSelections);
        if (next.has(folderId)) {
            next.delete(folderId);
        } else {
            next.add(folderId);
        }
        setChatSelections(next);
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            // Save lead folder access
            // Delete all existing, re-insert selected
            await supabase
                .from("member_folder_access" as any)
                .delete()
                .eq("member_id", member.id);

            if (leadSelections.size > 0) {
                const rows = Array.from(leadSelections).map((folder_id) => ({
                    member_id: member.id,
                    folder_id,
                }));
                const { error } = await supabase
                    .from("member_folder_access" as any)
                    .insert(rows);
                if (error) throw error;
            }

            // Save chat folder access
            await supabase
                .from("member_chat_folder_access" as any)
                .delete()
                .eq("member_id", member.id);

            if (chatSelections.size > 0) {
                const rows = Array.from(chatSelections).map((folder_id) => ({
                    member_id: member.id,
                    folder_id,
                }));
                const { error } = await supabase
                    .from("member_chat_folder_access" as any)
                    .insert(rows);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["member-lead-access"] });
            queryClient.invalidateQueries({ queryKey: ["member-chat-access"] });
            queryClient.invalidateQueries({ queryKey: ["member-lead-folder-access"] });
            queryClient.invalidateQueries({ queryKey: ["member-chat-folder-access"] });
            toast.success(`Acessos de ${member.name} atualizados!`);
            handleOpenChange(false);
        },
        onError: (error) => {
            toast.error("Erro ao salvar acessos");
            console.error(error);
        },
    });

    const isAdmin = member.role === "owner" || member.role === "admin";

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Gerenciar Acessos — {member.name}
                    </DialogTitle>
                </DialogHeader>

                {isAdmin ? (
                    <div className="py-6 text-center text-muted-foreground">
                        <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
                        <p className="font-medium">
                            {member.role === "owner" ? "Proprietário" : "Administrador"} tem acesso completo a todas as pastas.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
                        {/* Lead Folders Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Folder className="h-4 w-4 text-primary" />
                                <h4 className="font-semibold text-sm">Pastas de Clientes</h4>
                                <Badge variant="secondary" className="text-xs">
                                    {leadSelections.size}/{leadFolders.length}
                                </Badge>
                            </div>

                            {leadFolders.length === 0 ? (
                                <p className="text-sm text-muted-foreground pl-6">Nenhuma pasta criada ainda</p>
                            ) : (
                                <div className="space-y-2 pl-6">
                                    {leadFolders.map((folder) => (
                                        <label
                                            key={folder.id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                                        >
                                            <Checkbox
                                                checked={leadSelections.has(folder.id)}
                                                onCheckedChange={() => toggleLeadFolder(folder.id)}
                                            />
                                            <Folder
                                                className="h-4 w-4 flex-shrink-0"
                                                style={{ color: folder.color || "#6366f1" }}
                                            />
                                            <span className="text-sm">{folder.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Chat Folders Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                <h4 className="font-semibold text-sm">Pastas de Conversas</h4>
                                <Badge variant="secondary" className="text-xs">
                                    {chatSelections.size}/{chatFolders.length}
                                </Badge>
                            </div>

                            {chatFolders.length === 0 ? (
                                <p className="text-sm text-muted-foreground pl-6">Nenhuma pasta criada ainda</p>
                            ) : (
                                <div className="space-y-2 pl-6">
                                    {chatFolders.map((folder) => (
                                        <label
                                            key={folder.id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                                        >
                                            <Checkbox
                                                checked={chatSelections.has(folder.id)}
                                                onCheckedChange={() => toggleChatFolder(folder.id)}
                                            />
                                            <MessageSquare
                                                className="h-4 w-4 flex-shrink-0"
                                                style={{ color: folder.color || "#6366f1" }}
                                            />
                                            <span className="text-sm">{folder.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground px-1">
                            O membro só verá os clientes e conversas nas pastas selecionadas.
                            A pasta "Geral" (sem pasta) é visível para todos.
                        </p>
                    </div>
                )}

                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                    <DialogClose asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                            Cancelar
                        </Button>
                    </DialogClose>
                    {!isAdmin && (
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}
                            className="w-full sm:w-auto"
                        >
                            {saveMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                "Salvar Acessos"
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
