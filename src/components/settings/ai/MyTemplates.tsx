import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Wand2, Loader2 } from "lucide-react";
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { CreateAgentWizard } from "./CreateAgentWizard";
import { AgentCard } from "./AgentCard";
import { toast } from "sonner";
import { useConnectedWhatsAppInstances } from "@/hooks/useConnectedWhatsAppInstances";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CustomTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  config: any;
  is_favorite: boolean;
  created_at: string;
  agent_type: string | null;
  agent_persona_name: string | null;
  trigger_keywords: string[] | null;
  trigger_intents: string[] | null;
  transition_message: string | null;
  avatar_url: string | null;
}

interface MyTemplatesProps {
  workspaceId: string;
  onApplyTemplate: (config: any) => void;
}

export const MyTemplates = ({ workspaceId, onApplyTemplate }: MyTemplatesProps) => {
  const [showEditorDialog, setShowEditorDialog] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [regeneratingAvatarId, setRegeneratingAvatarId] = useState<string | null>(null);
  const [showRoutingSuggestion, setShowRoutingSuggestion] = useState(false);
  const [conflictingInstance, setConflictingInstance] = useState<{ instanceName: string; agentName: string } | null>(null);
  const queryClient = useQueryClient();

  // Fetch custom templates with all agent fields
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["custom-templates", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_templates")
        .select("id, name, description, icon, config, is_favorite, created_at, agent_type, agent_persona_name, trigger_keywords, trigger_intents, transition_message, avatar_url")
        .eq("workspace_id", workspaceId)
        .order("is_favorite", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CustomTemplate[];
    },
    enabled: !!workspaceId,
  });

  // Use centralized hook to avoid cache poisoning with different schemas
  const { instances: connectedInstances } = useConnectedWhatsAppInstances(workspaceId);

  // Fetch routing configuration to check if routing is enabled
  const { data: routingConfig } = useQuery({
    queryKey: ["agent-routing-config", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_routing_config")
        .select("is_routing_enabled, default_agent_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const isRoutingEnabled = routingConfig?.is_routing_enabled ?? false;
  const defaultAgentId = routingConfig?.default_agent_id;
  
  // If routing is enabled, ALL agents are "in use" for connected instances
  // Otherwise, only the agent with ai_template_id is in use (with fallback to default)
  const agentsInUse = new Set(
    isRoutingEnabled && connectedInstances.length > 0
      ? templates.map(t => t.id) // Routing ON: all agents in use
      : (() => {
          // Routing OFF: check ai_template_id from instances
          const instanceAgents = connectedInstances
            .filter(i => i.ai_template_id)
            .map(i => i.ai_template_id);
          
          // If no instance has ai_template_id set, use default_agent_id as fallback
          if (instanceAgents.length === 0 && defaultAgentId) {
            return [defaultAgentId];
          }
          return instanceAgents;
        })()
  );

  // Agents that are inactive (routing OFF and not the active agent)
  const inactiveAgents = new Set(
    !isRoutingEnabled && connectedInstances.length > 0
      ? templates.filter(t => !agentsInUse.has(t.id)).map(t => t.id)
      : []
  );

  // Map of instanceId -> agentName for instances that have other agents assigned
  const instancesWithOtherAgents: Record<string, string> = {};
  connectedInstances.forEach(instance => {
    if (instance.ai_template_id) {
      const agent = templates.find(t => t.id === instance.ai_template_id);
      if (agent) {
        instancesWithOtherAgents[instance.id] = agent.agent_persona_name || agent.name;
      }
    }
  });

  // Derivar selectedTemplate dos dados atualizados do React Query
  const selectedTemplate = selectedTemplateId 
    ? templates.find(t => t.id === selectedTemplateId) || null
    : null;

  const handleTemplateClick = (template: CustomTemplate) => {
    setSelectedTemplateId(template.id);
    setShowEditorDialog(true);
  };

  // Handle toggle for assigning agent to instance
  const handleInstanceToggle = async (agentId: string, instanceId: string, activate: boolean) => {
    // Find the instance
    const instance = connectedInstances.find(i => i.id === instanceId);
    if (!instance) return;

    // Update database - automatically overwrites any previous agent
    try {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ ai_template_id: activate ? agentId : null })
        .eq("id", instanceId);

      if (error) throw error;

      const agent = templates.find(t => t.id === agentId);
      const agentName = agent?.agent_persona_name || agent?.name || "Agente";
      const instanceName = instance.display_name || instance.phone || "linha";
      
      toast.success(
        activate 
          ? `${agentName} ativado na ${instanceName}` 
          : `${agentName} desativado da ${instanceName}`
      );

      // Invalidate cache to update UI
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances-connected", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
    } catch (error) {
      console.error("Error toggling instance:", error);
      toast.error("Erro ao alterar agente da linha");
    }
  };

  // Enable routing when user confirms from suggestion dialog
  const handleEnableRouting = async () => {
    try {
      const { error } = await supabase
        .from("agent_routing_config")
        .upsert({
          workspace_id: workspaceId,
          is_routing_enabled: true,
        }, {
          onConflict: "workspace_id"
        });

      if (error) throw error;

      toast.success("Roteamento Inteligente ativado! Todos os agentes agora participam do roteamento automático.");
      queryClient.invalidateQueries({ queryKey: ["agent-routing-config", workspaceId] });
      setShowRoutingSuggestion(false);
      setConflictingInstance(null);
    } catch (error) {
      console.error("Error enabling routing:", error);
      toast.error("Erro ao ativar roteamento");
    }
  };

  const handleRegenerateAvatar = async (agentId: string, personaName: string, agentType: string) => {
    setRegeneratingAvatarId(agentId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-avatar", {
        body: { personaName, agentType, agentId },
      });

      if (error) throw error;

      toast.success(`Avatar de ${personaName} regenerado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["custom-templates", workspaceId] });
    } catch (error) {
      console.error("Error regenerating avatar:", error);
      toast.error("Erro ao regenerar avatar. Tente novamente.");
    } finally {
      setRegeneratingAvatarId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-semibold">Meus Agentes</h3>
          <p className="text-muted-foreground text-sm">
            Crie e gerencie seus agentes de IA personalizados
          </p>
        </div>
        <Button onClick={() => setShowCreateWizard(true)} className="w-full sm:w-auto">
          <Wand2 className="w-4 h-4 mr-2" />
          <span>Criar Novo Agente</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Agent cards */}
        {templates.map((template) => (
          <AgentCard
            key={template.id}
            agent={template}
            onClick={() => handleTemplateClick(template)}
            onRegenerateAvatar={handleRegenerateAvatar}
            isRegeneratingAvatar={regeneratingAvatarId === template.id}
            isInUse={agentsInUse.has(template.id)}
            isInactive={inactiveAgents.has(template.id)}
            allConnectedInstances={connectedInstances}
            isRoutingEnabled={isRoutingEnabled}
            isDefaultAgent={template.id === defaultAgentId}
            onInstanceToggle={(instanceId, activate) => handleInstanceToggle(template.id, instanceId, activate)}
            instancesWithOtherAgents={instancesWithOtherAgents}
          />
        ))}

        {/* Create new agent card */}
        <Card
          className="cursor-pointer border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center"
          onClick={() => setShowCreateWizard(true)}
        >
          <div className="flex flex-col items-center text-center space-y-3 p-6">
            <div className="p-4 rounded-full bg-muted">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-medium">Criar Novo Agente</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Assistente guiado
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Template Editor Dialog */}
      <TemplateEditorDialog
        open={showEditorDialog}
        onOpenChange={(open) => {
          setShowEditorDialog(open);
          if (!open) setSelectedTemplateId(null);
        }}
        template={selectedTemplate}
        workspaceId={workspaceId}
        onApplyToWorkspace={onApplyTemplate}
      />

      {/* Create Agent Wizard */}
      <CreateAgentWizard
        open={showCreateWizard}
        onOpenChange={setShowCreateWizard}
        workspaceId={workspaceId}
      />

      {/* Routing Suggestion Dialog */}
      <AlertDialog open={showRoutingSuggestion} onOpenChange={setShowRoutingSuggestion}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Linha já possui agente ativo</AlertDialogTitle>
            <AlertDialogDescription>
              {conflictingInstance?.instanceName} já está sendo atendida por <strong>{conflictingInstance?.agentName}</strong>.
              <br /><br />
              Para ter múltiplos agentes respondendo na mesma linha, ative o <strong>Roteamento Inteligente</strong>.
              Com ele, a IA decide automaticamente qual agente responde cada mensagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRoutingSuggestion(false);
              setConflictingInstance(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleEnableRouting}>
              Ativar Roteamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
