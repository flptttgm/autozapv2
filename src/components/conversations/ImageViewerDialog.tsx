import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  X, 
  Download, 
  Maximize2, 
  Minimize2, 
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";

interface ImageViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  caption?: string;
}

export function ImageViewerDialog({
  open,
  onOpenChange,
  imageUrl,
  caption,
}: ImageViewerDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Fetch and create blob URL when opening
  useEffect(() => {
    if (open && imageUrl && !blobUrl) {
      loadImage();
    }
  }, [open, imageUrl]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      setBlobUrl(null);
      setScale(1);
      setIsLoading(true);
      setError(null);
      setIsFullscreen(false);
    }
  }, [open]);

  const loadImage = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("Falha ao carregar imagem");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (err) {
      console.error("Error loading image:", err);
      setError("Não foi possível carregar a imagem");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const link = document.createElement("a");
      link.href = blobUrl || imageUrl;
      
      // Extract filename from caption or URL
      let fileName = caption || "imagem";
      if (!fileName.includes(".")) {
        fileName += ".jpg";
      }
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download iniciado!");
    } catch (err) {
      toast.error("Erro ao baixar imagem");
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const displayName = caption || "Imagem";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className={`p-0 gap-0 ${
          isFullscreen 
            ? "max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh]" 
            : "max-w-4xl w-[90vw] h-[80vh] max-h-[80vh]"
        } transition-all duration-200`}
      >
        {/* Header */}
        <DialogHeader className="p-3 sm:p-4 border-b border-border bg-card/50 backdrop-blur-sm flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base font-medium truncate max-w-[60%]">
            <ImageIcon className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{displayName}</span>
          </DialogTitle>
          
          <div className="flex items-center gap-1">
            {/* Zoom controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="h-8 w-8"
              title="Diminuir zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={scale >= 3}
              className="h-8 w-8"
              title="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetZoom}
              disabled={scale === 1}
              className="h-8 w-8"
              title="Resetar zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-4 bg-border mx-1" />
            
            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8"
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            
            {/* Download */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              disabled={!blobUrl}
              className="h-8 w-8"
              title="Baixar imagem"
            >
              <Download className="h-4 w-4" />
            </Button>
            
            {/* Close */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Image Content */}
        <div 
          className="flex-1 flex items-center justify-center overflow-auto bg-black/90 min-h-0"
          onWheel={handleWheel}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 p-8">
              <Skeleton className="w-64 h-64 rounded-lg" />
              <p className="text-sm text-muted-foreground">Carregando imagem...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
                <X className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={loadImage}>
                Tentar novamente
              </Button>
            </div>
          ) : blobUrl ? (
            <img
              src={blobUrl}
              alt={displayName}
              className="max-w-full max-h-full object-contain transition-transform duration-200 cursor-zoom-in"
              style={{ transform: `scale(${scale})` }}
              onDoubleClick={() => setScale(scale === 1 ? 2 : 1)}
              draggable={false}
            />
          ) : null}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border bg-card/50 text-xs text-muted-foreground text-center">
          Scroll para zoom • Duplo clique para alternar 100%/200%
        </div>
      </DialogContent>
    </Dialog>
  );
}
