import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface Note {
  content: string;
  date: string;
  created_by?: string;
}

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentMetadata: Record<string, any>;
  onNoteAdded: () => void;
}

const MAX_NOTE_LENGTH = 500;

export function AddNoteDialog({
  open,
  onOpenChange,
  leadId,
  currentMetadata,
  onNoteAdded,
}: AddNoteDialogProps) {
  const [noteContent, setNoteContent] = useState("");

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!noteContent.trim()) throw new Error("Conteúdo da nota é obrigatório");

      const currentNotes = (currentMetadata?.notes || []) as Array<{ content: string; date: string; created_by?: string }>;
      const newNote = {
        content: noteContent.trim().slice(0, MAX_NOTE_LENGTH),
        date: new Date().toISOString(),
      };

      const updatedMetadata = {
        ...currentMetadata,
        notes: [...currentNotes, newNote],
      } as Record<string, unknown>;

      const { error } = await supabase
        .from("leads")
        .update({ metadata: updatedMetadata as any })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anotação adicionada!");
      setNoteContent("");
      onOpenChange(false);
      onNoteAdded();
    },
    onError: (error) => {
      console.error("Error adding note:", error);
      toast.error("Erro ao adicionar anotação");
    },
  });

  const handleSave = () => {
    if (!noteContent.trim()) {
      toast.error("Digite o conteúdo da anotação");
      return;
    }
    addNoteMutation.mutate();
  };

  const handleClose = () => {
    setNoteContent("");
    onOpenChange(false);
  };

  const remainingChars = MAX_NOTE_LENGTH - noteContent.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Anotação</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder="Digite sua anotação aqui..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value.slice(0, MAX_NOTE_LENGTH))}
            className="min-h-[120px] resize-none"
            maxLength={MAX_NOTE_LENGTH}
          />
          <p className={`text-xs text-right ${remainingChars < 50 ? "text-destructive" : "text-muted-foreground"}`}>
            {remainingChars} caracteres restantes
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={addNoteMutation.isPending || !noteContent.trim()}
          >
            {addNoteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
