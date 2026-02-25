import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText, FileSpreadsheet, FileImage, File, X } from "lucide-react";
import { toast } from "sonner";

const MAX_CAPTION_LENGTH = 1024;
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-zip-compressed': 'zip',
};

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentFile: File | null;
  onSend: (base64: string, fileName: string, caption: string, mimeType: string, extension: string) => void;
  isPending: boolean;
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) {
    return <FileText className="h-12 w-12 text-red-500" />;
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return <FileSpreadsheet className="h-12 w-12 text-green-600" />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText className="h-12 w-12 text-blue-600" />;
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return <FileImage className="h-12 w-12 text-orange-500" />;
  }
  return <File className="h-12 w-12 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getExtensionFromFile(file: File): string {
  // First try from MIME type
  const fromMime = ALLOWED_TYPES[file.type];
  if (fromMime) return fromMime;
  
  // Fallback to file name extension
  const nameParts = file.name.split('.');
  if (nameParts.length > 1) {
    return nameParts[nameParts.length - 1].toLowerCase();
  }
  
  return 'bin';
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  documentFile,
  onSend,
  isPending,
}: DocumentPreviewDialogProps) {
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!open) {
      setCaption("");
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    if (!documentFile) return;

    // Validate file size
    if (documentFile.size > MAX_FILE_SIZE) {
      toast.error(`Documento muito grande. Máximo: ${formatFileSize(MAX_FILE_SIZE)}`);
      return;
    }

    // Validate file type
    const extension = getExtensionFromFile(documentFile);
    const isAllowed = Object.values(ALLOWED_TYPES).includes(extension) || ALLOWED_TYPES[documentFile.type];
    
    if (!isAllowed) {
      toast.error("Formato não suportado. Use PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP ou RAR");
      return;
    }

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        onSend(base64, documentFile.name, caption.trim(), documentFile.type, extension);
      };
      reader.onerror = () => {
        toast.error("Erro ao ler o documento");
      };
      reader.readAsDataURL(documentFile);
    } catch (error) {
      console.error("Error reading document:", error);
      toast.error("Erro ao processar documento");
    }
  }, [documentFile, caption, onSend]);

  const handleClose = useCallback(() => {
    if (!isPending) {
      onOpenChange(false);
    }
  }, [isPending, onOpenChange]);

  if (!documentFile) return null;

  const extension = getExtensionFromFile(documentFile);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Enviar Documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Preview */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
            {getFileIcon(documentFile.type)}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" title={documentFile.name}>
                {documentFile.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(documentFile.size)} • .{extension.toUpperCase()}
              </p>
            </div>
            {!isPending && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Caption Input */}
          <div className="space-y-2">
            <Textarea
              placeholder="Adicionar descrição (opcional)..."
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LENGTH))}
              disabled={isPending}
              className="resize-none"
              rows={2}
            />
            <p className="text-xs text-muted-foreground text-right">
              {caption.length}/{MAX_CAPTION_LENGTH}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isPending || !documentFile}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
