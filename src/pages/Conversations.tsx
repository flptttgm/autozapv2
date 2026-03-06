import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  User,
  Loader2,
  Users,
  Bot,
  Smartphone,
  Trash2,
  Plus,
  Hand,
  ArrowLeft,
  Mic,
  Image as ImageIcon,
  Video,
  FileText,
  Phone,
  AlertTriangle,
  Pin,
  Star,
  HelpCircle,
  Search,
  Info,
  X,
  Check,
  CheckCheck,
  Eye,
  Download,
  MessageSquare,
  BookOpen,
  MoreVertical,
} from "lucide-react";
import { MessageStatusIndicator } from "@/components/conversations/MessageStatusIndicator";
import { ContactDetailsPanel } from "@/components/conversations/ContactDetailsPanel";
import { Switch } from "@/components/ui/switch";
import { ChatContextMenu } from "@/components/conversations/ChatContextMenu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTerminology } from "@/hooks/useTerminology";
import { useAuth } from "@/contexts/AuthContext";
import { NewConversationDialog } from "@/components/conversations/NewConversationDialog";
import { MessageInput } from "@/components/conversations/MessageInput";
import { Skeleton } from "@/components/ui/skeleton";
import { AppleEmojiText } from "@/components/ui/apple-emoji-text";
import { MarkdownWithAppleEmoji } from "@/components/ui/markdown-apple-emoji";
import { AudioMessageBubble } from "@/components/conversations/AudioMessageBubble";
import { PDFPreviewDialog } from "@/components/conversations/PDFPreviewDialog";
import { ImageViewerDialog } from "@/components/conversations/ImageViewerDialog";
import { ChatFolderTabs } from "@/components/conversations/ChatFolderTabs";
import { useLeadFolderAccess } from "@/hooks/useFolderAccess";

// Indicator for AI responses based on audio transcription
const TranscriptionIndicator = () => (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 opacity-70">
    <Mic className="h-3 w-3" />
    <span>Resposta baseada em áudio transcrito</span>
  </div>
);

// Chat Loading Skeleton - shows full skeleton (header + messages) for atomic loading
const ChatLoadingSkeleton = () => (
  <div className="flex flex-col h-full">
    {/* Header Skeleton */}
    <div className="p-3 sm:p-4 border-b border-border/40 chat-header-bg">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-20 rounded" />
      </div>
    </div>
    {/* Messages Skeleton */}
    <div className="flex-1 p-4 space-y-4 overflow-hidden">
      {/* Inbound message skeleton */}
      <div className="flex justify-start">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-16 w-48 rounded-lg" />
        </div>
      </div>
      {/* Outbound message skeleton */}
      <div className="flex justify-end">
        <div className="space-y-1">
          <div className="flex justify-end">
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-12 w-56 rounded-lg" />
        </div>
      </div>
      {/* Another inbound */}
      <div className="flex justify-start">
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-20 w-64 rounded-lg" />
        </div>
      </div>
      {/* Another outbound */}
      <div className="flex justify-end">
        <div className="space-y-1">
          <div className="flex justify-end">
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-14 w-44 rounded-lg" />
        </div>
      </div>
    </div>
    {/* Input Skeleton */}
    <div className="p-3 sm:p-4 border-t border-border/40 bg-transparent">
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  </div>
);

// Memoized Sidebar Content Component
interface SidebarContentProps {
  sidebarRef: React.RefObject<HTMLDivElement>;
  filteredChats: any[];
  selectedChatId: string | null;
  setSelectedChatId: (id: string | null) => void;
  setNewConversationOpen: (open: boolean) => void;
  setChatToDelete: (id: string | null) => void;
  onPinChat: (chatId: string, currentValue: boolean) => void;
  onFavoriteChat: (chatId: string, currentValue: boolean) => void;
  onToggleLeadAI: (leadId: string, currentValue: boolean) => void;
  isTogglingLeadAI: boolean;
  instancePhoneMap: Record<string, string>;
  selectedInstance: string | null;
  formatMessageDate: (date: string) => string;
  currentAIMode: string | null;
  onToggleAIMode: () => void;
  isTogglingAIMode: boolean;
  canToggleAIMode: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeFilter: "all" | "waiting" | "ai-active";
  setActiveFilter: (filter: "all" | "waiting" | "ai-active") => void;
  selectedChatFolderId: string | null;
  onSelectChatFolder: (folderId: string | null) => void;
  allowedChatFolderIds: string[] | null;
  canManageTeam: boolean;
}

