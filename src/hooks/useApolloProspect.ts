import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ApolloSearchParams,
  ApolloSearchResponse,
  ApolloEnrichedPerson,
  ApolloEnrichResponse,
} from "@/types/apollo";
import { extractPhoneFromApollo, getLocalNumber } from "@/lib/phone";
import { PROSPECT_CREDITS } from "@/lib/prospect-credits";

export function useApolloProspect() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Busca (grátis - não gasta créditos)
  const searchMutation = useMutation({
    mutationFn: async (params: ApolloSearchParams): Promise<ApolloSearchResponse> => {
      const { data, error } = await supabase.functions.invoke("apollo-search", {
        body: { params },
      });
      if (error) throw error;
      return data as ApolloSearchResponse;
    },
    onError: (error) => {
      toast.error("Erro ao buscar leads: " + error.message);
    },
  });

  // Enriquecimento básico (1 crédito/pessoa - email + empresa, SEM telefone)
  const enrichMutation = useMutation({
    mutationFn: async (personIds: string[]): Promise<ApolloEnrichResponse> => {
      if (!profile?.workspace_id) throw new Error("Workspace não encontrado");
      
      const { data, error } = await supabase.functions.invoke("apollo-enrich", {
        body: {
          action: "enrich",
          workspace_id: profile.workspace_id,
          details: personIds.map((id) => ({ id })),
          reveal_personal_emails: true,
          // NÃO envia reveal_phone_number - será feito separadamente
        },
      });
      
      if (error) {
        if (error.message?.includes("insufficient_credits")) {
          toast.error("Créditos insuficientes para enriquecer");
          throw new Error("Créditos insuficientes");
        }
        throw error;
      }
      
      // Invalidar cache de créditos após uso
      queryClient.invalidateQueries({ queryKey: ["prospect-credits", profile.workspace_id] });
      
      return data as ApolloEnrichResponse;
    },
    onError: (error) => {
      if (!error.message?.includes("Créditos insuficientes")) {
        toast.error("Erro ao enriquecer dados: " + error.message);
      }
    },
  });

  // Revelação de telefone (1 crédito/pessoa - chamada assíncrona via webhook)
  const revealPhonesMutation = useMutation({
    mutationFn: async (personIds: string[]): Promise<ApolloEnrichResponse & { status?: string; pending_count?: number }> => {
      if (!profile?.workspace_id) throw new Error("Workspace não encontrado");
      
      const { data, error } = await supabase.functions.invoke("apollo-enrich", {
        body: {
          action: "reveal_phones",
          workspace_id: profile.workspace_id,
          details: personIds.map((id) => ({ id })),
        },
      });
      
      if (error) {
        if (error.message?.includes("insufficient_credits")) {
          toast.error("Créditos insuficientes para revelar telefones");
          throw new Error("Créditos insuficientes");
        }
        throw error;
      }
      
      // Invalidar cache de créditos após uso
      queryClient.invalidateQueries({ queryKey: ["prospect-credits", profile.workspace_id] });
      
      return data as ApolloEnrichResponse & { status?: string; pending_count?: number };
    },
    onSuccess: (data) => {
      // Check if it's an async response
      if (data.status === "processing") {
        toast.info("Telefones sendo revelados. Aguarde alguns segundos...");
        return;
      }
      
      const phonesRevealed = data.matches?.filter(m => m.phone_numbers?.length).length || 0;
      if (phonesRevealed > 0) {
        toast.success(`${phonesRevealed} telefone(s) revelado(s)!`);
      } else if (data.is_mock) {
        toast.success("Telefones revelados (modo demonstração)!");
      } else {
        toast.info("Processando... telefones serão exibidos em breve.");
      }
    },
    onError: (error) => {
      if (!error.message?.includes("Créditos insuficientes")) {
        toast.error("Erro ao revelar telefones: " + error.message);
      }
    },
  });

  // Verificar duplicatas na base de leads
  const checkDuplicates = async (
    people: ApolloEnrichedPerson[]
  ): Promise<ApolloEnrichedPerson[]> => {
    if (!profile?.workspace_id || people.length === 0) return people;

    // Buscar todos os leads do workspace para verificação completa
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("id, email, phone, metadata")
      .eq("workspace_id", profile.workspace_id);

    // Criar sets para verificação rápida
    const existingEmails = new Set(
      existingLeads?.map((l) => l.email?.toLowerCase()).filter(Boolean) || []
    );

    // Para telefones, usar versão local (últimos 10-11 dígitos) para comparação flexível
    const existingPhonesLocal = new Set(
      existingLeads?.map((l) => getLocalNumber(l.phone)).filter(Boolean) || []
    );

    const existingLinkedins = new Set(
      existingLeads
        ?.map((l) => {
          const metadata = l.metadata as { linkedin_url?: string } | null;
          return metadata?.linkedin_url;
        })
        .filter(Boolean) || []
    );

    // Marcar duplicatas (incluindo telefone com comparação flexível)
    return people.map((person) => {
      const personPhone = extractPhoneFromApollo(person);
      const personPhoneLocal = getLocalNumber(personPhone);
      
      const emailExists = person.email && existingEmails.has(person.email.toLowerCase());
      const phoneExists = personPhoneLocal && existingPhonesLocal.has(personPhoneLocal);
      const linkedinExists = person.linkedin_url && existingLinkedins.has(person.linkedin_url);
      
      return {
        ...person,
        is_duplicate: emailExists || phoneExists || linkedinExists,
        existing_lead_id: existingLeads?.find(
          (l) =>
            l.email?.toLowerCase() === person.email?.toLowerCase() ||
            getLocalNumber(l.phone) === personPhoneLocal ||
            (l.metadata as { linkedin_url?: string } | null)?.linkedin_url === person.linkedin_url
        )?.id,
      };
    });
  };

  const importToLeadsMutation = useMutation({
    mutationFn: async (people: ApolloEnrichedPerson[]) => {
      // Normalizar telefones e permitir leads sem telefone (diferente do anterior)
      const leads = people.map((p) => ({
        name: p.name,
        phone: extractPhoneFromApollo(p) || null, // Permite null agora
        email: p.email,
        status: "prospect" as const,
        workspace_id: profile?.workspace_id,
        metadata: {
          source: "apollo",
          apollo_id: p.id,
          title: p.title,
          headline: p.headline,
          seniority: p.seniority,
          linkedin_url: p.linkedin_url,
          company: {
            name: p.organization.name,
            industry: p.organization.industry,
            website: p.organization.website_url,
            employee_count: p.organization.employee_count,
          },
          location: {
            city: p.city,
            state: p.state,
            country: p.country,
          },
          email_status: p.email_status,
          has_direct_phone: p.has_direct_phone,
          phone_revealed: !!p.phone_numbers?.length,
          imported_at: new Date().toISOString(),
        },
      }));

      const { error } = await supabase.from("leads").insert(leads);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      
      const withPhone = leads.filter(l => l.phone).length;
      const withoutPhone = leads.length - withPhone;
      
      return { importedCount: leads.length, withPhone, withoutPhone };
    },
    onSuccess: (result) => {
      let msg = `${result.importedCount} lead(s) importado(s)!`;
      if (result.withoutPhone > 0) {
        msg += ` (${result.withPhone} com telefone, ${result.withoutPhone} sem)`;
      }
      toast.success(msg);
    },
    onError: (error) => {
      toast.error("Erro ao importar leads: " + error.message);
    },
  });

  return { 
    searchMutation, 
    enrichMutation, 
    revealPhonesMutation,
    importToLeadsMutation, 
    checkDuplicates,
    creditCosts: PROSPECT_CREDITS.costs,
  };
}
