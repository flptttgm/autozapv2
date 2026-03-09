import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { PhoneCodeConnection } from "./PhoneCodeConnection";
import { MobileRegistration, MobileRegistrationState } from "./MobileRegistration";
import { AIModeSelector } from "./AIModeSelector";
import { MessageBufferSelector } from "./MessageBufferSelector";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Power,
  Smartphone,
  QrCode,
  Signal,
  Wifi,
  WifiOff,
  ArrowDownLeft,
  ArrowUpRight,
  MessageSquare,
  Copy,
  Monitor,
  Pencil,
  Check,
  X as XIcon,
  FlaskConical,
  Pause,
  Play,
  AlertTriangle,
  KeyRound,
  Lock,
  Zap,
  Clock,
  Trash2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface WhatsAppInstance {
  id: string;
  instance_id: string;
  instance_token: string;
  workspace_id: string;
  status: string;
  phone: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at?: string;
  display_name?: string | null;
  ai_template_id?: string | null;
  is_paused?: boolean;
  paused_at?: string | null;
  pause_reason?: string | null;
  ai_mode?: "all" | "selective";
  selective_tags?: string[];
}

interface WhatsAppInstanceCardProps {
  instance: WhatsAppInstance;
  isCreationBlocked?: boolean;
  onDelete: (instanceId: string) => void;
  onStatusChange: () => void;
}

