import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AdminPhone {
  id: string;
  workspace_id: string;
  user_id: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Normalize phone number: remove all non-digits
const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, "");
};

export const useAdminPhone = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const workspaceId = profile?.workspace_id;

  // Fetch current user's admin phone
  const { data: adminPhone, isLoading, error } = useQuery({
    queryKey: ["admin-phone", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from("workspace_admin_phones")
        .select("*")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (error) throw error;
      return data as AdminPhone | null;
    },
    enabled: !!profile?.id,
  });

  // Save or update admin phone
  const savePhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      if (!profile?.id || !workspaceId) {
        throw new Error("Usuário não autenticado");
      }

      const normalizedPhone = normalizePhone(phone);
      
      if (normalizedPhone.length < 10 || normalizedPhone.length > 13) {
        throw new Error("Número de telefone inválido");
      }

      // Check if record exists
      const { data: existing } = await supabase
        .from("workspace_admin_phones")
        .select("id")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from("workspace_admin_phones")
          .update({ 
            phone: normalizedPhone,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from("workspace_admin_phones")
          .insert({
            workspace_id: workspaceId,
            user_id: profile.id,
            phone: normalizedPhone,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-phone"] });
      toast.success("Número salvo com sucesso!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar número");
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!adminPhone?.id) {
        throw new Error("Nenhum número cadastrado");
      }

      const { data, error } = await supabase
        .from("workspace_admin_phones")
        .update({ is_active: isActive })
        .eq("id", adminPhone.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-phone"] });
      toast.success(data.is_active ? "Modo admin ativado" : "Modo admin desativado");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar status");
    },
  });

  // Delete admin phone
  const deletePhoneMutation = useMutation({
    mutationFn: async () => {
      if (!adminPhone?.id) {
        throw new Error("Nenhum número cadastrado");
      }

      const { error } = await supabase
        .from("workspace_admin_phones")
        .delete()
        .eq("id", adminPhone.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-phone"] });
      toast.success("Número removido");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao remover número");
    },
  });

  return {
    adminPhone,
    isLoading,
    error,
    savePhone: savePhoneMutation.mutate,
    isSaving: savePhoneMutation.isPending,
    toggleActive: toggleActiveMutation.mutate,
    isToggling: toggleActiveMutation.isPending,
    deletePhone: deletePhoneMutation.mutate,
    isDeleting: deletePhoneMutation.isPending,
  };
};
