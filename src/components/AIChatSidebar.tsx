import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X, Send, Sparkles, Bot, User, Trash2, ArrowRight, Maximize2, Minimize2,
  Plus, ChevronDown, Mic, Square, Loader2, Paperclip, ImageIcon,
  MessageSquare, Clock, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown, { Components } from "react-markdown";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ─────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isAudio?: boolean;
  attachments?: { name: string; type: string; dataUrl: string }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  model: string;
}

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isOverlay?: boolean;
}

// ─── Constants ─────────────────────────────────────
const MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", icon: "⚡", provider: "Google" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", icon: "✨", provider: "Google" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", icon: "🟢", provider: "OpenAI" },
  { id: "gpt-4o", label: "GPT-4o", icon: "🔵", provider: "OpenAI" },
];

const DEFAULT_MODEL = "gemini-2.5-flash";
const STORAGE_KEY = "ai-chat-conversations";
const MODEL_STORAGE_KEY = "ai-chat-selected-model";
const MAX_CONVERSATIONS = 20;

const routeMap: Record<string, string> = {
  'Dashboard': '/dashboard',
  'Leads': '/leads',
  'Conversas': '/conversations',
  'Agentes': '/ai-settings',
  'Agendamentos': '/appointments',
  'Orçamentos': '/quotes',
  'Conexões': '/whatsapp',
  'Configurações': '/settings',
  'Estatísticas': '/statistics',
};

// ─── Quick Action Button ───────────────────────────
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

// ─── Parse Quick Actions ───────────────────────────
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

// ─── Conversation History Helpers ──────────────────
function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveConversations(conversations: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)));
}

function generateTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === "user");
  if (!firstUser) return "Nova conversa";
  const text = firstUser.content.slice(0, 50);
  return text.length < firstUser.content.length ? text + "…" : text;
}

// ─── Stream Chat ───────────────────────────────────
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

