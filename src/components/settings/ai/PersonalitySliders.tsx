import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface PersonalitySlidersProps {
  personality: {
    tone: number;
    verbosity: number;
    proactivity: number;
    assistant_name: string;
    use_emojis: boolean;
  };
  onUpdate: (personality: any) => void;
}

export const PersonalitySliders = ({ personality, onUpdate }: PersonalitySlidersProps) => {
  const [localPersonality, setLocalPersonality] = useState(personality);

  useEffect(() => {
    setLocalPersonality(personality);
  }, [personality]);

  const handleSave = () => {
    onUpdate(localPersonality);
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold mb-2">Personalidade da I.A.</h3>
        <p className="text-muted-foreground">
          Ajuste como a I.A. se comporta e se comunica
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Tom de Voz</Label>
            <span className="text-sm text-muted-foreground">
              {localPersonality.tone < 30 ? "Formal" : localPersonality.tone < 70 ? "Equilibrado" : "Informal"}
            </span>
          </div>
          <Slider
            value={[localPersonality.tone]}
            onValueChange={([value]) => setLocalPersonality({ ...localPersonality, tone: value })}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Formal</span>
            <span>Informal</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Comprimento das Respostas</Label>
            <span className="text-sm text-muted-foreground">
              {localPersonality.verbosity < 40 ? "Conciso" : localPersonality.verbosity <= 60 ? "Equilibrado" : "Detalhado"}
            </span>
          </div>
          <Slider
            value={[localPersonality.verbosity]}
            onValueChange={([value]) => setLocalPersonality({ ...localPersonality, verbosity: value })}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Conciso</span>
            <span>Detalhado</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Proatividade</Label>
            <span className="text-sm text-muted-foreground">
              {localPersonality.proactivity < 30 ? "Reativo" : localPersonality.proactivity < 70 ? "Equilibrado" : "Proativo"}
            </span>
          </div>
          <Slider
            value={[localPersonality.proactivity]}
            onValueChange={([value]) => setLocalPersonality({ ...localPersonality, proactivity: value })}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Apenas responde</span>
            <span>Sugere próximos passos</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assistant-name">Nome do Assistente</Label>
          <Input
            id="assistant-name"
            value={localPersonality.assistant_name}
            onChange={(e) => setLocalPersonality({ ...localPersonality, assistant_name: e.target.value })}
            placeholder="Ex: Ana, Carlos, Assistente Virtual"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="use-emojis">Usar Emojis</Label>
            <p className="text-sm text-muted-foreground">
              Usa emojis com moderação para destacar informações (📅 📍 ✅)
            </p>
          </div>
          <Switch
            id="use-emojis"
            checked={localPersonality.use_emojis}
            onCheckedChange={(checked) => setLocalPersonality({ ...localPersonality, use_emojis: checked })}
          />
        </div>
      </div>

      <Button onClick={handleSave} className="w-full">
        Salvar Personalidade
      </Button>
    </div>
  );
};
