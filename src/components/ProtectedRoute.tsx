import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  skipOnboardingCheck?: boolean;
  skipTrialCheck?: boolean;
}

export function ProtectedRoute({
  children,
  skipOnboardingCheck = false,
  skipTrialCheck = false
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const { isTrialExpired, isExpired, subscription, isLoading: subscriptionLoading } = useSubscription();
  const location = useLocation();

  // List of paths that expired subscriptions (after grace period) can still access
  const allowedPaths = ['/plans', '/checkout', '/settings', '/onboarding'];
  const isAllowedPath = allowedPaths.some(path => location.pathname.startsWith(path));

  // Only show loading if we're still fetching and don't have cached data
  const showAuthLoading = loading && !user;
  const showSubscriptionLoading = subscriptionLoading && !subscription;

  if (showAuthLoading || showSubscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // PRIORITY 1: Check if subscription is FULLY expired (PAID plans only after grace period)
  // Trial expired users can still navigate - they just can't use WhatsApp automations
  // Only redirect to trial-expired for fully expired PAID subscriptions
  const isPaidPlanExpired = isExpired && subscription?.plan_type !== 'trial';

  if (!skipTrialCheck && isPaidPlanExpired && !isAllowedPath) {
    // If onboarding not completed, let them complete it first
    if (profile && profile.onboarding_completed === false) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/plans" replace />;
  }

  // PRIORITY 2: Check onboarding (only if subscription still valid or we're on allowed paths)
  if (!skipOnboardingCheck && profile && profile.onboarding_completed === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
