import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  bucket?: string;
  path?: string;
  expiresIn?: number;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidPath(path: string): boolean {
  // Keep it strict to avoid path traversal / unexpected buckets.
  // Expected: outbound/<workspace_id>/<lead_id>/<uuid>.<ext>
  return /^outbound\/[0-9a-f\-]{36}\/[0-9a-f\-]{36}\/[0-9a-f\-]{36}\.[a-z0-9]+$/i.test(path);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("[media-signed-url] Invalid claims", { error: claimsError?.message });
      return json(401, { error: "Unauthorized" });
    }

    const userId = claimsData.claims.sub;
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const bucket = String(body.bucket || "").trim();
    const path = String(body.path || "").trim();
    const expiresIn = Math.max(60, Math.min(60 * 60, Number(body.expiresIn || 60 * 30)));

    if (!bucket || !path) {
      return json(400, { error: "bucket and path are required" });
    }

    // Allowlist buckets for safety.
    if (bucket !== "whatsapp-audio") {
      return json(400, { error: "Invalid bucket" });
    }

    if (!isValidPath(path)) {
      return json(400, { error: "Invalid path" });
    }

    const workspaceIdFromPath = path.split("/")[1] || "";

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("workspace_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[media-signed-url] profile lookup failed", { error: profileError.message, userId });
      return json(500, { error: "Failed to load profile" });
    }

    const userWorkspaceId = profile?.workspace_id;
    if (!userWorkspaceId || userWorkspaceId !== workspaceIdFromPath) {
      return json(403, { error: "Forbidden" });
    }

    const { data: signedData, error: signedError } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (signedError || !signedData?.signedUrl) {
      console.error("[media-signed-url] createSignedUrl failed", {
        error: signedError?.message,
        bucket,
        path,
      });
      return json(500, { error: "Failed to sign media URL" });
    }

    return json(200, { signedUrl: signedData.signedUrl, expiresIn });
  } catch (error) {
    console.error("[media-signed-url] Unexpected error", error);
    return json(500, { error: "Internal server error" });
  }
});
