import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GroupInfo {
  phone: string;
  name: string;
  participantsCount: number;
  isAnnouncement: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get instance_id from request body
    const { instance_id } = await req.json();
    
    if (!instance_id) {
      return new Response(
        JSON.stringify({ error: "instance_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[zapi-list-groups] Fetching groups for instance: ${instance_id}`);

    // Detect if it's a UUID (database id) or Z-API instance_id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instance_id);
    
    // Get instance details - query by database id or Z-API instance_id
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("instance_id, instance_token, workspace_id")
      .eq(isUuid ? "id" : "instance_id", instance_id)
      .single();

    if (instanceError || !instance) {
      console.error("[zapi-list-groups] Instance not found:", instanceError);
      return new Response(
        JSON.stringify({ error: "Instância não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", instance.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const CLIENT_TOKEN = Deno.env.get("ZAPI_USER_TOKEN");
    
    // Fetch chats from Z-API
    const zapiUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/chats?page=1&pageSize=200`;
    
    console.log(`[zapi-list-groups] Calling Z-API: ${zapiUrl}`);
    
    const response = await fetch(zapiUrl, {
      method: "GET",
      headers: {
        "Client-Token": CLIENT_TOKEN || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[zapi-list-groups] Z-API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar grupos da API" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chats = await response.json();
    
    console.log(`[zapi-list-groups] Received ${chats?.length || 0} chats from Z-API`);

    // Filter only groups
    const groups: GroupInfo[] = [];
    
    if (Array.isArray(chats)) {
      for (const chat of chats) {
        // Check if it's a group (phone ends with @g.us or has isGroup flag)
        const isGroup = chat.isGroup === true || 
                        chat.phone?.endsWith("@g.us") || 
                        chat.isGroupAnnouncement === true;
        
        if (isGroup && chat.phone && chat.name) {
          groups.push({
            phone: chat.phone,
            name: chat.name,
            participantsCount: chat.participants?.length || 0,
            isAnnouncement: chat.isGroupAnnouncement || false,
          });
        }
      }
    }

    console.log(`[zapi-list-groups] Found ${groups.length} groups`);

    // Sort by name
    groups.sort((a, b) => a.name.localeCompare(b.name));

    return new Response(
      JSON.stringify({ 
        success: true, 
        groups,
        total: groups.length 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[zapi-list-groups] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Erro ao processar solicitação", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
