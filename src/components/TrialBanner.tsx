import { Link } from "react-router-dom";
import { AlertTriangle, Clock, X, ShieldAlert, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { useState, useRef, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";

// Hook para medir e definir altura do banner como CSS variable
const useBannerHeight = (bannerRef: React.RefObject<HTMLDivElement>, isVisible: boolean) => {
  useLayoutEffect(() => {
    const updateHeight = () => {
      if (bannerRef.current && isVisible) {
        const height = bannerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--top-banner-height', `${height}px`);
      } else {
        document.documentElement.style.setProperty('--top-banner-height', '0px');
      }
    };

    updateHeight();

    // Usar ResizeObserver para mudanças de tamanho
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateHeight);
    });

    if (bannerRef.current) {
      observer.observe(bannerRef.current);
    }

    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--top-banner-height', '0px');
    };
  }, [bannerRef, isVisible]);
};

export const TrialBanner = () => {
  const {
    subscription,
    trialDaysLeft,
    isTrialExpired,
    isLoading,
    isInGracePeriod,
    graceDaysLeft,
    isExpired
  } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Determinar se o banner será visível
  const isVisible = !isLoading && !dismissed && subscription != null;

  // Hook para medir altura do banner
  useBannerHeight(bannerRef, isVisible);

  // Don't show if loading or dismissed
  if (isLoading || dismissed || !subscription) {
    return null;
  }

  // Show expired banner (after grace period)
  if (isExpired) {
    return (
      <div
        ref={bannerRef}
        className="w-full relative overflow-hidden shrink-0 border-b border-destructive/20"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-950/90 via-destructive/80 to-red-950/90 backdrop-blur-md" />
        <div className="container mx-auto px-4 py-3 relative flex items-center justify-between gap-4 flex-wrap lg:flex-nowrap">
          <div className="flex items-center gap-3">
            <div className="bg-destructive/20 p-1.5 rounded-md">
              <AlertTriangle className="h-5 w-5 text-red-200" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white/90">Sua assinatura expirou</span>
              <span className="text-sm text-red-200/80">Suas conexões e automações foram desativadas.</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
            <Button
              asChild
              size="sm"
              className="w-full lg:w-auto bg-white hover:bg-white/90 text-destructive font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] gap-1.5"
            >
              <Link to="/plans">
                <Zap className="h-4 w-4" />
                Reativar Conta
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show grace period banner
  if (isInGracePeriod) {
    return (
      <div
        ref={bannerRef}
        className="w-full relative overflow-hidden shrink-0 border-b border-orange-500/20"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-orange-950/90 via-orange-600/80 to-orange-950/90 backdrop-blur-md" />
        <div className="container mx-auto px-4 py-3 relative flex items-center justify-between gap-4 flex-wrap lg:flex-nowrap">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500/20 p-1.5 rounded-md">
              <ShieldAlert className="h-5 w-5 text-orange-200" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white/90">Pagamento Pendente</span>
              <span className="text-sm text-orange-200/80">
                Período de carência: {graceDaysLeft} dia{graceDaysLeft !== 1 ? 's' : ''} restante{graceDaysLeft !== 1 ? 's' : ''} antes do bloqueio.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
            <Button
              asChild
              size="sm"
              className="w-full lg:w-auto bg-white hover:bg-white/90 text-orange-600 font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] gap-1.5"
            >
              <Link to="/plans">
                Regularizar Agora
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Only show trial banner for trial plans
  if (subscription.plan_type !== 'trial') {
    return null;
  }

  // Calculate hours left for more precision
  const hoursLeft = subscription.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60)))
    : 0;

  // Total trial days (assuming 7 days but could be dynamic)
  const totalTrialHours = 7 * 24;
  const hoursUsed = Math.max(0, totalTrialHours - hoursLeft);
  const timeProgress = Math.min(100, (hoursUsed / totalTrialHours) * 100);

  // Show banner only when less than 72 hours (3 days) or expired
  if (hoursLeft > 72 && !isTrialExpired) {
    return null;
  }

  const isTrialExpiredNow = isTrialExpired || hoursLeft <= 0;
  const isUrgent = hoursLeft <= 24 && !isTrialExpiredNow;

  // Trial expirado - banner premium escuro com pulse
  if (isTrialExpiredNow) {
    return (
      <div
        ref={bannerRef}
        className="w-full relative overflow-hidden shrink-0 border-b border-amber-500/20"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-950/90 via-orange-600/80 to-amber-950/90 backdrop-blur-md" />
        <div className="container mx-auto px-4 py-3 relative flex items-center justify-between gap-4 flex-wrap lg:flex-nowrap">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500/20 p-1.5 rounded-md relative">
              <div className="absolute inset-0 bg-orange-400 opacity-20 animate-ping rounded-md" />
              <AlertTriangle className="h-5 w-5 text-orange-200 relative z-10" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white/90">Período de teste expirado</span>
              <span className="text-sm text-orange-200/80">Faça o upgrade para reativar suas automações.</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
            <Button
              asChild
              size="sm"
              className="w-full lg:w-auto bg-white hover:bg-white/90 text-orange-600 font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] gap-1.5"
            >
              <Link to="/plans">
                <Sparkles className="h-4 w-4" />
                Fazer Upgrade
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active Trial Banner (Urgent or Warning)
  return (
    <div
      ref={bannerRef}
      className={cn(
        "w-full relative overflow-hidden shrink-0 border-b transition-colors",
        isUrgent ? "border-orange-500/20" : "border-yellow-500/20 dark:border-white/5"
      )}
    >
      <div className={cn(
        "absolute inset-0 backdrop-blur-md transition-colors",
        isUrgent
          ? "bg-gradient-to-r from-orange-950/90 via-orange-600/70 to-orange-950/90"
          : "bg-slate-900/90 dark:bg-black/40"
      )} />

      <div className="container mx-auto px-4 py-3 relative flex items-center justify-between gap-4 flex-wrap lg:flex-nowrap">
        <div className="flex items-center gap-4 flex-1">
          {/* Badge de Plano */}
          <div className={cn(
            "hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wider",
            isUrgent ? "bg-orange-500/20 text-orange-100" : "bg-primary/20 text-primary-foreground dark:text-primary"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse",
              isUrgent ? "bg-orange-400" : "bg-primary"
            )} />
            TRIAL
          </div>

          <div className="flex flex-col flex-1 max-w-md gap-1">
            <div className="flex items-center gap-2">
              <Clock className={cn("h-4 w-4", isUrgent ? "text-orange-200" : "text-slate-300 dark:text-slate-400")} />
              <span className={cn("text-sm font-medium", isUrgent ? "text-white" : "text-white dark:text-slate-200")}>
                {hoursLeft <= 24 ? (
                  `Últimas ${hoursLeft} horas do seu período de teste`
                ) : (
                  `${Math.ceil(hoursLeft / 24)} dias restantes no período de teste`
                )}
              </span>
            </div>
            {/* Progress bar do tempo */}
            <div className="flex items-center gap-2">
              <Progress
                value={timeProgress}
                className={cn("h-1.5 bg-white/10", isUrgent ? "[&>div]:bg-orange-300" : "[&>div]:bg-primary")}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0 justify-between lg:justify-end">
          {/* Info sutis no mobile que somem em telas muito pequenas, ou ficam menores */}
          <div className="hidden md:flex flex-col text-right mr-2">
            <span className={cn("text-xs font-medium", isUrgent ? "text-orange-200/80" : "text-slate-400")}>
              Gostou do sistema?
            </span>
            <span className={cn("text-xs", isUrgent ? "text-orange-200/60" : "text-slate-500")}>
              Garanta seu acesso VIP
            </span>
          </div>

          <Button
            asChild
            size="sm"
            className={cn(
              "font-semibold shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] gap-1.5 group",
              isUrgent
                ? "bg-white text-orange-600 hover:bg-white/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <Link to="/plans">
              <Sparkles className="h-4 w-4 group-hover:scale-110 transition-transform" />
              Ver Planos Premium
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0 hover:bg-white/10",
              isUrgent ? "text-white/70 hover:text-white" : "text-slate-400 hover:text-white"
            )}
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
