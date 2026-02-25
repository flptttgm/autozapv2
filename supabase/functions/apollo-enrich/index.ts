import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Custos de créditos internos (sincronizado com src/lib/prospect-credits.ts)
const CREDIT_COSTS = {
  enrich: 1,
  reveal_phones: 1, // Atualizado para 1 crédito
};

// Mock de dados enriquecidos
const MOCK_ENRICHED: Record<string, any> = {
  "mock-1": { id: "mock-1", first_name: "Carlos", last_name: "Silva", name: "Carlos Silva", email: "carlos.silva@techbrasil.com.br", title: "CEO", headline: "CEO na TechBrasil", city: "São Paulo", state: "SP", country: "Brasil", linkedin_url: "https://linkedin.com/in/carlos-silva-tech", email_status: "verified", seniority: "c_suite", organization: { name: "TechBrasil Ltda", industry: "Technology", website_url: "https://techbrasil.com.br", employee_count: 150 }, phone_numbers: [{ raw_number: "+55 11 99999-0001", type: "mobile" }] },
  "mock-2": { id: "mock-2", first_name: "Ana", last_name: "Pereira", name: "Ana Pereira", email: "ana.pereira@inovatech.io", title: "CTO", headline: "CTO | Especialista em Cloud & AI", city: "Rio de Janeiro", state: "RJ", country: "Brasil", linkedin_url: "https://linkedin.com/in/ana-pereira-cto", email_status: "verified", seniority: "c_suite", organization: { name: "InovaTech", industry: "Software Development", website_url: "https://inovatech.io", employee_count: 85 }, phone_numbers: [{ raw_number: "+55 21 98888-0002", type: "mobile" }] },
  "mock-3": { id: "mock-3", first_name: "Pedro", last_name: "Lopes", name: "Pedro Lopes", email: "pedro.lopes@vendamais.com.br", title: "Gerente de Vendas", headline: "Gerente de Vendas | +10 anos em B2B", city: "Belo Horizonte", state: "MG", country: "Brasil", linkedin_url: "https://linkedin.com/in/pedro-lopes-vendas", email_status: "verified", seniority: "manager", organization: { name: "VendaMais S.A.", industry: "Sales", website_url: "https://vendamais.com.br", employee_count: 320 }, phone_numbers: [{ raw_number: "+55 31 97777-0003", type: "mobile" }] },
  "mock-4": { id: "mock-4", first_name: "Maria", last_name: "Ferreira", name: "Maria Ferreira", email: "maria@agenciabr.com", title: "Diretora de Marketing", headline: "Diretora de Marketing | Growth & Branding", city: "Curitiba", state: "PR", country: "Brasil", linkedin_url: "https://linkedin.com/in/maria-ferreira-mkt", email_status: "guessed", seniority: "director", organization: { name: "AgênciaBR", industry: "Marketing", website_url: "https://agenciabr.com", employee_count: 45 }, phone_numbers: [] },
  "mock-5": { id: "mock-5", first_name: "João", last_name: "Souza", name: "João Souza", email: "joao@startupxyz.com.br", title: "Fundador", headline: "Fundador & CEO | Serial Entrepreneur", city: "Florianópolis", state: "SC", country: "Brasil", linkedin_url: "https://linkedin.com/in/joao-souza-founder", email_status: "verified", seniority: "founder", organization: { name: "StartupXYZ", industry: "Technology", website_url: "https://startupxyz.com.br", employee_count: 22 }, phone_numbers: [{ raw_number: "+55 48 96666-0005", type: "mobile" }] },
};

