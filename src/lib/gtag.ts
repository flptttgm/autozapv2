// Google Ads Conversion Tracking
// ID: AW-17611077707

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

// Google Ads conversion IDs - configure these with your actual conversion labels
const CONVERSION_IDS = {
  SIGNUP: 'AW-17611077707/SIGNUP_LABEL', // Replace SIGNUP_LABEL with actual label from Google Ads
  SUBSCRIPTION: 'AW-17611077707/SUBSCRIPTION_LABEL', // Replace SUBSCRIPTION_LABEL with actual label
  TRIAL_START: 'AW-17611077707/TRIAL_LABEL', // Replace TRIAL_LABEL with actual label
  LEAD: 'AW-17611077707/LEAD_LABEL', // Replace LEAD_LABEL with actual label
};

/**
 * Track a Google Ads conversion event
 */
export function trackConversion(
  conversionType: keyof typeof CONVERSION_IDS,
  value?: number,
  currency: string = 'BRL'
) {
  if (typeof window === 'undefined' || !window.gtag) {
    console.warn('gtag not available');
    return;
  }

  const conversionId = CONVERSION_IDS[conversionType];
  
  window.gtag('event', 'conversion', {
    send_to: conversionId,
    value: value,
    currency: currency,
  });

  console.log(`[Google Ads] Conversion tracked: ${conversionType}`, { value, currency });
}

/**
 * Track signup conversion
 */
export function trackSignupConversion() {
  trackConversion('SIGNUP');
  
  // Also send to Analytics
  if (window.gtag) {
    window.gtag('event', 'sign_up', {
      method: 'email',
    });
  }
}

/**
 * Track subscription conversion with value
 */
export function trackSubscriptionConversion(planType: string, value: number) {
  trackConversion('SUBSCRIPTION', value, 'BRL');
  
  // Also send to Analytics
  if (window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: `sub_${Date.now()}`,
      value: value,
      currency: 'BRL',
      items: [{
        item_name: planType,
        item_category: 'subscription',
        price: value,
        quantity: 1,
      }],
    });
  }
}

/**
 * Track trial start conversion
 */
export function trackTrialConversion() {
  trackConversion('TRIAL_START');
  
  // Also send to Analytics
  if (window.gtag) {
    window.gtag('event', 'start_trial');
  }
}

/**
 * Track lead capture (landing page form)
 */
export function trackLeadConversion(source?: string) {
  trackConversion('LEAD');
  
  // Also send to Analytics
  if (window.gtag) {
    window.gtag('event', 'generate_lead', {
      source: source || 'landing_page',
    });
  }
}

/**
 * Track page view (for SPAs)
 */
export function trackPageView(pagePath: string, pageTitle?: string) {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle,
  });
}

/**
 * Track custom event
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', eventName, params);
}