async function streamChat({
  messages,
  model,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  model: string;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
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
      body: JSON.stringify({ messages, model }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      if (resp.status === 401) throw new Error("Sessão expirada. Faça login novamente.");
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
        if (jsonStr === "[DONE]") { streamDone = true; break; }

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

// ─── Typing Indicator ──────────────────────────────
const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 px-1">
    <span className="ai-typing-dot" style={{ animationDelay: "0ms" }} />
    <span className="ai-typing-dot" style={{ animationDelay: "160ms" }} />
    <span className="ai-typing-dot" style={{ animationDelay: "320ms" }} />
  </div>
);

// ─── Format time ───────────────────────────────────
const formatTime = (date: Date) => {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export const AIChatSidebar = ({ isOpen, onClose, isOverlay = false }: AIChatSidebarProps) => {
  const navigate = useNavigate();

  // ─── State ─────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    const convs = loadConversations();
    return convs.length > 0 ? convs[0].id : null;
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
  });

  // Microphone state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Attachment state
  const [attachment, setAttachment] = useState<{ name: string; type: string; dataUrl: string } | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Derived state ─────────────────────────────
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];

  // ─── Persist model selection ───────────────────
  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  // ─── Persist conversations ─────────────────────
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // ─── Auto-scroll ───────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Also scroll during streaming (messages array reference changes)
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(scrollToBottom, 300);
      return () => clearInterval(interval);
    }
  }, [isLoading, scrollToBottom]);

  // ─── Auto-resize textarea ─────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // ─── Markdown Components ───────────────────────
  const markdownComponents: Components = useMemo(() => ({
    p: ({ children }) => (
      <p className="my-2 leading-relaxed text-foreground/90">{children}</p>
    ),
    strong: ({ children }) => {
      const text = String(children);
      const isTitle = text.endsWith(':') || text.length > 15;
      if (isTitle) {
        return (
          <strong className="block mt-3 mb-1.5 font-semibold text-primary border-l-2 border-primary pl-2 py-0.5">
            {children}
          </strong>
        );
      }
      return <strong className="font-semibold text-foreground">{children}</strong>;
    },
    ul: ({ children }) => <ul className="my-2 ml-1 space-y-1.5">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 ml-1 space-y-1.5 list-decimal list-inside">{children}</ol>,
    li: ({ children }) => (
      <li className="flex items-start gap-2 text-foreground/90">
        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
        <span className="flex-1">{children}</span>
      </li>
    ),
    h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1.5 text-foreground">{children}</h1>,
    h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1.5 text-foreground">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1.5 text-foreground">{children}</h3>,
    code: ({ children, className }) => {
      const isBlock = className?.includes('language-');
      if (isBlock) {
        return (
          <code className="block bg-background/60 rounded-lg p-3 my-2 text-xs overflow-x-auto">
            {children}
          </code>
        );
      }
      return <code className="bg-background/60 px-1.5 py-0.5 rounded text-xs">{children}</code>;
    },
    pre: ({ children }) => <pre className="my-2 overflow-hidden rounded-lg">{children}</pre>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
  }), []);

  // ─── Create / Switch Conversations ─────────────
  const createNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "Nova conversa",
      messages: [],
      createdAt: new Date().toISOString(),
      model: selectedModel,
    };
    setConversations(prev => [newConv, ...prev].slice(0, MAX_CONVERSATIONS));
    setActiveConversationId(newConv.id);
    setInput("");
    setAttachment(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [selectedModel]);

  const switchConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setInput("");
    setAttachment(null);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (activeConversationId === id) {
        setActiveConversationId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  }, [activeConversationId]);

  // ─── Update messages in active conversation ────
  const updateActiveMessages = useCallback((updater: (msgs: Message[]) => Message[]) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== activeConversationId) return c;
      const newMessages = updater(c.messages);
      return {
        ...c,
        messages: newMessages,
        title: c.title === "Nova conversa" ? generateTitle(newMessages) : c.title,
      };
    }));
  }, [activeConversationId]);

  // ─── Handle Close ──────────────────────────────
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  // ─── Handle Send ───────────────────────────────
  const handleSend = async (audioText?: string) => {
    const text = audioText || input.trim();
    if (!text || isLoading) return;

    // Ensure we have an active conversation
    let convId = activeConversationId;
    if (!convId) {
      const newConv: Conversation = {
        id: Date.now().toString(),
        title: "Nova conversa",
        messages: [],
        createdAt: new Date().toISOString(),
        model: selectedModel,
      };
      setConversations(prev => [newConv, ...prev].slice(0, MAX_CONVERSATIONS));
      setActiveConversationId(newConv.id);
      convId = newConv.id;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
      isAudio: !!audioText,
      attachments: attachment ? [attachment] : undefined,
    };

    // Add user message
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const newMessages = [...c.messages, userMessage];
      return {
        ...c,
        messages: newMessages,
        title: c.title === "Nova conversa" ? generateTitle(newMessages) : c.title,
      };
    }));

    setInput("");
    setAttachment(null);
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    let assistantContent = "";

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        const msgs = c.messages;
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant" && last.id.startsWith("stream-")) {
          return {
            ...c,
            messages: msgs.map((m, i) =>
              i === msgs.length - 1 ? { ...m, content: assistantContent } : m
            ),
          };
        }
        return {
          ...c,
          messages: [...msgs, {
            id: "stream-" + Date.now(),
            role: "assistant" as const,
            content: assistantContent,
            timestamp: new Date(),
          }],
        };
      }));
    };

    // Prepare messages for API
    const currentConv = conversations.find(c => c.id === convId);
    const allMsgs = [...(currentConv?.messages || []), userMessage];
    const apiMessages = allMsgs.map(m => ({
      role: m.role,
      content: m.content,
    }));

    await streamChat({
      messages: apiMessages,
      model: selectedModel,
      onDelta: upsertAssistant,
      onDone: () => setIsLoading(false),
      onError: (error) => {
        setIsLoading(false);
        toast.error(error);
        setConversations(prev => prev.map(c => {
          if (c.id !== convId) return c;
          return {
            ...c,
            messages: [...c.messages, {
              id: "error-" + Date.now(),
              role: "assistant" as const,
              content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
              timestamp: new Date(),
            }],
          };
        }));
      },
    });
  };

  // ─── Microphone ────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (audioChunksRef.current.length === 0) {
          toast.error("Nenhum áudio gravado");
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch {
      toast.error("Erro ao acessar microfone. Verifique as permissões.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio-base64`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            audioBase64,
            mimeType: audioBlob.type || 'audio/webm'
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro na transcrição");
      }

      const data = await response.json();
      if (data.transcription?.trim()) {
        toast.success("Áudio transcrito!");
        await handleSend(data.transcription);
      } else {
        toast.error("Não foi possível transcrever o áudio");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao transcrever áudio");
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── Attachment ────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error("Apenas imagens são suportadas no momento");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ name: file.name, type: file.type, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ─── Cleanup ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    };
  }, []);

  // ─── Format duration ──────────────────────────
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const modelInfo = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  return (
    <>
      {/* Backdrop - only for overlay mode */}
      {isOverlay && (
        <div
          className={cn(
            "fixed inset-0 bg-background/50 backdrop-blur-sm z-[45]",
            isClosing ? "ai-backdrop-closing" : "ai-backdrop-animate"
          )}
          onClick={handleClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "border-l border-border/50 flex flex-col",
          "bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-xl",
          isClosing ? "ai-sidebar-closing" : "ai-sidebar-animate",
          isOverlay
            ? cn(
              "fixed right-0 top-0 h-screen z-[55]",
              isMaximized ? "w-[80vw] max-w-[1000px]" : "w-[420px] max-w-full"
            )
            : cn(
              "relative shrink-0 h-full",
              isMaximized ? "w-[600px]" : "w-[420px]"
            )
        )}
      >
        {/* ═══ HEADER ══════════════════════════════ */}
        <div className="shrink-0 ai-content-animate">
          {/* Top bar with close + maximize */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ai-icon-hover border border-primary/20">
                  <Sparkles className="h-4 w-4 text-primary ai-sparkle-animate" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background" />
              </div>
              <div>
                <h3 className="font-semibold text-sm leading-tight">Assistente IA</h3>
                <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
                  {modelInfo.icon} {modelInfo.label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={createNewConversation}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Nova conversa</TooltipContent>
              </Tooltip>

              {/* History dropdown */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <History className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Histórico</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-auto z-[200]">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Conversas recentes</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {conversations.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Nenhuma conversa ainda
                    </div>
                  ) : (
                    conversations.map(conv => (
                      <DropdownMenuItem
                        key={conv.id}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer",
                          conv.id === activeConversationId && "bg-accent"
                        )}
                        onClick={() => switchConversation(conv.id)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{conv.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {conv.messages.length} msgs · {formatDate(conv.createdAt)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setIsMaximized(!isMaximized)}>
                    {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isMaximized ? "Minimizar" : "Maximizar"}</TooltipContent>
              </Tooltip>

              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Model selector bar */}
          <div className="px-4 pb-2.5 flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-7 text-xs border-border/50 bg-muted/30 rounded-lg flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {MODELS.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                      <span className="text-muted-foreground text-[10px]">({m.provider})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar conversa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todas as mensagens desta conversa serão apagadas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                      if (activeConversationId) deleteConversation(activeConversationId);
                    }}>
                      Limpar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="h-px bg-border/50" />
        </div>

        {/* ═══ MESSAGES AREA ═══════════════════════ */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-4">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-center ai-message-animate">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 border border-primary/10">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h4 className="font-medium text-sm mb-1">Como posso ajudar?</h4>
                <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
                  Pergunte sobre funcionalidades, peça ajuda para configurar ou tire dúvidas sobre a plataforma.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {["Como criar um agente?", "Conectar WhatsApp", "IA não responde"].map((q, i) => (
                    <button
                      key={i}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/50"
                      onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2.5 ai-message-animate",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
                style={{ animationDelay: `${Math.min(index * 0.03, 0.2)}s` }}
              >
                {message.role === "assistant" && (
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5 border border-primary/10">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted/60 rounded-bl-md border border-border/30"
                  )}
                >
                  {/* Audio badge */}
                  {message.isAudio && message.role === "user" && (
                    <div className="flex items-center gap-1 mb-1 opacity-70">
                      <Mic className="h-3 w-3" />
                      <span className="text-[10px]">Áudio transcrito</span>
                    </div>
                  )}

                  {/* Attachment preview */}
                  {message.attachments?.map((att, i) => (
                    <div key={i} className="mb-2">
                      <img src={att.dataUrl} alt={att.name} className="rounded-lg max-w-full max-h-40 object-cover" />
                    </div>
                  ))}

                  {message.role === "assistant" ? (
                    (() => {
                      const { cleanContent, actions } = parseQuickActions(message.content);
                      const handleNavigate = (path: string) => { navigate(path); onClose(); };
                      return (
                        <div className="max-w-none">
                          <ReactMarkdown components={markdownComponents}>
                            {cleanContent}
                          </ReactMarkdown>
                          {actions.length > 0 && (
                            <div className="flex flex-wrap mt-2 pt-2 border-t border-border/30">
                              {actions.map((action, idx) => (
                                <QuickActionButton key={idx} route={action} onNavigate={handleNavigate} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  )}

                  {/* Timestamp */}
                  <div className={cn(
                    "flex items-center justify-end mt-1 gap-1",
                    message.role === "user" ? "opacity-70" : "text-muted-foreground"
                  )}>
                    <span className="text-[10px]">{formatTime(message.timestamp)}</span>
                  </div>
                </div>

                {message.role === "user" && (
                  <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2.5 justify-start ai-message-animate">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-3 border border-border/30">
                  <TypingIndicator />
                </div>
              </div>
            )}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* ═══ INPUT AREA ══════════════════════════ */}
        <div className="shrink-0 border-t border-border/50 ai-content-animate" style={{ animationDelay: '0.1s' }}>
          {/* Attachment preview */}
          {attachment && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2 border border-border/30">
                <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{attachment.name}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setAttachment(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Recording state */}
          {isRecording ? (
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-red-500 tabular-nums">
                  {formatDuration(recordingDuration)}
                </span>
                <span className="text-xs text-muted-foreground">Gravando...</span>
              </div>
              <Button onClick={stopRecording} size="icon" variant="destructive" className="h-9 w-9 rounded-xl">
                <Square className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : isTranscribing ? (
            <div className="px-4 py-3 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Transcrevendo áudio...</span>
            </div>
          ) : (
            <div className="px-3 py-2.5">
              <div className="flex items-end gap-1.5 bg-muted/30 rounded-xl border border-border/40 px-2 py-1.5 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                {/* Attach button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground rounded-lg"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Anexar imagem</TooltipContent>
                </Tooltip>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Pergunte algo..."
                  rows={1}
                  className="flex-1 bg-transparent border-0 resize-none text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 py-1.5 max-h-[120px] min-h-[32px]"
                  disabled={isLoading}
                />

                {/* Mic button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground rounded-lg"
                      onClick={startRecording}
                      disabled={isLoading}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Gravar áudio</TooltipContent>
                </Tooltip>

                {/* Send button */}
                <Button
                  size="icon"
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-lg transition-all",
                    input.trim() || attachment
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 scale-100"
                      : "bg-muted text-muted-foreground scale-95 opacity-50"
                  )}
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && !attachment) || isLoading}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Shortcut hint */}
              <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
                Enter envia · Shift+Enter quebra linha
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
