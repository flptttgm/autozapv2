import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logPlatformAction } from "@/hooks/usePlatformLog";
import { PresenceProvider } from "@/hooks/useWorkspacePresence";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  workspace_id: string | null;
  onboarding_completed: boolean | null;
  has_password: boolean | null;
  pwa_dismissed: boolean | null;
  whatsapp_number: string | null;
  company_name: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => { },
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Helper to check if we should log this login (deduplication)
const LOGIN_DEDUP_KEY = 'last_login_log';
const LOGIN_DEDUP_INTERVAL_MS = 60000; // 60 seconds

function shouldLogLogin(userId: string): boolean {
  try {
    const stored = localStorage.getItem(LOGIN_DEDUP_KEY);
    if (stored) {
      const { id, ts } = JSON.parse(stored);
      if (id === userId && Date.now() - ts < LOGIN_DEDUP_INTERVAL_MS) {
        return false; // Already logged recently for this user
      }
    }
    localStorage.setItem(LOGIN_DEDUP_KEY, JSON.stringify({ id: userId, ts: Date.now() }));
    return true;
  } catch {
    return true; // If localStorage fails, allow logging
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Refs to track initialization and previous session state
  const initializedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles' as any)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as unknown as Profile;
  };

  useEffect(() => {
    // Safety timeout to prevent infinite loading if Supabase fails to respond
    const AUTH_TIMEOUT_MS = 10000; // 10 seconds
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Session check timeout - forcing loading to false');
        setLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          localStorage.setItem('has_logged_in_before', 'true');
        }

        const currentUserId = session?.user?.id ?? null;
        const wasLoggedIn = prevUserIdRef.current !== null;
        const isNowLoggedIn = currentUserId !== null;
        const isNewUser = currentUserId !== prevUserIdRef.current;

        // Only log login when:
        // 1. App is initialized (not during initial load)
        // 2. Event is SIGNED_IN
        // 3. User transitioned from logged-out to logged-in (or different user)
        // 4. Deduplication check passes
        if (
          initializedRef.current &&
          event === 'SIGNED_IN' &&
          session?.user &&
          (!wasLoggedIn || isNewUser) &&
          shouldLogLogin(session.user.id)
        ) {
          setTimeout(() => {
            logPlatformAction({
              action: 'login',
              entity_type: 'user',
              entity_id: session.user.id,
              user_id: session.user.id,
              user_email: session.user.email,
              details: { event, provider: session.user.app_metadata?.provider || 'email' },
            });
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          // Clear all React Query cache on logout to prevent cross-session data leakage
          queryClient.clear();

          // Clear session-specific UI state
          sessionStorage.removeItem("plan_badge_dismissed");

          setTimeout(() => {
            logPlatformAction({
              action: 'logout',
              entity_type: 'user',
              details: { event },
            });
          }, 0);
        } else if (event === 'USER_UPDATED' && session?.user) {
          setTimeout(() => {
            logPlatformAction({
              action: 'update',
              entity_type: 'user',
              entity_id: session.user.id,
              user_id: session.user.id,
              user_email: session.user.email,
              details: { event },
            });
          }, 0);
        }

        // Update previous user ref
        prevUserIdRef.current = currentUserId;

        if (session?.user) {
          // Use setTimeout to avoid deadlock with Supabase auth
          setTimeout(async () => {
            const profileData = await fetchProfile(session.user.id);
            setProfile(profileData);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      prevUserIdRef.current = session?.user?.id ?? null;

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        setProfile(profileData);
      }
      setLoading(false);

      // Mark as initialized AFTER initial session check
      initializedRef.current = true;
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user?.id) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, refreshProfile }}>
      <PresenceProvider userId={user?.id} workspaceId={profile?.workspace_id}>
        {children}
      </PresenceProvider>
    </AuthContext.Provider>
  );
}
