import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Loader2, Route, Zap, Brain, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TRANSITION_STYLES, ROUTING_MODES } from "@/lib/agent-profiles";
import { useTranslation } from "react-i18next";

interface AgentRoutingSettingsProps {
  workspaceId: string;
}

interface RoutingConfig {
  id?: string;
  workspace_id: string;
  is_routing_enabled: boolean;
  default_agent_id: string | null;
  routing_mode: 'hybrid' | 'keywords' | 'ai';
  transition_style: 'friendly' | 'formal' | 'silent';
  hybrid_threshold?: number;
}

interface AgentOption {
  id: string;
  name: string;
  persona_name: string | null;
  agent_type: string | null;
}

export const AgentRoutingSettings = ({ workspaceId }: AgentRoutingSettingsProps) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation("agents");

  // Fetch routing config
  const { data: routingConfig, isLoading: configLoading } = useQuery({
    queryKey: ['agent-routing-config', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_routing_config')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data as RoutingConfig | null;
    },
    enabled: !!workspaceId
  });

  // Fetch agents for default selection
  const { data: agents = [] } = useQuery({
    queryKey: ['agents-for-routing', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('super_agents')
        .select('id, name, persona_name, agent_type')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (error) throw error;
      return data as AgentOption[];
    },
    enabled: !!workspaceId
  });

  // Local state
  const [config, setConfig] = useState<RoutingConfig>({
    workspace_id: workspaceId,
    is_routing_enabled: false,
    default_agent_id: null,
    routing_mode: 'hybrid',
    transition_style: 'friendly',
    hybrid_threshold: 0.70
  });

  // Update local state when data loads
  useEffect(() => {
    if (routingConfig) {
      setConfig({
        ...routingConfig,
        routing_mode: (routingConfig.routing_mode as 'hybrid' | 'keywords' | 'ai') || 'hybrid',
        transition_style: (routingConfig.transition_style as 'friendly' | 'formal' | 'silent') || 'friendly',
        hybrid_threshold: routingConfig.hybrid_threshold ?? 0.70
      });
    }
  }, [routingConfig]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newConfig: RoutingConfig) => {
      const { error } = await supabase
        .from('agent_routing_config')
        .upsert({
          workspace_id: workspaceId,
          is_routing_enabled: newConfig.is_routing_enabled,
          default_agent_id: newConfig.default_agent_id,
          routing_mode: newConfig.routing_mode,
          transition_style: newConfig.transition_style,
          hybrid_threshold: newConfig.hybrid_threshold,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workspace_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-routing-config', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['agents-for-routing', workspaceId] });
      toast.success('Configurações de roteamento salvas!');
    },
    onError: (error) => {
      console.error('Error saving routing config:', error);
      toast.error('Erro ao salvar configurações');
    }
  });

  const handleConfigChange = (updates: Partial<RoutingConfig>) => {
    let newConfig = { ...config, ...updates };

    // Auto-select support agent as default when enabling routing without a default
    if (updates.is_routing_enabled && !newConfig.default_agent_id && agents.length > 0) {
      const supportAgent = agents.find(a => a.agent_type === 'support');
      if (supportAgent) {
        newConfig.default_agent_id = supportAgent.id;
        console.log('[AgentRouting] Auto-selected support agent as default:', supportAgent.name);
      } else {
        // Fallback to first available agent
        newConfig.default_agent_id = agents[0].id;
        console.log('[AgentRouting] Auto-selected first agent as default:', agents[0].name);
      }
    }

    setConfig(newConfig);
    saveMutation.mutate(newConfig);
  };

  if (configLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      {/* Header with toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">{t("routingSettings.title")}</h3>
            {config.is_routing_enabled && (
              <Badge variant="default" className="text-xs">{t("routingSettings.active")}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("routingSettings.description")}
          </p>
        </div>
        <Switch
          checked={config.is_routing_enabled}
          onCheckedChange={(checked) => handleConfigChange({ is_routing_enabled: checked })}
        />
      </div>

      {config.is_routing_enabled && (
        <>
          <div className="border-t pt-6 space-y-6">
            {/* Routing Mode */}
            <div className="space-y-3">
              <Label className="text-base font-medium">{t("routingSettings.detectionMode")}</Label>
              <RadioGroup
                value={config.routing_mode}
                onValueChange={(value) => handleConfigChange({ routing_mode: value as 'hybrid' | 'keywords' | 'ai' })}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {/* HYBRID - FIRST AND HIGHLIGHTED */}
                <Label
                  htmlFor="mode-hybrid"
                  className={`flex flex-col gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${config.routing_mode === 'hybrid'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-border hover:border-amber-500/50'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="hybrid" id="mode-hybrid" className="mt-0" />
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="font-medium">{ROUTING_MODES.hybrid.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ROUTING_MODES.hybrid.description}
                  </p>

                  {/* Threshold Slider - only shows when hybrid selected */}
                  {config.routing_mode === 'hybrid' && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Confiança</span>
                        <span className="text-xs font-medium">
                          {Math.round((config.hybrid_threshold || 0.70) * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[(config.hybrid_threshold || 0.70) * 100]}
                        onValueChange={(values) => handleConfigChange({
                          hybrid_threshold: values[0] / 100
                        })}
                        min={50}
                        max={95}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Maior = mais preciso. Menor = mais respostas prontas.
                      </p>
                    </div>
                  )}
                </Label>

                {/* KEYWORDS */}
                <Label
                  htmlFor="mode-keywords"
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${config.routing_mode === 'keywords'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                    }`}
                >
                  <RadioGroupItem value="keywords" id="mode-keywords" className="mt-1" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="font-medium">{ROUTING_MODES.keywords.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ROUTING_MODES.keywords.description}
                    </p>
                  </div>
                </Label>

                {/* AI */}
                <Label
                  htmlFor="mode-ai"
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${config.routing_mode === 'ai'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                    }`}
                >
                  <RadioGroupItem value="ai" id="mode-ai" className="mt-1" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-500" />
                      <span className="font-medium">{ROUTING_MODES.ai.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ROUTING_MODES.ai.description}
                    </p>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {/* Transition Style */}
            <div className="space-y-3">
              <Label className="text-base font-medium">{t("routingSettings.transitionStyle")}</Label>
              <RadioGroup
                value={config.transition_style}
                onValueChange={(value) => handleConfigChange({ transition_style: value as 'friendly' | 'formal' | 'silent' })}
                className="space-y-2"
              >
                {Object.values(TRANSITION_STYLES).map((style) => (
                  <Label
                    key={style.id}
                    htmlFor={`style-${style.id}`}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${config.transition_style === style.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <RadioGroupItem value={style.id} id={`style-${style.id}`} />
                    <span className="text-xl">{style.icon}</span>
                    <div className="flex-1">
                      <span className="font-medium">{style.label}</span>
                      <p className="text-xs text-muted-foreground">{style.description}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {/* Default Agent */}
            <div className="space-y-3">
              <Label className="text-base font-medium">{t("routingSettings.defaultAgent")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("routingSettings.defaultAgentDesc")}
              </p>
              <Select
                value={config.default_agent_id || 'none'}
                onValueChange={(value) => handleConfigChange({
                  default_agent_id: value === 'none' ? null : value
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (usar configurações da instância)</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <span>{agent.name}</span>
                        {agent.agent_type && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {agent.agent_type}
                          </Badge>
                        )}
                        {agent.persona_name && (
                          <span className="text-muted-foreground text-xs">
                            ({agent.persona_name})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info card */}
          <Card className="p-4 bg-muted/50 border-dashed">
            <div className="flex gap-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("routingSettings.howItWorks")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("routingSettings.howItWorksDesc")}
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {!config.is_routing_enabled && (
        <Card className="p-4 bg-muted/50 border-dashed">
          <p className="text-sm text-muted-foreground text-center">
            Ative o roteamento inteligente para configurar a troca automática de agentes durante as conversas.
          </p>
        </Card>
      )}

      {saveMutation.isPending && (
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Salvando...
        </div>
      )}
    </Card>
  );
};
