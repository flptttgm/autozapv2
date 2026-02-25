import { cn } from "@/lib/utils";

interface LeadProgressBarProps {
  progress: number;
  showPercentage?: boolean;
  className?: string;
}

export const LeadProgressBar = ({ progress, showPercentage = true, className }: LeadProgressBarProps) => {
  const getProgressColor = (value: number) => {
    if (value >= 75) return "bg-emerald-500";
    if (value >= 50) return "bg-amber-500";
    return "bg-cyan-500";
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showPercentage && (
        <span className="text-sm font-medium text-foreground w-10 text-right">
          {progress}%
        </span>
      )}
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", getProgressColor(progress))}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// Status weights representing sales funnel progress
const STATUS_WEIGHTS: Record<string, number> = {
  new: 0,
  prospect: 10,
  contacted: 40,
  qualified: 70,
  converted: 100,
  lost: 0,
};

// Calculate lead progress based on status (funnel stage) + data completeness
export const calculateLeadProgress = (lead: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
}) => {
  const status = lead.status || "new";
  const baseProgress = STATUS_WEIGHTS[status] ?? 0;

  // Data completeness bonus (up to 20% extra for prospect, scales down for advanced stages)
  let dataBonus = 0;
  if (status === "prospect" || status === "new") {
    if (lead.name && lead.name.trim() !== "") dataBonus += 5;
    if (lead.phone && lead.phone.trim() !== "") dataBonus += 5;
    if (lead.email && lead.email.trim() !== "") dataBonus += 5;
  }

  return Math.min(100, baseProgress + dataBonus);
};
