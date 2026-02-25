import { Link } from "react-router-dom";
import { AlertTriangle, Clock, X, ShieldAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        className="w-full px-4 py-3 text-center transition-all shrink-0 bg-destructive text-destructive-foreground"
      >
        <div className="container mx-auto flex items-center justify-center gap-3 flex-wrap relative">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="font-medium">
            Sua assinatura expirou e suas conexões foram desativadas. Renove seu plano para reativá-las.
          </span>
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="shrink-0"
          >
            <Link to="/plans">Renovar Agora</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 hover:bg-white/20 ml-2"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Show grace period banner
  if (isInGracePeriod) {
    return (
      <div
        ref={bannerRef}
        className="w-full px-4 py-3 text-center transition-all shrink-0 bg-orange-500 text-white"
      >
        <div className="container mx-auto flex items-center justify-center gap-3 flex-wrap">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span className="font-medium">
            Período de carência: {graceDaysLeft} dia{graceDaysLeft !== 1 ? 's' : ''} restante{graceDaysLeft !== 1 ? 's' : ''}.
            Suas conexões serão desativadas se não renovar.
          </span>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 bg-white/20 border-white/40 hover:bg-white/30 text-inherit"
          >
            <Link to="/plans">Renovar Agora</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 hover:bg-white/20"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
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

  // Show banner only when less than 24 hours or expired
  if (hoursLeft > 24 && !isTrialExpired) {
    return null;
  }

  const isTrialExpiredNow = isTrialExpired || hoursLeft <= 0;
  const isUrgent = hoursLeft <= 6 && !isTrialExpiredNow;

  // Trial expirado - banner laranja com gradiente (não pode fechar)
  if (isTrialExpiredNow) {
    return (
      <div
        ref={bannerRef}
        className="w-full px-4 py-3 text-center transition-all shrink-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white"
      >
        <div className="container mx-auto flex items-center justify-center gap-3 flex-wrap relative">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="font-medium text-sm sm:text-base">
            Seu período de teste expirou. Suas automações estão pausadas.
          </span>
          <Button
            asChild
            size="sm"
            className="shrink-0 bg-white text-orange-600 hover:bg-white/90 font-semibold gap-1.5"
          >
            <Link to="/plans">
              <Zap className="h-4 w-4" />
              Assinar Agora
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 hover:bg-white/20 ml-2"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={bannerRef}
      className={cn(
        "w-full px-4 py-3 text-center transition-all shrink-0",
        isUrgent
          ? "bg-orange-500 text-white"
          : "bg-yellow-500 text-yellow-950"
      )}
    >
      <div className="container mx-auto flex items-center justify-center gap-3 flex-wrap">
        <Clock className="h-5 w-5 shrink-0" />

        <span className="font-medium">
          {isUrgent ? (
            `Últimas ${hoursLeft} hora${hoursLeft !== 1 ? 's' : ''} do seu período de teste!`
          ) : (
            `Seu período de teste expira em ${hoursLeft} hora${hoursLeft !== 1 ? 's' : ''}. Escolha um plano para não perder acesso.`
          )}
        </span>

        <Button
          asChild
          size="sm"
          variant="outline"
          className="shrink-0 bg-white/20 border-white/40 hover:bg-white/30 text-inherit"
        >
          <Link to="/plans">Ver Planos</Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 hover:bg-white/20"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
