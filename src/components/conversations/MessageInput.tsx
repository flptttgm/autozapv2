import { useState, useCallback, useRef, KeyboardEvent, memo } from "react";
import { Send, Paperclip, Image, Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { ShortcutsPopover, QuickReply } from "./ShortcutsPopover";
import { AudioRecorder } from "./AudioRecorder";
import { ImagePreviewDialog } from "./ImagePreviewDialog";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";

interface MessageInputProps {
  onSend: (message: string) => void;
  onSendAudio?: (audioBase64: string, duration: number, mimeType: string) => void;
  onSendImage?: (imageBase64: string, caption: string, mimeType: string) => void;
  onSendDocument?: (base64: string, fileName: string, caption: string, mimeType: string, extension: string) => void;
  isPending: boolean;
  isImagePending?: boolean;
  isDocumentPending?: boolean;
  disabled?: boolean;
  quickReplies?: QuickReply[];
}

/**
 * Enhanced message input component with toolbar for emoji, attachments, and shortcuts
 */
export const MessageInput = memo(function MessageInput({
  onSend,
  onSendAudio,
  onSendImage,
  onSendDocument,
  isPending,
  isImagePending = false,
  isDocumentPending = false,
  disabled = false,
  quickReplies = [],
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    if (!text.trim() || isPending || disabled) return;
    onSend(text.trim());
    setText("");
  }, [text, isPending, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleEmojiSelect = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
  }, []);

  const handleShortcutSelect = useCallback((response: string) => {
    setText(response);
  }, []);

  const handleAttachmentClick = useCallback(() => {
    if (!onSendDocument) {
      toast.info("Em breve: envio de documentos", {
        description: "Esta funcionalidade estará disponível em breve.",
      });
      return;
    }
    documentInputRef.current?.click();
  }, [onSendDocument]);

  const handleDocumentSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    setSelectedDocumentFile(file);
    setDocumentDialogOpen(true);
  }, []);

  const handleDocumentSend = useCallback(
    (base64: string, fileName: string, caption: string, mimeType: string, extension: string) => {
      if (onSendDocument) {
        onSendDocument(base64, fileName, caption, mimeType, extension);
      }
      setDocumentDialogOpen(false);
      setSelectedDocumentFile(null);
    },
    [onSendDocument]
  );

  const handleDocumentDialogClose = useCallback((open: boolean) => {
    setDocumentDialogOpen(open);
    if (!open) {
      setSelectedDocumentFile(null);
    }
  }, []);

  const handleImageClick = useCallback(() => {
    if (!onSendImage) {
      toast.info("Em breve: envio de imagens", {
        description: "Esta funcionalidade estará disponível em breve.",
      });
      return;
    }
    imageInputRef.current?.click();
  }, [onSendImage]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    setSelectedImageFile(file);
    setImageDialogOpen(true);
  }, []);

  const handleImageSend = useCallback(
    (imageBase64: string, caption: string, mimeType: string) => {
      if (onSendImage) {
        onSendImage(imageBase64, caption, mimeType);
      }
      setImageDialogOpen(false);
      setSelectedImageFile(null);
    },
    [onSendImage]
  );

  const handleImageDialogClose = useCallback((open: boolean) => {
    setImageDialogOpen(open);
    if (!open) {
      setSelectedImageFile(null);
    }
  }, []);

  const handleAudioClick = useCallback(() => {
    if (!onSendAudio) {
      toast.info("Em breve: gravação de áudio", {
        description: "Esta funcionalidade estará disponível em breve.",
      });
      return;
    }
    setIsRecordingMode(true);
  }, [onSendAudio]);

  const handleAudioSend = useCallback(
    (audioBase64: string, duration: number, mimeType: string) => {
      if (onSendAudio) {
        onSendAudio(audioBase64, duration, mimeType);
      }
      setIsRecordingMode(false);
    },
    [onSendAudio]
  );

  const handleAudioCancel = useCallback(() => {
    setIsRecordingMode(false);
  }, []);

  const isDisabled = disabled || isPending;

  // Show audio recorder when in recording mode
  if (isRecordingMode) {
    return (
      <AudioRecorder
        onSend={handleAudioSend}
        onCancel={handleAudioCancel}
        isPending={isPending}
        disabled={disabled}
      />
    );
  }

  return (
    <>
      {/* Hidden image input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* Hidden document input */}
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
        className="hidden"
        onChange={handleDocumentSelect}
      />

      {/* Image preview dialog */}
      <ImagePreviewDialog
        open={imageDialogOpen}
        onOpenChange={handleImageDialogClose}
        imageFile={selectedImageFile}
        onSend={handleImageSend}
        isPending={isImagePending}
      />

      {/* Document preview dialog */}
      <DocumentPreviewDialog
        open={documentDialogOpen}
        onOpenChange={handleDocumentDialogClose}
        documentFile={selectedDocumentFile}
        onSend={handleDocumentSend}
        isPending={isDocumentPending}
      />

      <div className="bg-background/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] transition-all focus-within:ring-1 focus-within:ring-primary/30">
        {/* Text area */}
        <Textarea
          placeholder="Digite sua mensagem aqui..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          className="border-0 resize-none min-h-[60px] max-h-[120px] focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent px-4 py-3 placeholder:text-muted-foreground/60"
          rows={2}
        />

        {/* Action toolbar */}
        <div className="flex items-center justify-between px-2 py-2 border-t border-white/5 bg-black/5 dark:bg-white/5">
          <div className="flex items-center gap-0.5">
            {/* Emoji picker */}
            <EmojiPickerPopover
              onEmojiSelect={handleEmojiSelect}
              disabled={isDisabled}
            />

            {/* Attachment button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-colors"
              disabled={isDisabled}
              onClick={handleAttachmentClick}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Image button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-colors"
              disabled={isDisabled}
              onClick={handleImageClick}
            >
              <Image className="h-4 w-4" />
            </Button>

            {/* Audio button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-colors"
              disabled={isDisabled}
              onClick={handleAudioClick}
            >
              <Mic className="h-4 w-4" />
            </Button>

            {/* Divider */}
            <div className="w-px h-4 bg-white/10 mx-1" />

            {/* Shortcuts popover */}
            <ShortcutsPopover
              quickReplies={quickReplies}
              onSelect={handleShortcutSelect}
              disabled={isDisabled}
            />
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!text.trim() || isDisabled}
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full shadow-lg transition-all",
              !text.trim() || isDisabled
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 hover:shadow-[0_0_15px_rgba(var(--primary),0.3)]"
            )}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 ml-0.5" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
});
