import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const getOrCreateVisitorId = (): string => {
  const key = 'autozap_visitor_id';
  let visitorId = localStorage.getItem(key);
  
  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(key, visitorId);
  }
  
  return visitorId;
};

export const usePageView = () => {
  const location = useLocation();

  useEffect(() => {
    const trackPageView = async () => {
      try {
        const visitorId = getOrCreateVisitorId();
        
        await supabase.from('page_views').insert({
          page_path: location.pathname,
          visitor_id: visitorId,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        });
      } catch (error) {
        // Silent fail - don't break the app for analytics
        console.error('Failed to track page view:', error);
      }
    };

    trackPageView();
  }, [location.pathname]);
};