export const WhatsAppInstanceCard = ({
  instance,
  isCreationBlocked = false,
  onDelete,
  onStatusChange
}: WhatsAppInstanceCardProps) => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  // Initialize status from database to avoid "offline" flash while verifying with Z-API
  const [status, setStatus] = useState<{
    connected: boolean;
    phone?: string;
  } | null>(() => {
    // Use database status as initial state - UI shows immediately
    const isDbConnected = instance.status === 'connected';
    return {
      connected: isDbConnected,
      phone: instance.phone || undefined
    };
  });

  // Editable name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(instance.display_name || "");
  const [isSavingName, setIsSavingName] = useState(false);


  // Pause state
  const [isPaused, setIsPaused] = useState(instance.is_paused || false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  // Expired instance state
  const [isExpired, setIsExpired] = useState(false);
  const [isRecreating, setIsRecreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Saved mobile registration state
  const [savedMobileState, setSavedMobileState] = useState<MobileRegistrationState | null>(null);

  // Fetch workspace subscription to check if sync is available
  const { data: workspaceSubscription } = useQuery({
    queryKey: ["workspace-subscription", instance.workspace_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_type, status")
        .eq("workspace_id", instance.workspace_id)
        .single();

      if (error) return null;
      return data;
    },
  });

  // Check if we can sync (paid plan + active status)
  const canSyncSubscription = workspaceSubscription?.status === 'active' &&
    workspaceSubscription?.plan_type !== 'trial';

  // Handle sync subscription attempt
  const handleSyncSubscription = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-instance-subscription?instance_db_id=${instance.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Falha ao sincronizar');
      }

      toast.success(data.message || "Sincronização concluída!");
      setIsExpired(false);
      onStatusChange();
    } catch (error) {
      console.error('[handleSyncSubscription] Error:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Falha na sincronização'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Save display name
  const handleSaveName = async () => {
    if (!editName.trim()) {
      setEditName(instance.display_name || "");
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ display_name: editName.trim() })
        .eq("id", instance.id);

      if (error) throw error;
      toast.success("Nome atualizado!");
      setIsEditingName(false);
      onStatusChange();
    } catch (error) {
      console.error("Error saving name:", error);
      toast.error("Erro ao salvar nome");
    } finally {
      setIsSavingName(false);
    }
  };


  // Toggle pause state
  const handleTogglePause = async () => {
    setIsTogglingPause(true);
    const newPausedState = !isPaused;

    try {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({
          is_paused: newPausedState,
          paused_at: newPausedState ? new Date().toISOString() : null,
          pause_reason: newPausedState ? 'manual_pause' : null
        })
        .eq("id", instance.id);

      if (error) throw error;

      setIsPaused(newPausedState);
      toast.success(newPausedState ? "IA pausada - mensagens não serão respondidas" : "IA reativada - mensagens serão respondidas");
      // Invalidate all WhatsApp instance queries to keep UI in sync
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances-connected", instance.workspace_id] });
    } catch (error) {
      console.error("Error toggling pause:", error);
      toast.error("Erro ao alterar estado de pausa");
    } finally {
      setIsTogglingPause(false);
    }
  };

  const copyConnectionLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado! Abra em um computador para escanear o QR Code");
  };

  // Fetch message statistics for this instance
  const { data: messageStats } = useQuery({
    queryKey: ["message-stats", instance.instance_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("direction, metadata")
        .eq("workspace_id", instance.workspace_id);

      if (error) throw error;

      // Filter messages that belong to this instance
      const instanceMessages = data?.filter((msg: any) => {
        const metadata = msg.metadata as any;
        return metadata?.instanceId === instance.instance_id;
      }) || [];

      const inbound = instanceMessages.filter((m: any) => m.direction === "inbound").length;
      const outbound = instanceMessages.filter((m: any) => m.direction === "outbound" || m.direction === "outbound_manual").length;

      return { inbound, outbound, total: inbound + outbound };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const [isDeleted, setIsDeleted] = useState(false);

  // Track current instance.id to detect when it changes (component reused with new instance)
  const [currentInstanceId, setCurrentInstanceId] = useState(instance.id);

  // Reset deleted state if instance.id changes (new instance replacing old one)
  useEffect(() => {
    if (instance.id !== currentInstanceId) {
      console.log(`[WhatsAppInstanceCard] Instance changed from ${currentInstanceId} to ${instance.id}, resetting state`);
      setIsDeleted(false);
      setCurrentInstanceId(instance.id);
      setQrCode(null);
      // Reset status to new instance's database status (not null) to avoid flash
      setStatus({
        connected: instance.status === 'connected',
        phone: instance.phone || undefined
      });
      setIsExpired(false);
      setSavedMobileState(null);
    }
  }, [instance.id, currentInstanceId]);

  // Check for saved mobile registration state
  useEffect(() => {
    const checkSavedMobileState = async () => {
      try {
        const { data } = await supabase
          .from('whatsapp_instances')
          .select('mobile_registration_state')
          .eq('id', instance.id)
          .single();

        if (data?.mobile_registration_state) {
          const state = data.mobile_registration_state as unknown as MobileRegistrationState;
          // Check if not expired (30 min)
          if (new Date(state.expiresAt) > new Date()) {
            console.log('[WhatsAppInstanceCard] Found saved mobile state:', state.step);
            setSavedMobileState(state);
          } else {
            console.log('[WhatsAppInstanceCard] Saved mobile state expired, clearing');
            // Clear expired state
            await supabase
              .from('whatsapp_instances')
              .update({ mobile_registration_state: null })
              .eq('id', instance.id);
          }
        }
      } catch (err) {
        console.warn('[WhatsAppInstanceCard] Error checking saved state:', err);
      }
    };

    checkSavedMobileState();
  }, [instance.id]);

  const fetchStatus = async () => {
    // Skip if instance was deleted or ID changed
    if (isDeleted || instance.id !== currentInstanceId) {
      console.log(`[fetchStatus] Skipping - isDeleted: ${isDeleted}, idMismatch: ${instance.id !== currentInstanceId}`);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=status&instance_db_id=${instance.id}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`Status fetch failed for instance ${instance.id}:`, response.status, errorData);

        // If instance not found, mark as deleted to stop further polling
        if (response.status === 500 && errorData?.error === 'Instance not found') {
          console.log(`[fetchStatus] Instance ${instance.id} not found, stopping polling and triggering refresh`);
          setIsDeleted(true);
          // Trigger parent refresh to get updated list
          onStatusChange();
          return;
        }

        // Don't throw - just keep existing status
        return;
      }

      const data = await response.json();

      // ANTI-FRAUDE: Tratar resposta de bloqueio
      if (data.blocked) {
        toast.error(
          "Este número já está vinculado a outra conta. A conexão foi bloqueada.",
          { duration: 8000 }
        );
        setStatus({ connected: false });
        setQrCode(null);
        onStatusChange();
        return;
      }

      setStatus({
        connected: data.connected,
        phone: data.phone
      });

      if (!data.connected) {
        fetchQRCode();
      } else {
        setQrCode(null);
      }
    } catch (error) {
      console.warn('Error fetching status:', error);
      // Keep existing status on error - don't crash
    }
  };

  // Replace expired instance with a new one, preserving settings
  const handleReplaceInstance = async () => {
    if (isCreationBlocked) {
      toast.error("Seu plano não permite criar/substituir conexões no momento. Assine ou regularize para continuar.", {
        action: {
          label: "Ver Planos",
          onClick: () => window.location.href = "/plans",
        },
      });
      return;
    }

    setIsRecreating(true);

    // Save current settings to apply to the new instance
    const savedDisplayName = instance.display_name;
    const savedTemplateId = instance.ai_template_id;

    try {
      console.log('[handleReplaceInstance] Deleting expired instance:', instance.id);
      console.log('[handleReplaceInstance] Preserving settings:', { savedDisplayName, savedTemplateId });

      // Delete the old instance from database (Z-API instance is already expired)
      const { error: deleteError } = await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("id", instance.id);

      if (deleteError) throw deleteError;

      console.log('[handleReplaceInstance] Creating new instance for workspace:', instance.workspace_id);

      // Create a new instance
      const createResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ workspace_id: instance.workspace_id })
        }
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao criar nova instância');
      }

      const newInstance = await createResponse.json();
      console.log('[handleReplaceInstance] New instance created:', newInstance);

      // Apply saved settings to the new instance
      if (newInstance.id && (savedDisplayName || savedTemplateId)) {
        console.log('[handleReplaceInstance] Applying saved settings to new instance');
        const { error: updateError } = await supabase
          .from("whatsapp_instances")
          .update({
            display_name: savedDisplayName,
            ai_template_id: savedTemplateId
          })
          .eq("id", newInstance.id);

        if (updateError) {
          console.warn('[handleReplaceInstance] Failed to apply settings:', updateError);
        } else {
          console.log('[handleReplaceInstance] Settings applied successfully');
        }
      }

      toast.success("Instância substituída! Suas configurações foram mantidas.");

      // Notify parent to refresh the list
      onStatusChange();
      onDelete(instance.id); // Remove this card, new one will appear

    } catch (error) {
      console.error('[handleReplaceInstance] Error:', error);
      toast.error(`Erro ao substituir instância: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsRecreating(false);
    }
  };

  const fetchQRCode = async () => {
    // Skip if instance was deleted or ID changed
    if (isDeleted || instance.id !== currentInstanceId) {
      console.log(`[fetchQRCode] Skipping - isDeleted: ${isDeleted}, idMismatch: ${instance.id !== currentInstanceId}`);
      return;
    }

    // ANTI-FRAUDE: Não buscar QR code para instâncias bloqueadas
    if (instance.status === 'blocked') {
      console.log('[fetchQRCode] Instance is blocked, skipping QR fetch');
      setQrCode(null);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=qrcode&instance_db_id=${instance.id}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const data = await response.json();

      // ANTI-FRAUDE: Detectar bloqueio na resposta
      if (data.blocked) {
        console.log('[fetchQRCode] Instance blocked by anti-fraud');
        toast.error("Este número já está vinculado a outra conta. A conexão foi bloqueada.", { duration: 8000 });
        setQrCode(null);
        onStatusChange(); // Refresh to show blocked UI
        return;
      }

      // Detect expired instance - show warning instead of auto-recreating
      if (data.needsRecreate || data.error === 'INSTANCE_EXPIRED') {
        console.log('[fetchQRCode] Instance expired, showing warning');
        setIsExpired(true);
        setQrCode(null);
        return;
      }

      if (!response.ok) {
        console.warn(`QR code fetch failed for instance ${instance.id}:`, response.status, data);
        return;
      }

      setIsExpired(false);
      setQrCode(data.value || data.qrcode || data.image);
      setCountdown(30);
    } catch (error) {
      console.warn('Error fetching QR code:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    console.log('[handleDisconnect] Function called for instance:', instance.id);
    try {
      setIsLoading(true);
      console.log('[handleDisconnect] isLoading set to true');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=disconnect&instance_db_id=${instance.id}`;
      console.log('[handleDisconnect] Making request to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ instance_db_id: instance.id })
      });

      console.log('[handleDisconnect] Response status:', response.status);
      const responseData = await response.json();
      console.log('[handleDisconnect] Response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to disconnect: ${response.status}`);
      }

      toast.success("Desconectado com sucesso!");
      console.log('[handleDisconnect] Success! Updating UI...');
      setQrCode(null);
      fetchStatus();
      onStatusChange();
    } catch (error) {
      console.error('[handleDisconnect] Error:', error);
      toast.error(`Erro ao desconectar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
      console.log('[handleDisconnect] isLoading set to false');
    }
  };

  const handleRestart = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=restart&instance_db_id=${instance.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ instance_db_id: instance.id })
        }
      );

      if (!response.ok) throw new Error('Failed to restart');

      toast.success("Instância reiniciada!");
      setTimeout(() => {
        fetchStatus();
        onStatusChange();
      }, 3000);
    } catch (error) {
      console.error('Error restarting:', error);
      toast.error("Erro ao reiniciar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      console.log('[handleDelete] Deleting instance:', instance.id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            instance_db_id: instance.id
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao deletar instância');
      }

      toast.success("Instância deletada com sucesso!");
      setIsDeleted(true);
      onDelete(instance.id);
      onStatusChange();
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances-connected", instance.workspace_id] });
    } catch (error) {
      console.error('[handleDelete] Error:', error);
      toast.error(`Erro ao deletar: ${error instanceof Error ? error.message : 'Falha na exclusão'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isDeleted) return; // Don't poll if deleted
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [instance.id, isDeleted]);

  useEffect(() => {
    if (qrCode && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && qrCode) {
      fetchQRCode();
    }
  }, [countdown, qrCode]);

  const isConnected = status?.connected;
  const displayPhone = status?.phone || instance.phone;
  const isBlocked = instance.status === 'blocked';
  const isTrialExpiredInstance = instance.status === 'trial_expired';

  // UI específica para instância com TRIAL EXPIRADO
  if (isTrialExpiredInstance) {
    return (
      <Card className="relative overflow-hidden transition-all duration-300 border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-lg shadow-amber-500/10">
        {/* Trial expired indicator bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />

        <div className="p-4 sm:p-6 pt-5 sm:pt-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-amber-500 to-orange-600">
                <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-600 items-center justify-center">
                    <Pause className="w-3 h-3 text-white" />
                  </span>
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base sm:text-lg text-amber-600 dark:text-amber-400 mb-1">
                  {instance.display_name || "Instância WhatsApp"}
                </h3>
                <Badge
                  className="text-[10px] sm:text-xs font-bold bg-amber-500 text-white border-amber-600"
                >
                  <Pause className="w-3 h-3 mr-1" /> PAUSADA
                </Badge>
              </div>
            </div>
          </div>

          {/* Trial expired message */}
          <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  Automações pausadas por falta de assinatura
                </p>
                {instance.updated_at && (
                  <p className="text-[11px] font-medium text-amber-600/90 dark:text-amber-400/90 mb-1 flex items-center gap-1 bg-amber-500/10 w-fit px-2 py-0.5 rounded-full border border-amber-500/20">
                    <Clock className="w-3 h-3" /> Expirou em: {new Date(instance.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                  Seu período de teste expirou e esta conexão foi desativada.
                  Assine um plano para reconectar e reativar as automações de IA.
                </p>
              </div>
            </div>
          </div>

          {/* CTA to subscribe */}
          <Button
            asChild
            className="w-full gap-2 shadow-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white mb-2"
          >
            <a href="/plans">
              <Zap className="w-4 h-4" />
              Assinar para Reconectar
            </a>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading}
                className="w-full gap-2 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              >
                <Trash2 className="w-4 h-4" />
                Excluir Instância Expirada
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Instância?</AlertDialogTitle>
                <AlertDialogDescription>
                  Seu período de teste expirou. Ao excluir esta instância, você poderá liberar espaço para futuras conexões. Esta ação é irreversível.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    );
  }

  // UI específica para instância BLOQUEADA por antifraude
  if (isBlocked) {
    return (
      <Card className="relative overflow-hidden transition-all duration-300 border-2 border-red-600 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent shadow-lg shadow-red-500/10">
        {/* Blocked indicator bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-red-500 to-red-600 animate-pulse" />

        <div className="p-4 sm:p-6 pt-5 sm:pt-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-red-600 to-red-700">
                <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600 items-center justify-center">
                    <XCircle className="w-3 h-3 text-white" />
                  </span>
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base sm:text-lg text-red-600 dark:text-red-400 mb-1">
                  Conexão Bloqueada
                </h3>
                <Badge
                  variant="destructive"
                  className="text-[10px] sm:text-xs font-bold bg-red-600 text-white border-red-700 animate-pulse"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" /> BLOQUEADO
                </Badge>
              </div>
            </div>
          </div>

          {/* Blocked message */}
          <div className="p-4 rounded-xl bg-red-500/10 border-2 border-red-500/30 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Este número já está vinculado a outra conta
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80">
                  Por segurança, cada número de WhatsApp só pode ser usado em uma única conta.
                  Esta conexão foi bloqueada automaticamente pelo sistema de antifraude.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Para continuar, exclua esta instância e conecte com um número diferente.
                </p>
              </div>
            </div>
          </div>

          {/* Delete blocked instance option */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading}
                className="w-full gap-2 text-red-600 dark:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
                Excluir Instância Bloqueada
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Instância Bloqueada?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta instância foi bloqueada por segurança. Ao excluí-la, você poderá tentar conectar um número diferente. Esta ação é irreversível.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl glass shadow-md h-full flex flex-col ${isConnected
      ? 'border-green-500/20 bg-gradient-to-br from-green-500/[0.03] via-transparent to-transparent'
      : 'border-red-500/20 bg-gradient-to-br from-red-500/[0.03] via-transparent to-transparent'
      }`}>
      {/* Status indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${isConnected ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400' : 'bg-gradient-to-r from-red-500 via-orange-500 to-amber-500'
        }`} />

      <div className="p-4 sm:p-6 pt-4 sm:pt-5 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${isConnected
              ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/25 shadow-lg'
              : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg'
              }`}>
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              {/* Connection pulse */}
              {isConnected && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 items-center justify-center ring-2 ring-background">
                    <Wifi className="w-2 h-2 text-white" />
                  </span>
                </span>
              )}
              {!isConnected && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 items-center justify-center ring-2 ring-background">
                    <WifiOff className="w-2 h-2 text-white" />
                  </span>
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {/* Editable Instance Name */}
              {isEditingName ? (
                <div className="flex items-center gap-1.5 mb-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm font-bold py-0 px-2"
                    placeholder="Nome da instância"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") {
                        setEditName(instance.display_name || "");
                        setIsEditingName(false);
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={handleSaveName}
                    disabled={isSavingName}
                  >
                    {isSavingName ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setEditName(instance.display_name || "");
                      setIsEditingName(false);
                    }}
                  >
                    <XIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-0.5 group">
                  <h3 className="font-semibold text-sm sm:text-base truncate">
                    {instance.display_name || displayPhone || `Instância`}
                  </h3>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditName(instance.display_name || "");
                      setIsEditingName(true);
                    }}
                  >
                    <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                  </Button>
                </div>
              )}

              {/* Phone number when connected */}
              {isConnected && displayPhone && (
                <p className="text-[11px] text-muted-foreground mb-1 font-mono">{displayPhone}</p>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={isConnected ? "default" : "destructive"}
                  className={`text-[10px] font-medium px-2 py-0 h-5 ${isConnected
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 hover:bg-green-500/15'
                    : 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 hover:bg-red-500/15'
                    }`}
                >
                  {isConnected ? (
                    <><Signal className="w-2.5 h-2.5 mr-1" /> Online</>
                  ) : (
                    <><WifiOff className="w-2.5 h-2.5 mr-1" /> Offline</>
                  )}
                </Badge>
                {isPaused && isConnected && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium px-2 py-0 h-5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  >
                    <Pause className="w-2.5 h-2.5 mr-1" /> IA Pausada
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {isConnected ? (
          <div className="space-y-3">
            {/* Message Statistics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <ArrowDownLeft className="w-3 h-3 text-blue-500" />
                  <span className="text-[10px] font-medium text-muted-foreground hidden sm:inline">Recebidas</span>
                </div>
                <p className="text-base sm:text-lg font-bold text-foreground tabular-nums">{messageStats?.inbound || 0}</p>
                <span className="text-[10px] text-muted-foreground sm:hidden">Receb.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  <span className="text-[10px] font-medium text-muted-foreground hidden sm:inline">Enviadas</span>
                </div>
                <p className="text-base sm:text-lg font-bold text-foreground tabular-nums">{messageStats?.outbound || 0}</p>
                <span className="text-[10px] text-muted-foreground sm:hidden">Env.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <MessageSquare className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground hidden sm:inline">Total</span>
                </div>
                <p className="text-base sm:text-lg font-bold text-foreground tabular-nums">{messageStats?.total || 0}</p>
                <span className="text-[10px] text-muted-foreground sm:hidden">Total</span>
              </div>
            </div>

            {/* Status message */}
            {isPaused ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
                <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Pause className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  <span className="sm:hidden">IA pausada</span>
                  <span className="hidden sm:inline">IA pausada — mensagens não serão respondidas automaticamente</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8 border border-green-500/15">
                <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                  <span className="sm:hidden">Pronto para mensagens</span>
                  <span className="hidden sm:inline">Pronto para enviar e receber mensagens</span>
                </span>
              </div>
            )}

            {/* AI Mode Selector */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3">
              <AIModeSelector
                instanceId={instance.id}
                workspaceId={instance.workspace_id}
                currentMode={instance.ai_mode || "all"}
                onModeChange={onStatusChange}
              />
              <div className="border-t border-border/50 pt-3">
                <MessageBufferSelector
                  instanceId={instance.id}
                  currentBufferSeconds={(instance as any).message_buffer_seconds || 0}
                  onBufferChange={onStatusChange}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={handleTogglePause}
                variant="outline"
                size="sm"
                disabled={isTogglingPause}
                className={`flex-1 gap-1.5 h-8 text-xs font-medium transition-colors ${isPaused
                  ? 'border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 hover:border-green-500/50'
                  : 'border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50'
                  }`}
              >
                {isTogglingPause ? (
                  <Loader2 className="animate-spin w-3.5 h-3.5" />
                ) : isPaused ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                {isPaused ? "Retomar IA" : "Pausar IA"}
              </Button>

              <Button
                onClick={handleDisconnect}
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="flex-1 gap-1.5 h-8 text-xs font-medium border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
              >
                {isLoading ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                Desconectar
              </Button>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleRestart}
                      disabled={isLoading}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reiniciar — use quando mensagens não chegam</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isLoading}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Instância?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. A instância será removida do sistema e você precisará escanear um novo QR Code caso queira usá-la novamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

          </div>
        ) : (
          <div className="space-y-3">
            {/* Message Statistics (compact for disconnected) */}
            {(messageStats?.total || 0) > 0 && (
              <div className="flex items-center justify-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/40 text-xs">
                <div className="flex items-center gap-1">
                  <ArrowDownLeft className="w-3 h-3 text-blue-500" />
                  <span className="text-muted-foreground tabular-nums">{messageStats?.inbound || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  <span className="text-muted-foreground tabular-nums">{messageStats?.outbound || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-primary" />
                  <span className="font-medium tabular-nums">{messageStats?.total || 0}</span>
                </div>
              </div>
            )}

            {/* Mobile: Conexão via código de pareamento */}
            {isMobile && !qrCode && !isExpired ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <KeyRound className="w-5 h-5 text-primary shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      Conexão via código
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Digite seu número para gerar o código de pareamento
                    </p>
                  </div>
                </div>

                <PhoneCodeConnection
                  instanceId={instance.id}
                  onConnected={() => {
                    fetchStatus();
                    onStatusChange();
                  }}
                  onExpired={() => setIsExpired(true)}
                />

                {/* Actions Mobile */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleRestart}
                          disabled={isLoading}
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                        >
                          <Power className="w-4 h-4" />
                          Reiniciar
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Use quando mensagens não estão sendo enviadas/recebidas</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ) : qrCode ? (
              <>
                {isMobile ? (
                  /* Mobile: QR Code e opção de código */
                  <div className="space-y-4">
                    {/* Pending registration banner */}
                    {savedMobileState && (
                      <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-purple-500" />
                          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Registro mobile pendente</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {savedMobileState.phone} - {savedMobileState.step}
                        </p>
                      </div>
                    )}
                    <Tabs defaultValue={savedMobileState ? "mobile" : "code"} className="w-full">
                      <TabsList className="grid grid-cols-3 w-full mb-4">
                        <TabsTrigger value="code" className="gap-1 text-[10px] sm:text-xs px-1">
                          <KeyRound className="w-3 h-3" />
                          <span className="hidden xs:inline">Código</span>
                          <span className="xs:hidden">Cód</span>
                        </TabsTrigger>
                        <TabsTrigger value="qr" className="gap-1 text-[10px] sm:text-xs px-1">
                          <QrCode className="w-3 h-3" />
                          QR
                        </TabsTrigger>
                        <TabsTrigger value="mobile" className="gap-1 text-[10px] sm:text-xs px-1">
                          <Smartphone className="w-3 h-3" />
                          Mobile
                          {savedMobileState && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 ml-1" />}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="code" className="mt-0">
                        <PhoneCodeConnection
                          instanceId={instance.id}
                          onConnected={() => {
                            fetchStatus();
                            onStatusChange();
                          }}
                          onExpired={() => setIsExpired(true)}
                        />
                      </TabsContent>

                      <TabsContent value="qr" className="mt-0 space-y-4">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                          <Monitor className="w-5 h-5 text-blue-500 shrink-0" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              Para escanear o QR
                            </p>
                            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                              Acesse em um computador ou use outro celular
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <div className="bg-white p-2 rounded-xl shadow-lg">
                            <img src={qrCode} alt="QR Code" className="w-40 h-40 rounded" />
                          </div>
                        </div>

                        <Button
                          onClick={copyConnectionLink}
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar link
                        </Button>
                      </TabsContent>

                      <TabsContent value="mobile" className="mt-0">
                        <MobileRegistration
                          instanceId={instance.id}
                          savedState={savedMobileState}
                          onConnected={() => {
                            setSavedMobileState(null);
                            fetchStatus();
                            onStatusChange();
                          }}
                          onCancel={() => setSavedMobileState(null)}
                        />
                      </TabsContent>
                    </Tabs>

                    {/* Actions Mobile */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-border">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={handleRestart}
                              disabled={isLoading}
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                            >
                              <Power className="w-4 h-4" />
                              Reiniciar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Use quando mensagens não estão sendo enviadas/recebidas</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                ) : (
                  /* Desktop: Tabs com QR, Código e Mobile */
                  <Tabs defaultValue={savedMobileState ? "mobile" : "qr"} className="w-full">
                    <TabsList className="grid grid-cols-3 w-full mb-4">
                      <TabsTrigger value="qr" className="gap-1.5 text-xs sm:text-sm">
                        <QrCode className="w-3.5 h-3.5" />
                        QR Code
                      </TabsTrigger>
                      <TabsTrigger value="code" className="gap-1.5 text-xs sm:text-sm">
                        <KeyRound className="w-3.5 h-3.5" />
                        Código
                      </TabsTrigger>
                      <TabsTrigger value="mobile" className="gap-1.5 text-xs sm:text-sm">
                        <Smartphone className="w-3.5 h-3.5" />
                        Mobile
                        {savedMobileState && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 ml-1" />}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="qr" className="mt-0 space-y-4 sm:space-y-5">
                      {/* Status message */}
                      <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-medium">
                          Escaneie o QR Code com seu WhatsApp
                        </span>
                      </div>

                      {/* QR Code */}
                      <div className="flex justify-center">
                        <div className="relative bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl ring-1 ring-black/5">
                          <img
                            src={qrCode}
                            alt="QR Code WhatsApp"
                            className="w-44 h-44 sm:w-52 sm:h-52 rounded-lg"
                          />
                          {/* Countdown overlay */}
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-background rounded-full shadow-md border text-[10px] sm:text-xs font-medium">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-pulse" />
                            <span className="text-muted-foreground">Atualiza em</span>
                            <span className="text-foreground font-bold">{countdown}s</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Desktop */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-4 justify-center">
                        <Button
                          onClick={fetchQRCode}
                          disabled={isLoading}
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto gap-2"
                        >
                          {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                          Atualizar QR
                        </Button>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={handleRestart}
                                disabled={isLoading}
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto gap-2"
                              >
                                <Power className="w-4 h-4" />
                                Reiniciar
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Use quando mensagens não estão sendo enviadas/recebidas</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isLoading}
                              className="w-full sm:w-auto gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="sm:hidden">Excluir</span>
                              <span className="hidden sm:inline">Excluir Instância</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Instância?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação excluirá permanentemente a instância. Se você tiver uma conexão ativa, ela será interrompida. Esta ação é irreversível.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDelete}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TabsContent>

                    <TabsContent value="code" className="mt-0">
                      <PhoneCodeConnection
                        instanceId={instance.id}
                        onConnected={() => {
                          fetchStatus();
                          onStatusChange();
                        }}
                        onExpired={() => setIsExpired(true)}
                      />
                    </TabsContent>

                    <TabsContent value="mobile" className="mt-0">
                      <MobileRegistration
                        instanceId={instance.id}
                        savedState={savedMobileState}
                        onConnected={() => {
                          setSavedMobileState(null);
                          fetchStatus();
                          onStatusChange();
                        }}
                        onCancel={() => setSavedMobileState(null)}
                      />
                    </TabsContent>
                  </Tabs>
                )}
              </>
            ) : isExpired ? (
              /* Expired instance warning with manual replace button */
              <div className="space-y-4">
                <div className="flex flex-col gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2 mb-0.5">
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          Conexão expirada
                        </p>
                        {instance.updated_at && (
                          <span className="text-[10px] font-medium text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(instance.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Esta instância ficou muito tempo sem conectar e expirou.
                      </p>
                    </div>
                  </div>

                  {isCreationBlocked ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Seu plano atual está bloqueado. Para substituir esta instância, é necessário assinar/regularizar.
                      </p>
                      <Button asChild className="w-full gap-2">
                        <Link to="/plans">
                          <Lock className="w-4 h-4" />
                          Assinar para reativar
                        </Link>
                      </Button>
                    </div>
                  ) : canSyncSubscription ? (
                    // User has paid plan - offer sync first, then replace as fallback
                    <div className="space-y-2">
                      <Button
                        onClick={handleSyncSubscription}
                        disabled={isSyncing}
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sincronizando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Sincronizar Assinatura
                          </>
                        )}
                      </Button>
                      <p className="text-[10px] text-center text-muted-foreground">
                        Se não funcionar, tente substituir a instância
                      </p>
                      <Button
                        onClick={handleReplaceInstance}
                        disabled={isRecreating || isSyncing}
                        variant="outline"
                        className="w-full gap-2"
                      >
                        {isRecreating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Substituindo...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Substituir Instância
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleReplaceInstance}
                      disabled={isRecreating}
                      className="w-full gap-2"
                    >
                      {isRecreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Substituindo...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Substituir Instância
                        </>
                      )}
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isLoading || isRecreating || isSyncing}
                        className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir Instância Expirada
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Instância?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta instância expirou. Ao excluí-la, você poderá criar uma nova conexão. Esta ação é irreversível.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status message */}
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                    Carregando QR Code...
                  </span>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button
                    onClick={fetchQRCode}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto gap-2"
                  >
                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                    Gerar QR Code
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isLoading}
                        className="w-full sm:w-auto gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Instância?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Deseja realmente excluir esta instância? Esta ação é irreversível.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};