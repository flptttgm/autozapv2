import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { formatTimeRemaining, MIN_DELAY_MS, MAX_DELAY_MS } from "./constants";

interface SendingProgressProps {
  progress: number;
  current: number;
  total: number;
  nextDelayMs: number | null;
}

export const SendingProgress = ({
  progress,
  current,
  total,
  nextDelayMs,
}: SendingProgressProps) => {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (nextDelayMs === null) {
      setCountdown(null);
      return;
    }

    setCountdown(Math.ceil(nextDelayMs / 1000));

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [nextDelayMs]);

  // Calculate estimated remaining time
  const remaining = total - current;
  const avgDelaySeconds = (MIN_DELAY_MS + MAX_DELAY_MS) / 2 / 1000;
  const estimatedRemainingSeconds = Math.ceil(remaining * avgDelaySeconds);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-muted-foreground">Enviando mensagens...</span>
        </div>
        <span className="font-medium">{Math.round(progress)}%</span>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          ✓ {current} de {total} enviados
        </span>
        {remaining > 0 && (
          <span>🕐 Restante: ~{formatTimeRemaining(estimatedRemainingSeconds)}</span>
        )}
      </div>

      {countdown !== null && current < total && (
        <div className="text-xs text-center text-muted-foreground bg-muted/50 rounded-md py-2">
          ⏱️ Próximo envio em {countdown} segundos
        </div>
      )}
    </div>
  );
};
