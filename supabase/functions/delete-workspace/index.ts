import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteWorkspaceRequest {
  workspace_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Client with user token for auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for deletions (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`[delete-workspace] User ${userId} requesting workspace deletion`);

    // Parse request body
    const { workspace_id }: DeleteWorkspaceRequest = await req.json();
    
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-workspace] Target workspace: ${workspace_id}`);

    // 1. Verify user is the owner of the workspace
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, owner_id")
      .eq("id", workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return new Response(
        JSON.stringify({ error: "Workspace não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (workspace.owner_id !== userId) {
      console.error(`User ${userId} is not owner of workspace ${workspace_id} (owner: ${workspace.owner_id})`);
      return new Response(
        JSON.stringify({ error: "Você não tem permissão para excluir este workspace" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verify this is not the user's current active workspace
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("workspace_id")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar perfil do usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userProfile?.workspace_id === workspace_id) {
      return new Response(
        JSON.stringify({ 
          error: "Não é possível excluir o workspace em que você está logado. Troque de workspace primeiro." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-workspace] Starting deletion of workspace: ${workspace.name} (${workspace_id})`);

    // 3. Cancel Asaas subscription if exists
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("asaas_subscription_id")
      .eq("workspace_id", workspace_id)
      .single();

    if (subscription?.asaas_subscription_id) {
      console.log(`[delete-workspace] Cancelling Asaas subscription: ${subscription.asaas_subscription_id}`);
      try {
        const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
        if (asaasApiKey) {
          const asaasUrl = Deno.env.get("ASAAS_API_URL") || "https://api.asaas.com/v3";
          await fetch(`${asaasUrl}/subscriptions/${subscription.asaas_subscription_id}`, {
            method: "DELETE",
            headers: {
              "access_token": asaasApiKey,
              "Content-Type": "application/json",
            },
          });
          console.log("[delete-workspace] Asaas subscription cancelled");
        }
      } catch (asaasError) {
        console.error("[delete-workspace] Error cancelling Asaas subscription:", asaasError);
        // Continue with deletion - don't block on external service failure
      }
    }

    // 4. Disconnect WhatsApp instances via Z-API
    const { data: instances } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("instance_id, instance_token")
      .eq("workspace_id", workspace_id);

    if (instances && instances.length > 0) {
      console.log(`[delete-workspace] Disconnecting ${instances.length} WhatsApp instance(s)`);
      for (const instance of instances) {
        try {
          if (instance.instance_id && instance.instance_token) {
            await fetch(`https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/disconnect`, {
              method: "GET",
            });
            console.log(`[delete-workspace] Disconnected instance ${instance.instance_id}`);
          }
        } catch (zapiError) {
          console.error(`[delete-workspace] Error disconnecting instance ${instance.instance_id}:`, zapiError);
          // Continue - don't block on external service failure
        }
      }
    }

    // 5. Delete all related data in proper order (to avoid FK violations)
    const deletionOrder = [
      // Message-related
      { table: "messages", field: "workspace_id" },
      { table: "message_buffer", field: "workspace_id" },
      { table: "chat_memory", field: "workspace_id" },
      
      // Lead-related (messages reference leads, so delete messages first)
      { table: "lead_tag_assignments", field: "lead_id", subquery: true },
      { table: "appointments", field: "workspace_id" },
      { table: "invoices", field: "workspace_id" },
      { table: "quotes", field: "workspace_id" },
      { table: "leads", field: "workspace_id" },
      
      // Tags
      { table: "lead_tags", field: "workspace_id" },
      
      // AI-related
      { table: "ai_feedback", field: "workspace_id" },
      { table: "knowledge_base", field: "workspace_id" },
      { table: "custom_templates", field: "workspace_id" },
      { table: "agent_routing_config", field: "workspace_id" },
      
      // WhatsApp
      { table: "group_welcome_messages", field: "workspace_id" },
      { table: "whatsapp_instances", field: "workspace_id" },
      
      // Other configs
      { table: "message_templates", field: "workspace_id" },
      { table: "calendar_integrations", field: "workspace_id" },
      { table: "system_config", field: "workspace_id" },
      { table: "audit_logs", field: "workspace_id" },
      
      // Payments
      { table: "payments_history", field: "workspace_id" },
      { table: "asaas_customers", field: "workspace_id" },
      
      // Apollo/Prospect
      { table: "apollo_phone_reveals", field: "workspace_id" },
      
      // Invites
      { table: "invites", field: "workspace_id" },
      
      // Members and subscriptions
      { table: "workspace_members", field: "workspace_id" },
      { table: "subscriptions", field: "workspace_id" },
    ];

    // Special handling for lead_tag_assignments (references leads by lead_id)
    console.log("[delete-workspace] Deleting lead_tag_assignments for workspace leads...");
    const { data: workspaceLeads } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("workspace_id", workspace_id);
    
    if (workspaceLeads && workspaceLeads.length > 0) {
      const leadIds = workspaceLeads.map(l => l.id);
      await supabaseAdmin
        .from("lead_tag_assignments")
        .delete()
        .in("lead_id", leadIds);
    }

    for (const item of deletionOrder) {
      if (item.subquery) continue; // Skip, handled above
      
      console.log(`[delete-workspace] Deleting from ${item.table}...`);
      const { error: deleteError } = await supabaseAdmin
        .from(item.table)
        .delete()
        .eq(item.field, workspace_id);
      
      if (deleteError) {
        console.error(`[delete-workspace] Error deleting from ${item.table}:`, deleteError);
        // Continue with other deletions
      }
    }

    // 6. Finally, delete the workspace itself
    console.log("[delete-workspace] Deleting workspace...");
    const { error: workspaceDeleteError } = await supabaseAdmin
      .from("workspaces")
      .delete()
      .eq("id", workspace_id);

    if (workspaceDeleteError) {
      console.error("[delete-workspace] Error deleting workspace:", workspaceDeleteError);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir workspace: " + workspaceDeleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Log the action
    await supabaseAdmin.from("platform_logs").insert({
      user_id: userId,
      user_email: user.email,
      action: "delete",
      entity_type: "workspace",
      entity_id: workspace_id,
      details: {
        workspace_name: workspace.name,
        deleted_at: new Date().toISOString(),
      },
    });

    console.log(`[delete-workspace] Successfully deleted workspace ${workspace.name} (${workspace_id})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Workspace "${workspace.name}" excluído com sucesso` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[delete-workspace] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
