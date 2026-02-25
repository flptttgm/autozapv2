import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TerminologyType = "clientes" | "leads" | "pacientes";
interface Terminology {
  singular: string;
  plural: string;
  singularLower: string;
  pluralLower: string;
  novo: string;
  nova: string;
  captura: string;
}

const TERMINOLOGY_MAP: Record<TerminologyType, Terminology> = {
  clientes: {
    singular: "Cliente",
    plural: "Clientes",
    singularLower: "cliente",
    pluralLower: "clientes",
    novo: "Novo Cliente",
    nova: "Nova Cliente",
    captura: "captura automática de clientes",
  },
  leads: {
    singular: "Lead",
    plural: "Leads",
    singularLower: "lead",
    pluralLower: "leads",
    novo: "Novo Lead",
    nova: "Nova Lead",
    captura: "captura automática de leads",
  },
  pacientes: {
    singular: "Paciente",
    plural: "Pacientes",
    singularLower: "paciente",
    pluralLower: "pacientes",
    novo: "Novo Paciente",
    nova: "Nova Paciente",
    captura: "captura automática de pacientes",
  },
};

const DEFAULT_TERMINOLOGY = TERMINOLOGY_MAP.clientes;

export const useTerminology = () => {
  const { user } = useAuth();

  // Get workspace ID from profile
  const { data: workspaceId } = useQuery({
    queryKey: ["user-workspace-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("workspace_id")
        .eq("id", user.id)
        .single();
      return profile?.workspace_id;
    },
    enabled: !!user?.id,
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ["terminology_config", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from("system_config")
        .select("config_value")
        .eq("config_key", "entity_terminology")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (error) throw error;
      return data?.config_value as { type: TerminologyType } | null;
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5, // 5 minutos - evita refetch constante
    placeholderData: (previousData) => previousData, // Manter valor anterior durante transições
  });

  const type: TerminologyType = config?.type || "clientes";
  const terminology = TERMINOLOGY_MAP[type] || DEFAULT_TERMINOLOGY;

  // Memoize to prevent unnecessary re-renders
  const stableTerminology = useMemo(() => ({
    type,
    terminology,
    isLoading: isLoading || !user?.id,
  }), [type, terminology, isLoading, user?.id]);

  return stableTerminology;
};
