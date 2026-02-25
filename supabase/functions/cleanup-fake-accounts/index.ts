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

    // Get authorization header to verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user is a platform admin
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

    console.log("Admin verified, starting cleanup...");

    // List of blocked domains
    const blockedDomains = [
      "example.com",
      "test.com",
      "tempmail.com",
      "mailinator.com",
      "guerrillamail.com",
      "10minutemail.com",
      "throwaway.email",
      "fakeinbox.com",
      "temp-mail.org",
      "disposablemail.com",
    ];

    // Get all users from auth.users
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (listError) {
      console.error("Error listing users:", listError);
      throw listError;
    }

    console.log(`Found ${authUsers.users.length} total users`);

    // Filter fake accounts
    const fakeAccounts = authUsers.users.filter((u) => {
      const email = u.email?.toLowerCase() || "";
      const domain = email.split("@")[1] || "";

      // Check blocked domains
      if (blockedDomains.includes(domain)) return true;

      // Check test pattern: test[random][timestamp]@example.com
      if (/^test[a-z0-9]{6,}[0-9]{10,}@/.test(email)) return true;

      // Check test pattern with only random chars
      if (/^test[a-z0-9]{8,}@/.test(email)) return true;

      return false;
    });

    console.log(`Identified ${fakeAccounts.length} fake accounts to delete`);

    const deletedEmails: string[] = [];
    const failedEmails: string[] = [];

    // Delete each fake account
    for (const fakeUser of fakeAccounts) {
      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(fakeUser.id);
        
        if (deleteError) {
          console.error(`Failed to delete ${fakeUser.email}:`, deleteError);
          failedEmails.push(fakeUser.email || "unknown");
        } else {
          console.log(`Deleted: ${fakeUser.email}`);
          deletedEmails.push(fakeUser.email || "unknown");
        }
      } catch (err) {
        console.error(`Error deleting ${fakeUser.email}:`, err);
        failedEmails.push(fakeUser.email || "unknown");
      }
    }

    // Clean orphan records (subscriptions, messages, etc. without workspace)
    console.log("Cleaning orphan records...");
    const { data: orphanCleanup, error: orphanError } = await supabaseAdmin.rpc("cleanup_orphan_records");
    
    if (orphanError) {
      console.error("Error cleaning orphan records:", orphanError);
    } else {
      console.log("Orphan cleanup result:", orphanCleanup);
    }

    // Log the cleanup action
    await supabaseAdmin.from("platform_logs").insert({
      user_id: user.id,
      user_email: user.email,
      action: "delete",
      entity_type: "user",
      entity_id: "bulk_cleanup",
      details: {
        operation: "fake_accounts_cleanup",
        total_identified: fakeAccounts.length,
        total_deleted: deletedEmails.length,
        total_failed: failedEmails.length,
        deleted_emails: deletedEmails,
        failed_emails: failedEmails,
        orphan_cleanup: orphanCleanup || null,
        cleanup_date: new Date().toISOString(),
      },
    });

    console.log("Cleanup completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: `Limpeza concluída: ${deletedEmails.length} contas fake removidas`,
        stats: {
          total_identified: fakeAccounts.length,
          total_deleted: deletedEmails.length,
          total_failed: failedEmails.length,
          orphan_cleanup: orphanCleanup || { deleted_subscriptions: 0, deleted_messages: 0, deleted_leads: 0, deleted_appointments: 0 },
        },
        deleted_emails: deletedEmails,
        failed_emails: failedEmails,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Cleanup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Erro ao executar limpeza", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
