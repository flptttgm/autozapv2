import { useState, useMemo, useEffect } from "react";
import { Star, Edit2, RefreshCw, Check, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const agentTypeColors: Record<string, { bg: string; text: string; badge: string }> = {
  sales: { bg: "bg-emerald-500/10", text: "text-emerald-600", badge: "bg-emerald-500" },
  support: { bg: "bg-blue-500/10", text: "text-blue-600", badge: "bg-blue-500" },
  scheduling: { bg: "bg-violet-500/10", text: "text-violet-600", badge: "bg-violet-500" },
  financial: { bg: "bg-amber-500/10", text: "text-amber-600", badge: "bg-amber-500" },
  technical: { bg: "bg-slate-500/10", text: "text-slate-600", badge: "bg-slate-500" },
  general: { bg: "bg-primary/10", text: "text-primary", badge: "bg-primary" },
};

const agentTypeLabels: Record<string, string> = {
  sales: "Vendas",
  support: "Suporte",
  scheduling: "Agendamento",
  financial: "Financeiro",
  technical: "Técnico",
  general: "Geral",
};

interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    description?: string | null;
    agent_type?: string | null;
    agent_persona_name?: string | null;
    trigger_keywords?: string[] | null;
    transition_message?: string | null;
    icon?: string | null;
    is_favorite?: boolean;
    avatar_url?: string | null;
  };
  onClick: () => void;
  onRegenerateAvatar?: (agentId: string, personaName: string, agentType: string) => void;
  isRegeneratingAvatar?: boolean;
  isInUse?: boolean;
  isInactive?: boolean;
  allConnectedInstances?: { id: string; display_name?: string | null; phone?: string | null; ai_template_id?: string | null }[];
  isRoutingEnabled?: boolean;
  isDefaultAgent?: boolean;
  onInstanceToggle?: (instanceId: string, activate: boolean) => void;
  instancesWithOtherAgents?: Record<string, string>; // { instanceId: agentName }
}

export const AgentCard = ({ 
  agent, 
  onClick, 
  onRegenerateAvatar, 
  isRegeneratingAvatar, 
  isInUse, 
  isInactive, 
  allConnectedInstances = [], 
  isRoutingEnabled, 
  isDefaultAgent,
  onInstanceToggle,
  instancesWithOtherAgents = {}
}: AgentCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const agentType = agent.agent_type || "general";
  const colors = agentTypeColors[agentType] || agentTypeColors.general;
  const typeLabel = agentTypeLabels[agentType] || "Geral";
  
  // Get persona name or first name from agent name
  const personaName = agent.agent_persona_name || agent.name.split(" ")[0];
  const initial = personaName.charAt(0).toUpperCase();
  
  // Cache-buster estável - só recalcula quando avatar_url muda
  const imageUrl = useMemo(() => {
    if (!agent.avatar_url) return null;
    // Se já tem query param, usar como está
    if (agent.avatar_url.includes('?')) return agent.avatar_url;
    // Senão, adicionar cache-buster estável (calculado uma vez por mount)
    return `${agent.avatar_url}?v=${Date.now()}`;
  }, [agent.avatar_url]);

  // Reset loading state when URL changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [imageUrl]);
  
  // Parse keywords
  const keywords = Array.isArray(agent.trigger_keywords) 
    ? agent.trigger_keywords.slice(0, 4) 
    : [];

  return (
    <Card
      className={cn(
        "group relative cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all overflow-hidden",
        isInactive && "opacity-50 grayscale hover:opacity-75 hover:grayscale-0"
      )}
      onClick={onClick}
    >
      {/* Type badge header */}
      <div className={cn("px-4 py-2 flex items-center justify-between", colors.bg)}>
        <Badge className={cn("text-xs font-medium text-white border-0", colors.badge)}>
          {typeLabel.toUpperCase()}
        </Badge>
        <div className="flex items-center gap-2">
          {isInUse && (
            <Badge className="bg-green-500 text-white text-xs border-0 gap-1">
              <Check className="w-3 h-3" />
              EM USO
            </Badge>
          )}
          {isInactive && (
            <Badge variant="secondary" className="text-xs border-0">
              INATIVO
            </Badge>
          )}
          {agent.is_favorite && (
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Avatar and name section */}
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar com loading state */}
          <div className="relative w-14 h-14 shrink-0">
            {imageUrl && !imageError ? (
              <>
                <img 
                  src={imageUrl}
                  alt={personaName}
                  loading="lazy"
                  className={cn(
                    "w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-md transition-opacity duration-300",
                    imageLoaded ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                {/* Skeleton enquanto carrega */}
                {!imageLoaded && (
                  <Skeleton className="absolute inset-0 w-14 h-14 rounded-full" />
                )}
              </>
            ) : (
              // Fallback: inicial do nome com botão de regenerar
              <div 
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white relative",
                  colors.badge
                )}
              >
                {initial}
                {onRegenerateAvatar && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerateAvatar(agent.id, personaName, agentType);
                    }}
                    disabled={isRegeneratingAvatar}
                    className="absolute -bottom-1 -right-1 p-1 bg-background rounded-full shadow-md hover:bg-muted transition-colors disabled:opacity-50"
                    title="Regenerar avatar"
                  >
                    <RefreshCw className={cn("w-3 h-3 text-muted-foreground", isRegeneratingAvatar && "animate-spin")} />
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{personaName}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {typeLabel}
            </p>
          </div>
        </div>

        {/* Transition message preview */}
        {agent.transition_message && (
          <p className="text-sm text-muted-foreground italic mb-4 line-clamp-2">
            "{agent.transition_message}"
          </p>
        )}

        {/* Keywords */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {keywords.map((keyword, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
              >
                {keyword}
              </span>
            ))}
            {(agent.trigger_keywords?.length || 0) > 4 && (
              <span className="px-2 py-0.5 text-xs text-muted-foreground">
                +{(agent.trigger_keywords?.length || 0) - 4}
              </span>
            )}
          </div>
        )}

        {/* Instance toggles - only show when routing is OFF and there are connected instances */}
        {!isRoutingEnabled && allConnectedInstances.length > 0 && onInstanceToggle && (
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="w-3 h-3" />
              <span>Linhas:</span>
            </div>
            {allConnectedInstances.map((instance) => {
              const isAssignedToThis = instance.ai_template_id === agent.id;
              const otherAgentName = instancesWithOtherAgents[instance.id];
              const hasOtherAgent = !!otherAgentName && !isAssignedToThis;
              
              return (
                <div 
                  key={instance.id} 
                  className="flex items-center justify-between gap-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-sm truncate flex-1">
                    {instance.display_name || instance.phone || "Conexão"}
                  </span>
                  <Switch
                    checked={isAssignedToThis}
                    onCheckedChange={(checked) => onInstanceToggle(instance.id, checked)}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Instance info - show when routing is enabled */}
        {isRoutingEnabled && isInUse && allConnectedInstances.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 mb-2">
            <Smartphone className="w-3 h-3" />
            <span>
              {isDefaultAgent && "Padrão • "}
              Ativo em todas as linhas (Roteamento)
            </span>
          </div>
        )}

        {/* Edit hint */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <Edit2 className="w-3 h-3" />
          <span>Clique para editar</span>
        </div>
      </div>
    </Card>
  );
};