const MemoizedSidebarContent = memo(function SidebarContent({
  sidebarRef,
  filteredChats,
  selectedChatId,
  setSelectedChatId,
  setNewConversationOpen,
  setChatToDelete,
  onPinChat,
  onFavoriteChat,
  onToggleLeadAI,
  isTogglingLeadAI,
  instancePhoneMap,
  selectedInstance,
  formatMessageDate,
  currentAIMode,
  onToggleAIMode,
  isTogglingAIMode,
  canToggleAIMode,
  searchTerm,
  setSearchTerm,
  activeFilter,
  setActiveFilter,
  selectedChatFolderId,
  onSelectChatFolder,
  allowedChatFolderIds,
  canManageTeam,
}: SidebarContentProps) {
  // Generate avatar color from name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-rose-500",
      "bg-pink-500",
      "bg-fuchsia-500",
      "bg-purple-500",
      "bg-violet-500",
      "bg-indigo-500",
      "bg-blue-500",
      "bg-sky-500",
      "bg-cyan-500",
      "bg-teal-500",
      "bg-emerald-500",
      "bg-green-500",
      "bg-lime-500",
      "bg-yellow-500",
      "bg-amber-500",
      "bg-orange-500",
    ];
    const index =
      name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      colors.length;
    return colors[index];
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Format last message preview
  const getMessagePreviewText = (lastMessage: any, isGroup: boolean) => {
    if (!lastMessage) return "";

    let prefix = "";
    if (lastMessage.direction === "outbound" || lastMessage.direction === "outbound_manual") {
      if (lastMessage.isAI) {
        prefix = "🤖 ";
      } else {
        const status = lastMessage.deliveryStatus || 'sent';
        if (status === 'read' || status === 'played') {
          prefix = "✓✓ "; // blue applied via span in render
        } else if (status === 'received') {
          prefix = "✓✓ ";
        } else {
          prefix = "✓ ";
        }
      }
    }

    switch (lastMessage.messageType) {
      case "audio":
        return `${prefix}Áudio`;
      case "image":
        return `${prefix}Imagem`;
      case "video":
        return `${prefix}Vídeo`;
      case "document":
        return `${prefix}Documento`;
      default: {
        const text = String(lastMessage.content || "")
          .replace(/\s+/g, " ")
          .trim();
        return `${prefix}${text}`;
      }
    }
  };

  const formatPreviewForList = (text: string, limit = 35) => {
    const normalized = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) return "";
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
  };

  return (
    <div
      ref={sidebarRef}
      className="flex flex-col h-full min-h-0 overflow-hidden overflow-x-hidden"
    >

      {/* Chat Folder Tabs */}
      <ChatFolderTabs
        selectedFolderId={selectedChatFolderId}
        onSelectFolder={onSelectChatFolder}
        allowedFolderIds={allowedChatFolderIds}
        canManageTeam={canManageTeam}
      />

      <ScrollArea className="flex-1 h-full min-w-0 w-full overflow-x-hidden">
        {filteredChats.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {selectedInstance
              ? "Nenhuma conversa nesta instância"
              : "Nenhuma conversa ainda"}
          </div>
        ) : (
          <div className="px-2 py-1 overflow-hidden">
            {filteredChats.map((chat: any) => {
              const isGroup = chat.isGroup || chat.chat_id?.includes("-group");
              const displayName = (
                chat.leads?.name ||
                (isGroup ? chat.groupName || "Grupo" : "Sem nome")
              ).replace(/^Grupo:\s*/i, "");
              const instancePhone = chat.instanceId
                ? instancePhoneMap[chat.instanceId]
                : null;
              const leadPhoto =
                (chat.leads as any)?.avatar_url ||
                (chat.leads?.metadata as any)?.photo;
              const isSelected = selectedChatId === chat.chat_id;
              const lastMessage = chat.lastMessage;

              const rawPreview =
                getMessagePreviewText(lastMessage, isGroup) ||
                (isGroup
                  ? "Grupo"
                  : chat.leads?.phone?.replace(/^55/, "+55 ")) ||
                "";

              return (
                <motion.div
                  key={chat.chat_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  layout
                  onClick={() => setSelectedChatId(chat.chat_id)}
                  className={`group w-full min-w-0 p-3 my-1 rounded-xl cursor-pointer transition-all duration-200 overflow-hidden border ${isSelected
                    ? "bg-primary/10 border-primary/30 shadow-sm"
                    : "bg-muted/40 hover:bg-muted/70 border-border/30 hover:border-border/50"
                    }`}
                >
                  {/* Outer flex: avatar + content + delete button */}
                  <div className="flex items-start gap-3 min-w-0 w-full">
                    {/* Avatar */}
                    <div className="shrink-0">
                      <Avatar className="h-14 w-14 transition-all">
                        {leadPhoto ? (
                          <AvatarImage src={leadPhoto} alt={displayName} />
                        ) : null}
                        <AvatarFallback
                          className={
                            isGroup
                              ? "bg-blue-500/20"
                              : getAvatarColor(displayName)
                          }
                        >
                          {isGroup ? (
                            <Users className="h-5 w-5 text-blue-500" />
                          ) : (
                            <span className="text-white font-semibold text-sm">
                              {getInitials(displayName)}
                            </span>
                          )}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Content - flex-1 min-w-0 for proper truncation */}
                    <div className="flex-1 min-w-0 py-0.5">
                      {/* Line 1: Pin + Name only */}
                      <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
                        {/* Pin indicator - micro */}
                        {chat.is_pinned && (
                          <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />
                        )}
                        {/* Name - maximum priority with flex-1 min-w-0 */}
                        <p
                          className={`min-w-0 flex-1 font-semibold truncate ${chat.unread_count > 0 ? "text-foreground" : ""}`}
                        >
                          {displayName}
                        </p>
                        {/* Unread count badge */}
                        {chat.unread_count > 0 && (
                          <Badge className="h-5 min-w-5 px-1.5 bg-primary text-primary-foreground text-xs font-bold shrink-0">
                            {chat.unread_count}
                          </Badge>
                        )}
                      </div>

                      {/* Line 2: Message preview with delivery status */}
                      <p
                        className={`text-sm truncate flex items-center gap-1 ${chat.unread_count > 0
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                          }`}
                        title={rawPreview}
                      >
                        {(lastMessage?.direction === "outbound" || lastMessage?.direction === "outbound_manual") && !lastMessage?.isAI && (
                          (lastMessage.deliveryStatus === 'read' || lastMessage.deliveryStatus === 'played')
                            ? <CheckCheck className="h-4 w-4 shrink-0 text-blue-500" />
                            : (lastMessage.deliveryStatus === 'received')
                              ? <CheckCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                              : <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        {lastMessage?.direction === "outbound" && lastMessage?.isAI && (
                          <span>🤖 </span>
                        )}
                        <span className="truncate">
                          <AppleEmojiText
                            text={formatPreviewForList(
                              (lastMessage?.direction === "outbound" || lastMessage?.direction === "outbound_manual")
                                ? getMessagePreviewText(lastMessage, isGroup).replace(/^(🤖 |✓✓ |✓ )/, '')
                                : rawPreview
                            )}
                            emojiSize={16}
                          />
                        </span>
                      </p>

                      {/* Line 3: Time + Icons */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {/* Time */}
                        <span
                          className={`text-xs ${chat.unread_count > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}
                        >
                          {formatMessageDate(chat.created_at)}
                        </span>
                        {/* Favorite indicator */}
                        {chat.is_favorite && (
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                        )}
                        {/* Group indicator */}
                        {isGroup && (
                          <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        )}
                        {/* Hands On indicator */}
                        {chat.ai_paused && !isGroup && (
                          <Hand className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        {/* AI enabled indicator for selective mode */}
                        {currentAIMode === "selective" &&
                          !isGroup &&
                          chat.leads?.ai_enabled && (
                            <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                      </div>
                    </div>

                    {/* Context menu with pin, favorite, delete */}
                    <ChatContextMenu
                      chatId={chat.chat_id}
                      isPinned={chat.is_pinned ?? false}
                      isFavorite={chat.is_favorite ?? false}
                      isAIEnabled={chat.leads?.ai_enabled ?? true}
                      showAIToggle={
                        (currentAIMode === "selective" ||
                          currentAIMode === "all") &&
                        !!chat.lead_id &&
                        !chat.isGroup
                      }
                      isTogglingAI={isTogglingLeadAI}
                      onPin={() =>
                        onPinChat(chat.chat_id, chat.is_pinned ?? false)
                      }
                      onFavorite={() =>
                        onFavoriteChat(chat.chat_id, chat.is_favorite ?? false)
                      }
                      onDelete={() => setChatToDelete(chat.chat_id)}
                      onToggleAI={() =>
                        chat.leads?.id &&
                        onToggleLeadAI(
                          chat.leads.id,
                          chat.leads.ai_enabled ?? true,
                        )
                      }
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
});

// Memoized Chat Content Component
interface ChatContentProps {
  isDesktop?: boolean;
  isLoading: boolean;
  selectedChatId: string | null;
  setSelectedChatId: (id: string | null) => void;
  messages: any[] | undefined;
  chats: any[] | undefined;
  instancePhoneMap: Record<string, string>;
  terminology: { singular: string; plural: string };
  isAIPaused: boolean;
  isAITyping: boolean;
  isContactTyping: boolean;
  isGroupChat: boolean;
  toggleAIPauseMutation: any;
  setChatToDelete: (id: string | null) => void;
  handleSendMessage: (message: string) => void;
  handleSendAudio?: (
    audioBase64: string,
    duration: number,
    mimeType: string,
  ) => void;
  handleSendImage?: (
    imageBase64: string,
    caption: string,
    mimeType: string,
  ) => void;
  handleSendDocument?: (
    base64: string,
    fileName: string,
    caption: string,
    mimeType: string,
    extension: string,
  ) => void;
  sendMessageMutation: any;
  sendAudioMutation?: any;
  sendImageMutation?: any;
  sendDocumentMutation?: any;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onToggleDetails?: () => void;
  showDetailsButton?: boolean;
  quickReplies?: Array<{
    id?: string;
    trigger: string;
    response: string;
    enabled: boolean;
  }>;
  onPinChat?: (chatId: string, currentValue: boolean) => void;
  onFavoriteChat?: (chatId: string, currentValue: boolean) => void;
  onToggleLeadAI?: (leadId: string, currentValue: boolean) => void;
  currentAIMode?: string;
  onOpenPdfPreview?: (url: string, fileName: string) => void;
  onOpenImagePreview?: (url: string, caption: string) => void;
}

const MemoizedChatContent = memo(function ChatContent({
  isDesktop = false,
  isLoading,
  selectedChatId,
  setSelectedChatId,
  messages,
  chats,
  instancePhoneMap,
  terminology,
  isAIPaused,
  isAITyping,
  isContactTyping,
  isGroupChat,
  toggleAIPauseMutation,
  setChatToDelete,
  handleSendMessage,
  handleSendAudio,
  handleSendImage,
  handleSendDocument,
  sendMessageMutation,
  sendAudioMutation,
  sendImageMutation,
  sendDocumentMutation,
  messagesEndRef,
  onToggleDetails,
  showDetailsButton = false,
  quickReplies = [],
  onOpenPdfPreview,
  onPinChat,
  onFavoriteChat,
  onToggleLeadAI,
  currentAIMode,
  onOpenImagePreview,
}: ChatContentProps) {
  // Show skeleton if loading and no cached messages
  if (isLoading && (!messages || messages.length === 0)) {
    return <ChatLoadingSkeleton />;
  }

  if (!selectedChatId) {
    return (
      <div
        className={`flex-1 h-full items-center justify-center whatsapp-doodle-bg ${isDesktop ? "flex" : "hidden"}`}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-6 p-8"
        >
          {/* Animated Icon with Pulse Rings */}
          <div className="relative">
            {/* Outer pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/10"
              animate={{
                scale: [1, 1.8, 1.8],
                opacity: [0.4, 0, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
              style={{ width: 80, height: 80 }}
            />
            {/* Inner pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/15"
              animate={{
                scale: [1, 1.5, 1.5],
                opacity: [0.5, 0, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.4,
              }}
              style={{ width: 80, height: 80 }}
            />
            {/* Main icon container with float + horizontal spin */}
            <motion.div
              className="relative h-20 w-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center backdrop-blur-sm"
              style={{ perspective: 600 }}
              animate={{
                y: [0, -6, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <motion.div
                animate={{ rotateY: [0, 360] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 4,
                  ease: "easeInOut",
                }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <MessageSquare className="h-9 w-9 text-primary" />
              </motion.div>
            </motion.div>
          </div>

          {/* Text Content with stagger */}
          <div className="text-center space-y-2">
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-lg font-semibold text-foreground"
            >
              Selecione uma conversa
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-sm text-muted-foreground max-w-xs"
            >
              Escolha uma conversa na lista ao lado para começar a interagir
            </motion.p>
          </div>

          {/* Subtle bottom badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 mt-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] text-muted-foreground font-medium">
              Pronto para atender
            </span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const chatHeader = chats?.find((c) => c.chat_id === selectedChatId);
  const isGroupHeader =
    chatHeader?.isGroup === true ||
    chatHeader?.chat_id?.includes("-group") === true;
  const rawGroupLeadName = chatHeader?.leads?.name;
  // For groups: prefer groupName, then lead name (only if it's not a raw numeric ID), then "Grupo"
  const displayName = (
    isGroupHeader
      ? chatHeader?.groupName || (rawGroupLeadName && !/^\d{10,}-group$/i.test(rawGroupLeadName) ? rawGroupLeadName : null) || "Grupo"
      : rawGroupLeadName || terminology.singular
  ).replace(/^Grupo:\s*/i, "");
  const instancePhone = chatHeader?.instanceId
    ? instancePhoneMap[chatHeader.instanceId]
    : null;
  const headerPhoto =
    (chatHeader?.leads as any)?.avatar_url ||
    (chatHeader?.leads?.metadata as any)?.photo;
  const showHandsOnButton = !isGroupHeader;

  return (
    <div className="relative z-0 flex-1 h-full min-h-0 min-w-0 flex flex-col overflow-hidden">
      <motion.div
        key={selectedChatId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-border/40 chat-header-bg">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Back button - mobile only */}
              {!isDesktop && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedChatId(null)}
                  className="shrink-0 -ml-1 h-8 w-8"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}

              {/* Avatar - smaller on mobile */}
              {isGroupHeader ? (
                <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-lg">
                  {headerPhoto ? (
                    <AvatarImage src={headerPhoto} alt={displayName} className="rounded-lg" />
                  ) : null}
                  <AvatarFallback className="bg-blue-500/20 rounded-lg">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                  {headerPhoto ? (
                    <AvatarImage src={headerPhoto} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/20">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  </AvatarFallback>
                </Avatar>
              )}

              {/* Name container - maximum priority */}
              <div className="min-w-0 flex-1">
                <p
                  className="font-semibold text-sm sm:text-base truncate cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => {
                    if (chatHeader?.lead_id) {
                      window.location.href = `/leads/${chatHeader.lead_id}`;
                    }
                  }}
                >
                  {displayName}
                </p>
                {/* Instance phone - hidden on very small screens */}
                {instancePhone && (
                  <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <Smartphone className="h-3 w-3" />
                    <span>{instancePhone.replace(/^55/, "+55 ")}</span>
                  </div>
                )}
              </div>

              {/* Mobile: Options menu */}
              {!isDesktop && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() =>
                        selectedChatId &&
                        onPinChat?.(
                          selectedChatId,
                          chatHeader?.is_pinned ?? false,
                        )
                      }
                      className="cursor-pointer"
                    >
                      <Pin
                        className={`h-4 w-4 mr-2 ${chatHeader?.is_pinned ? "text-primary fill-primary" : ""}`}
                      />
                      {chatHeader?.is_pinned ? "Despinar" : "Pinar conversa"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        selectedChatId &&
                        onFavoriteChat?.(
                          selectedChatId,
                          chatHeader?.is_favorite ?? false,
                        )
                      }
                      className="cursor-pointer"
                    >
                      <Star
                        className={`h-4 w-4 mr-2 ${chatHeader?.is_favorite ? "text-yellow-500 fill-yellow-500" : ""}`}
                      />
                      {chatHeader?.is_favorite
                        ? "Remover favorito"
                        : "Favoritar"}
                    </DropdownMenuItem>
                    {!isGroupHeader &&
                      chatHeader?.leads?.id &&
                      (currentAIMode === "selective" ||
                        currentAIMode === "all") && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              chatHeader?.leads?.id &&
                              onToggleLeadAI?.(
                                chatHeader.leads.id,
                                chatHeader.leads.ai_enabled ?? true,
                              )
                            }
                            className="cursor-pointer"
                          >
                            <Bot
                              className={`h-4 w-4 mr-2 ${chatHeader?.leads?.ai_enabled ? "text-primary" : "text-muted-foreground"}`}
                            />
                            {chatHeader?.leads?.ai_enabled
                              ? "Desativar IA"
                              : "Ativar IA"}
                          </DropdownMenuItem>
                        </>
                      )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setChatToDelete(selectedChatId)}
                      className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir conversa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <div className="hidden sm:flex items-center gap-2">
                {!isGroupHeader && chatHeader?.leads?.status && (
                  <Badge
                    variant="outline"
                    className={
                      chatHeader.leads.status === "qualified"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                        : chatHeader.leads.status === "converted"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : chatHeader.leads.status === "contacted"
                            ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                            : chatHeader.leads.status === "lost"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                              : "bg-muted text-muted-foreground border-border"
                    }
                  >
                    {chatHeader.leads.status === "new" && "Novo"}
                    {chatHeader.leads.status === "contacted" && "Contatado"}
                    {chatHeader.leads.status === "qualified" && "Qualificado"}
                    {chatHeader.leads.status === "converted" && "Convertido"}
                    {chatHeader.leads.status === "lost" && "Perdido"}
                  </Badge>
                )}
                {isAIPaused && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  >
                    <Hand className="h-3 w-3 mr-1" />
                    Hands On
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
              <div className="flex sm:hidden items-center gap-1.5 flex-wrap">
                {!isGroupHeader && chatHeader?.leads?.status && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${chatHeader.leads.status === "qualified"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                      : chatHeader.leads.status === "converted"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                        : chatHeader.leads.status === "contacted"
                          ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                          : chatHeader.leads.status === "lost"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                            : "bg-muted text-muted-foreground border-border"
                      }`}
                  >
                    {chatHeader.leads.status === "new" && "N"}
                    {chatHeader.leads.status === "contacted" && "C"}
                    {chatHeader.leads.status === "qualified" && "Q"}
                    {chatHeader.leads.status === "converted" && "CV"}
                    {chatHeader.leads.status === "lost" && "P"}
                  </Badge>
                )}
                {isAIPaused && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  >
                    <Hand className="h-3 w-3" />
                  </Badge>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-4">
                {!isGroupHeader && chatHeader?.leads?.phone && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground font-medium">
                      {chatHeader.leads.phone.replace(/^55/, "+55 ")}
                    </span>
                  </div>
                )}
              </div>

              {showHandsOnButton && !isAIPaused && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAIPauseMutation.mutate(true)}
                        disabled={toggleAIPauseMutation.isPending}
                        className="text-xs sm:text-sm"
                      >
                        {toggleAIPauseMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Hand className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Hands On</span>
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Clique para pausar a IA e assumir manualmente
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Info Button for Details Panel */}
              {showDetailsButton && onToggleDetails && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleDetails}
                        className="hidden sm:flex text-muted-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ver detalhes do contato</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden sm:flex text-muted-foreground hover:text-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() =>
                      selectedChatId &&
                      onPinChat?.(
                        selectedChatId,
                        chatHeader?.is_pinned ?? false,
                      )
                    }
                    className="cursor-pointer"
                  >
                    <Pin
                      className={`h-4 w-4 mr-2 ${chatHeader?.is_pinned ? "text-primary fill-primary" : ""}`}
                    />
                    {chatHeader?.is_pinned ? "Despinar" : "Pinar conversa"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      selectedChatId &&
                      onFavoriteChat?.(
                        selectedChatId,
                        chatHeader?.is_favorite ?? false,
                      )
                    }
                    className="cursor-pointer"
                  >
                    <Star
                      className={`h-4 w-4 mr-2 ${chatHeader?.is_favorite ? "text-yellow-500 fill-yellow-500" : ""}`}
                    />
                    {chatHeader?.is_favorite ? "Remover favorito" : "Favoritar"}
                  </DropdownMenuItem>
                  {!isGroupHeader &&
                    chatHeader?.leads?.id &&
                    (currentAIMode === "selective" ||
                      currentAIMode === "all") && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            chatHeader?.leads?.id &&
                            onToggleLeadAI?.(
                              chatHeader.leads.id,
                              chatHeader.leads.ai_enabled ?? true,
                            )
                          }
                          className="cursor-pointer"
                        >
                          <Bot
                            className={`h-4 w-4 mr-2 ${chatHeader?.leads?.ai_enabled ? "text-primary" : "text-muted-foreground"}`}
                          />
                          {chatHeader?.leads?.ai_enabled
                            ? "Desativar IA"
                            : "Ativar IA"}
                        </DropdownMenuItem>
                      </>
                    )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setChatToDelete(selectedChatId)}
                    className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir conversa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* AI Paused Banner */}
        {isAIPaused && (
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[inset_0_-1px_0_rgba(245,158,11,0.1)]">
            {/* Subtle glow effect */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-500/20 shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-amber-800 dark:text-amber-300 text-sm tracking-tight">
                  Automação Pausada (Modo Manual)
                </span>
                <span className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium mt-0.5">
                  Você está no controle deste atendimento.
                </span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => toggleAIPauseMutation.mutate(false)}
              disabled={toggleAIPauseMutation.isPending}
              className="relative z-10 bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow-md hover:shadow-amber-500/20 w-full sm:w-auto text-xs font-semibold tracking-wide transition-all border border-amber-600/50"
            >
              {toggleAIPauseMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Bot className="h-3.5 w-3.5 mr-1.5" />
              )}
              Reativar IA
            </Button>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 h-full p-4 whatsapp-doodle-bg">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages?.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhuma mensagem ainda
              </div>
            ) : (
              <>
                {messages?.map((msg, index) => {
                  const showDateSeparator =
                    index === 0 ||
                    !isToday(new Date(messages[index - 1].created_at!)) ||
                    !isToday(new Date(msg.created_at!));

                  return (
                    <div key={msg.id}>
                      {showDateSeparator && (
                        <div className="flex items-center justify-center my-4">
                          <Badge variant="secondary" className="text-xs">
                            {isToday(new Date(msg.created_at!))
                              ? "Hoje"
                              : isYesterday(new Date(msg.created_at!))
                                ? "Ontem"
                                : format(
                                  new Date(msg.created_at!),
                                  "dd/MM/yyyy",
                                  {
                                    locale: ptBR,
                                  },
                                )}
                          </Badge>
                        </div>
                      )}
                      <div
                        className={`flex ${msg.direction === "inbound"
                          ? "justify-start"
                          : "justify-end"
                          }`}
                      >
                        <div className="flex flex-col gap-1 max-w-[85%] sm:max-w-[70%]">
                          {msg.direction !== "inbound" && (
                            <div className="flex items-center gap-1.5 justify-end px-1">
                              {msg.direction === "outbound_manual" ? (
                                <>
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {(msg.metadata as any)?.userName ||
                                      "Usuário"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Bot className="h-3 w-3 text-primary" />
                                  <span className="text-xs text-primary font-medium">
                                    IA
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          {msg.direction === "inbound" && (
                            <div className="flex items-center gap-1.5 px-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {(msg.metadata as any)?.senderName || "Cliente"}
                              </span>
                            </div>
                          )}
                          <Card
                            className={`rounded-2xl ${msg.message_type === "sticker"
                              ? "bg-transparent p-0 shadow-none border-none"
                              : `p-3 shadow-sm ${msg.direction === "inbound"
                                ? "bg-card/80 backdrop-blur-sm border-border/50 rounded-tl-sm"
                                : msg.direction === "outbound_manual"
                                  ? "bg-secondary/60 backdrop-blur-sm border-secondary/50 rounded-tr-sm"
                                  : "bg-primary/90 dark:bg-primary/80 text-primary-foreground border-primary/50 shadow-primary/10 rounded-tr-sm"
                              }`
                              }`}
                          >
                            <div className="text-sm whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none prose-p:m-0 prose-p:leading-relaxed prose-ol:my-1 prose-ul:my-1 prose-li:my-0.5">
                              {msg.message_type === "audio" ? (
                                <AudioMessageBubble
                                  metadata={msg.metadata as any}
                                  content={msg.content}
                                />
                              ) : msg.message_type === "image" ? (
                                <div className="flex flex-col gap-2">
                                  {msg.content && (
                                    <span className="text-sm">
                                      {msg.content}
                                    </span>
                                  )}
                                  {(msg.metadata as any)?.mediaUrl && (
                                    <img
                                      src={(msg.metadata as any).mediaUrl}
                                      alt={msg.content || "Imagem"}
                                      className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() =>
                                        onOpenImagePreview?.(
                                          (msg.metadata as any).mediaUrl,
                                          msg.content || "Imagem",
                                        )
                                      }
                                    />
                                  )}
                                </div>
                              ) : msg.message_type === "video" || msg.message_type === "document" ? (
                                (() => {
                                  // Generic rendering for documents and videos
                                  const meta = msg.metadata as any;
                                  const fileName = (msg.content || meta?.fileName || "documento").toLowerCase();
                                  const mimeType = (meta?.mimeType || meta?.zapi_payload?.document?.mimeType || meta?.zapi_payload?.video?.mimeType || "").toLowerCase();
                                  const videoExts = [".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"];

                                  const isVideoType = msg.message_type === "video" || mimeType.startsWith("video/") || videoExts.some(ext => fileName.endsWith(ext));
                                  const isPdfType = fileName.endsWith(".pdf") || mimeType === "application/pdf";
                                  const mediaUrl = meta?.mediaUrl;

                                  return (
                                    <div className="flex flex-col gap-2">
                                      {/* Header Icon & Title */}
                                      <div className="flex items-center gap-2">
                                        {isVideoType ? <Video className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                                        <span className="font-medium">{msg.content}</span>
                                      </div>

                                      {/* Media Content Region */}
                                      {mediaUrl && (
                                        <>
                                          {isVideoType && (
                                            <video controls src={mediaUrl} className="max-w-xs rounded-lg mb-1" />
                                          )}

                                          {/* Action Buttons */}
                                          <div className={`flex items-center gap-3 ${isVideoType ? "ml-1" : "ml-6"}`}>
                                            {isPdfType ? (
                                              <button
                                                onClick={() => onOpenPdfPreview?.(mediaUrl, msg.content || meta?.fileName || "documento.pdf")}
                                                className="text-xs text-primary hover:underline flex items-center gap-1"
                                              >
                                                <Eye className="h-3 w-3" />
                                                Visualizar
                                              </button>
                                            ) : !isVideoType && (
                                              <button
                                                onClick={async () => {
                                                  try {
                                                    const response = await fetch(mediaUrl);
                                                    const blob = await response.blob();
                                                    window.open(URL.createObjectURL(blob), "_blank");
                                                  } catch (error) {
                                                    toast.error(`Erro ao abrir documento`);
                                                  }
                                                }}
                                                className="text-xs text-primary hover:underline flex items-center gap-1"
                                              >
                                                <Eye className="h-3 w-3" />
                                                Visualizar
                                              </button>
                                            )}
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const response = await fetch(mediaUrl);
                                                  const blob = await response.blob();
                                                  const blobUrl = URL.createObjectURL(blob);
                                                  const link = document.createElement("a");
                                                  link.href = blobUrl;
                                                  link.download = msg.content || (isVideoType ? "video.mp4" : "documento");
                                                  document.body.appendChild(link);
                                                  link.click();
                                                  document.body.removeChild(link);
                                                  URL.revokeObjectURL(blobUrl);
                                                  toast.success("Download iniciado!");
                                                } catch (error) {
                                                  toast.error(`Erro ao baixar ${isVideoType ? 'vídeo' : 'documento'}`);
                                                }
                                              }}
                                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                                            >
                                              <Download className="h-3 w-3" />
                                              Baixar
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : msg.message_type === "call" ? (
                                <div className="flex items-center gap-2 text-muted-foreground italic">
                                  <Phone className="h-4 w-4" />
                                  <span>{msg.content}</span>
                                </div>
                              ) : msg.message_type === "sticker" ? (
                                (() => {
                                  const stickerUrl = (msg.metadata as any)?.mediaUrl || (msg.metadata as any)?.zapi_payload?.sticker?.stickerUrl;
                                  return (
                                    <div className="flex items-center justify-center relative group">
                                      {stickerUrl ? (
                                        <img
                                          src={stickerUrl}
                                          alt="Sticker"
                                          className="max-w-[180px] max-h-[180px] w-auto h-auto drop-shadow-sm transition-transform group-hover:scale-[1.02]"
                                        />
                                      ) : (
                                        <div className="flex items-center gap-2 bg-card border shadow-sm p-3 text-card-foreground rounded-2xl">
                                          <span>🎨</span>
                                          <span>{msg.content}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : (
                                <MarkdownWithAppleEmoji content={msg.content} />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <p className="text-xs opacity-70">
                                {format(new Date(msg.created_at!), "HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                              {msg.direction !== "inbound" && (
                                <MessageStatusIndicator
                                  status={(msg as any).delivery_status}
                                  isAI={msg.direction === "outbound"}
                                />
                              )}
                            </div>
                            {msg.direction === "outbound" &&
                              (msg.metadata as any)?.usedAudioTranscription && (
                                <TranscriptionIndicator />
                              )}
                          </Card>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isContactTyping && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="flex flex-col gap-1 max-w-[85%] sm:max-w-[70%]">
                      <div className="flex items-center gap-1.5 px-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Digitando...
                        </span>
                      </div>
                      <Card className="p-3 bg-card border-border">
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-muted-foreground/70 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-2 h-2 bg-muted-foreground/70 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 bg-muted-foreground/70 rounded-full animate-bounce"></span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}
                {isAITyping && !isAIPaused && (
                  <div className="flex justify-end animate-fade-in">
                    <div className="flex flex-col gap-1 max-w-[85%] sm:max-w-[70%]">
                      <div className="flex items-center gap-1.5 justify-end px-1">
                        <Bot className="h-3 w-3 text-primary" />
                        <span className="text-xs text-primary font-medium">
                          IA
                        </span>
                      </div>
                      <Card className="p-3 bg-primary/80 dark:bg-primary/70 border-primary/60">
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-primary-foreground/70 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-2 h-2 bg-primary-foreground/70 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 bg-primary-foreground/70 rounded-full animate-bounce"></span>
                          </div>
                          <span className="text-xs text-primary-foreground/70 ml-2">
                            Digitando...
                          </span>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-border/40 bg-transparent">
          {isGroupChat ? (
            <div className="flex items-center justify-center text-muted-foreground text-sm py-3">
              <Users className="h-4 w-4 mr-2" />
              Respostas manuais para grupos não são suportadas
            </div>
          ) : (
            <MessageInput
              onSend={handleSendMessage}
              onSendAudio={handleSendAudio}
              onSendImage={handleSendImage}
              onSendDocument={handleSendDocument}
              isPending={false}
              isImagePending={false}
              isDocumentPending={false}
              quickReplies={quickReplies}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
});

const Conversations = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedInstance = searchParams.get("instance");
  const preSelectedChat = searchParams.get("chat");
  const newLeadId = searchParams.get("newLead");
  const debugOverflow = searchParams.get("debugOverflow") === "1";

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [isAITyping, setIsAITyping] = useState(false);

  // Listen for header "new conversation" button
  useEffect(() => {
    const handler = () => setNewConversationOpen(true);
    window.addEventListener("open-new-conversation", handler);
    return () => window.removeEventListener("open-new-conversation", handler);
  }, []);
  const [isContactTyping, setIsContactTyping] = useState(false);
  const [isContactOnline, setIsContactOnline] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "waiting" | "ai-active"
  >("all");
  const [selectedChatFolderId, setSelectedChatFolderId] = useState<
    string | null
  >(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    fileName: string;
  } | null>(null);
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    caption: string;
  } | null>(null);
  const [showKBWarningModal, setShowKBWarningModal] = useState(false);
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const hasAutoSelectedRef = useRef(false);
  const { terminology } = useTerminology();
  const { user, profile } = useAuth();

  // Lead folder access control (reused for conversation tabs)
  const { allowedFolderIds: allowedChatFolderIds, isAdmin: canManageTeam } =
    useLeadFolderAccess();

  // Fetch lead-folder relations for filtering conversations by lead folder
  const { data: leadFolderRelations } = useQuery({
    queryKey: ["lead-folder-relations-map", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      const { data, error } = await supabase
        .from("lead_folder_relations")
        .select("lead_id, folder_id");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.workspace_id,
  });

  const formatMessageDate = useCallback((date: string) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, "HH:mm", { locale: ptBR });
    } else if (isYesterday(messageDate)) {
      return `Ontem ${format(messageDate, "HH:mm", { locale: ptBR })}`;
    } else {
      return format(messageDate, "dd/MM/yyyy HH:mm", { locale: ptBR });
    }
  }, []);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "instant" : "smooth",
    });
  };

  // Debug: highlights and logs any element overflowing the sidebar width
  useEffect(() => {
    if (!debugOverflow) return;

    const root = sidebarRef.current;
    if (!root) return;

    let raf = 0;

    const scan = () => {
      // Clear previous markers
      root
        .querySelectorAll<HTMLElement>("[data-overflow-debug='1']")
        .forEach((el) => {
          el.style.outline = "";
          el.removeAttribute("data-overflow-debug");
        });

      const baseWidth = root.clientWidth;
      const all = Array.from(root.querySelectorAll<HTMLElement>("*"));

      all.forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
          el.setAttribute("data-overflow-debug", "1");
          el.style.outline = "2px solid hsl(var(--destructive))";
          console.warn("[OverflowDebug]", {
            tag: el.tagName,
            className: el.className,
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            sidebarWidth: baseWidth,
            text: (el.textContent || "").slice(0, 80),
          });
        }
      });
    };

    raf = window.requestAnimationFrame(scan);
    const onResize = () => window.requestAnimationFrame(scan);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [debugOverflow]);

  // Fetch WhatsApp instances for the workspace (including is_paused for typing indicator)
  const { data: whatsappInstances } = useQuery({
    queryKey: ["whatsapp-instances", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select(
          "id, instance_id, phone, status, is_paused, ai_mode, ai_template_id, super_agent_id",
        )
        .eq("workspace_id", profile.workspace_id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.workspace_id,
  });

  // Get the super agent ID for the selected instance
  const activeSuperAgentId = useMemo(() => {
    if (!selectedInstance || !whatsappInstances) return null;
    const instance = whatsappInstances.find(
      (i) => i.instance_id === selectedInstance,
    );
    return instance?.super_agent_id || null;
  }, [selectedInstance, whatsappInstances]);

  // Fetch quick replies from the active super agent
  const { data: quickReplies = [] } = useQuery({
    queryKey: ["agent-quick-replies", activeSuperAgentId],
    queryFn: async () => {
      if (!activeSuperAgentId) return [];
      const { data, error } = await supabase
        .from("super_agents")
        .select("quick_replies")
        .eq("id", activeSuperAgentId)
        .single();

      if (error) throw error;
      return (
        (data?.quick_replies as Array<{
          id?: string;
          trigger: string;
          response: string;
          enabled: boolean;
        }>) || []
      );
    },
    enabled: !!activeSuperAgentId,
  });

  // Create a map of instanceId to phone for quick lookup
  const instancePhoneMap = useMemo(() => {
    const map: Record<string, string> = {};
    whatsappInstances?.forEach((instance) => {
      if (instance.instance_id && instance.phone) {
        map[instance.instance_id] = instance.phone;
      }
    });
    return map;
  }, [whatsappInstances]);

  // Create a map of instanceId to is_paused for checking global pause state
  const instancePausedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    whatsappInstances?.forEach((instance) => {
      if (instance.instance_id) {
        map[instance.instance_id] = instance.is_paused ?? false;
      }
    });
    return map;
  }, [whatsappInstances]);

  // Create a map of instanceId to ai_mode for checking AI mode (only connected instances)
  const instanceAIModeMap = useMemo(() => {
    const map: Record<string, string> = {};
    whatsappInstances?.forEach((instance) => {
      // Only consider connected instances for AI mode display
      if (instance.instance_id && instance.status === "connected") {
        map[instance.instance_id] = instance.ai_mode ?? "selective";
      }
    });
    return map;
  }, [whatsappInstances]);

  // Create a map of instanceId to UUID for mutations
  const instanceIdToUuidMap = useMemo(() => {
    const map: Record<string, string> = {};
    whatsappInstances?.forEach((instance) => {
      if (instance.instance_id && instance.id) {
        map[instance.instance_id] = instance.id;
      }
    });
    return map;
  }, [whatsappInstances]);

  // Determine current AI mode based on selected instance or all instances
  const currentAIMode = useMemo(() => {
    const modes = Object.values(instanceAIModeMap);
    if (modes.length === 0) return null;

    // If filtering by instance, show that instance's mode
    if (selectedInstance && instanceAIModeMap[selectedInstance]) {
      return instanceAIModeMap[selectedInstance];
    }

    // If all instances have the same mode, show that mode
    const allSame = modes.every((m) => m === modes[0]);
    if (allSame) return modes[0];

    // Mixed modes
    return "mixed";
  }, [instanceAIModeMap, selectedInstance]);

  // Filter only connected instances for toggle logic
  const connectedInstances = useMemo(() => {
    return whatsappInstances?.filter((i) => i.status === "connected") || [];
  }, [whatsappInstances]);

  // Determine if toggle is available (single connected instance or filtered)
  const canToggleAIMode = useMemo(() => {
    if (connectedInstances.length === 0) return false;
    // Can toggle if there's only 1 connected instance or if filtering by instance
    return connectedInstances.length === 1 || !!selectedInstance;
  }, [connectedInstances, selectedInstance]);

  // Check if workspace has configured KB
  const { data: kbReadyCount } = useQuery({
    queryKey: ["kb-ready-count", profile?.workspace_id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("knowledge_base")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", profile!.workspace_id)
        .eq("is_active", true)
        .eq("embedding_status", "completed");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.workspace_id,
    staleTime: 30000,
  });

  const hasConfiguredKB = (kbReadyCount ?? 0) >= 1;

  // Handler for force activate all without KB
  const handleForceActivateAll = async () => {
    setShowKBWarningModal(false);

    const newMode = "all";
    const uuid = selectedInstance
      ? instanceIdToUuidMap[selectedInstance]
      : connectedInstances.length === 1
        ? connectedInstances[0].id
        : null;

    if (!uuid) return;

    const { error } = await supabase
      .from("whatsapp_instances")
      .update({ ai_mode: newMode })
      .eq("id", uuid);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.warning(
        "Modo 'Todos' ativado sem base de conhecimento. A IA pode dar respostas genéricas.",
      );
    }
  };

  // Mutation for toggling AI mode
  const toggleAIModeMutation = useMutation({
    mutationFn: async () => {
      const newMode = currentAIMode === "all" ? "selective" : "all";

      // If trying to activate "all" and no KB, show modal
      if (newMode === "all" && !hasConfiguredKB) {
        setShowKBWarningModal(true);
        throw new Error("KB_VALIDATION");
      }

      // If filtering by instance, toggle just that one
      if (selectedInstance) {
        const uuid = instanceIdToUuidMap[selectedInstance];
        if (!uuid) throw new Error("Instância não encontrada");

        const { error } = await supabase
          .from("whatsapp_instances")
          .update({ ai_mode: newMode })
          .eq("id", uuid);

        if (error) throw error;
      } else if (connectedInstances.length === 1) {
        // Single connected instance, toggle it
        const uuid = connectedInstances[0].id;
        if (!uuid) throw new Error("Instância não encontrada");

        const { error } = await supabase
          .from("whatsapp_instances")
          .update({ ai_mode: newMode })
          .eq("id", uuid);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      const newMode = currentAIMode === "all" ? "seletivo" : "todos";
      toast.success(`Modo da IA alterado para "${newMode}"`);
    },
    onError: (error: Error) => {
      if (error.message === "KB_VALIDATION") return; // Don't show error toast
      console.error("Error toggling AI mode:", error);
      toast.error("Erro ao alterar modo da IA");
    },
  });

  const { data: chats } = useQuery({
    queryKey: ["chats", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];

      // Fetch all data in 3 parallel queries instead of N+1
      const [messagesResult, unreadResult, memoryResult] = await Promise.all([
        supabase
          .from("messages")
          .select(
            "chat_id, lead_id, created_at, content, direction, message_type, metadata, delivery_status, leads(id, name, phone, metadata, status, score, ai_enabled, avatar_url)",
          )
          .eq("workspace_id", profile.workspace_id)
          .neq("message_type", "note")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("messages")
          .select("chat_id")
          .eq("workspace_id", profile.workspace_id)
          .eq("direction", "inbound")
          .eq("is_read", false),
        supabase
          .from("chat_memory")
          .select("chat_id, ai_paused, is_pinned, is_favorite, folder_id")
          .eq("workspace_id", profile.workspace_id),
      ]);

      if (messagesResult.error) throw messagesResult.error;

      const data = messagesResult.data;

      // Create lookup maps for O(1) access
      const unreadByChat = (unreadResult.data || []).reduce(
        (acc: Record<string, number>, msg) => {
          acc[msg.chat_id] = (acc[msg.chat_id] || 0) + 1;
          return acc;
        },
        {},
      );

      const memoryByChat = (memoryResult.data || []).reduce(
        (
          acc: Record<
            string,
            {
              ai_paused: boolean;
              is_pinned: boolean;
              is_favorite: boolean;
              folder_id: string | null;
            }
          >,
          mem,
        ) => {
          acc[mem.chat_id] = {
            ai_paused: mem.ai_paused ?? false,
            is_pinned: (mem as any).is_pinned ?? false,
            is_favorite: (mem as any).is_favorite ?? false,
            folder_id: (mem as any).folder_id ?? null,
          };
          return acc;
        },
        {} as Record<
          string,
          {
            ai_paused: boolean;
            is_pinned: boolean;
            is_favorite: boolean;
            folder_id: string | null;
          }
        >,
      );

      // Group by lead_id (preferred) or chat_id (fallback for messages without lead)
      // This prevents duplicate conversations when the same lead has messages with different chat_id formats
      const chatMap = new Map<string, any>();

      data.forEach((msg: any) => {
        const chatId = msg.chat_id;
        const leadId = msg.lead_id;
        const meta = msg.metadata as any;
        // Use lead_id as the primary grouping key when available, fallback to chat_id
        const groupKey = leadId || chatId;

        if (chatMap.has(groupKey)) {
          // Only update missing instanceId/groupName
          const existing = chatMap.get(groupKey);
          if (!existing.instanceId && meta?.instanceId) {
            existing.instanceId = meta.instanceId;
          }
          if (!existing.groupName && meta?.groupName) {
            existing.groupName = meta.groupName;
          }
          // Track all chat_ids for this lead (for unread count aggregation)
          if (chatId && !existing._allChatIds.has(chatId)) {
            existing._allChatIds.add(chatId);
          }
        } else {
          // First message for this chat (already the most recent due to ORDER BY)
          const isGroup = chatId?.includes("-group") || meta?.isGroup === true;
          chatMap.set(groupKey, {
            chat_id: chatId,
            lead_id: leadId,
            created_at: msg.created_at,
            leads: msg.leads,
            instanceId: meta?.instanceId || null,
            isGroup,
            groupName: meta?.groupName || null,
            lastMessage: {
              content: msg.content,
              direction: msg.direction,
              messageType: msg.message_type,
              isAI: meta?.respondedByAI === true,
              deliveryStatus: msg.delivery_status || 'sent',
            },
            _allChatIds: new Set([chatId]),
          });
        }
      });

      const uniqueChats = Array.from(chatMap.values());

      // Enrich with unread count and AI paused/pinned/favorite status from maps (no additional queries!)
      return uniqueChats.map((chat: any) => {
        // Aggregate unread count across all chat_ids for this lead
        let totalUnread = 0;
        for (const cid of chat._allChatIds) {
          totalUnread += unreadByChat[cid] || 0;
        }
        // Check memory by any of the chat_ids (primary first)
        let memory = memoryByChat[chat.chat_id];
        if (!memory) {
          for (const cid of chat._allChatIds) {
            if (memoryByChat[cid]) {
              memory = memoryByChat[cid];
              break;
            }
          }
        }
        // Remove internal tracking set before returning
        const { _allChatIds, ...cleanChat } = chat;
        return {
          ...cleanChat,
          unread_count: totalUnread,
          ai_paused: memory?.ai_paused ?? false,
          is_pinned: memory?.is_pinned ?? false,
          is_favorite: memory?.is_favorite ?? false,
          folder_id: memory?.folder_id ?? null,
        };
      });
    },
    enabled: !!profile?.workspace_id,
  });

  // Filter chats by selected instance, search term, and active filter, then sort with pinned first
  const filteredChats = useMemo(() => {
    if (!chats) return [];
    let result = selectedInstance
      ? chats.filter((chat) => chat.instanceId === selectedInstance)
      : chats;

    // Apply lead folder filter — show conversations whose lead belongs to the selected folder
    if (selectedChatFolderId !== null && leadFolderRelations) {
      const leadsInFolder = new Set(
        leadFolderRelations
          .filter((r: any) => r.folder_id === selectedChatFolderId)
          .map((r: any) => r.lead_id)
      );
      result = result.filter((chat) => chat.lead_id && leadsInFolder.has(chat.lead_id));
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      result = result.filter((chat) => {
        const name = (chat.leads?.name || "").toLowerCase();
        const phone = (chat.leads?.phone || "").toLowerCase();
        return name.includes(search) || phone.includes(search);
      });
    }

    // Apply active filter
    if (activeFilter === "waiting") {
      result = result.filter((chat) => chat.unread_count > 0);
    } else if (activeFilter === "ai-active") {
      result = result.filter((chat) => !chat.ai_paused && !chat.isGroup);
    }

    // Sort: pinned first, then by date
    return result.sort((a, b) => {
      // Pinned chats first
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      // Then by date (most recent first)
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [chats, selectedInstance, searchTerm, activeFilter, selectedChatFolderId, leadFolderRelations]);

  // Fetch messages with loading state
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", selectedChatId, profile?.workspace_id],
    queryFn: async () => {
      if (!selectedChatId || !profile?.workspace_id) return [];

      // First try by chat_id
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", selectedChatId)
        .eq("workspace_id", profile.workspace_id)
        .neq("message_type", "note")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // If no messages found by chat_id, try by lead_id (selectedChatId might be a lead_id due to grouping)
      if ((!data || data.length === 0) && selectedChatId.includes("-")) {
        const { data: leadMessages, error: leadError } = await supabase
          .from("messages")
          .select("*")
          .eq("lead_id", selectedChatId)
          .eq("workspace_id", profile.workspace_id)
          .neq("message_type", "note")
          .order("created_at", { ascending: true });

        if (leadError) throw leadError;
        return leadMessages;
      }

      return data;
    },
    enabled: !!selectedChatId && !!profile?.workspace_id,
  });

  // Fetch chat_memory for the selected chat (Hands On state)
  const { data: chatMemory, isLoading: memoryLoading } = useQuery({
    queryKey: ["chat_memory", selectedChatId, profile?.workspace_id],
    queryFn: async () => {
      if (!selectedChatId || !profile?.workspace_id) return null;

      const { data, error } = await supabase
        .from("chat_memory")
        .select("id, ai_paused")
        .eq("chat_id", selectedChatId)
        .eq("workspace_id", profile.workspace_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedChatId && !!profile?.workspace_id,
  });

  // Unified loading state - only show loading when both are needed
  const isChatLoading = messagesLoading || memoryLoading;

  const isAIPaused = chatMemory?.ai_paused ?? false;

  // Stable reference to queryClient for use in effects without triggering re-subscriptions
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  // Mark messages as read when opening a chat and reset typing state
  useEffect(() => {
    // Reset typing state and online status when changing chats
    setIsAITyping(false);
    setIsContactTyping(false);
    setIsContactOnline(null);

    const markAsRead = async () => {
      if (!selectedChatId) return;

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("chat_id", selectedChatId)
        .eq("direction", "inbound")
        .eq("is_read", false);

      // Refresh chat list and unread counts in sidebar
      queryClientRef.current.invalidateQueries({ queryKey: ["chats"] });
      queryClientRef.current.invalidateQueries({
        queryKey: ["unread-by-instance"],
      });
    };

    markAsRead();
  }, [selectedChatId]);

  // Ref for contact typing timeout
  const contactTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Realtime subscription for contact presence (typing + online status)
  useEffect(() => {
    if (!selectedChatId) return;

    const presenceChannel = supabase
      .channel(`presence-${selectedChatId}`)
      .on("broadcast", { event: "presence" }, (payload: any) => {
        console.log("[Conversations] Presence event received:", payload);

        if (payload.payload?.chatId === selectedChatId) {
          // Handle typing
          const isTyping = payload.payload?.isTyping ?? false;
          setIsContactTyping(isTyping);

          // Auto-clear typing indicator after 5 seconds
          if (contactTypingTimeoutRef.current) {
            clearTimeout(contactTypingTimeoutRef.current);
          }
          if (isTyping) {
            contactTypingTimeoutRef.current = setTimeout(() => {
              setIsContactTyping(false);
              contactTypingTimeoutRef.current = null;
            }, 5000);
          }

          // Handle online status
          if (payload.payload?.isOnline) {
            setIsContactOnline(true);
          } else if (payload.payload?.isOffline) {
            setIsContactOnline(false);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      if (contactTypingTimeoutRef.current) {
        clearTimeout(contactTypingTimeoutRef.current);
      }
    };
  }, [selectedChatId]);

  // Ref for typing timeout to be able to clear it
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Realtime subscription for new messages in selected chat (INSERT only - no UPDATE to avoid markAsRead loop)
  useEffect(() => {
    if (!selectedChatId || !profile?.workspace_id) return;

    const channel = supabase
      .channel(`messages-${selectedChatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${selectedChatId}`,
        },
        async (payload: any) => {
          console.log("New message detected:", payload);
          queryClientRef.current.invalidateQueries({
            queryKey: ["messages", selectedChatId, profile?.workspace_id],
          });
          queryClientRef.current.invalidateQueries({ queryKey: ["chats"] });

          // Hide typing indicator when outbound (AI) message arrives
          if (payload.new?.direction === "outbound") {
            setIsAITyping(false);
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = null;
            }
            return;
          }

          // For inbound messages, clear contact typing and check AI state
          if (payload.new?.direction === "inbound") {
            // Contact sent a message, so they stopped typing
            setIsContactTyping(false);
            if (contactTypingTimeoutRef.current) {
              clearTimeout(contactTypingTimeoutRef.current);
              contactTypingTimeoutRef.current = null;
            }

            // Invalidate chat_memory cache first
            queryClientRef.current.invalidateQueries({
              queryKey: ["chat_memory", selectedChatId, profile?.workspace_id],
            });

            // Fresh check from database to avoid stale cache (conversation-level pause)
            const { data: memoryCheck } = await supabase
              .from("chat_memory")
              .select("ai_paused")
              .eq("chat_id", selectedChatId)
              .maybeSingle();

            const isConversationPaused = memoryCheck?.ai_paused ?? false;

            // Check if the instance is globally paused
            const messageInstanceId = (payload.new?.metadata as any)
              ?.instanceId;
            const isInstancePaused = messageInstanceId
              ? (instancePausedMap[messageInstanceId] ?? false)
              : false;

            // Check selective mode and lead ai_enabled
            const instanceMode = messageInstanceId
              ? instanceAIModeMap[messageInstanceId]
              : null;
            const isSelectiveMode = instanceMode === "selective";

            let isLeadAIEnabled = true; // Default to true
            if (isSelectiveMode && payload.new?.lead_id) {
              const { data: leadCheck } = await supabase
                .from("leads")
                .select("ai_enabled")
                .eq("id", payload.new.lead_id)
                .maybeSingle();

              isLeadAIEnabled = leadCheck?.ai_enabled ?? true;
            }

            console.log("[Conversations] AI typing indicator check:", {
              chatId: selectedChatId,
              isConversationPaused,
              isInstancePaused,
              isSelectiveMode,
              isLeadAIEnabled,
              instanceId: messageInstanceId,
            });

            // Only show typing if ALL conditions are met
            const shouldShowTyping =
              !isConversationPaused &&
              !isInstancePaused &&
              (!isSelectiveMode || isLeadAIEnabled);

            if (shouldShowTyping) {
              setIsAITyping(true);

              // Auto-clear typing indicator after 30 seconds if AI doesn't respond
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              typingTimeoutRef.current = setTimeout(() => {
                console.log(
                  "[Conversations] Typing indicator timeout - clearing",
                );
                setIsAITyping(false);
                typingTimeoutRef.current = null;
              }, 30000);
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${selectedChatId}`,
        },
        (payload: any) => {
          const newRecord = payload.new;

          // React to delivery_status changes (sent/received/read/played)
          if (newRecord?.delivery_status && newRecord.delivery_status !== payload.old?.delivery_status) {
            console.log(
              "[Conversations] Delivery status updated, refreshing messages",
              { messageId: newRecord.id, status: newRecord.delivery_status },
            );
            queryClientRef.current.invalidateQueries({
              queryKey: ["messages", selectedChatId, profile?.workspace_id],
            });
          }

          // React to audio messages with transcription
          if (
            newRecord?.message_type === "audio" &&
            newRecord?.metadata?.transcription
          ) {
            console.log(
              "[Conversations] Audio transcription detected, refreshing messages",
              {
                messageId: newRecord.id,
                transcription: newRecord.metadata.transcription?.substring(
                  0,
                  50,
                ),
              },
            );
            queryClientRef.current.invalidateQueries({
              queryKey: ["messages", selectedChatId, profile?.workspace_id],
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [
    selectedChatId,
    profile?.workspace_id,
    instancePausedMap,
    instanceAIModeMap,
  ]);

  // Realtime subscription for all new messages in workspace (INSERT only - no UPDATE to avoid loops)
  useEffect(() => {
    if (!profile?.workspace_id) return;

    const channel = supabase
      .channel("all-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `workspace_id=eq.${profile.workspace_id}`,
        },
        () => {
          queryClientRef.current.invalidateQueries({ queryKey: ["chats"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.workspace_id]);

  // Reset initial load flag when changing chats
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [selectedChatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      scrollToBottom(isInitialLoadRef.current);
      isInitialLoadRef.current = false;
    }
  }, [messages]);

  // Reset auto-select flag when URL param changes (new navigation)
  useEffect(() => {
    hasAutoSelectedRef.current = false;
  }, [preSelectedChat]);

  // Auto-select chat from URL param (only once to prevent re-selection on refetch)
  useEffect(() => {
    if (
      preSelectedChat &&
      chats &&
      chats.length > 0 &&
      !hasAutoSelectedRef.current
    ) {
      const chatExists = chats.some((c) => c.chat_id === preSelectedChat);
      if (chatExists) {
        setSelectedChatId(preSelectedChat);
        hasAutoSelectedRef.current = true;
      }
    }
  }, [preSelectedChat, chats]);

  // Auto-open new conversation dialog with pre-selected lead from URL
  useEffect(() => {
    if (newLeadId) {
      setNewConversationOpen(true);
    }
  }, [newLeadId]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageToSend: string) => {
      if (!selectedChatId || !messageToSend.trim()) return;

      const selectedChat = chats?.find((c) => c.chat_id === selectedChatId);

      // Verificar se é grupo usando isGroup flag ou padrão do chat_id
      const isGroup =
        selectedChat?.isGroup === true ||
        selectedChat?.chat_id?.includes("-group") === true;
      if (isGroup) {
        throw new Error("Não é possível enviar mensagens manuais para grupos");
      }

      console.log("[Conversations] Sending message:", {
        chat_id: selectedChatId,
        lead_id: selectedChat?.lead_id,
        isGroup,
        hasLeadId: !!selectedChat?.lead_id,
      });

      const { data, error } = await supabase.functions.invoke("manual-inbox", {
        body: {
          chat_id: selectedChatId,
          message: messageToSend,
          lead_id: selectedChat?.lead_id || null, // Pode ser null, a edge function vai criar
          user_id: user?.id,
          user_name: profile?.display_name || user?.email || "Usuário",
        },
      });

      if (error) {
        let errorMessage = "Erro desconhecido";
        try {
          if (error.context) {
            const errorBody = await error.context.json();
            errorMessage = errorBody.error || error.message || errorMessage;
          } else {
            errorMessage = (data as any)?.error || error.message || errorMessage;
          }
        } catch (e) {
          errorMessage = error.message || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return data;
    },
    onMutate: async (messageToSend) => {
      if (!selectedChatId) return { previousMessages: undefined };
      const queryKey = ["messages", selectedChatId, profile?.workspace_id];
      await queryClient.cancelQueries({ queryKey });
      const previousMessages = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return [...old, {
          id: `temp-${Date.now()}`,
          chat_id: selectedChatId,
          content: messageToSend,
          direction: "outbound",
          message_type: "text",
          created_at: new Date().toISOString(),
          delivery_status: "pending",
          metadata: {}
        }];
      });
      return { previousMessages };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChatId] });
    },
    onError: (error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", selectedChatId, profile?.workspace_id], context.previousMessages);
      }
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar mensagem",
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChatId] });
    },
  });

  // Send audio message mutation
  const sendAudioMutation = useMutation({
    mutationFn: async ({
      audioBase64,
      duration,
      mimeType,
    }: {
      audioBase64: string;
      duration: number;
      mimeType: string;
    }) => {
      if (!selectedChatId) return;

      const selectedChat = chats?.find((c) => c.chat_id === selectedChatId);

      // Verificar se é grupo
      const isGroup =
        selectedChat?.isGroup === true ||
        selectedChat?.chat_id?.includes("-group") === true;
      if (isGroup) {
        throw new Error("Não é possível enviar áudio para grupos");
      }

      console.log("[Conversations] Sending audio:", {
        chat_id: selectedChatId,
        lead_id: selectedChat?.lead_id,
        duration,
        mimeType,
      });

      const { data, error } = await supabase.functions.invoke("manual-inbox", {
        body: {
          chat_id: selectedChatId,
          lead_id: selectedChat?.lead_id || null,
          user_id: user?.id,
          user_name: profile?.display_name || user?.email || "Usuário",
          audio_base64: audioBase64,
          audio_duration: duration,
          audio_mime_type: mimeType,
        },
      });

      if (error) {
        const errorMessage =
          (data as any)?.error || error.message || "Erro desconhecido";
        throw new Error(errorMessage);
      }
      return data;
    },
    onMutate: async (variables) => {
      if (!selectedChatId) return { previousMessages: undefined };
      const queryKey = ["messages", selectedChatId, profile?.workspace_id];
      await queryClient.cancelQueries({ queryKey });
      const previousMessages = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        const mediaUrl = variables.audioBase64.startsWith('data:')
          ? variables.audioBase64
          : `data:${variables.mimeType};base64,${variables.audioBase64}`;

        return [...old, {
          id: `temp-${Date.now()}`,
          chat_id: selectedChatId,
          content: "[Áudio 🎤]",
          direction: "outbound",
          message_type: "audio",
          created_at: new Date().toISOString(),
          delivery_status: "pending",
          metadata: {
            duration: variables.duration,
            mediaUrl
          }
        }];
      });
      return { previousMessages };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChatId] });
    },
    onError: (error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", selectedChatId, profile?.workspace_id], context.previousMessages);
      }
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar áudio",
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChatId] });
    },
  });

  // Send image message mutation
  const sendImageMutation = useMutation({
    mutationFn: async ({
      imageBase64,
      caption,
      mimeType,
    }: {
      imageBase64: string;
      caption: string;
      mimeType: string;
    }) => {
      if (!selectedChatId) return;

      const selectedChat = chats?.find((c) => c.chat_id === selectedChatId);

      // Verificar se é grupo
      const isGroup =
        selectedChat?.isGroup === true ||
        selectedChat?.chat_id?.includes("-group") === true;
      if (isGroup) {
        throw new Error("Não é possível enviar imagem para grupos");
      }

      console.log("[Conversations] Sending image:", {
        chat_id: selectedChatId,
        lead_id: selectedChat?.lead_id,
        mimeType,
        hasCaption: !!caption,
      });

      const { data, error } = await supabase.functions.invoke("manual-inbox", {
        body: {
          chat_id: selectedChatId,
          lead_id: selectedChat?.lead_id || null,
          user_id: user?.id,
          user_name: profile?.display_name || user?.email || "Usuário",
          image_base64: imageBase64,
          image_mime_type: mimeType,
          image_caption: caption,
        },
      });

      if (error) {
        const errorMessage =
          (data as any)?.error || error.message || "Erro desconhecido";
        throw new Error(errorMessage);
      }
      return data;
    },
    onMutate: async (variables) => {
      if (!selectedChatId) return { previousMessages: undefined };
      const queryKey = ["messages", selectedChatId, profile?.workspace_id];
      await queryClient.cancelQueries({ queryKey });
      const previousMessages = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        const mediaUrl = variables.imageBase64.startsWith('data:')
          ? variables.imageBase64
          : `data:${variables.mimeType};base64,${variables.imageBase64}`;

        return [...old, {
          id: `temp-${Date.now()}`,
          chat_id: selectedChatId,
          content: variables.caption || "[Imagem 📷]",
          direction: "outbound",
          message_type: "image",
          created_at: new Date().toISOString(),
          delivery_status: "pending",
          metadata: {
            mediaUrl
          }
        }];
      });
      return { previousMessages };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChatId] });
    },
    onError: (error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", selectedChatId, profile?.workspace_id], context.previousMessages);
      }
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar imagem",
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChatId] });
    },
  });

  // Send document message mutation
  const sendDocumentMutation = useMutation({
    mutationFn: async ({
      base64,
      fileName,
      caption,
      mimeType,
      extension,
    }: {
      base64: string;
      fileName: string;
      caption: string;
      mimeType: string;
      extension: string;
    }) => {
      if (!selectedChatId) return;

      const selectedChat = chats?.find((c) => c.chat_id === selectedChatId);

      // Verificar se é grupo
      const isGroup =
        selectedChat?.isGroup === true ||
        selectedChat?.chat_id?.includes("-group") === true;
      if (isGroup) {
        throw new Error("Não é possível enviar documento para grupos");
      }

      console.log("[Conversations] Sending document:", {
        chat_id: selectedChatId,
        lead_id: selectedChat?.lead_id,
        fileName,
        mimeType,
        extension,
        hasCaption: !!caption,
      });

      const { data, error = null } = await supabase.functions.invoke(
        "manual-inbox",
        {
          body: {
            chat_id: selectedChatId,
            lead_id: selectedChat?.lead_id || null,
            user_id: user?.id,
            user_name: profile?.display_name || user?.email || "Usuário",
            document_base64: base64,
            document_mime_type: mimeType,
            document_file_name: fileName,
            document_extension: extension,
            document_caption: caption,
          },
        },
      );

      if (error) {
        const errorMessage =
          (data as any)?.error || error.message || "Erro desconhecido";
        throw new Error(errorMessage);
      }
      return data;
    },
    onMutate: async (variables) => {
      if (!selectedChatId) return { previousMessages: undefined };
      const queryKey = ["messages", selectedChatId, profile?.workspace_id];
      await queryClient.cancelQueries({ queryKey });
      const previousMessages = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        const mediaUrl = variables.base64.startsWith('data:')
          ? variables.base64
          : `data:${variables.mimeType};base64,${variables.base64}`;

        return [...old, {
          id: `temp-${Date.now()}`,
          chat_id: selectedChatId,
          content: variables.caption || "[Documento 📄]",
          direction: "outbound",
          message_type: "document",
          created_at: new Date().toISOString(),
          delivery_status: "pending",
          metadata: {
            fileName: variables.fileName,
            extension: variables.extension,
            mediaUrl
          }
        }];
      });
      return { previousMessages };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChatId] });
    },
    onError: (error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", selectedChatId, profile?.workspace_id], context.previousMessages);
      }
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar documento",
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChatId] });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (chatId: string) => {
      // Delete all messages for this chat
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("chat_id", chatId);

      if (messagesError) throw messagesError;

      // Delete buffer if exists
      await supabase.from("message_buffer").delete().eq("chat_id", chatId);

      // Delete chat memory if exists (filtrar por workspace_id para isolamento)
      await supabase
        .from("chat_memory")
        .delete()
        .eq("chat_id", chatId)
        .eq("workspace_id", profile?.workspace_id);
    },
    onSuccess: () => {
      toast.success("Conversa excluída!");
      if (selectedChatId === chatToDelete) {
        setSelectedChatId(null);
      }
      setChatToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir conversa: " + error.message);
      setChatToDelete(null);
    },
  });

  // Toggle AI pause (Hands On mode) mutation
  const toggleAIPauseMutation = useMutation({
    mutationFn: async (pause: boolean) => {
      if (!selectedChatId) return;

      const selectedChat = chats?.find((c) => c.chat_id === selectedChatId);

      // Upsert chat_memory with ai_paused value
      const { error } = await supabase.from("chat_memory").upsert(
        {
          chat_id: selectedChatId,
          lead_id: selectedChat?.lead_id || null,
          ai_paused: pause,
          pause_reason: pause ? "manual" : null,
          paused_at: pause ? new Date().toISOString() : null,
          paused_by: pause ? user?.id : null,
          conversation_history: chatMemory ? undefined : [],
          workspace_id: profile?.workspace_id,
        },
        { onConflict: "chat_id,workspace_id" },
      );

      if (error) throw error;
    },
    onSuccess: (_, pause) => {
      toast.success(
        pause ? "Modo Hands On ativado - IA pausada" : "IA reativada",
      );
      queryClient.invalidateQueries({
        queryKey: ["chat_memory", selectedChatId, profile?.workspace_id],
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao alternar modo: " + error.message);
    },
  });

  // Toggle pin mutation
  const togglePinMutation = useMutation({
    mutationFn: async ({
      chatId,
      currentValue,
    }: {
      chatId: string;
      currentValue: boolean;
    }) => {
      const chat = chats?.find((c) => c.chat_id === chatId);

      const { error } = await supabase.from("chat_memory").upsert(
        {
          chat_id: chatId,
          workspace_id: profile?.workspace_id,
          lead_id: chat?.lead_id || null,
          is_pinned: !currentValue,
          conversation_history: [],
        },
        { onConflict: "chat_id,workspace_id" },
      );

      if (error) throw error;
    },
    onSuccess: (_, { currentValue }) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      toast.success(currentValue ? "Conversa despinada" : "Conversa pinada");
    },
    onError: (error: Error) => {
      toast.error("Erro ao alterar pin: " + error.message);
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({
      chatId,
      currentValue,
    }: {
      chatId: string;
      currentValue: boolean;
    }) => {
      const chat = chats?.find((c) => c.chat_id === chatId);

      // Atualizar chat_memory
      const { error } = await supabase.from("chat_memory").upsert(
        {
          chat_id: chatId,
          workspace_id: profile?.workspace_id,
          lead_id: chat?.lead_id || null,
          is_favorite: !currentValue,
          conversation_history: [],
        },
        { onConflict: "chat_id,workspace_id" },
      );

      if (error) throw error;

      // Também atualizar o lead se existir
      if (chat?.lead_id) {
        const { error: leadError } = await supabase
          .from("leads")
          .update({ is_favorite: !currentValue })
          .eq("id", chat.lead_id);

        if (leadError)
          console.warn("Erro ao atualizar lead favorito:", leadError);
      }
    },
    onSuccess: (_, { currentValue }) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        currentValue ? "Removido dos favoritos" : "Adicionado aos favoritos",
      );
    },
    onError: (error: Error) => {
      toast.error("Erro ao alterar favorito: " + error.message);
    },
  });

  // Toggle lead AI enabled (for selective mode)
  const toggleLeadAIMutation = useMutation({
    mutationFn: async ({
      leadId,
      currentValue,
    }: {
      leadId: string;
      currentValue: boolean;
    }) => {
      const { error } = await supabase
        .from("leads")
        .update({ ai_enabled: !currentValue })
        .eq("id", leadId);

      if (error) throw error;
    },

    onSuccess: (_, { currentValue }) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      toast.success(
        currentValue
          ? "IA desativada para este contato"
          : "IA ativada para este contato",
      );
    },
    onError: (error: Error) => {
      toast.error("Erro ao alterar configuração da IA: " + error.message);
    },
  });

  // Check if current chat is a group (using isGroup flag or chat_id pattern)
  const selectedChat = chats?.find((c) => c.chat_id === selectedChatId);
  const isGroupChat =
    selectedChat?.isGroup === true ||
    selectedChat?.chat_id?.includes("-group") === true;

  console.log("[Conversations] isGroupChat check:", {
    chatId: selectedChat?.chat_id,
    isGroup: selectedChat?.isGroup,
    hasGroupInId: selectedChat?.chat_id?.includes("-group"),
    leadId: selectedChat?.lead_id,
    result: isGroupChat,
  });

  const handleSendMessage = useCallback(
    (message: string) => {
      sendMessageMutation.mutate(message);
    },
    [sendMessageMutation],
  );

  // Note: isMobile is now always a boolean (never undefined) due to sync initialization

  return (
    <div className="flex flex-1 w-full h-full min-w-0 overflow-hidden relative">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-[300px] ambient-glow-primary blur-[120px] rounded-full pointer-events-none -translate-y-1/2 z-0" />
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] ambient-glow-secondary blur-[120px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/2 z-0" />

      {isMobile ? (
        // Mobile Layout - Either list OR chat, never both
        selectedChatId ? (
          <div className="w-full h-full flex flex-col overflow-hidden pb-24 md:pb-0 relative z-10 glass border-x-0 sm:border-x">
            <MemoizedChatContent
              isDesktop={false}
              isLoading={isChatLoading}
              selectedChatId={selectedChatId}
              setSelectedChatId={setSelectedChatId}
              messages={messages}
              chats={chats}
              instancePhoneMap={instancePhoneMap}
              terminology={terminology}
              isAIPaused={isAIPaused}
              isAITyping={isAITyping}
              isContactTyping={isContactTyping}
              isGroupChat={isGroupChat}
              toggleAIPauseMutation={toggleAIPauseMutation}
              setChatToDelete={setChatToDelete}
              handleSendMessage={handleSendMessage}
              handleSendAudio={(audioBase64, duration, mimeType) =>
                sendAudioMutation.mutate({ audioBase64, duration, mimeType })
              }
              handleSendImage={(imageBase64, caption, mimeType) =>
                sendImageMutation.mutate({ imageBase64, caption, mimeType })
              }
              handleSendDocument={(
                base64,
                fileName,
                caption,
                mimeType,
                extension,
              ) =>
                sendDocumentMutation.mutate({
                  base64,
                  fileName,
                  caption,
                  mimeType,
                  extension,
                })
              }
              sendMessageMutation={sendMessageMutation}
              sendAudioMutation={sendAudioMutation}
              sendImageMutation={sendImageMutation}
              sendDocumentMutation={sendDocumentMutation}
              messagesEndRef={messagesEndRef}
              quickReplies={quickReplies}
              onOpenPdfPreview={(url, fileName) =>
                setPdfPreview({ url, fileName })
              }
              onOpenImagePreview={(url, caption) =>
                setImagePreview({ url, caption })
              }
              onPinChat={(chatId, currentValue) =>
                togglePinMutation.mutate({ chatId, currentValue })
              }
              onFavoriteChat={(chatId, currentValue) =>
                toggleFavoriteMutation.mutate({ chatId, currentValue })
              }
              onToggleLeadAI={(leadId, currentValue) =>
                toggleLeadAIMutation.mutate({ leadId, currentValue })
              }
              currentAIMode={currentAIMode}
            />
          </div>
        ) : (
          <div className="w-full h-full flex relative z-10">
            <div className="w-full h-full border-r border-border/40 glass flex flex-col">
              <MemoizedSidebarContent
                sidebarRef={sidebarRef}
                filteredChats={filteredChats}
                selectedChatId={selectedChatId}
                setSelectedChatId={setSelectedChatId}
                setNewConversationOpen={setNewConversationOpen}
                setChatToDelete={setChatToDelete}
                onPinChat={(chatId, currentValue) =>
                  togglePinMutation.mutate({ chatId, currentValue })
                }
                onFavoriteChat={(chatId, currentValue) =>
                  toggleFavoriteMutation.mutate({ chatId, currentValue })
                }
                onToggleLeadAI={(leadId, currentValue) =>
                  toggleLeadAIMutation.mutate({ leadId, currentValue })
                }
                isTogglingLeadAI={toggleLeadAIMutation.isPending}
                instancePhoneMap={instancePhoneMap}
                selectedInstance={selectedInstance}
                formatMessageDate={formatMessageDate}
                currentAIMode={currentAIMode}
                onToggleAIMode={() => toggleAIModeMutation.mutate()}
                isTogglingAIMode={toggleAIModeMutation.isPending}
                canToggleAIMode={canToggleAIMode}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                selectedChatFolderId={selectedChatFolderId}
                onSelectChatFolder={setSelectedChatFolderId}
                allowedChatFolderIds={allowedChatFolderIds}
                canManageTeam={canManageTeam}
              />
            </div>
          </div>
        )
      ) : (
        // Desktop Layout - Resizable Panels
        <ResizablePanelGroup
          direction="horizontal"
          className="flex h-full w-full relative z-10"
        >
          <ResizablePanel
            defaultSize={25}
            minSize={15}
            maxSize={45}
            className="border-r border-border/40 glass flex flex-col h-full"
          >
            <MemoizedSidebarContent
              sidebarRef={sidebarRef}
              filteredChats={filteredChats}
              selectedChatId={selectedChatId}
              setSelectedChatId={setSelectedChatId}
              setNewConversationOpen={setNewConversationOpen}
              setChatToDelete={setChatToDelete}
              onPinChat={(chatId, currentValue) =>
                togglePinMutation.mutate({ chatId, currentValue })
              }
              onFavoriteChat={(chatId, currentValue) =>
                toggleFavoriteMutation.mutate({ chatId, currentValue })
              }
              onToggleLeadAI={(leadId, currentValue) =>
                toggleLeadAIMutation.mutate({ leadId, currentValue })
              }
              isTogglingLeadAI={toggleLeadAIMutation.isPending}
              instancePhoneMap={instancePhoneMap}
              selectedInstance={selectedInstance}
              formatMessageDate={formatMessageDate}
              currentAIMode={currentAIMode}
              onToggleAIMode={() => toggleAIModeMutation.mutate()}
              isTogglingAIMode={toggleAIModeMutation.isPending}
              canToggleAIMode={canToggleAIMode}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              selectedChatFolderId={selectedChatFolderId}
              onSelectChatFolder={setSelectedChatFolderId}
              allowedChatFolderIds={allowedChatFolderIds}
              canManageTeam={canManageTeam}
            />
          </ResizablePanel>

          <ResizableHandle
            withHandle
            className="bg-border hover:bg-primary/20 transition-colors"
          />

          <ResizablePanel
            defaultSize={showDetailsPanel && selectedChatId ? 50 : 75}
            className="flex-1 h-full min-w-0"
          >
            <MemoizedChatContent
              isDesktop
              isLoading={isChatLoading}
              selectedChatId={selectedChatId}
              setSelectedChatId={setSelectedChatId}
              messages={messages}
              chats={chats}
              instancePhoneMap={instancePhoneMap}
              terminology={terminology}
              isAIPaused={isAIPaused}
              isAITyping={isAITyping}
              isContactTyping={isContactTyping}
              isGroupChat={isGroupChat}
              toggleAIPauseMutation={toggleAIPauseMutation}
              setChatToDelete={setChatToDelete}
              handleSendMessage={handleSendMessage}
              handleSendAudio={(audioBase64, duration, mimeType) =>
                sendAudioMutation.mutate({ audioBase64, duration, mimeType })
              }
              handleSendImage={(imageBase64, caption, mimeType) =>
                sendImageMutation.mutate({ imageBase64, caption, mimeType })
              }
              handleSendDocument={(
                base64,
                fileName,
                caption,
                mimeType,
                extension,
              ) =>
                sendDocumentMutation.mutate({
                  base64,
                  fileName,
                  caption,
                  mimeType,
                  extension,
                })
              }
              sendMessageMutation={sendMessageMutation}
              sendAudioMutation={sendAudioMutation}
              sendImageMutation={sendImageMutation}
              sendDocumentMutation={sendDocumentMutation}
              messagesEndRef={messagesEndRef}
              onToggleDetails={() => setShowDetailsPanel(!showDetailsPanel)}
              showDetailsButton={!!selectedChatId}
              quickReplies={quickReplies}
              onOpenPdfPreview={(url, fileName) =>
                setPdfPreview({ url, fileName })
              }
              onOpenImagePreview={(url, caption) =>
                setImagePreview({ url, caption })
              }
              onPinChat={(chatId, currentValue) =>
                togglePinMutation.mutate({ chatId, currentValue })
              }
              onFavoriteChat={(chatId, currentValue) =>
                toggleFavoriteMutation.mutate({ chatId, currentValue })
              }
              onToggleLeadAI={(leadId, currentValue) =>
                toggleLeadAIMutation.mutate({ leadId, currentValue })
              }
              currentAIMode={currentAIMode}
            />
          </ResizablePanel>

          {/* Contact Details Panel */}
          {showDetailsPanel && selectedChatId && selectedChat && (
            <>
              <ResizableHandle
                withHandle
                className="bg-border hover:bg-primary/20 transition-colors"
              />
              <ResizablePanel
                defaultSize={25}
                minSize={20}
                maxSize={35}
                className="h-full"
              >
                <ContactDetailsPanel
                  lead={
                    selectedChat?.leads
                      ? {
                        id: selectedChat.leads.id,
                        name: selectedChat.leads.name,
                        phone: selectedChat.leads.phone,
                        email: selectedChat.leads.email || null,
                        status: selectedChat.leads.status,
                        score: selectedChat.leads.score,
                        created_at: selectedChat.created_at,
                        metadata: selectedChat.leads.metadata,
                        avatar_url: (selectedChat.leads as any)?.avatar_url,
                      }
                      : null
                  }
                  instancePhone={
                    selectedChat?.instanceId
                      ? instancePhoneMap[selectedChat.instanceId]
                      : null
                  }
                  workspaceId={profile?.workspace_id}
                  onClose={() => setShowDetailsPanel(false)}
                  onLeadUpdated={() =>
                    queryClient.invalidateQueries({ queryKey: ["chats"] })
                  }
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!chatToDelete}
        onOpenChange={() => setChatToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as mensagens desta conversa
              serão permanentemente excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                chatToDelete && deleteConversationMutation.mutate(chatToDelete)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        existingChats={chats || []}
        onConversationCreated={(chatId) => setSelectedChatId(chatId)}
        preSelectedLeadId={newLeadId || undefined}
      />

      {/* PDF Preview Dialog */}
      <PDFPreviewDialog
        open={!!pdfPreview}
        onOpenChange={(open) => !open && setPdfPreview(null)}
        pdfUrl={pdfPreview?.url || ""}
        fileName={pdfPreview?.fileName || ""}
      />

      {/* Image Viewer Dialog */}
      <ImageViewerDialog
        open={!!imagePreview}
        onOpenChange={(open) => !open && setImagePreview(null)}
        imageUrl={imagePreview?.url || ""}
        caption={imagePreview?.caption || ""}
      />

      {/* KB Warning AlertDialog */}
      <AlertDialog
        open={showKBWarningModal}
        onOpenChange={setShowKBWarningModal}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Base de Conhecimento Vazia
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você ainda não configurou sua{" "}
                  <strong>Base de Conhecimento</strong>. Sem ela, a IA não terá
                  informações sobre seu negócio e pode dar respostas genéricas
                  ou incorretas.
                </p>
                <p className="text-sm text-muted-foreground">
                  Recomendamos adicionar pelo menos FAQs básicos antes de ativar
                  o modo "Todos".
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:gap-3">
            <AlertDialogAction
              onClick={() => navigate("/ai-settings?tab=knowledge")}
              className="w-full"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Configurar Base de Conhecimento
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault();
                handleForceActivateAll();
              }}
              className="w-full border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
            >
              Ativar mesmo assim
            </AlertDialogCancel>
            <AlertDialogCancel className="w-full">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Conversations;
