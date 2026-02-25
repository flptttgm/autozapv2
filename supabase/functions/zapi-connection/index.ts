import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('ZAPI_INSTANCE_TOKEN');
    const userToken = Deno.env.get('ZAPI_USER_TOKEN');

    if (!instanceId || !token || !userToken) {
      throw new Error('Z-API credentials not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

    console.log(`Z-API Connection: Action=${action}`);

    switch (action) {
      case 'status': {
        const response = await fetch(`${baseUrl}/status`, {
          method: 'GET',
          headers: { 
            'Client-Token': userToken,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Z-API status error:', errorText);
          throw new Error(`Z-API status check failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Z-API Status:', data);

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'qrcode': {
        const response = await fetch(`${baseUrl}/qr-code/image`, {
          method: 'GET',
          headers: { 
            'Client-Token': userToken,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Z-API QR code error:', errorText);
          throw new Error(`Z-API QR code fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Z-API QR Code retrieved');

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        const response = await fetch(`${baseUrl}/disconnect`, {
          method: 'GET',
          headers: { 
            'Client-Token': userToken,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Z-API disconnect error:', errorText);
          throw new Error(`Z-API disconnect failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Z-API Disconnected');

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'restart': {
        const response = await fetch(`${baseUrl}/restart`, {
          method: 'GET',
          headers: { 
            'Client-Token': userToken,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Z-API restart error:', errorText);
          throw new Error(`Z-API restart failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Z-API Restarted');

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in zapi-connection function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
