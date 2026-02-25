import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SentimentIndicatorProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const getSentimentConfig = (score: number | null) => {
  if (score === null) return null;
  
  if (score >= 70) {
    return {
      emoji: "😊",
      label: "Satisfeito",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      border: "border-emerald-200 dark:border-emerald-800",
    };
  } else if (score >= 40) {
    return {
      emoji: "😐",
      label: "Neutro",
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-100 dark:bg-slate-800/30",
      border: "border-slate-200 dark:border-slate-700",
    };
  } else if (score >= 20) {
    return {
      emoji: "😟",
      label: "Insatisfeito",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      border: "border-amber-200 dark:border-amber-800",
    };
  } else {
    return {
      emoji: "😡",
      label: "Crítico",
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-900/30",
      border: "border-rose-200 dark:border-rose-800",
    };
  }
};

export const SentimentIndicator = ({ score, size = "sm", showLabel = false }: SentimentIndicatorProps) => {
  const config = getSentimentConfig(score);
  
  if (!config || score === null) return null;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const emojiSizes = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              "font-medium border cursor-help",
              config.bg,
              config.color,
              config.border,
              sizeClasses[size]
            )}
          >
            <span className={emojiSizes[size]}>{config.emoji}</span>
            {showLabel ? (
              <span className="ml-1">{config.label}</span>
            ) : (
              <span className="ml-1">{score}%</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sentimento: {config.label} ({score}%)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
