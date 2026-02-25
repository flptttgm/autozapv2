
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback styles (better than notionists)
const avatarStyles: Record<string, string> = {
  sales: "micah",
  support: "micah",
  scheduling: "micah",
  financial: "micah",
  technical: "micah",
  general: "micah",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { personaName, agentType, agentId, gender } = await req.json();

    if (!personaName || !agentId) {
      return new Response(
        JSON.stringify({ error: "personaName and agentId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const aiApiKey = Deno.env.get("AI_API_KEY");

    let avatarBuffer: Uint8Array | null = null;
    let contentType = "image/svg+xml";
    let fileExt = "svg";

    // DEBUG: Log start
    await supabase.from('debug_logs').insert({
      data: {
        function: 'generate-avatar',
        params: { personaName, agentType, agentId, gender },
        has_key: !!aiApiKey
      }
    });

    // 1. Try AI Generation (DALL-E 3) if Key is present
    if (aiApiKey) {
      try {
        console.log("Attempting AI Image Generation...");
        const image = await generateAIImage(aiApiKey, personaName, agentType, gender);
        if (image) {
          avatarBuffer = image.buffer;
          contentType = image.contentType;
          fileExt = image.fileExt;
          console.log("AI Image generated successfully!");
        }
      } catch (e) {
        console.error("AI Generation failed, falling back to DiceBear:", e);
      }
    }

    // 2. Fallback to DiceBear if AI failed or no key
    if (!avatarBuffer) {
      console.log("Using DiceBear fallback...");
      await supabase.from('debug_logs').insert({
        data: {
          function: 'generate-avatar',
          status: 'fallback_to_dicebear',
          reason: aiApiKey ? 'AI generation failed' : 'No API Key'
        }
      });
      const style = avatarStyles[agentType] || "micah";
      const seed = encodeURIComponent(`${personaName}-${agentId}`);
      // Use 'micah' style which is cleaner/modern, or 'avataaars'
      const dicebearUrl = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&backgroundType=gradientLinear`;

      const response = await fetch(dicebearUrl);
      if (!response.ok) throw new Error(`DiceBear error: ${response.status}`);

      const svgData = await response.arrayBuffer();
      avatarBuffer = new Uint8Array(svgData);
      contentType = "image/svg+xml";
      fileExt = "svg";
    }

    // 3. Upload to Supabase Storage
    const fileName = `avatars/${agentId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, avatarBuffer!, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Failed to upload avatar: ${uploadError.message}`);
    }

    // 4. Get Public URL
    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(fileName);

    const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    // 5. Update DB
    const { error: updateError } = await supabase
      .from("custom_templates")
      .update({ avatar_url: avatarUrl })
      .eq("id", agentId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Failed to update avatar URL: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ avatarUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("generate-avatar error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateAIImage(apiKey: string, name: string, role: string, gender?: string) {
  // Use OpenAI DALL-E 3
  // Prompt engineering for professional avatar
  const genderTerm = gender ? gender : "professional";
  const roleTerm = role === 'custom' ? 'assistant' : role;

  const prompt = `A professional, highly detailed, photorealistic profile picture of a ${roleTerm} named ${name}. 
  The person should look friendly, trustworthy, and competent. 
  Neutral high-quality studio background (soft grey or gradient). 
  Lighting: Soft, professional studio lighting, rim light.
  Style: 8k resolution, cinematic, realistic texture, no cartoon, no 3D render style. 
  Gender: ${genderTerm}.`;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
      quality: "standard",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Image Error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const b64Json = data.data[0].b64_json;

  // Convert B64 to Uint8Array
  const binString = atob(b64Json);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }

  return {
    buffer: bytes,
    contentType: "image/png",
    fileExt: "png"
  };
}
