import { Pin, Star, Trash2, MoreVertical, Bot } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatContextMenuProps {
  chatId: string;
  isPinned: boolean;
  isFavorite: boolean;
  isAIEnabled?: boolean;
  showAIToggle?: boolean;
  isTogglingAI?: boolean;
  onPin: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onToggleAI?: () => void;
}

export function ChatContextMenu({
  chatId,
  isPinned,
  isFavorite,
  isAIEnabled = true,
  showAIToggle = false,
  isTogglingAI = false,
  onPin,
  onFavorite,
  onDelete,
  onToggleAI,
}: ChatContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 p-1.5 rounded-lg bg-background/80 backdrop-blur-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Opções"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          className="cursor-pointer"
        >
          <Pin className={`h-4 w-4 mr-2 ${isPinned ? "text-primary fill-primary" : ""}`} />
          {isPinned ? "Despinar" : "Pinar conversa"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onFavorite();
          }}
          className="cursor-pointer"
        >
          <Star className={`h-4 w-4 mr-2 ${isFavorite ? "text-yellow-500 fill-yellow-500" : ""}`} />
          {isFavorite ? "Remover favorito" : "Favoritar"}
        </DropdownMenuItem>
        
        {showAIToggle && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onToggleAI?.();
              }}
              disabled={isTogglingAI}
              className="cursor-pointer"
            >
              <Bot className={`h-4 w-4 mr-2 ${isAIEnabled ? "text-primary" : "text-muted-foreground"}`} />
              {isTogglingAI ? "Alterando..." : isAIEnabled ? "Desativar IA" : "Ativar IA"}
            </DropdownMenuItem>
          </>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir conversa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}