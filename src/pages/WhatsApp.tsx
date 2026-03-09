// WhatsApp page - Manage WhatsApp connections
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Smartphone, BarChart3, Lock, Crown, X, AlertTriangle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WhatsAppInstanceCard } from "@/components/whatsapp/WhatsAppInstanceCard";
import { WhatsAppAnalytics } from "@/components/whatsapp/WhatsAppAnalytics";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { motion } from "framer-motion";

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
  subscribed: boolean | null;
  ai_mode?: "all" | "selective";
}

const WhatsApp = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { subscription, connectionsUsed, totalConnections, isTrialExpired, isBlocked } = useSubscription();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showLimitAlert, setShowLimitAlert] = useState(true);

  const workspaceId = profile?.workspace_id;
  const canCreateMore = connectionsUsed < totalConnections && !isTrialExpired;

  const fetchInstances = async () => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_id, instance_token, workspace_id, status, phone, connected_at, created_at, updated_at, subscribed, ai_mode, message_buffer_seconds, display_name')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      // Cast ai_mode to correct type since Supabase returns string
      setInstances((data || []).map(d => ({
        ...d,
        ai_mode: d.ai_mode as "all" | "selective" | undefined
      })));
    } catch (error) {
      console.error('Error fetching instances:', error);
      toast.error(`Erro ao carregar instâncias: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createInstance = async () => {
    if (!workspaceId) {
      toast.error("Workspace não encontrado");
      return;
    }

    if (!canCreateMore) {
      toast.error("Limite de conexões atingido. Faça upgrade do seu plano.");
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ workspace_id: workspaceId })
        }
      );

      const data = await response.json();

      // Tratar erros específicos retornados pelo backend
      if (!response.ok) {
        if (data.error === 'TRIAL_EXPIRED') {
          toast.error("Seu período de teste expirou. Assine um plano para criar novas conexões.", {
            action: {
              label: "Ver Planos",
              onClick: () => window.location.href = "/plans"
            }
          });
          return;
        }
        if (data.error === 'SUBSCRIPTION_BLOCKED') {
          toast.error(data.message || "Seu plano está bloqueado. Regularize para continuar.", {
            action: {
              label: "Ver Planos",
              onClick: () => window.location.href = "/plans"
            }
          });
          return;
        }
        if (data.error === 'CONNECTION_LIMIT') {
          toast.error(data.message || "Limite de conexões atingido. Faça upgrade.", {
            action: {
              label: "Fazer Upgrade",
              onClick: () => window.location.href = "/plans"
            }
          });
          return;
        }
        if (data.error === 'NO_SUBSCRIPTION') {
          toast.error("Nenhum plano encontrado. Assine um plano para criar conexões.", {
            action: {
              label: "Ver Planos",
              onClick: () => window.location.href = "/plans"
            }
          });
          return;
        }
        throw new Error(data.error || 'Failed to create instance');
      }

      console.log('Instance created:', data);

      // Fallback: garantir modo seletivo após criação
      if (data.instance?.id && data.instance?.ai_mode !== 'selective') {
        console.log('[WhatsApp] Forcing selective mode for new instance');
        await supabase
          .from('whatsapp_instances')
          .update({ ai_mode: 'selective' })
          .eq('id', data.instance.id);
      }

      toast.success("Instância WhatsApp criada com sucesso!");
      fetchInstances();
    } catch (error) {
      console.error('Error creating instance:', error);
      toast.error("Erro ao criar instância WhatsApp");
    } finally {
      setIsCreating(false);
    }
  };

  const handleInstanceDelete = (instanceId: string) => {
    setInstances(prev => prev.filter(i => i.id !== instanceId));
    queryClient.invalidateQueries({ queryKey: ['connections-used'] });
  };

  useEffect(() => {
    if (workspaceId) {
      fetchInstances();
    }
  }, [workspaceId]);

  // Check if any instance is expired (only status = 'expired' matters)
  // Note: subscribed flag is Z-API billing detail, doesn't affect functionality
  // Check for expired instances - includes both expired and trial_expired statuses
  const expiredInstances = useMemo(() => {
    return instances.filter(i => i.status === 'expired' || i.status === 'trial_expired');
  }, [instances]);

  const hasExpiredInstances = expiredInstances.length > 0;
  return (
    <div className="relative p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 min-h-screen overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] ambient-glow-primary blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3 z-0" />
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] ambient-glow-secondary blur-[120px] rounded-full pointer-events-none -translate-x-1/3 z-0" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header Responsivo */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-1">
                Conexões WhatsApp
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gerencie suas conexões ({connectionsUsed}/{totalConnections})
              </p>
            </div>

            <Button
              onClick={createInstance}
              disabled={isCreating || !canCreateMore}
              className="w-full sm:w-auto gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  <span className="sm:hidden">Criando...</span>
                  <span className="hidden sm:inline">Criando...</span>
                </>
              ) : !canCreateMore ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span className="sm:hidden">Limite</span>
                  <span className="hidden sm:inline">Limite Atingido</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span className="sm:hidden">Nova</span>
                  <span className="hidden sm:inline">Nova Conexão</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Alerts Responsivos */}
        {/* CRITICAL: Alert for expired WhatsApp instances */}
        {hasExpiredInstances && (
          <Alert className="mb-4 sm:mb-6 border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-sm sm:text-base text-destructive">Conexão WhatsApp Expirada!</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm">
                {expiredInstances.length === 1
                  ? `Sua conexão WhatsApp${expiredInstances[0].phone ? ` (${expiredInstances[0].phone})` : ''} expirou. A automação está pausada.`
                  : `${expiredInstances.length} conexões WhatsApp expiraram. A automação está pausada.`
                }
                {' '}Exclua e crie uma nova conexão para reativar.
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="w-full sm:w-auto shrink-0 gap-2"
                onClick={() => {
                  // Scroll to first expired instance
                  const firstExpired = document.querySelector('[data-instance-expired="true"]');
                  firstExpired?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Reconectar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isTrialExpired && (
          <Alert className="mb-4 sm:mb-6 border-amber-500/50 bg-amber-500/10">
            <Lock className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-sm sm:text-base">Automações pausadas</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm">Seu período de teste expirou. Suas conexões estão pausadas. Assine um plano para reativar.</span>
              <Button asChild size="sm" variant="default" className="w-full sm:w-auto shrink-0">
                <Link to="/plans">Assinar Agora</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isTrialExpired && !canCreateMore && showLimitAlert && (
          <Alert className="mb-4 sm:mb-6 border-amber-500/50 bg-amber-500/10 relative">
            <button
              onClick={() => setShowLimitAlert(false)}
              className="absolute top-2 right-2 p-1 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Fechar alerta"
            >
              <X className="h-4 w-4" />
            </button>
            <Crown className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-sm sm:text-base pr-6">Limite de conexões atingido</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm">Você está usando {connectionsUsed}/{totalConnections} conexões. Faça upgrade para adicionar mais.</span>
              <Button asChild size="sm" variant="outline" className="w-full sm:w-auto shrink-0">
                <Link to="/plans">Fazer Upgrade</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs Responsivas */}
        <Tabs defaultValue="connections" className="space-y-4 sm:space-y-6">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex bg-muted/40 backdrop-blur-md border border-border/50 shadow-sm p-1 rounded-xl">
            <TabsTrigger value="connections" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg">
              <Smartphone className="w-4 h-4" />
              <span className="sm:hidden">Conexões</span>
              <span className="hidden sm:inline">Conexões</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg">
              <BarChart3 className="w-4 h-4" />
              <span className="sm:hidden">Stats</span>
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections">
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 py-8 sm:py-12">
                <Loader2 className="animate-spin w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-sm sm:text-lg">Carregando instâncias...</span>
              </div>
            ) : instances.length === 0 ? (
              <Card className="p-6 sm:p-12 glass border-border/40 shadow-sm">
                <div className="flex flex-col items-center text-center gap-4 sm:gap-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Smartphone className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold mb-2">Nenhuma conexão WhatsApp</h2>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-md">
                      Crie sua primeira conexão WhatsApp para começar a receber e enviar mensagens automaticamente.
                    </p>
                  </div>
                  <Button
                    onClick={createInstance}
                    disabled={isCreating || !canCreateMore}
                    size="lg"
                    className="w-full sm:w-auto gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="animate-spin w-5 h-5" />
                        <span className="sm:hidden">Criando...</span>
                        <span className="hidden sm:inline">Criando instância...</span>
                      </>
                    ) : !canCreateMore ? (
                      <>
                        <Lock className="w-5 h-5" />
                        <span>Limite Atingido</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        <span className="sm:hidden">Criar Conexão</span>
                        <span className="hidden sm:inline">Criar Primeira Conexão</span>
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
                {instances.map((instance, index) => {
                  // Only rely on database status - subscribed is Z-API billing detail
                  // Backend correctly manages these statuses via check-expired-subscriptions
                  const isExpired = instance.status === 'expired' || instance.status === 'trial_expired';

                  return (
                    <motion.div
                      key={instance.id}
                      data-instance-expired={isExpired ? "true" : "false"}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.1,
                        ease: [0.25, 0.46, 0.45, 0.94]
                      }}
                    >
                      <WhatsAppInstanceCard
                        instance={instance}
                        isCreationBlocked={isTrialExpired || isBlocked}
                        onDelete={handleInstanceDelete}
                        onStatusChange={fetchInstances}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            {workspaceId && (
              <WhatsAppAnalytics
                instances={instances}
                workspaceId={workspaceId}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WhatsApp;