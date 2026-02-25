import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is platform admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "platform_admin")
      .single();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Acesso negado - apenas administradores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user ID from request body
    const { user_id } = await req.json();
    
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-delete-user] Admin ${user.email} deleting user: ${user_id}`);

    // Get user email before deletion for logging
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const targetEmail = targetUser?.user?.email || "unknown";

    // Delete the user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    
    if (deleteError) {
      console.error(`[admin-delete-user] Failed to delete user:`, deleteError);
      return new Response(
        JSON.stringify({ error: "Erro ao deletar usuário", details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the deletion action
    await supabaseAdmin.from("platform_logs").insert({
      user_id: user.id,
      user_email: user.email,
      action: "delete",
      entity_type: "user",
      entity_id: user_id,
      details: {
        operation: "admin_delete_user",
        deleted_email: targetEmail,
        deleted_at: new Date().toISOString(),
      },
    });

    console.log(`[admin-delete-user] Successfully deleted: ${targetEmail}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Usuário ${targetEmail} removido com sucesso`,
        deleted_email: targetEmail,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[admin-delete-user] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Erro ao processar solicitação", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
