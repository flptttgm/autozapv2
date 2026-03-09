import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { PlaybackWaveform } from "./PlaybackWaveform";
import {
  Send,
  Trash2,
  Clock,
  Calendar,
  HelpCircle,
  MessageCircle,
  ShoppingBag,
  Mic,
  Square,
  Loader2,
  Play,
  Pause,
  X
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isAudio?: boolean;
}

interface AIPreviewChatProps {
  workspaceId: string;
  templateId: string | null;
  templateName: string;
}

const EXAMPLE_MESSAGES = [
  { label: "Horário", message: "Qual o horário de atendimento?", icon: Clock },
  { label: "Agendar", message: "Quero agendar um horário", icon: Calendar },
  { label: "Dúvida", message: "Tenho uma dúvida sobre os serviços", icon: HelpCircle },
  { label: "Preços", message: "Quais são os preços?", icon: ShoppingBag },
];

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 px-2 py-1.5">
    <span className="w-1.5 h-1.5 bg-purple-500/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1.5 h-1.5 bg-purple-500/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-1.5 h-1.5 bg-purple-500/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

// Recording indicator with waveform visualization
const AudioWaveform = ({ stream, duration }: { stream: MediaStream | null; duration: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barCount = 20;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / barCount;
      const gap = 2;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * (bufferLength / barCount));
        const value = dataArray[dataIndex] || 0;
        const barHeight = Math.max(4, (value / 255) * canvas.height * 0.9);

        const x = i * barWidth + gap / 2;
        const y = (canvas.height - barHeight) / 2;

        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - gap, barHeight, 2);
        ctx.fill();
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [stream]);

  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-full">
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-red-600 dark:text-red-400 tabular-nums">
          {formatDuration(duration)}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={120}
        height={32}
        className="flex-1 max-w-[120px]"
      />
    </div>
  );
};

