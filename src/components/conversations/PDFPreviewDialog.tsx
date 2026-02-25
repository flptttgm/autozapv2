import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Maximize2, Minimize2, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface PDFPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string;
  fileName: string;
}

export function PDFPreviewDialog({
  open,
  onOpenChange,
  pdfUrl,
  fileName,
}: PDFPreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadPdf = async () => {
    if (blobUrl) return; // Already loaded
    
    try {
      setIsLoading(true);
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (error) {
      toast.error("Erro ao carregar PDF");
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const url = blobUrl || pdfUrl;
      const response = blobUrl ? null : await fetch(pdfUrl);
      const blob = blobUrl ? null : await response?.blob();
      const downloadUrl = blobUrl || (blob ? URL.createObjectURL(blob) : pdfUrl);
      
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      if (!blobUrl && blob) {
        URL.revokeObjectURL(downloadUrl);
      }
      
      toast.success("Download iniciado!");
    } catch (error) {
      toast.error("Erro ao baixar PDF");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setIsLoading(true);
    }
    setIsFullscreen(false);
    onOpenChange(newOpen);
  };

  // Load PDF when dialog opens
  if (open && !blobUrl && isLoading) {
    loadPdf();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={`${isFullscreen ? 'max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh]' : 'max-w-4xl w-full h-[80vh] max-h-[80vh]'} flex flex-col p-0 gap-0 transition-all duration-200`}
      >
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-medium truncate pr-4">
              {fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <span className="text-sm text-muted-foreground">Carregando PDF...</span>
              </div>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={fileName}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm text-muted-foreground">Erro ao carregar PDF</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
