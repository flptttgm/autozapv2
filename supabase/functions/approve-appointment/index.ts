import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApproveAppointmentRequest {
  appointmentId: string;
  action: "approve" | "reject";
  reason?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Z-API client token for authentication
    const clientToken = Deno.env.get("ZAPI_USER_TOKEN");

    // Get user from authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ApproveAppointmentRequest = await req.json();
    const { appointmentId, action, reason } = body;

    if (!appointmentId || !action) {
      return new Response(
        JSON.stringify({ error: "Missing appointmentId or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the appointment with lead info
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select(`
        id, title, status, start_time, end_time, workspace_id, lead_id, metadata,
        leads(name, phone, whatsapp_instance_id)
      `)
      .eq("id", appointmentId)
      .single();

    if (fetchError || !appointment) {
      console.error("Error fetching appointment:", fetchError);
      return new Response(
        JSON.stringify({ error: "Appointment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to the workspace
    const { data: profile } = await supabase
      .from("profiles")
      .select("workspace_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.workspace_id !== appointment.workspace_id) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify appointment is in pending_owner status
    if (appointment.status !== "pending_owner") {
      return new Response(
        JSON.stringify({ error: `Cannot ${action} appointment with status: ${appointment.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    // leads is returned as an object when using .single(), extract safely with unknown first
    const leadsData = appointment.leads as unknown as { name: string | null; phone: string; whatsapp_instance_id: string | null } | null;
    const leadPhone = leadsData?.phone;
    const leadName = leadsData?.name || leadPhone;
    const instanceId = leadsData?.whatsapp_instance_id;

    if (action === "approve") {
      // Update appointment to pending_lead
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "pending_lead",
          owner_approved_at: now,
          owner_approved_by: user.id,
          metadata: {
            ...(appointment.metadata || {}),
            owner_approved_at: now,
            owner_approved_by_id: user.id,
          },
        })
        .eq("id", appointmentId);

      if (updateError) {
        console.error("Error updating appointment:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update appointment" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send WhatsApp to lead asking for confirmation
      if (leadPhone) {
        const startDate = new Date(appointment.start_time);
        const formattedDate = startDate.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        const formattedTime = startDate.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const confirmationMessage = `✅ *Ótimas notícias!* Seu agendamento foi aprovado!\n\n📅 *${appointment.title}*\n🗓️ ${formattedDate} às ${formattedTime}\n\nPor favor, confirme sua presença respondendo *SIM* ou *CONFIRMO*.\n\nSe precisar reagendar ou cancelar, é só nos avisar! 😊`;

        // Try lead's instance first
        let instance = null;
        
        if (instanceId) {
          console.log(`[approve-appointment] Looking for lead's instance: ${instanceId}`);
          const { data } = await supabase
            .from("whatsapp_instances")
            .select("instance_id, instance_token")
            .eq("instance_id", instanceId)
            .single();
          instance = data;
        }

        // Fallback: get workspace's connected instance
        if (!instance) {
          console.log(`[approve-appointment] Lead's instance not found, looking for workspace's connected instance`);
          const { data } = await supabase
            .from("whatsapp_instances")
            .select("instance_id, instance_token")
            .eq("workspace_id", appointment.workspace_id)
            .eq("status", "connected")
            .limit(1)
            .maybeSingle();
          instance = data;
          
          if (instance) {
            console.log(`[approve-appointment] Using workspace's instance: ${instance.instance_id}`);
          }
        }

        if (instance?.instance_id && instance?.instance_token) {
          try {
            const zapiUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/send-text`;
            
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (clientToken) {
              headers["client-token"] = clientToken;
            }

            const zapiResponse = await fetch(zapiUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({
                phone: leadPhone,
                message: confirmationMessage,
              }),
            });

            const responseText = await zapiResponse.text();
            console.log(`[approve-appointment] Z-API response:`, {
              status: zapiResponse.status,
              ok: zapiResponse.ok,
              body: responseText.substring(0, 200)
            });

            if (!zapiResponse.ok) {
              console.error(`[approve-appointment] Z-API error sending to ${leadPhone}:`, responseText);
            } else {
              console.log(`[approve-appointment] Confirmation request sent successfully to ${leadPhone}`);
            }
          } catch (sendError) {
            console.error("[approve-appointment] Error sending WhatsApp confirmation:", sendError);
            // Don't fail the approval just because the message failed
          }
        } else {
          console.log(`[approve-appointment] No instance found - neither lead's nor workspace's`);
        }
      }

      // Send push notification to workspace owner about the approval (only if approved by someone else)
      const { data: workspaceOwner } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", appointment.workspace_id)
        .single();

      // Only notify the owner if someone else approved (not the owner themselves)
      if (workspaceOwner?.owner_id && workspaceOwner.owner_id !== user.id) {
        await supabase.from("user_notifications").insert({
          user_id: workspaceOwner.owner_id,
          title: "Agendamento aprovado",
          body: `O agendamento "${appointment.title}" com ${leadName} foi aprovado. Aguardando confirmação do cliente.`,
          url: "/appointments",
          type: "appointment",
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Appointment approved, waiting for lead confirmation",
          newStatus: "pending_lead"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "reject") {
      // Update appointment to rejected
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "rejected",
          metadata: {
            ...(appointment.metadata || {}),
            rejected_at: now,
            rejected_by_id: user.id,
            rejection_reason: reason,
          },
        })
        .eq("id", appointmentId);

      if (updateError) {
        console.error("Error rejecting appointment:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to reject appointment" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send WhatsApp to lead informing about rejection
      if (leadPhone) {
        const rejectionMessage = `❌ *Agendamento não disponível*\n\nInfelizmente não foi possível confirmar o horário solicitado${reason ? `: ${reason}` : "."}\n\nGostaria de sugerir outro horário? Estamos à disposição para encontrar uma data que funcione melhor! 😊`;

        // Try lead's instance first
        let instance = null;
        
        if (instanceId) {
          console.log(`[approve-appointment] Rejection - Looking for lead's instance: ${instanceId}`);
          const { data } = await supabase
            .from("whatsapp_instances")
            .select("instance_id, instance_token")
            .eq("instance_id", instanceId)
            .single();
          instance = data;
        }

        // Fallback: get workspace's connected instance
        if (!instance) {
          console.log(`[approve-appointment] Rejection - Lead's instance not found, looking for workspace's connected instance`);
          const { data } = await supabase
            .from("whatsapp_instances")
            .select("instance_id, instance_token")
            .eq("workspace_id", appointment.workspace_id)
            .eq("status", "connected")
            .limit(1)
            .maybeSingle();
          instance = data;
          
          if (instance) {
            console.log(`[approve-appointment] Rejection - Using workspace's instance: ${instance.instance_id}`);
          }
        }

        if (instance?.instance_id && instance?.instance_token) {
          try {
            const zapiUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/send-text`;
            
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (clientToken) {
              headers["client-token"] = clientToken;
            }

            const zapiResponse = await fetch(zapiUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({
                phone: leadPhone,
                message: rejectionMessage,
              }),
            });

            const responseText = await zapiResponse.text();
            console.log(`[approve-appointment] Z-API rejection response:`, {
              status: zapiResponse.status,
              ok: zapiResponse.ok,
              body: responseText.substring(0, 200)
            });

            if (!zapiResponse.ok) {
              console.error(`[approve-appointment] Z-API error sending rejection to ${leadPhone}:`, responseText);
            } else {
              console.log(`[approve-appointment] Rejection notification sent successfully to ${leadPhone}`);
            }
          } catch (sendError) {
            console.error("[approve-appointment] Error sending WhatsApp rejection:", sendError);
          }
        } else {
          console.log(`[approve-appointment] Rejection - No instance found - neither lead's nor workspace's`);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Appointment rejected",
          newStatus: "rejected"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in approve-appointment:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
