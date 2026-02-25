import { useState, useRef, useEffect, useMemo } from "react";
import { X, Send, Sparkles, Bot, User, Trash2, ArrowRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown, { Components } from "react-markdown";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mapeamento de rotas
const routeMap: Record<string, string> = {
  'Dashboard': '/dashboard',
  'Leads': '/leads',
  'Conversas': '/conversations',
  'Agentes': '/ai-settings',
  'Agendamentos': '/appointments',
  'Conexões': '/whatsapp',
  'Configurações': '/settings',
  'Estatísticas': '/statistics',
};

// Componente de botão de ação rápida
const QuickActionButton = ({ 
  route, 
  onNavigate 
}: { 
  route: string; 
  onNavigate: (path: string) => void;
}) => {
  const path = routeMap[route];
  if (!path) return null;
  
  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-2 mr-2 gap-1.5 text-xs h-7 bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary"
      onClick={() => onNavigate(path)}
    >
      <ArrowRight className="h-3 w-3" />
      Ir para {route}
    </Button>
  );
};

// Parser para extrair ações rápidas do texto
const parseQuickActions = (content: string): { cleanContent: string; actions: string[] } => {
  const regex = /\[IR PARA: ([^\]]+)\]/g;
  const actions: string[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    actions.push(match[1]);
  }
  
  const cleanContent = content.replace(regex, '').trim();
  return { cleanContent, actions };
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    // Get user session token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Você precisa estar logado para usar o assistente IA");
    }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      if (resp.status === 401) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      throw new Error(errorData.error || `Erro ${resp.status}`);
    }
    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (error) {
    onError(error instanceof Error ? error.message : "Erro desconhecido");
  }
}

export const AIChatSidebar = ({ isOpen, onClose }: AIChatSidebarProps) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Sou o assistente IA do Appi AutoZap. Como posso ajudar você hoje?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200); // Match animation duration
  };

  // Componentes customizados para melhor formatação do Markdown
  const markdownComponents: Components = useMemo(() => ({
    p: ({ children }) => (
      <p className="my-2.5 leading-relaxed text-foreground/90">{children}</p>
    ),
    strong: ({ children }) => {
      const text = String(children);
      const isTitle = text.endsWith(':') || text.length > 15;
      
      if (isTitle) {
        return (
          <strong className="block mt-4 mb-2 font-semibold text-primary border-l-2 border-primary pl-2 py-0.5">
            {children}
          </strong>
        );
      }
      return <strong className="font-semibold text-foreground">{children}</strong>;
    },
    ul: ({ children }) => (
      <ul className="my-3 ml-1 space-y-2">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-3 ml-1 space-y-2 list-decimal list-inside">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="flex items-start gap-2 text-foreground/90">
        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
        <span className="flex-1">{children}</span>
      </li>
    ),
    h1: ({ children }) => (
      <h1 className="text-lg font-bold mt-4 mb-2 text-foreground">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-base font-bold mt-4 mb-2 text-foreground">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-bold mt-3 mb-2 text-foreground">{children}</h3>
    ),
    code: ({ children, className }) => {
      const isBlock = className?.includes('language-');
      if (isBlock) {
        return (
          <code className="block bg-background/60 rounded-lg p-3 my-2 text-xs overflow-x-auto">
            {children}
          </code>
        );
      }
      return (
        <code className="bg-background/60 px-1.5 py-0.5 rounded text-xs">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-3 overflow-hidden rounded-lg">{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-3 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
  }), []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id !== "welcome") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: assistantContent,
            timestamp: new Date(),
          },
        ];
      });
    };

    // Prepare messages for API (exclude welcome message, map to API format)
    const apiMessages = [...messages.filter(m => m.id !== "welcome"), userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await streamChat({
      messages: apiMessages,
      onDelta: upsertAssistant,
      onDone: () => setIsLoading(false),
      onError: (error) => {
        setIsLoading(false);
        toast.error(error);
        // Add error message
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
            timestamp: new Date(),
          },
        ]);
      },
    });
  };

  const clearHistory = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Olá! Sou o assistente IA do Appi AutoZap. Como posso ajudar você hoje?",
        timestamp: new Date(),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-background/50 backdrop-blur-sm z-[45] lg:hidden",
          isClosing ? "ai-backdrop-closing" : "ai-backdrop-animate"
        )}
        onClick={handleClose}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed right-0 top-0 h-screen border-l border-border bg-card z-[55] flex flex-col",
          isClosing ? "ai-sidebar-closing" : "ai-sidebar-animate",
          isMaximized ? "w-[80vw] max-w-[1000px]" : "w-96 max-w-full"
        )}
      >
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4 shrink-0 ai-content-animate">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center ai-icon-hover ai-sparkle-animate">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Assistente IA</h3>
              <p className="text-xs text-muted-foreground">Powered by Gemini</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Limpar histórico"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar histórico?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todas as mensagens serão apagadas. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={clearHistory}>
                      Limpar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? "Minimizar" : "Maximizar"}
            >
              {isMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 ai-message-animate",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
                style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted/80 rounded-bl-md"
                  )}
                >
                  {message.role === "assistant" ? (
                    (() => {
                      const { cleanContent, actions } = parseQuickActions(message.content);
                      const handleNavigate = (path: string) => {
                        navigate(path);
                        onClose();
                      };
                      return (
                        <div className="max-w-none">
                          <ReactMarkdown components={markdownComponents}>
                            {cleanContent}
                          </ReactMarkdown>
                          {actions.length > 0 && (
                            <div className="flex flex-wrap mt-3 pt-2 border-t border-border/50">
                              {actions.map((action, idx) => (
                                <QuickActionButton 
                                  key={idx} 
                                  route={action} 
                                  onNavigate={handleNavigate}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border shrink-0 ai-content-animate" style={{ animationDelay: '0.15s' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </aside>
    </>
  );
};
