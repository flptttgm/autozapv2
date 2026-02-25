import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Folder, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FOLDER_COLORS = [
  "#6366f1", // Indigo (default)
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#0ea5e9", // Sky
  "#6b7280", // Gray
];

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFolderCreated?: (folderId: string) => void;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onFolderCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.workspace_id) throw new Error("Workspace não encontrado");
      if (!name.trim()) throw new Error("Nome da pasta é obrigatório");

      const { data, error } = await supabase
        .from("lead_folders")
        .insert({
          workspace_id: profile.workspace_id,
          name: name.trim(),
          color,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe uma pasta com esse nome");
        }
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead-folders"] });
      toast.success(`Pasta "${name}" criada com sucesso!`);
      onFolderCreated?.(data.id);
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar pasta");
    },
  });

  const handleClose = () => {
    setName("");
    setColor(FOLDER_COLORS[0]);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createFolderMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" style={{ color }} />
            Criar Nova Pasta
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nome da pasta</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Black Friday 40k"
              autoFocus
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor da pasta</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="w-full sm:w-auto">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!name.trim() || createFolderMutation.isPending}
              className="w-full sm:w-auto"
            >
              {createFolderMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Pasta"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
