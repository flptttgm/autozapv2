import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Webhook endpoint for Apollo.io async phone number revelation
 * Apollo sends phone data here after processing reveal_phone_number requests
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload = await req.json();
    console.log("Apollo webhook received:", JSON.stringify(payload, null, 2));

    // Apollo sends data in various formats - handle them
    const matches = payload.matches || payload.people || [payload];
    
    for (const person of matches) {
      if (!person?.id) {
        console.log("Skipping person without ID:", person);
        continue;
      }

      const apolloPersonId = person.id;
      const phoneNumbers = person.phone_numbers || [];
      const primaryPhone = phoneNumbers.find((p: any) => p.type === "mobile")?.raw_number 
        || phoneNumbers[0]?.raw_number 
        || null;

      console.log(`Processing person ${apolloPersonId}, phone: ${primaryPhone}`);

      // Update the phone reveal request
      const { data: existingRequest, error: fetchError } = await supabase
        .from("apollo_phone_reveals")
        .select("id, workspace_id, status")
        .eq("apollo_person_id", apolloPersonId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !existingRequest) {
        console.log(`No pending request found for ${apolloPersonId}:`, fetchError?.message);
        continue;
      }

      // Update with delivered phone
      const { error: updateError } = await supabase
        .from("apollo_phone_reveals")
        .update({
          status: primaryPhone ? "delivered" : "no_phone",
          phone_raw: primaryPhone,
          delivered_at: new Date().toISOString(),
          payload: person,
        })
        .eq("id", existingRequest.id);

      if (updateError) {
        console.error(`Error updating request ${existingRequest.id}:`, updateError);
        continue;
      }

      console.log(`Updated request ${existingRequest.id} with phone: ${primaryPhone}`);

      // If phone was delivered and lead exists, update the lead too
      if (primaryPhone) {
        // Find leads with this Apollo ID in metadata
        const { data: leads } = await supabase
          .from("leads")
          .select("id, phone, metadata")
          .eq("workspace_id", existingRequest.workspace_id)
          .filter("metadata->apollo_id", "eq", apolloPersonId);

        if (leads && leads.length > 0) {
          for (const lead of leads) {
            // Only update if lead doesn't have a phone yet
            if (!lead.phone) {
              const { error: leadError } = await supabase
                .from("leads")
                .update({ 
                  phone: primaryPhone,
                  metadata: {
                    ...((lead.metadata as object) || {}),
                    phone_revealed: true,
                    phone_revealed_at: new Date().toISOString(),
                  }
                })
                .eq("id", lead.id);

              if (leadError) {
                console.error(`Error updating lead ${lead.id}:`, leadError);
              } else {
                console.log(`Updated lead ${lead.id} with revealed phone`);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: matches.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apollo-phone-webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
