import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, X, FileText, Image as ImageIcon, StickyNote } from "lucide-react";
import { EmojiPickerPopover } from "@/components/conversations/EmojiPickerPopover";

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onNoteAdded: () => void;
}

const MAX_NOTE_LENGTH = 1000;

export function AddNoteDialog({
  open,
  onOpenChange,
  leadId,
  onNoteAdded,
}: AddNoteDialogProps) {
  const [noteContent, setNoteContent] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!noteContent.trim() && !attachedFile) throw new Error("Conteúdo ou anexo obrigatório");
      if (!profile?.workspace_id) throw new Error("Workspace não encontrado");

      setIsUploading(true);
      let attachmentMetadata = null;

      // Upload file if attached
      if (attachedFile) {
        const fileExt = attachedFile.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `notes/${leadId}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(filePath, attachedFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(filePath);
        attachmentMetadata = {
          name: attachedFile.name,
          url: publicUrl,
          type: attachedFile.type,
          size: attachedFile.size,
        };
      }

      // Save as message with type 'note'
      const { error } = await supabase.from("messages").insert({
        lead_id: leadId,
        workspace_id: profile.workspace_id,
        chat_id: `note_${leadId}`,
        content: noteContent.trim(),
        direction: "outbound_manual",
        message_type: "note",
        metadata: {
          type: "note",
          created_by: "user",
          visibility: "private",
          attachment: attachmentMetadata,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anotação salva!");
      setNoteContent("");
      setAttachedFile(null);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["lead-message-notes", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-timeline", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      onNoteAdded();
    },
    onError: (error) => {
      console.error("Error adding note:", error);
      toast.error("Erro ao salvar anotação: " + error.message);
    },
    onSettled: () => setIsUploading(false),
  });

  const handleSave = () => {
    if (!noteContent.trim() && !attachedFile) {
      toast.error("Digite algo ou anexe um arquivo");
      return;
    }
    addNoteMutation.mutate();
  };

  const handleClose = () => {
    setNoteContent("");
    setAttachedFile(null);
    onOpenChange(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo: 10MB");
        return;
      }
      setAttachedFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-400" />;
    return <FileText className="h-4 w-4 text-orange-400" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const remainingChars = MAX_NOTE_LENGTH - noteContent.length;
  const isPending = addNoteMutation.isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-white/10 bg-card/95 backdrop-blur-xl">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <StickyNote className="h-3.5 w-3.5 text-primary" />
            </div>
            Nova Anotação
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Notas são privadas e visíveis apenas para a equipe.
          </p>
        </DialogHeader>

        {/* Content */}
        <div className="px-5 pb-2">
          <div className="relative">
            <Textarea
              placeholder="Escreva sua anotação..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              className="min-h-[100px] max-h-[200px] resize-none border-white/10 bg-white/5 focus:bg-white/[0.07] rounded-xl text-sm placeholder:text-muted-foreground/50 transition-colors"
              maxLength={MAX_NOTE_LENGTH}
            />
          </div>

          {/* Attached file preview */}
          {attachedFile && (
            <div className="mt-2 flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              {getFileIcon(attachedFile.type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{attachedFile.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatFileSize(attachedFile.size)}</p>
              </div>
              <button
                onClick={() => setAttachedFile(null)}
                className="h-5 w-5 rounded-full bg-white/10 hover:bg-destructive/20 flex items-center justify-center transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-7 w-7 rounded-md hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="Anexar arquivo"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <EmojiPickerPopover
                onEmojiSelect={(emoji) => setNoteContent((prev) => prev + emoji)}
              />
            </div>
            <span className={`text-[10px] tabular-nums ${remainingChars < 100 ? "text-yellow-500" : remainingChars < 30 ? "text-destructive" : "text-muted-foreground/50"}`}>
              {remainingChars}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/5 bg-white/[0.02]">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 px-3 text-xs rounded-lg"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || (!noteContent.trim() && !attachedFile)}
            className="h-8 px-4 text-xs rounded-lg shadow-sm shadow-primary/20"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
