import { useNavigate } from "react-router-dom";
import { MessageSquare, ChevronRight } from "lucide-react";

interface Message {
  id: string;
  chat_id: string;
  content: string;
  created_at: string;
  direction: string;
  is_read?: boolean;
  unread_count?: number;
  leads?: {
    name: string | null;
    phone: string;
  } | null;
}

interface MobileRecentConversationsProps {
  messages: Message[];
  getTimeAgo: (date: string) => string;
}

export function MobileRecentConversations({ messages, getTimeAgo }: MobileRecentConversationsProps) {
  const navigate = useNavigate();

  if (!messages || messages.length === 0) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Conversas Recentes
          </h2>
        </div>
        <div className="bg-card rounded-3xl border border-dashed border-border/50 dark:border-white/10">
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Nenhuma conversa recente
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Conversas Recentes
        </h2>
        <button 
          onClick={() => navigate("/conversations")}
          className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
        >
          Ver todas
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* Unified container */}
      <div className="bg-card rounded-3xl border border-border/30 dark:border-white/5 overflow-hidden shadow-sm">
        {messages.map((msg, index) => (
          <div 
            key={msg.id}
            className={`flex items-center gap-4 p-4 hover:bg-muted/50 dark:hover:bg-white/5 transition-colors cursor-pointer active:bg-muted ${
              index < messages.length - 1 ? "border-b border-border/30 dark:border-white/5" : ""
            }`}
            onClick={() => navigate(`/conversations?chat=${msg.chat_id}`)}
          >
            {/* Avatar with online indicator */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold text-sm">
                  {(msg.leads?.name || msg.leads?.phone || "?")[0].toUpperCase()}
                </span>
              </div>
              {/* Pending message indicator - shows when last message was from client */}
              {msg.direction === "inbound" && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-primary border-2 border-card rounded-full" />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="font-medium text-sm text-foreground truncate">
                  {msg.leads?.name || msg.leads?.phone || "Desconhecido"}
                </p>
                <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1.5">
                  {msg.unread_count && msg.unread_count > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                      {msg.unread_count > 99 ? "99+" : msg.unread_count}
                    </span>
                  )}
                  {getTimeAgo(msg.created_at)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {msg.direction === "inbound" ? "" : "Você: "}
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