function generateMockEnriched(id: string, includePhone: boolean = false) {
  const names = ["Lucas", "Marina", "Victor", "Carolina", "Felipe", "Bianca"];
  const lastNames = ["Almeida", "Barbosa", "Carvalho", "Dias", "Esteves", "Fonseca"];
  const companies = ["TechCorp", "InovaHub", "DigitalBR", "CloudMax", "DataSoft"];
  
  const firstName = names[Math.floor(Math.random() * names.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const company = companies[Math.floor(Math.random() * companies.length)];
  
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase()}.com.br`,
    title: "Profissional",
    headline: `Profissional na ${company}`,
    city: "São Paulo",
    state: "SP",
    country: "Brasil",
    linkedin_url: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
    email_status: "verified",
    seniority: "manager",
    organization: { name: company, industry: "Technology", website_url: `https://${company.toLowerCase()}.com.br`, employee_count: 100 },
    phone_numbers: includePhone 
      ? [{ raw_number: `+55 11 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`, type: "mobile" }]
      : [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action = "enrich", workspace_id, details, reveal_personal_emails } = await req.json();
    const apolloApiKey = Deno.env.get("APOLLO_API_KEY");
    
    // Criar cliente Supabase para verificar créditos
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const personCount = details?.length || 0;
    const creditCost = action === "reveal_phones" 
      ? CREDIT_COSTS.reveal_phones * personCount
      : CREDIT_COSTS.enrich * personCount;

    // Verificar e debitar créditos se workspace_id fornecido
    let newBalance: number | null = null;
    if (workspace_id && personCount > 0) {
      // Verificar saldo
      const { data: credits } = await supabase
        .from("prospect_credits")
        .select("balance")
        .eq("workspace_id", workspace_id)
        .single();

      if (!credits || credits.balance < creditCost) {
        return new Response(
          JSON.stringify({
            error: "insufficient_credits",
            required: creditCost,
            available: credits?.balance || 0,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Debitar créditos
      const { data: debitResult, error: debitError } = await supabase.rpc("debit_prospect_credits", {
        p_workspace_id: workspace_id,
        p_amount: creditCost,
        p_action: action,
        p_description: `${action === "reveal_phones" ? "Revelação de telefone" : "Enriquecimento"} de ${personCount} contato(s)`,
      });

      if (debitError) {
        console.error("Error debiting credits:", debitError);
        return new Response(
          JSON.stringify({ error: "Failed to debit credits", details: debitError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      newBalance = debitResult;
    }

    // Se não tiver API key do Apollo, retorna mock
    if (!apolloApiKey) {
      const includePhone = action === "reveal_phones";
      const matches = details.map((d: { id: string }) => {
        const mock = MOCK_ENRICHED[d.id] || generateMockEnriched(d.id, includePhone);
        // Para enrich sem reveal, não incluir telefone
        if (action === "enrich" && mock.phone_numbers?.length) {
          return { ...mock, phone_numbers: [] };
        }
        return mock;
      });

      // Para reveal_phones com mock, simular registro de requisição assíncrona (UPSERT)
      if (action === "reveal_phones" && workspace_id) {
        for (const d of details) {
          await supabase.from("apollo_phone_reveals").upsert({
            workspace_id,
            apollo_person_id: d.id,
            status: "delivered", // Mock já entrega direto
            phone_raw: matches.find((m: any) => m.id === d.id)?.phone_numbers?.[0]?.raw_number || null,
            delivered_at: new Date().toISOString(),
          }, { 
            onConflict: "workspace_id,apollo_person_id",
            ignoreDuplicates: false 
          });
        }
      }

      return new Response(
        JSON.stringify({
          status: "success",
          credits_consumed: personCount,
          internal_credits_debited: creditCost,
          new_balance: newBalance,
          matches,
          is_mock: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Para reveal_phones, usamos a API com webhook assíncrono
    if (action === "reveal_phones") {
      // Construir webhook URL
      const webhookUrl = `${supabaseUrl}/functions/v1/apollo-phone-webhook`;
      
      console.log(`Requesting phone reveal for ${personCount} contacts with webhook: ${webhookUrl}`);

      // Registrar requisições pendentes no banco (UPSERT para evitar duplicatas)
      const pendingInserts = details.map((d: { id: string }) => ({
        workspace_id,
        apollo_person_id: d.id,
        status: "pending",
        requested_at: new Date().toISOString(),
      }));

      // Use upsert to handle re-reveals of the same person
      for (const pending of pendingInserts) {
        const { error: upsertError } = await supabase
          .from("apollo_phone_reveals")
          .upsert(pending, { 
            onConflict: "workspace_id,apollo_person_id",
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error("Error upserting pending request:", upsertError);
        }
      }

      // Chamar Apollo com reveal_phone_number e webhook
      const apolloBody = {
        reveal_personal_emails: true,
        reveal_phone_number: true,
        webhook_url: webhookUrl,
        details,
      };

      const response = await fetch("https://api.apollo.io/api/v1/people/bulk_match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apolloApiKey,
        },
        body: JSON.stringify(apolloBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Apollo API error:", errorText);
        
        // Marcar requisições como falhas
        await supabase
          .from("apollo_phone_reveals")
          .update({ status: "failed" })
          .eq("workspace_id", workspace_id)
          .eq("status", "pending")
          .in("apollo_person_id", details.map((d: { id: string }) => d.id));

        throw new Error(`Apollo API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Apollo pode retornar dados imediatamente ou apenas aceitar a solicitação
      // Se matches vierem com phone_numbers, o webhook pode não ser chamado
      const matches = data.matches || [];
      
      // Atualizar requisições que já receberam telefone na resposta síncrona
      for (const match of matches) {
        if (match.phone_numbers?.length) {
          const primaryPhone = match.phone_numbers.find((p: any) => p.type === "mobile")?.raw_number 
            || match.phone_numbers[0]?.raw_number;

          await supabase
            .from("apollo_phone_reveals")
            .update({
              status: "delivered",
              phone_raw: primaryPhone,
              delivered_at: new Date().toISOString(),
              payload: match,
            })
            .eq("workspace_id", workspace_id)
            .eq("apollo_person_id", match.id)
            .eq("status", "pending");
        }
      }

      return new Response(
        JSON.stringify({
          status: "processing",
          message: "Telefones sendo revelados. Aguarde alguns segundos...",
          internal_credits_debited: creditCost,
          new_balance: newBalance,
          matches: matches,
          pending_count: details.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chamada normal de enrich (sem telefone)
    const apolloBody = {
      reveal_personal_emails: reveal_personal_emails ?? true,
      details,
    };

    console.log(`Calling Apollo API for ${action} with ${personCount} contacts`);

    const response = await fetch("https://api.apollo.io/api/v1/people/bulk_match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloApiKey,
      },
      body: JSON.stringify(apolloBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Apollo API error:", errorText);
      throw new Error(`Apollo API error: ${response.status}`);
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify({
        ...data,
        internal_credits_debited: creditCost,
        new_balance: newBalance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apollo-enrich:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
