import { Link } from "react-router-dom";
import { Crown, Clock, Zap, Gem, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { Skeleton } from "@/components/ui/skeleton";

const planConfig = {
  trial_expired: {
    icon: AlertTriangle,
    label: "Trial Expirado",
    className: "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400",
    iconClass: "text-orange-500",
  },
  trial: {
    icon: Clock,
    label: "Teste Grátis",
    className: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
    iconClass: "text-amber-500",
  },
  start: {
    icon: Zap,
    label: "Start",
    className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    iconClass: "text-emerald-500",
  },
  pro: {
    icon: Crown,
    label: "Pro",
    className: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
    iconClass: "text-blue-500",
  },
  business: {
    icon: Gem,
    label: "Business",
    className: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",
    iconClass: "text-purple-500",
  },
};

export const PlanBadge = () => {
  const { subscription, isLoading, connectionsUsed, totalConnections, trialDaysLeft, isTrialExpired } = useSubscription();

  if (isLoading) {
    return (
      <div className="mx-3 mb-3">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  const planType = subscription?.plan_type || 'trial';
  const effectiveType = (planType === 'trial' && isTrialExpired) ? 'trial_expired' : planType;
  const config = planConfig[effectiveType as keyof typeof planConfig] || planConfig.trial;
  const Icon = config.icon;
  const showTrialExpired = effectiveType === 'trial_expired';

  return (
    <Link to="/plans" className="block mx-3 mb-3">
      <div
        className={cn(
          "p-3 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer",
          config.className,
          planType === 'trial' && !isTrialExpired && "animate-pulse"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", config.iconClass)} />
            <span className="font-medium text-sm">
              {config.label}
              {planType === 'trial' && !isTrialExpired && trialDaysLeft > 0 && (
                <span className="ml-1 text-xs opacity-80">
                  ({trialDaysLeft}d restantes)
                </span>
              )}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 opacity-60" />
        </div>
        <div className="mt-1.5 text-xs opacity-80">
          {showTrialExpired 
            ? "Assine para continuar" 
            : `${connectionsUsed}/${totalConnections} ${totalConnections === 1 ? 'Conexão' : 'Conexões'}`
          }
        </div>
      </div>
    </Link>
  );
};
