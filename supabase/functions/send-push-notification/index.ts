import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";
import { PushMessageError, Urgency } from "jsr:@negrel/webpush";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Convert standard Base64 to Base64 URL format
 */
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// VAPID keys from environment
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

let appServer: webpush.ApplicationServer | null = null;

/**
 * Import VAPID keys from Base64 URL format and create CryptoKeyPair
 */
async function importVapidKeysFromBase64(publicKeyB64: string, privateKeyB64: string) {
  const addPadding = (b64: string): string => {
    const padding = '='.repeat((4 - b64.length % 4) % 4);
    return b64 + padding;
  };

  const toStandardBase64 = (b64url: string): string => {
    return addPadding(b64url).replace(/-/g, '+').replace(/_/g, '/');
  };

  const decodeB64Url = (b64url: string): Uint8Array => {
    const standardB64 = toStandardBase64(b64url);
    const binaryString = atob(standardB64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const publicKeyRaw = decodeB64Url(publicKeyB64);
  const privateKeyRaw = decodeB64Url(privateKeyB64);

  // Validate format
  if (publicKeyRaw.length !== 65 || publicKeyRaw[0] !== 0x04) {
    throw new Error(`Invalid public key format: expected 65 bytes starting with 0x04`);
  }
  if (privateKeyRaw.length !== 32) {
    throw new Error(`Invalid private key format: expected 32 bytes`);
  }

  // Extract coordinates
  const x = publicKeyRaw.slice(1, 33);
  const y = publicKeyRaw.slice(33, 65);
  const d = privateKeyRaw;

  const toB64UrlBytes = (bytes: Uint8Array): string => {
    const b64 = btoa(String.fromCharCode(...bytes));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  // Import keys via SubtleCrypto
  const privateJwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: toB64UrlBytes(x),
    y: toB64UrlBytes(y),
    d: toB64UrlBytes(d),
  };

  const publicJwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: toB64UrlBytes(x),
    y: toB64UrlBytes(y),
  };

  const privateKey = await crypto.subtle.importKey(
    'jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']
  );

  const publicKey = await crypto.subtle.importKey(
    'jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']
  );

  return { publicKey, privateKey };
}

async function getAppServer(): Promise<webpush.ApplicationServer | null> {
  if (appServer) return appServer;
  
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('[send-push] VAPID keys not configured!');
    return null;
  }
  
  try {
    console.log('[send-push] Importing VAPID keys...');
    
    const vapidKeys = await importVapidKeysFromBase64(vapidPublicKey, vapidPrivateKey);
    
    appServer = await webpush.ApplicationServer.new({
      contactInformation: 'mailto:contato@appicompany.com',
      vapidKeys
    });
    
    // Log the public key that will be used in JWT
    const rawPublicKey = await appServer.getVapidPublicKeyRaw();
    const publicKeyB64 = btoa(String.fromCharCode(...rawPublicKey))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    console.log(`[send-push] Server VAPID public key: ${publicKeyB64.substring(0, 40)}...`);
    
    console.log('[send-push] Application server initialized successfully');
    return appServer;
  } catch (error) {
    console.error('[send-push] Failed to initialize app server:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const server = await getAppServer();
    if (!server) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured or invalid', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { workspace_id, title, body, url, tag, action } = await req.json();

    // Special action to generate new VAPID keys
    if (action === 'generate-vapid-keys') {
      console.log('[send-push] Generating new VAPID keys...');
      const newKeys = await webpush.generateVapidKeys();
      const exported = await webpush.exportVapidKeys(newKeys);
      
      // Get the applicationServerKey format (Base64 URL encoded raw public key)
      const testServer = await webpush.ApplicationServer.new({
        contactInformation: 'mailto:test@test.com',
        vapidKeys: newKeys
      });
      const rawPublicKey = await testServer.getVapidPublicKeyRaw();
      const publicKeyB64Url = btoa(String.fromCharCode(...rawPublicKey))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'VAPID keys generated. Save these in secrets as JSON strings.',
          publicKeyForFrontend: publicKeyB64Url,
          publicKeyJwk: JSON.stringify(exported.publicKey),
          privateKeyJwk: JSON.stringify(exported.privateKey),
          instructions: [
            '1. Update VAPID_PUBLIC_KEY secret with: ' + JSON.stringify(exported.publicKey),
            '2. Update VAPID_PRIVATE_KEY secret with: ' + JSON.stringify(exported.privateKey),
            '3. Update frontend VAPID_PUBLIC_KEY constant with: ' + publicKeyB64Url,
            '4. Users will need to re-subscribe to push notifications'
          ]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: 'workspace_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-push] Sending notifications for workspace: ${workspace_id}`);

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('workspace_id', workspace_id);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-push] No subscriptions found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-push] Found ${subscriptions.length} subscriptions`);

    const notificationPayload = JSON.stringify({
      title: title || 'Nova mensagem',
      body: body || 'Você recebeu uma nova mensagem',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: url || '/conversations', tag: tag || 'message' }
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          const p256dh = toBase64Url(sub.p256dh);
          const auth = toBase64Url(sub.auth);

          const subscriber = server.subscribe({
            endpoint: sub.endpoint,
            keys: { p256dh, auth }
          });

          console.log(`[send-push] Sending to: ${sub.endpoint.substring(0, 60)}...`);

          await subscriber.pushTextMessage(notificationPayload, {
            ttl: 86400,
            urgency: Urgency.High,
          });

          console.log(`[send-push] Success: ${sub.endpoint.substring(0, 50)}...`);
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          let errorMsg = 'Unknown error';
          
          if (error instanceof PushMessageError) {
            errorMsg = `PushMessageError: Status ${error.response?.status || 'unknown'}`;
            try {
              const responseText = await error.response?.text?.();
              if (responseText) errorMsg += ` - ${responseText}`;
            } catch {}
            
            if (error.isGone()) {
              console.log(`[send-push] Subscription is gone (410), removing...`);
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
          } else if (error instanceof Error) {
            errorMsg = error.message || error.toString();
          } else {
            errorMsg = String(error);
          }
          
          console.error(`[send-push] Error: ${errorMsg}`);
          return { success: false, endpoint: sub.endpoint, error: errorMsg };
        }
      })
    );

    const successful = results.filter(r => 
      r.status === 'fulfilled' && (r.value as any).success
    ).length;

    console.log(`[send-push] Results: ${successful}/${subscriptions.length} successful`);

    return new Response(
      JSON.stringify({ success: true, sent: successful, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-push] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
