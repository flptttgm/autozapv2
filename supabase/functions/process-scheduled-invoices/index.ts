import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = new Date().toISOString().split('T')[0];

    // Get all scheduled invoices due today
    const { data: scheduledInvoices, error: fetchError } = await supabaseClient
      .from("scheduled_invoices")
      .select(`
        *,
        lead:leads(id, name, phone, whatsapp_instance_id)
      `)
      .eq("next_due_date", today)
      .eq("is_active", true);

    if (fetchError) {
      console.error("Error fetching scheduled invoices:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch scheduled invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${scheduledInvoices?.length || 0} scheduled invoices for today`);

    const results = {
      processed: 0,
      failed: 0,
      details: [] as Array<{ invoiceId: string; status: string; error?: string }>
    };

    for (const scheduled of scheduledInvoices || []) {
      try {
        // Generate PIX and create invoice
        const generateResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-pix`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({
              workspaceId: scheduled.workspace_id,
              amount: scheduled.amount,
              description: scheduled.description,
              leadId: scheduled.lead_id,
              dueDate: scheduled.next_due_date,
              source: 'scheduled'
            })
          }
        );

        if (!generateResponse.ok) {
          throw new Error(`Failed to generate PIX: ${await generateResponse.text()}`);
        }

        const { invoice } = await generateResponse.json();

        // Send invoice via WhatsApp
        const sendResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-invoice`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({ invoiceId: invoice.id })
          }
        );

        if (!sendResponse.ok) {
          throw new Error(`Failed to send invoice: ${await sendResponse.text()}`);
        }

        // Calculate next due date based on frequency
        let nextDueDate = new Date(scheduled.next_due_date);
        
        switch (scheduled.frequency) {
          case 'weekly':
            nextDueDate.setDate(nextDueDate.getDate() + 7);
            break;
          case 'biweekly':
            nextDueDate.setDate(nextDueDate.getDate() + 14);
            break;
          case 'monthly':
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            // Handle day_of_month if specified
            if (scheduled.day_of_month) {
              const lastDayOfMonth = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
              nextDueDate.setDate(Math.min(scheduled.day_of_month, lastDayOfMonth));
            }
            break;
          case 'custom':
            if (scheduled.custom_days) {
              nextDueDate.setDate(nextDueDate.getDate() + scheduled.custom_days);
            }
            break;
        }

        // Update scheduled invoice with next due date
        await supabaseClient
          .from("scheduled_invoices")
          .update({ next_due_date: nextDueDate.toISOString().split('T')[0] })
          .eq("id", scheduled.id);

        results.processed++;
        results.details.push({
          invoiceId: invoice.id,
          status: 'success'
        });

      } catch (error: unknown) {
        console.error(`Error processing scheduled invoice ${scheduled.id}:`, error);
        const message = error instanceof Error ? error.message : "Unknown error";
        results.failed++;
        results.details.push({
          invoiceId: scheduled.id,
          status: 'failed',
          error: message
        });
      }
    }

    // Also check for overdue invoices and update their status
    const { error: overdueError } = await supabaseClient
      .from("invoices")
      .update({ status: 'overdue' })
      .lt("due_date", today)
      .in("status", ['pending', 'sent']);

    if (overdueError) {
      console.error("Error updating overdue invoices:", overdueError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in process-scheduled-invoices:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
