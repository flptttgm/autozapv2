import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface PlatformLogEntry {
  action: 'login' | 'logout' | 'signup' | 'create' | 'update' | 'delete';
  entity_type: 'user' | 'subscription' | 'whatsapp' | 'payment' | 'ab_test' | 'lead' | 'appointment' | 'knowledge_base' | 'config';
  entity_id?: string;
  details?: Json;
  user_id?: string;
  user_email?: string;
}

export const logPlatformAction = async (entry: PlatformLogEntry) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("platform_logs").insert([{
      user_id: entry.user_id || user?.id || null,
      user_email: entry.user_email || user?.email || null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      details: entry.details || {},
    }]);

    if (error) {
      console.error("Error logging platform action:", error);
    }
  } catch (err) {
    console.error("Failed to log platform action:", err);
  }
};

export const usePlatformLog = () => {
  return { logPlatformAction };
};