export const AIPreviewChat = ({
  workspaceId,
  templateId,
  templateName
}: AIPreviewChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom with smooth animation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordedAudio?.url) {
        URL.revokeObjectURL(recordedAudio.url);
      }
    };
  }, [recordedAudio]);

  const streamChat = async (userMessage: string) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/preview-ai-response`;

    setIsTyping(true);

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        message: userMessage,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        template_id: templateId,
        workspace_id: workspaceId,
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

  const handleSend = async (messageText?: string, isAudio = false) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text, timestamp: new Date(), isAudio };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

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

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Store stream for waveform visualization
      audioStreamRef.current = stream;
      setAudioStream(stream);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
        setAudioStream(null);

        if (audioChunksRef.current.length === 0) {
          toast.error("Nenhum áudio gravado");
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType
        });

        // Store audio for playback instead of transcribing immediately
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio({ blob: audioBlob, url: audioUrl });
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Erro ao acessar microfone. Verifique as permissões.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
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
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
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

      if (data.transcription && data.transcription.trim()) {
        toast.success("Áudio transcrito!");
        await handleSend(data.transcription, true);
      } else {
        toast.error("Não foi possível transcrever o áudio");
      }

    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao transcrever áudio");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleDiscardAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (recordedAudio?.url) {
      URL.revokeObjectURL(recordedAudio.url);
    }
    setRecordedAudio(null);
    setIsPlaying(false);
    setPlaybackProgress(0);
    setAudioDuration(0);
  };

  const handleSendAudio = async () => {
    if (!recordedAudio) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    await transcribeAudio(recordedAudio.blob);
    handleDiscardAudio();
  };

  const handlePlayPauseAudio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setPlaybackProgress(progress);
  };

  const handleAudioLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const formatAudioTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Area */}
      <ScrollArea
        className="flex-1 p-4 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center mb-5 shadow-lg shadow-purple-500/5">
              <MessageCircle className="w-7 h-7 text-purple-500" />
            </div>
            <p className="text-base font-semibold text-foreground mb-1.5">
              Teste como a IA responderá
            </p>
            <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
              Simule uma conversa real. As mensagens não são enviadas pelo WhatsApp.
            </p>
            <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground/60">
              <Mic className="w-3.5 h-3.5" />
              <span>Teste também com áudio</span>
            </div>

            {/* Example Messages */}
            <div className="grid grid-cols-2 gap-2 mt-8 w-full max-w-xs">
              {EXAMPLE_MESSAGES.map((ex) => (
                <button
                  key={ex.label}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all duration-200 hover:shadow-sm active:scale-[0.97] disabled:opacity-50 group"
                  onClick={() => handleSend(ex.message)}
                  disabled={isLoading}
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 group-hover:bg-purple-500/15 transition-colors">
                    <ex.icon className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <span className="text-xs font-medium text-foreground/80 text-left">{ex.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                <div
                  className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${msg.role === "user"
                    ? "bg-purple-500/15 text-foreground rounded-tr-sm"
                    : "bg-muted/60 border border-border/40 text-foreground rounded-tl-sm"
                    }`}
                >
                  {/* Audio indicator */}
                  {msg.isAudio && msg.role === "user" && (
                    <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground">
                      <Mic className="w-3 h-3" />
                      <span>Áudio transcrito</span>
                    </div>
                  )}

                  {/* Message content with markdown support */}
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-strong:text-inherit">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1">{children}</ol>,
                        li: ({ children }) => <li className="mb-0.5">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        code: ({ children }) => (
                          <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {/* Timestamp */}
                  <div className={`flex items-center justify-end gap-1 mt-1 ${msg.role === "user" ? "text-purple-500/50" : "text-muted-foreground/50"
                    }`}>
                    <span className="text-[10px] tabular-nums">{formatTime(msg.timestamp)}</span>
                    {msg.role === "user" && (
                      <svg viewBox="0 0 16 11" width="14" height="9" className="text-purple-500/60">
                        <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 0 0 .501.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.337-.273zm3.634 0a.457.457 0 0 0-.303-.102.493.493 0 0 0-.382.178l-6.19 7.636-1.152-1.089-.337.274 1.768 1.768a.724.724 0 0 0 .501.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.337-.273z" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Clear button */}
      {messages.length > 0 && (
        <div className="flex justify-center py-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="w-3 h-3" />
            Limpar conversa
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-center gap-2 p-3 border-t border-border/50 min-w-0 overflow-hidden">
        {isRecording ? (
          <>
            <div className="flex-1 min-w-0 overflow-hidden">
              <AudioWaveform stream={audioStream} duration={recordingDuration} />
            </div>
            <Button
              onClick={stopRecording}
              size="icon"
              variant="destructive"
              className="h-10 w-10 rounded-full shrink-0"
            >
              <Square className="w-4 h-4" />
            </Button>
          </>
        ) : recordedAudio ? (
          <>
            {/* Audio playback UI with progress */}
            <audio
              ref={audioRef}
              src={recordedAudio.url}
              className="hidden"
              onTimeUpdate={handleAudioTimeUpdate}
              onLoadedMetadata={handleAudioLoadedMetadata}
              onEnded={handleAudioEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <Button
              onClick={handleDiscardAudio}
              size="icon"
              variant="ghost"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="flex-1 min-w-0 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white dark:bg-muted rounded-full overflow-hidden">
              <Button
                onClick={handlePlayPauseAudio}
                size="icon"
                variant="ghost"
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-full shrink-0 text-purple-500 hover:text-purple-400 hover:bg-purple-500/10"
              >
                {isPlaying ? <Pause className="w-3 h-3 sm:w-4 sm:h-4" /> : <Play className="w-3 h-3 sm:w-4 sm:h-4" />}
              </Button>
              <div className="flex-1 min-w-0 overflow-hidden">
                <PlaybackWaveform
                  isPlaying={isPlaying}
                  progress={playbackProgress}
                  className="w-full"
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {formatAudioTime(audioRef.current?.currentTime || 0)}
              </span>
            </div>
            <Button
              onClick={handleSendAudio}
              disabled={isTranscribing}
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-purple-500 hover:bg-purple-600 text-white shrink-0"
            >
              {isTranscribing ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </Button>
          </>
        ) : isTranscribing ? (
          <div className="flex-1 flex items-center justify-center gap-2 h-10">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            <span className="text-sm text-muted-foreground">Transcrevendo áudio...</span>
          </div>
        ) : (
          <>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Digite uma mensagem..."
              className="flex-1 h-12 text-sm bg-muted/50 border-border/50 rounded-full px-5 focus-visible:ring-1 focus-visible:ring-purple-500/50"
              disabled={isLoading}
            />

            {input.trim() ? (
              <Button
                onClick={() => handleSend()}
                disabled={isLoading}
                size="icon"
                className="h-10 w-10 rounded-full bg-purple-500 hover:bg-purple-600 text-white shrink-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                onClick={handleMicClick}
                disabled={isLoading}
                size="icon"
                className="h-10 w-10 rounded-full bg-purple-500 hover:bg-purple-600 text-white shrink-0"
              >
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
