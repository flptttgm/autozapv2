import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PromptEditorProps {
  prompt: string;
  onUpdate: (prompt: string) => void;
}

export const PromptEditor = ({ prompt, onUpdate }: PromptEditorProps) => {
  const [localPrompt, setLocalPrompt] = useState(prompt || '');

  useEffect(() => {
    setLocalPrompt(prompt || '');
  }, [prompt]);

  const handleSave = () => {
    onUpdate(localPrompt);
  };

  const variables = [
    { name: "{{nome_cliente}}", desc: "Nome do cliente" },
    { name: "{{horario_funcionamento}}", desc: "Horário de funcionamento" },
    { name: "{{servicos}}", desc: "Lista de serviços" },
    { name: "{{empresa}}", desc: "Nome da empresa" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Instruções Customizadas</h3>
        <p className="text-muted-foreground">
          Configure o prompt que define como a I.A. deve se comportar
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Seja específico sobre o tom, objetivos e limitações da I.A. Quanto mais detalhado, melhor o resultado.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label>Variáveis Disponíveis</Label>
        <div className="flex flex-wrap gap-2">
          {variables.map((variable) => (
            <Badge
              key={variable.name}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => setLocalPrompt(localPrompt + " " + variable.name)}
            >
              {variable.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="system-prompt">Prompt do Sistema</Label>
        <Textarea
          id="system-prompt"
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          placeholder="Exemplo: Você é um assistente de clínica médica chamado Ana. Seja empático e profissional. Seu objetivo é agendar consultas e responder dúvidas gerais sobre os serviços. Em casos de emergência, oriente o paciente a buscar atendimento imediato..."
          className="min-h-[300px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {localPrompt.length} caracteres
        </p>
      </div>

      <div className="space-y-2">
        <Label>Dicas para um bom prompt:</Label>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Defina claramente quem é a I.A. e qual seu papel</li>
          <li>Especifique o tom de voz desejado (formal, informal, técnico)</li>
          <li>Liste os principais objetivos (agendar, informar, vender)</li>
          <li>Estabeleça limitações (não fazer diagnósticos, não dar consultas legais)</li>
          <li>Inclua instruções sobre quando escalar para humano</li>
        </ul>
      </div>

      <Button onClick={handleSave} className="w-full">
        Salvar Prompt
      </Button>
    </div>
  );
};
