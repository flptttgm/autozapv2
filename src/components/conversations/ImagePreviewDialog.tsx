import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Loader2, Image as ImageIcon } from "lucide-react";

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onSend: (imageBase64: string, caption: string, mimeType: string) => void;
  isPending: boolean;
}

const MAX_CAPTION_LENGTH = 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function ImagePreviewDialog({
  open,
  onOpenChange,
  imageFile,
  onSend,
  isPending,
}: ImagePreviewDialogProps) {
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate preview URL when file changes
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      setError(null);
      return;
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(imageFile.type)) {
      setError("Formato não suportado. Use JPG, PNG, WEBP ou GIF.");
      setPreviewUrl(null);
      return;
    }

    // Validate file size
    if (imageFile.size > MAX_FILE_SIZE) {
      setError("Imagem muito grande. Máximo: 5MB");
      setPreviewUrl(null);
      return;
    }

    setError(null);
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  // Reset caption when dialog opens
  useEffect(() => {
    if (open) {
      setCaption("");
      // Focus textarea after a short delay
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = async () => {
    if (!imageFile || error) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix
      const base64Data = base64.replace(/^data:[^;]+;base64,/, "");
      onSend(base64Data, caption.trim(), imageFile.type);
    };
    reader.readAsDataURL(imageFile);
  };

  const handleCaptionChange = (value: string) => {
    if (value.length <= MAX_CAPTION_LENGTH) {
      setCaption(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Enviar imagem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview area */}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-full max-w-full object-contain"
              />
            ) : error ? (
              <div className="text-center p-4">
                <X className="h-12 w-12 mx-auto text-destructive mb-2" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : (
              <div className="text-center p-4 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Carregando preview...</p>
              </div>
            )}
          </div>

          {/* Caption input */}
          {!error && (
            <div className="space-y-2">
              <Textarea
                ref={textareaRef}
                placeholder="Adicionar legenda (opcional)..."
                value={caption}
                onChange={(e) => handleCaptionChange(e.target.value)}
                className="resize-none min-h-[80px]"
                maxLength={MAX_CAPTION_LENGTH}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground text-right">
                {caption.length}/{MAX_CAPTION_LENGTH}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!previewUrl || !!error || isPending}
            className="gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
