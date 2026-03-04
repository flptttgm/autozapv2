import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Crown, Clock, Zap, Gem, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

const planConfig = {
  trial_expired: {
    icon: AlertTriangle,
    label: "Expirado",
    wrapperClass: "border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent",
    iconClass: "text-orange-500",
    badgeClass: "bg-orange-500",
    glowClass: "from-orange-500/20",
    progressClass: "[&>div]:bg-orange-500 bg-orange-500/20"
  },
  trial: {
    icon: Clock,
    label: "Teste Grátis",
    wrapperClass: "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent",
    iconClass: "text-primary dark:text-primary",
    badgeClass: "bg-primary",
    glowClass: "from-primary/20",
    progressClass: "[&>div]:bg-primary bg-primary/20"
  },
  start: {
    icon: Zap,
    label: "Start",
    wrapperClass: "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent",
    iconClass: "text-emerald-500",
    badgeClass: "bg-emerald-500",
    glowClass: "from-emerald-500/20",
    progressClass: "[&>div]:bg-emerald-500 bg-emerald-500/20"
  },
  pro: {
    icon: Crown,
    label: "Pro",
    wrapperClass: "border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent",
    iconClass: "text-blue-500",
    badgeClass: "bg-blue-500",
    glowClass: "from-blue-500/20",
    progressClass: "[&>div]:bg-blue-500 bg-blue-500/20"
  },
  business: {
    icon: Gem,
    label: "Business",
    wrapperClass: "border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-transparent",
    iconClass: "text-purple-500",
    badgeClass: "bg-purple-500",
    glowClass: "from-purple-500/20",
    progressClass: "[&>div]:bg-purple-500 bg-purple-500/20"
  },
};

export const PlanBadge = () => {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("plan_badge_dismissed") === "true";
    }
    return false;
  });

  const {
    subscription,
    isLoading,
    connectionsUsed,
    totalConnections,
    trialDaysLeft,
    isTrialExpired,
    membersUsed,
    membersLimit
  } = useSubscription();

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation(); // Stop event bubbling
    setIsDismissed(true);
    sessionStorage.setItem("plan_badge_dismissed", "true");
  };

  if (isLoading) {
    return (
      <div className="mx-3 mb-3">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (isDismissed) {
    return null;
  }

  const planType = subscription?.plan_type || 'trial';
  const effectiveType = (planType === 'trial' && isTrialExpired) ? 'trial_expired' : planType;
  const config = planConfig[effectiveType as keyof typeof planConfig] || planConfig.trial;
  const Icon = config.icon;
  const showTrialExpired = effectiveType === 'trial_expired';

  // Calculate connection usage percentage
  const usagePercentage = Math.min(100, Math.max(0, (connectionsUsed / Math.max(1, totalConnections)) * 100));
  const membersPercentage = Math.min(100, Math.max(0, (membersUsed / Math.max(1, membersLimit)) * 100));

  return (
    <Link to="/plans" className="block mx-3 mb-3 group outline-none">
      <div
        className={cn(
          "relative overflow-hidden p-3 rounded-xl border transition-all duration-300",
          "hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]",
          config.wrapperClass
        )}
      >
        {/* Subtle background glow effect */}
        <div className={cn(
          "absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 bg-gradient-to-br to-transparent transition-opacity group-hover:opacity-40",
          config.glowClass
        )} />

        <div className="relative z-10 flex flex-col gap-2.5">
          {/* Header row: Icon, Label, Close Button */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-md bg-background/50 backdrop-blur-sm border border-white/5",
                planType === 'trial' && !isTrialExpired && "animate-pulse"
              )}>
                <Icon className={cn("h-3.5 w-3.5", config.iconClass)} />
              </div>
              <div className="flex flex-col">
                <span className={cn(
                  "font-semibold text-xs tracking-tight",
                  showTrialExpired ? "text-orange-500" : "text-foreground"
                )}>
                  {config.label}
                </span>
                {planType === 'trial' && !isTrialExpired && trialDaysLeft > 0 && (
                  <span className="text-[10px] text-muted-foreground font-medium -mt-0.5">
                    {trialDaysLeft} dias restantes
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="p-1 -m-1 rounded-sm text-muted-foreground/50 hover:text-foreground/80 hover:bg-white/10 transition-all z-20 cursor-pointer"
              aria-label="Dispensar alerta de plano"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Progress / Status row */}
          {!showTrialExpired && (
            <div className="flex flex-col gap-2 mt-0.5 pointer-events-none">
              {/* Connections Usage */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Conexões ativas</span>
                  <span className={cn(
                    usagePercentage >= 100 ? "text-orange-500 font-bold" : "text-foreground/80"
                  )}>
                    {connectionsUsed}/{totalConnections}
                  </span>
                </div>
                <Progress
                  value={usagePercentage}
                  className={cn("h-1.5", config.progressClass)}
                />
              </div>

              {/* Members Usage */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Membros</span>
                  <span className={cn(
                    membersPercentage >= 100 ? "text-orange-500 font-bold" : "text-foreground/80"
                  )}>
                    {membersUsed}/{membersLimit}
                  </span>
                </div>
                <Progress
                  value={membersPercentage}
                  className={cn("h-1.5 bg-muted/50", config.progressClass.replace('bg-', 'bg-opacity-20 '))}
                />
              </div>
            </div>
          )}

          {showTrialExpired && (
            <div className="mt-0.5 text-[11px] font-medium text-orange-500/80 group-hover:text-orange-500 transition-colors">
              Clique aqui para continuar usando
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

