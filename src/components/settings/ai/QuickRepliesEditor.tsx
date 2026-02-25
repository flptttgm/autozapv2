import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuickReply {
  id?: string;
  trigger: string;
  response: string;
  enabled: boolean;
}

interface QuickRepliesEditorProps {
  quickReplies: QuickReply[];
  onUpdate: (quickReplies: QuickReply[]) => void;
}

export const QuickRepliesEditor = ({ quickReplies, onUpdate }: QuickRepliesEditorProps) => {
  const [replies, setReplies] = useState<QuickReply[]>(quickReplies.length > 0 ? quickReplies : []);

  // Validation helpers for visual feedback
  const isTriggerEmpty = (reply: QuickReply) => 
    reply.enabled && !reply.trigger?.trim();

  const isResponseEmpty = (reply: QuickReply) => 
    reply.enabled && !reply.response?.trim();

  const addReply = () => {
    const newReply: QuickReply = {
      id: Date.now().toString(),
      trigger: "",
      response: "",
      enabled: true,
    };
    setReplies([...replies, newReply]);
  };

  const removeReply = (id: string) => {
    const updated = replies.filter((r) => r.id !== id);
    setReplies(updated);
    onUpdate(updated);
  };

  const updateReply = (id: string, field: keyof QuickReply, value: any) => {
    const updated = replies.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    setReplies(updated);
  };

  const handleSave = () => {
    // Validate enabled quick replies have both trigger and response filled
    const invalidReplies = replies.filter(qr => 
      qr.enabled && (!qr.trigger?.trim() || !qr.response?.trim())
    );
    
    if (invalidReplies.length > 0) {
      toast.error('Respostas rápidas habilitadas precisam ter gatilho e resposta preenchidos');
      return;
    }
    
    onUpdate(replies);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Respostas Rápidas</h3>
        <p className="text-muted-foreground">
          Configure respostas automáticas para perguntas frequentes
        </p>
      </div>

      <div className="space-y-4">
        {replies.map((reply, index) => (
          <Card key={reply.id} className="p-4">
            <div className="flex items-start gap-3">
              <GripVertical className="w-5 h-5 text-muted-foreground mt-2 cursor-move" />
              
                <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label htmlFor={`trigger-${index}`}>Palavra-chave (trigger)</Label>
                    <Input
                      id={`trigger-${index}`}
                      value={reply.trigger}
                      onChange={(e) => updateReply(reply.id!, "trigger", e.target.value)}
                      placeholder="Ex: horário, preço, localização"
                      className={cn(
                        isTriggerEmpty(reply) && "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {isTriggerEmpty(reply) && (
                      <p className="text-xs text-destructive mt-1">Obrigatório quando habilitado</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={reply.enabled}
                      onCheckedChange={(checked) => updateReply(reply.id!, "enabled", checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeReply(reply.id!)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`response-${index}`}>Resposta</Label>
                  <Textarea
                    id={`response-${index}`}
                    value={reply.response}
                    onChange={(e) => updateReply(reply.id!, "response", e.target.value)}
                    placeholder="Digite a resposta automática..."
                    rows={3}
                    className={cn(
                      isResponseEmpty(reply) && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {isResponseEmpty(reply) && (
                    <p className="text-xs text-destructive mt-1">Obrigatório quando habilitado</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="outline" onClick={addReply} className="w-full sm:flex-1">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Resposta Rápida
        </Button>
        <Button onClick={handleSave} className="w-full sm:flex-1">
          Salvar Todas
        </Button>
      </div>
    </div>
  );
};
