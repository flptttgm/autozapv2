import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PhoneRevealRequest {
  id: string;
  apollo_person_id: string;
  status: "pending" | "delivered" | "failed" | "no_phone";
  phone_raw: string | null;
  requested_at: string;
  delivered_at: string | null;
}

export function usePhoneRevealStatus(personIds: string[] = []) {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<Record<string, PhoneRevealRequest>>({});
  const [isPolling, setIsPolling] = useState(false);

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    if (!profile?.workspace_id || personIds.length === 0) return;

    const { data, error } = await supabase
      .from("apollo_phone_reveals")
      .select("id, apollo_person_id, status, phone_raw, requested_at, delivered_at")
      .eq("workspace_id", profile.workspace_id)
      .in("apollo_person_id", personIds)
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Error fetching phone reveal status:", error);
      return;
    }

    // Create a map of the most recent request per person
    const requestMap: Record<string, PhoneRevealRequest> = {};
    for (const req of data || []) {
      if (!requestMap[req.apollo_person_id]) {
        requestMap[req.apollo_person_id] = req as PhoneRevealRequest;
      }
    }

    setRequests(requestMap);
  }, [profile?.workspace_id, personIds.join(",")]);

  // Start polling when there are pending requests
  useEffect(() => {
    const hasPending = Object.values(requests).some((r) => r.status === "pending");
    
    if (hasPending && !isPolling) {
      setIsPolling(true);
      
      // Immediate fetch when pending is detected
      fetchStatus();
      
      const intervalId = setInterval(async () => {
        await fetchStatus();
      }, 2000); // Poll every 2 seconds (faster)

      // Stop polling after 60 seconds max
      const timeoutId = setTimeout(() => {
        setIsPolling(false);
        clearInterval(intervalId);
      }, 60000);

      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        setIsPolling(false);
      };
    } else if (!hasPending && isPolling) {
      // Stop polling when no more pending requests
      setIsPolling(false);
    }
  }, [requests, isPolling, fetchStatus]);

  // Also use realtime subscription for instant updates (listen to ALL events)
  useEffect(() => {
    if (!profile?.workspace_id || personIds.length === 0) return;

    const channel = supabase
      .channel("phone-reveals")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, and DELETE
          schema: "public",
          table: "apollo_phone_reveals",
          filter: `workspace_id=eq.${profile.workspace_id}`,
        },
        (payload) => {
          const updated = payload.new as PhoneRevealRequest;
          if (updated && personIds.includes(updated.apollo_person_id)) {
            setRequests((prev) => ({
              ...prev,
              [updated.apollo_person_id]: updated,
            }));
            
            // If delivered, stop polling for this person
            if (updated.status === "delivered" || updated.status === "no_phone" || updated.status === "failed") {
              console.log(`Phone reveal completed for ${updated.apollo_person_id}: ${updated.status}`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.workspace_id, personIds.join(",")]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Helper to get status for a specific person
  const getStatus = (apolloPersonId: string): PhoneRevealRequest | null => {
    return requests[apolloPersonId] || null;
  };

  // Check if any are pending
  const hasPendingRequests = Object.values(requests).some((r) => r.status === "pending");

  return {
    requests,
    getStatus,
    hasPendingRequests,
    isPolling,
    refetch: fetchStatus,
  };
}
