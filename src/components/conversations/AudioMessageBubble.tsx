import { useEffect, useMemo, useState } from "react";
import { Loader2, Mic, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSignedMediaUrl } from "@/hooks/useSignedMediaUrl";
import { WaveformAudioPlayer } from "@/components/conversations/WaveformAudioPlayer";

type AudioMessageBubbleProps = {
  content: string;
  metadata: any;
};

export function AudioMessageBubble({ content, metadata }: AudioMessageBubbleProps) {
  const initialMediaUrl = typeof metadata?.mediaUrl === "string" ? metadata.mediaUrl : "";
  const audioStoragePath = typeof metadata?.audioStoragePath === "string" ? metadata.audioStoragePath : "";
  const duration = Number(metadata?.duration || 0);
  const transcription = typeof metadata?.transcription === "string" ? metadata.transcription : "";

  const [mediaUrl, setMediaUrl] = useState<string>(initialMediaUrl);
  const [playerError, setPlayerError] = useState(false);

  const canReload = useMemo(() => Boolean(audioStoragePath), [audioStoragePath]);
  const signer = useSignedMediaUrl();

  useEffect(() => {
    setMediaUrl(initialMediaUrl);
    setPlayerError(false);
  }, [initialMediaUrl]);

  const handleReload = async () => {
    if (!audioStoragePath) {
      toast.error("Não foi possível localizar o arquivo do áudio");
      return;
    }

    try {
      setPlayerError(false);
      const result = await signer.mutateAsync({
        bucket: "whatsapp-audio",
        path: audioStoragePath,
        expiresIn: 60 * 30,
      });
      setMediaUrl(result.signedUrl);
    } catch (e) {
      toast.error("Falha ao carregar o áudio. Tente novamente.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-primary" />
        {content}
      </span>

      {mediaUrl && !playerError ? (
        <WaveformAudioPlayer
          src={mediaUrl}
          initialDurationSeconds={duration}
          onError={() => {
            setPlayerError(true);
            setMediaUrl("");
          }}
        />
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
          <Mic className="h-3 w-3" />
          <span className="flex-1">Áudio indisponível</span>
          {canReload && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={handleReload}
              disabled={signer.isPending}
            >
              <RotateCw className="h-3.5 w-3.5 mr-1" />
              {signer.isPending ? "Carregando…" : "Carregar áudio"}
            </Button>
          )}
        </div>
      )}

      {transcription ? (
        <div className="text-sm text-muted-foreground italic border-l-2 border-primary/50 pl-2 mt-1">
          "{transcription}"
        </div>
      ) : (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Transcrevendo áudio...</span>
        </div>
      )}
    </div>
  );
}
