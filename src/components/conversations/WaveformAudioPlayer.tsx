import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WaveformAudioPlayerProps = {
  src: string;
  initialDurationSeconds?: number;
  onError?: () => void;
  className?: string;
};

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const s = Math.round(seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function WaveformAudioPlayer({
  src,
  initialDurationSeconds,
  onError,
  className,
}: WaveformAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const [duration, setDuration] = useState<number>(initialDurationSeconds || 0);
  const [hasError, setHasError] = useState(false);

  const bars = useMemo(
    () => [40, 70, 55, 85, 45, 75, 50, 90, 60, 80, 45, 65, 55, 75, 40, 85, 50, 70, 60, 45],
    []
  );

  const handlePlayPause = useCallback(async () => {
    const el = audioRef.current;
    if (!el || hasError) return;

    try {
      if (el.paused) {
        await el.play();
      } else {
        el.pause();
      }
    } catch {
      setHasError(true);
      onError?.();
    }
  }, [hasError, onError]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoadedMetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    const onTimeUpdate = () => {
      if (!Number.isFinite(el.duration) || el.duration <= 0) return;
      setProgress((el.currentTime / el.duration) * 100);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(100);
    };
    const onAudioError = () => {
      setHasError(true);
      setIsPlaying(false);
      onError?.();
    };

    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onAudioError);

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onAudioError);
    };
  }, [onError]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={handlePlayPause}
        aria-label={isPlaying ? "Pausar áudio" : "Tocar áudio"}
      >
        {hasError ? <AlertTriangle className="h-4 w-4" /> : isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <div className="flex-1 min-w-0">
        <div className="flex h-6 items-center gap-1 overflow-hidden">
          {bars.map((h, idx) => {
            const pos = (idx / bars.length) * 100;
            const active = pos <= progress;
            return (
              <div
                key={idx}
                className={cn(
                  "w-1 shrink-0 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-muted-foreground/30"
                )}
                style={{ height: `${h * 0.6}%` }}
              />
            );
          })}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">{formatDuration((progress / 100) * (duration || 0))}</span>
          <span className="tabular-nums">{formatDuration(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
}
