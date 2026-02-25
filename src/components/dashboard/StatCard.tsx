import { LucideIcon, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

export type StatCardColor = "emerald" | "blue" | "orange" | "purple" | "rose" | "amber";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  iconColor?: StatCardColor;
  className?: string;
  animateValue?: boolean;
}

const iconColorClasses: Record<StatCardColor, string> = {
  emerald: "bg-emerald-500/20 text-emerald-400",
  blue: "bg-blue-500/20 text-blue-400",
  orange: "bg-orange-500/20 text-orange-400",
  purple: "bg-purple-500/20 text-purple-400",
  rose: "bg-rose-500/20 text-rose-400",
  amber: "bg-amber-500/20 text-amber-400",
};

function AnimatedValue({ value }: { value: number }) {
  const { count } = useAnimatedCounter({ end: value, duration: 1.5 });
  return <>{count.toLocaleString("pt-BR")}</>;
}

export function StatCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  iconColor = "emerald",
  className,
  animateValue = true,
}: StatCardProps) {
  // Parse numeric value for animation
  const numericValue = typeof value === "string"
    ? parseFloat(value.replace(/[^\d.-]/g, ""))
    : value;
  const isNumeric = !isNaN(numericValue) && isFinite(numericValue);

  // Extract suffix (like % or any non-numeric characters at the end)
  const suffix = typeof value === "string"
    ? value.replace(/[\d.,\s]/g, "").trim()
    : "";

  return (
    <Card
      className={cn(
        "bg-card border-border shadow-none hover:border-border/80 transition-colors",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-5">
        <CardTitle className="text-sm font-medium text-muted-foreground truncate pr-2">
          {title}
        </CardTitle>
        <div className={cn("p-2.5 rounded-xl", iconColorClasses[iconColor])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">
            {animateValue && isNumeric ? (
              <>
                <AnimatedValue value={numericValue} />
                {suffix}
              </>
            ) : (
              value
            )}
          </span>
          {change && (
            <span className={cn("text-xs font-medium flex items-center gap-0.5", iconColorClasses[iconColor].split(" ")[1])}>
              {trend === "up" && <TrendingUp className="h-3 w-3" />}
              {trend === "neutral" && iconColor === "purple" && <Zap className="h-3 w-3" />}
              {change}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}