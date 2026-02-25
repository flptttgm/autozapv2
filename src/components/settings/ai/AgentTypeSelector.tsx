import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AGENT_PROFILES, AgentType } from "@/lib/agent-profiles";
import { Settings } from "lucide-react";

interface AgentTypeSelectorProps {
  selectedType: AgentType | 'custom' | null;
  onSelect: (type: AgentType | 'custom') => void;
}

export const AgentTypeSelector = ({ selectedType, onSelect }: AgentTypeSelectorProps) => {
  const agentTypes: (AgentType | 'custom')[] = ['sales', 'support', 'scheduling', 'financial', 'technical', 'custom'];

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Escolha o Tipo de Agente</h3>
        <p className="text-sm text-muted-foreground">
          Selecione um perfil pré-configurado ou crie do zero
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {agentTypes.map((type) => {
          if (type === 'custom') {
            return (
              <Card
                key="custom"
                className={cn(
                  "p-4 cursor-pointer transition-all hover:shadow-md border-2",
                  selectedType === 'custom'
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-dashed hover:border-primary/50"
                )}
                onClick={() => onSelect('custom')}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div 
                    className={cn(
                      "p-3 rounded-full transition-colors",
                      selectedType === 'custom' 
                        ? "bg-primary/20 text-primary" 
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Settings className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">Personalizado</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      Crie do zero com total liberdade
                    </p>
                  </div>
                </div>
              </Card>
            );
          }

          const profile = AGENT_PROFILES[type];
          const Icon = profile.icon;
          const isSelected = selectedType === type;

          return (
            <Card
              key={type}
              className={cn(
                "p-4 cursor-pointer transition-all hover:shadow-md border-2",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-transparent hover:border-primary/30"
              )}
              onClick={() => onSelect(type)}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div 
                  className="p-3 rounded-full transition-colors"
                  style={{ 
                    backgroundColor: isSelected ? `${profile.color}20` : 'hsl(var(--muted))',
                    color: isSelected ? profile.color : 'hsl(var(--muted-foreground))'
                  }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <p className="font-medium text-sm">{profile.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {profile.description}
                  </p>
                </div>
                {isSelected && (
                  <Badge variant="secondary" className="text-xs">
                    Selecionado
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {selectedType && selectedType !== 'custom' && (
        <Card className="p-4 bg-muted/50 border-dashed">
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <span>💡</span>
              Dica
            </p>
            <p className="text-xs text-muted-foreground">
              O perfil <strong>{AGENT_PROFILES[selectedType].name}</strong> já vem configurado com personalidade, 
              palavras-chave e prompt otimizados. Você poderá personalizar tudo no próximo passo.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
