import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PresenceContextType {
    onlineUserIds: Set<string>;
}

const PresenceContext = createContext<PresenceContextType>({
    onlineUserIds: new Set(),
});

export const usePresenceContext = () => useContext(PresenceContext);

/**
 * Global presence provider — mounts once in AuthProvider.
 * Handles both broadcasting the current user's presence AND
 * tracking all online users in the workspace via a single channel instance.
 */
export function PresenceProvider({
    userId,
    workspaceId,
    children,
}: {
    userId: string | undefined;
    workspaceId: string | null | undefined;
    children: React.ReactNode;
}) {
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!workspaceId || !userId) return;

        // Fire-and-forget last_seen_at update
        const updateLastSeen = () => {
            supabase
                .from("profiles" as any)
                .update({ last_seen_at: new Date().toISOString() } as any)
                .eq("user_id", userId)
                .then(() => { });
        };

        const channelName = `workspace-presence-${workspaceId}`;
        const channel = supabase.channel(channelName);
        channelRef.current = channel;

        channel
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState();
                const ids = new Set<string>();
                (Object.values(state) as any[][]).forEach((presences) => {
                    presences.forEach((p) => {
                        if (p.user_id) ids.add(p.user_id);
                    });
                });
                setOnlineUserIds(ids);
            })
            .subscribe(async (status: string) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({
                        user_id: userId,
                        online_at: new Date().toISOString(),
                    });
                    updateLastSeen();
                }
            });

        // Update last_seen_at every 60 seconds
        intervalRef.current = setInterval(updateLastSeen, 60_000);

        return () => {
            updateLastSeen();
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [workspaceId, userId]);

    return (
        <PresenceContext.Provider value={{ onlineUserIds }}>
            {children}
        </PresenceContext.Provider>
    );
}
