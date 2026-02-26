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

  const { data: billingInfo, isLoading: isQueryLoading, refetch } = useQuery({
    queryKey: ['subscription', profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return null;

      // 1. Get current workspace to find its owner
      const { data: currentWs, error: currentError } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', profile.workspace_id)
        .single();

      if (currentError || !currentWs) {
        console.error('Error fetching current workspace for billing:', currentError);
        return null;
      }

      // 2. Get the owner's main workspace (oldest one)
      const { data: mainWs, error: mainError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', currentWs.owner_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const billingWorkspaceId = mainWs?.id || profile.workspace_id;

      // 3. Get the subscription for the main workspace
      const { data: subscriptionData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', billingWorkspaceId)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        return null;
      }

      // 4. Get total connections used across ALL workspaces owned by this user
      // First find all workspaces owned by this user
      const { data: allWorkspaces } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', currentWs.owner_id);

      const allWorkspaceIds = allWorkspaces?.map(w => w.id) || [billingWorkspaceId];

      // Count total instances
      const { count: connectionsUsed } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .in('workspace_id', allWorkspaceIds);

      // Count total members (excluding duplicates if same user is in multiple workspaces)
      // Actually simply count members in the active workspace or main workspace?
      // Usually seats are counted on the main workspace
      const { count: membersUsed } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', billingWorkspaceId);

      return {
        subscription: subscriptionData as Subscription | null,
        billingWorkspaceId,
        ownerId: currentWs.owner_id,
        allWorkspaceIds,
        connectionsUsed: connectionsUsed || 0,
        membersUsed: membersUsed || 0,
      };
    },
    enabled: !!profile?.workspace_id,
  });

  const subscription = billingInfo?.subscription || null;

  // True loading state: ONLY when actually loading, not when there's no user
  // If profile loading is done but no workspace_id, that's not a loading state - it's "no data"
  const isLoading = isProfileLoading || (!!profile?.workspace_id && isQueryLoading);

  const connectionsUsed = billingInfo?.connectionsUsed || 0;
  const membersUsed = billingInfo?.membersUsed || 0;

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
