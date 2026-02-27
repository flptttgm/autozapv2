import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TerminologyType = "clientes" | "leads" | "pacientes" | "contatos";
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
  contatos: {
    singular: "Contato",
    plural: "Contatos",
    singularLower: "contato",
    pluralLower: "contatos",
    novo: "Novo Contato",
    nova: "Nova Contato",
    captura: "captura automática de contatos",
  },
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

const DEFAULT_TERMINOLOGY = TERMINOLOGY_MAP.contatos;

export const useTerminology = () => {
  const { user } = useAuth();

  // Get the owner's primary workspace ID (first created workspace owned by this user)
  // Terminology is shared across all workspaces of the same owner
  const { data: ownerWorkspaceId, isLoading: isLoadingWorkspace } = useQuery({
    queryKey: ["owner-primary-workspace", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Find all workspaces where this user is the owner, pick the first created one
      const { data: ownedWorkspaces, error } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (error) {
        console.error("[useTerminology] Error fetching owner workspace:", error);
        return null;
      }

      if (ownedWorkspaces && ownedWorkspaces.length > 0) {
        return ownedWorkspaces[0].id;
      }

      // Fallback: if user doesn't own any workspace, use their workspace membership
      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1);

      return memberships?.[0]?.workspace_id || null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["terminology_config", ownerWorkspaceId],
    queryFn: async () => {
      if (!ownerWorkspaceId) return null;
      const { data, error } = await supabase
        .from("system_config")
        .select("config_value")
        .eq("config_key", "entity_terminology")
        .eq("workspace_id", ownerWorkspaceId)
        .maybeSingle();

      if (error) throw error;
      return data?.config_value as { type: TerminologyType } | null;
    },
    enabled: !!ownerWorkspaceId,
    staleTime: 1000 * 60 * 5,
    placeholderData: (previousData) => previousData,
  });

  const type: TerminologyType = config?.type || "contatos";
  const terminology = TERMINOLOGY_MAP[type] || DEFAULT_TERMINOLOGY;

  const isLoading = isLoadingWorkspace || isLoadingConfig || !user?.id;

  // Memoize to prevent unnecessary re-renders
  const stableTerminology = useMemo(() => ({
    type,
    terminology,
    isLoading,
    ownerWorkspaceId,
  }), [type, terminology, isLoading, user?.id, ownerWorkspaceId]);

  return stableTerminology;
};
