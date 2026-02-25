import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Grace period in days (must match edge function)
export const GRACE_PERIOD_DAYS = 3;

export interface Subscription {
  id: string;
  workspace_id: string;
  plan_type: 'trial' | 'start' | 'pro' | 'business';
  connections_limit: number;
  connections_extra: number;
  members_limit: number;
  billing_cycle: 'monthly' | 'annual';
  status: 'active' | 'canceled' | 'past_due' | 'expired' | 'overdue';
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  asaas_subscription_id: string | null;
  discount_percent: number | null;
  applied_coupon: string | null;
  effective_price: number | null;
  payment_method: string | null;
  card_last_digits: string | null;
}

export const PLAN_LIMITS = {
  trial: 1,
  start: 1,
  pro: 3,
  business: 10,
};

export const PLAN_PRICES = {
  start: { monthly: 687, annual: 584 },
  pro: { monthly: 997, annual: 827 },
  business: { monthly: 2497, annual: 1997 },
};

export const useSubscription = () => {
  const authContext = useAuth();
  const profile = authContext.profile;
  const isProfileLoading = authContext.loading;

  const { data: subscription, isLoading: isQueryLoading, refetch } = useQuery({
    queryKey: ['subscription', profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', profile.workspace_id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }

      return data as Subscription | null;
    },
    enabled: !!profile?.workspace_id,
  });

  // True loading state: ONLY when actually loading, not when there's no user
  // If profile loading is done but no workspace_id, that's not a loading state - it's "no data"
  const isLoading = isProfileLoading || (!!profile?.workspace_id && isQueryLoading);

  const { data: connectionsUsed = 0 } = useQuery({
    queryKey: ['connections-used', profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;

      const { count, error } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', profile.workspace_id);

      if (error) {
        console.error('Error fetching connections:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!profile?.workspace_id,
  });

  const { data: membersUsed = 0 } = useQuery({
    queryKey: ['members-used', profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;

      const { count, error } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', profile.workspace_id);

      if (error) {
        console.error('Error fetching members:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!profile?.workspace_id,
  });

  const membersLimit = subscription?.members_limit || 1;

  const totalConnections = subscription
    ? (PLAN_LIMITS[subscription.plan_type] || 1) + (subscription.connections_extra || 0)
    : 1;

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Calculate grace period status - ONLY for paid plans, NOT trial
  const getGracePeriodInfo = () => {
    if (!subscription) return { isInGracePeriod: false, graceDaysLeft: 0 };

    // Trial accounts do NOT have grace period - they expire immediately
    if (subscription.plan_type === 'trial') {
      return { isInGracePeriod: false, graceDaysLeft: 0 };
    }

    // Only paid plans have grace period based on current_period_end
    if (!subscription.current_period_end) {
      return { isInGracePeriod: false, graceDaysLeft: 0 };
    }

    const now = Date.now();
    const expirationTime = new Date(subscription.current_period_end).getTime();

    // If not yet expired, not in grace period
    if (now < expirationTime) return { isInGracePeriod: false, graceDaysLeft: 0 };

    // Calculate days since expiration
    const daysSinceExpiration = Math.floor((now - expirationTime) / (1000 * 60 * 60 * 24));
    const graceDaysLeft = GRACE_PERIOD_DAYS - daysSinceExpiration;

    // In grace period if status is still 'active' and within grace period days
    const isInGracePeriod = subscription.status === 'active' && graceDaysLeft > 0;

    return { isInGracePeriod, graceDaysLeft: Math.max(0, graceDaysLeft) };
  };

  const { isInGracePeriod, graceDaysLeft } = getGracePeriodInfo();

  // Verificar se está bloqueado (qualquer status que impede uso)
  const isBlocked = ['expired', 'canceled', 'overdue', 'past_due'].includes(subscription?.status || '');

  return {
    subscription,
    isLoading,
    refetch,
    connectionsUsed,
    totalConnections,
    trialDaysLeft,
    isTrialExpired: subscription?.plan_type === 'trial' && trialDaysLeft <= 0,
    isInGracePeriod,
    graceDaysLeft,
    isExpired: subscription?.status === 'expired',
    isBlocked,
    membersUsed,
    membersLimit,
    canAddMember: membersUsed < membersLimit,
  };
};
