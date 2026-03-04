import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LeadFolder } from "./FolderTabs";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FolderInput, Loader2, Folder, Copy } from "lucide-react";
import { toast } from "sonner";

interface MoveToFolderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedLeads: Set<string>;
    folders: LeadFolder[];
    onSuccess?: () => void;
}

export function MoveToFolderDialog({
    open,
    onOpenChange,
    selectedLeads,
    folders,
    onSuccess,
}: MoveToFolderDialogProps) {
    const [targetFolderId, setTargetFolderId] = useState<string>("general");
    const [actionType, setActionType] = useState<"move" | "copy">("move");
    const { profile } = useAuth();
    const queryClient = useQueryClient();

    const moveLeadsMutation = useMutation({
        mutationFn: async () => {
            if (!profile?.workspace_id) throw new Error("Workspace não encontrado");
            if (selectedLeads.size === 0) throw new Error("Nenhum lead selecionado");

            const leadIds = Array.from(selectedLeads);

            if (actionType === "move") {
                // Remove from all current folders first
                const { error: deleteError } = await supabase
                    .from("lead_folder_relations")
                    .delete()
                    .in("lead_id", leadIds)
                    .eq("workspace_id", profile.workspace_id);

                if (deleteError) throw deleteError;
            }

            // If a specific folder is selected (not 'general'), we insert the new relations
            if (targetFolderId !== "general") {
                const relationsToInsert = leadIds.map(leadId => ({
                    lead_id: leadId,
                    folder_id: targetFolderId,
                    workspace_id: profile.workspace_id
                }));

                const { error: insertError } = await supabase
                    .from("lead_folder_relations")
                    .upsert(relationsToInsert, { onConflict: 'lead_id, folder_id' });

                if (insertError) throw insertError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            queryClient.invalidateQueries({ queryKey: ["lead-folders"] });
            queryClient.invalidateQueries({ queryKey: ["leads-counts"] });

            const actionText = actionType === "move" ? "movidos" : "copiados";
            toast.success(`${selectedLeads.size} leads ${actionText} com sucesso!`);
            onSuccess?.();
            handleClose();
        },
        onError: (error: Error) => {
            toast.error(error.message || `Erro ao processar os leads`);
        },
    });

    const handleClose = () => {
        setTargetFolderId("general");
        setActionType("move");
        onOpenChange(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        moveLeadsMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {actionType === "move" ? <FolderInput className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5 text-primary" />}
                        Organizar {selectedLeads.size} lead(s)
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-3">
                        <Label>Ação Desejada</Label>
                        <RadioGroup
                            value={actionType}
                            onValueChange={(val: "move" | "copy") => {
                                setActionType(val);
                                // If switching to copy and 'general' is selected, reset to first folder
                                if (val === "copy" && targetFolderId === "general") {
                                    setTargetFolderId(folders[0]?.id || "general");
                                }
                            }}
                            className="flex flex-col space-y-2"
                        >
                            <Label
                                htmlFor="move"
                                className={`flex items-center space-x-3 rounded-md border p-3 cursor-pointer transition-colors ${actionType === "move" ? "bg-muted/80 border-primary/50" : "hover:bg-muted/50"
                                    }`}
                            >
                                <RadioGroupItem value="move" id="move" />
                                <span className="flex-1 font-medium">Mover</span>
                                <span className="text-xs text-muted-foreground ml-auto">Retira da pasta atual</span>
                            </Label>
                            <Label
                                htmlFor="copy"
                                className={`flex items-center space-x-3 rounded-md border p-3 cursor-pointer transition-colors ${actionType === "copy" ? "bg-muted/80 border-primary/50" : "hover:bg-muted/50"
                                    }`}
                            >
                                <RadioGroupItem value="copy" id="copy" />
                                <span className="flex-1 font-medium">Copiar</span>
                                <span className="text-xs text-muted-foreground ml-auto">Mantém onde já está</span>
                            </Label>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label>Selecione a pasta de destino</Label>
                        <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Escolha a pasta" />
                            </SelectTrigger>
                            <SelectContent>
                                {actionType === "move" && (
                                    <SelectItem value="general">
                                        <div className="flex items-center gap-2">
                                            <Folder className="h-4 w-4 text-muted-foreground" />
                                            <span>Todos (Remover de todas as pastas)</span>
                                        </div>
                                    </SelectItem>
                                )}
                                {folders.map((folder) => (
                                    <SelectItem key={folder.id} value={folder.id}>
                                        <div className="flex items-center gap-2">
                                            <Folder className="h-4 w-4" style={{ color: folder.color || undefined }} />
                                            <span>{folder.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="w-full sm:w-auto">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            disabled={moveLeadsMutation.isPending || (actionType === "copy" && targetFolderId === "general")}
                            className="w-full sm:w-auto"
                        >
                            {moveLeadsMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                "Confirmar"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
