import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

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

function buildTerminologyMap(t: (key: string) => string): Record<TerminologyType, Terminology> {
  return {
    contatos: {
      singular: t("contact"),
      plural: t("contacts"),
      singularLower: t("contactLower"),
      pluralLower: t("contactsLower"),
      novo: t("newContactM"),
      nova: t("newContactF"),
      captura: t("autoCapture_contatos"),
    },
    clientes: {
      singular: t("client"),
      plural: t("clients"),
      singularLower: t("clientLower"),
      pluralLower: t("clientsLower"),
      novo: t("newClientM"),
      nova: t("newClientF"),
      captura: t("autoCapture_clientes"),
    },
    leads: {
      singular: t("lead"),
      plural: t("leads"),
      singularLower: t("leadLower"),
      pluralLower: t("leadsLower"),
      novo: t("newLeadM"),
      nova: t("newLeadF"),
      captura: t("autoCapture_leads"),
    },
    pacientes: {
      singular: t("patient"),
      plural: t("patients"),
      singularLower: t("patientLower"),
      pluralLower: t("patientsLower"),
      novo: t("newPatientM"),
      nova: t("newPatientF"),
      captura: t("autoCapture_pacientes"),
    },
  };
}

export const useTerminology = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("terminology");

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
  const terminologyMap = buildTerminologyMap(t);
  const defaultTerminology = terminologyMap.contatos;
  const terminology = terminologyMap[type] || defaultTerminology;

  const isLoading = isLoadingWorkspace || isLoadingConfig || !user?.id;

  // Memoize to prevent unnecessary re-renders
  const stableTerminology = useMemo(() => ({
    type,
    terminology,
    isLoading,
    ownerWorkspaceId,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [type, terminology, isLoading, user?.id, ownerWorkspaceId, i18n.language]);

  return stableTerminology;
};
