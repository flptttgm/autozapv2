import { LucideIcon } from "lucide-react";

interface Stat {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  trend: "up" | "down" | "neutral";
}

interface MobileStatsCardsProps {
  stats: Stat[];
}

export function MobileStatsCards({ stats }: MobileStatsCardsProps) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-muted-foreground mb-4 px-1">
        Resumo
      </h2>
      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex gap-3">
          {stats.map((stat) => (
            <div
              key={stat.title}
              className="flex-shrink-0 min-w-[150px] h-40 p-4 rounded-3xl bg-card border border-border/30 dark:border-white/5 shadow-sm flex flex-col justify-between"
            >
              {/* Icon at top */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                stat.trend === "up" 
                  ? "bg-green-500/10" 
                  : stat.trend === "down" 
                  ? "bg-red-500/10" 
                  : "bg-muted"
              }`}>
                <stat.icon className={`w-5 h-5 ${
                  stat.trend === "up" 
                    ? "text-green-500" 
                    : stat.trend === "down" 
                    ? "text-red-500" 
                    : "text-muted-foreground"
                }`} />
              </div>
              
              {/* Value and labels at bottom */}
              <div>
                <p className="text-3xl font-bold text-foreground mb-1">{stat.value}</p>
                <p className="text-xs text-muted-foreground truncate">{stat.title}</p>
                <p className={`text-xs font-bold mt-1 ${
                  stat.trend === "up" 
                    ? "text-green-500" 
                    : stat.trend === "down" 
                    ? "text-red-500" 
                    : "text-muted-foreground"
                }`}>
                  {stat.change}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
