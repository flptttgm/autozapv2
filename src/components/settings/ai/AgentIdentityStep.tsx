import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AGENT_PROFILES, AgentType } from "@/lib/agent-profiles";
import { RefreshCw, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentIdentityStepProps {
  agentType: AgentType | 'custom';
  personaName: string;
  onPersonaNameChange: (name: string) => void;
  transitionMessage: string;
  onTransitionMessageChange: (message: string) => void;
  triggerKeywords: string[];
  onTriggerKeywordsChange: (keywords: string[]) => void;
}

export const AgentIdentityStep = ({
  agentType,
  personaName,
  onPersonaNameChange,
  transitionMessage,
  onTransitionMessageChange,
  triggerKeywords,
  onTriggerKeywordsChange,
}: AgentIdentityStepProps) => {
  const [newKeyword, setNewKeyword] = useState("");
  
  const profile = agentType !== 'custom' ? AGENT_PROFILES[agentType] : null;
  const suggestedPersonas = profile?.suggested_personas || [];

  // Generate random persona suggestion
  const suggestRandomPersona = () => {
    if (suggestedPersonas.length > 0) {
      const randomIndex = Math.floor(Math.random() * suggestedPersonas.length);
      onPersonaNameChange(suggestedPersonas[randomIndex]);
    }
  };

  // Update transition message when persona name changes
  useEffect(() => {
    if (personaName && profile && !transitionMessage) {
      const defaultTransition = profile.default_transition.replace('{persona}', personaName);
      onTransitionMessageChange(defaultTransition);
    }
  }, [personaName, profile]);

  // Update transition message template when persona changes
  const updateTransitionWithPersona = (name: string) => {
    onPersonaNameChange(name);
    if (profile && transitionMessage) {
      // Replace the old persona name with the new one
      const template = profile.default_transition;
      onTransitionMessageChange(template.replace('{persona}', name));
    }
  };

  const handleAddKeyword = () => {
    const keyword = newKeyword.trim().toLowerCase();
    if (keyword && !triggerKeywords.includes(keyword)) {
      onTriggerKeywordsChange([...triggerKeywords, keyword]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    onTriggerKeywordsChange(triggerKeywords.filter(k => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  return (
    <div className="space-y-6">
      {/* Persona Name */}
      <div className="space-y-3">
        <Label htmlFor="persona-name">Nome da Persona *</Label>
        <div className="flex gap-2">
          <Input
            id="persona-name"
            value={personaName}
            onChange={(e) => updateTransitionWithPersona(e.target.value)}
            placeholder="Ex: Mariana, Carlos, Amanda"
            className="flex-1"
          />
          {suggestedPersonas.length > 0 && (
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={suggestRandomPersona}
              title="Sugerir nome aleatório"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Este nome será usado nas apresentações ao cliente
        </p>

        {/* Suggested personas */}
        {suggestedPersonas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestedPersonas.map((name) => (
              <Badge
                key={name}
                variant={personaName === name ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => updateTransitionWithPersona(name)}
              >
                {name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Transition Message */}
      <div className="space-y-2">
        <Label htmlFor="transition-message">Mensagem de Apresentação</Label>
        <Textarea
          id="transition-message"
          value={transitionMessage}
          onChange={(e) => onTransitionMessageChange(e.target.value)}
          placeholder="Oi! Agora quem está falando com você é..."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Mensagem enviada quando este agente assume a conversa. Use <code className="bg-muted px-1 rounded">{'{persona}'}</code> para inserir o nome.
        </p>
      </div>

      {/* Preview */}
      {personaName && transitionMessage && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <p className="text-sm font-medium mb-2">📱 Preview da apresentação:</p>
          <div className="bg-card rounded-lg p-3 shadow-sm border">
            <p className="text-sm">
              {transitionMessage.replace('{persona}', personaName)}
            </p>
          </div>
        </Card>
      )}

      {/* Trigger Keywords */}
      <div className="space-y-3">
        <Label>Palavras-chave de Ativação</Label>
        <p className="text-xs text-muted-foreground">
          Quando o cliente usar essas palavras, este agente será acionado automaticamente
        </p>
        
        <div className="flex gap-2">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma palavra-chave..."
            className="flex-1"
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={handleAddKeyword}
            disabled={!newKeyword.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {triggerKeywords.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="pl-2 pr-1 py-1 flex items-center gap-1"
            >
              {keyword}
              <button
                type="button"
                onClick={() => handleRemoveKeyword(keyword)}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {triggerKeywords.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Nenhuma palavra-chave adicionada
            </p>
          )}
        </div>

        {/* Pre-fill button for agent type */}
        {profile && profile.trigger_keywords.length > 0 && triggerKeywords.length === 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onTriggerKeywordsChange(profile.trigger_keywords)}
            className="mt-2"
          >
            Usar palavras-chave sugeridas para {profile.name}
          </Button>
        )}
      </div>
    </div>
  );
};
