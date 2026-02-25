import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Trash2,
  Bot,
  Sparkles,
  Clock,
  Calendar,
  HelpCircle,
  ShoppingBag,
  Loader2
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const EXAMPLE_MESSAGES = [
  { label: "Horário", message: "Qual o horário de atendimento?", icon: Clock },
  { label: "Agendar", message: "Quero agendar um horário", icon: Calendar },
  { label: "Dúvida", message: "Tenho uma dúvida sobre os serviços", icon: HelpCircle },
  { label: "Preços", message: "Quais são os preços?", icon: ShoppingBag },
];

const MAX_DEMO_MESSAGES = 5;

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Typing animation component
const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-2 py-1">
    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

export const LandingAIDemo = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load message count from session storage
  useEffect(() => {
    const storedCount = sessionStorage.getItem('landing-demo-count');
    if (storedCount) {
      setMessageCount(parseInt(storedCount, 10));
    }
  }, []);

  // Auto-scroll to bottom with smooth animation
  useEffect(() => {
    if (scrollRef.current) {
      // ScrollArea has a viewport inside, we need to scroll that
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      const elementToScroll = viewport || scrollRef.current;
      elementToScroll.scrollTo({
        top: elementToScroll.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping]);

  const streamChat = async (userMessage: string) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-ai-demo`;

    setIsTyping(true);

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userMessage,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || `Error: ${resp.status}`);
    }

    if (!resp.body) throw new Error("No response body");

    setIsTyping(false);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";
    const assistantTimestamp = new Date();

    while (true) {
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
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg?.role === "assistant") {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent, timestamp: assistantTimestamp }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    // Check message limit
    if (messageCount >= MAX_DEMO_MESSAGES) {
      toast.info("Limite de demonstração atingido. Crie sua conta para continuar!");
      return;
    }

    const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Increment and save message count
    const newCount = messageCount + 1;
    setMessageCount(newCount);
    sessionStorage.setItem('landing-demo-count', newCount.toString());

    try {
      await streamChat(text);
    } catch (error) {
      console.error("Error streaming chat:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao processar";
      toast.error(errorMessage);
      setIsTyping(false);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const handleCreateAccount = () => {
    navigate('/auth?tab=signup');
  };

  const hasReachedLimit = messageCount >= MAX_DEMO_MESSAGES;
  const remainingMessages = MAX_DEMO_MESSAGES - messageCount;

  return (
    <div className="flex flex-col h-[500px] md:h-[550px] bg-background rounded-2xl border border-border/50 overflow-hidden shadow-xl">
      {/* Header - WhatsApp style */}
      <div className="bg-[#075E54] text-white px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <h3 className="font-semibold text-xs sm:text-sm truncate">Assistente Appi</h3>
              <Badge variant="secondary" className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0 bg-white/20 text-white border-0 shrink-0">
                Demo
              </Badge>
            </div>
            <p className="text-[10px] sm:text-xs text-white/80">Online • IA Real</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 bg-white/10 border-white/20 text-white whitespace-nowrap">
            {remainingMessages > 0 ? `${remainingMessages}` : 'Limite'}
          </Badge>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-7 w-7 sm:h-8 sm:w-8 text-white/80 hover:text-white hover:bg-white/10"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <ScrollArea
        className="flex-1 p-4"
        ref={scrollRef}
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
        }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h4 className="text-lg font-semibold mb-2">Teste nossa IA agora!</h4>
            <p className="text-muted-foreground text-sm mb-6 max-w-[280px]">
              Converse com a IA real do Appi AutoZap. Faça perguntas e veja como ela responde!
            </p>

            {/* Example buttons */}
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLE_MESSAGES.map((example, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSend(example.message)}
                  disabled={isLoading || hasReachedLimit}
                  className="text-xs gap-1.5"
                >
                  <example.icon className="w-3.5 h-3.5" />
                  {example.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm ${msg.role === "user"
                      ? "bg-[#DCF8C6] text-gray-900 rounded-br-none"
                      : "bg-card text-card-foreground rounded-bl-none"
                    }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-1 text-right ${msg.role === "user" ? "text-gray-600" : "text-muted-foreground"}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-card rounded-lg px-3 py-2 shadow-sm rounded-bl-none">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Limit Reached CTA */}
      {hasReachedLimit && (
        <div className="px-4 py-3 bg-primary/5 border-t border-border/50">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Gostou? Crie sua conta e teste com seu WhatsApp!
            </p>
            <Button size="sm" onClick={handleCreateAccount} className="shrink-0">
              Criar Conta Grátis
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 bg-muted/30 border-t border-border/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasReachedLimit ? "Crie uma conta para continuar..." : "Digite sua mensagem..."}
            disabled={isLoading || hasReachedLimit}
            className="flex-1 bg-background border-border/50"
            maxLength={500}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || hasReachedLimit}
            className="shrink-0 bg-[#25D366] hover:bg-[#128C7E] text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};
