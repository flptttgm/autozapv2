import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { 
  User, Bot, Heart, Star, Zap, Coffee, 
  MessageCircle, Sparkles, Shield, Target, 
  Award, Crown, Lightbulb, Rocket
} from "lucide-react";

const iconOptions = [
  { id: "user", icon: User, label: "Usuário" },
  { id: "bot", icon: Bot, label: "Bot" },
  { id: "heart", icon: Heart, label: "Coração" },
  { id: "star", icon: Star, label: "Estrela" },
  { id: "zap", icon: Zap, label: "Raio" },
  { id: "coffee", icon: Coffee, label: "Café" },
  { id: "message-circle", icon: MessageCircle, label: "Mensagem" },
  { id: "sparkles", icon: Sparkles, label: "Brilhos" },
  { id: "shield", icon: Shield, label: "Escudo" },
  { id: "target", icon: Target, label: "Alvo" },
  { id: "award", icon: Award, label: "Prêmio" },
  { id: "crown", icon: Crown, label: "Coroa" },
  { id: "lightbulb", icon: Lightbulb, label: "Ideia" },
  { id: "rocket", icon: Rocket, label: "Foguete" },
];

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string, icon: string) => void;
  isLoading?: boolean;
  defaultName?: string;
}

export const SaveTemplateDialog = ({ 
  open, 
  onOpenChange, 
  onSave, 
  isLoading,
  defaultName = ""
}: SaveTemplateDialogProps) => {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("star");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), description.trim(), selectedIcon);
    // Reset form
    setName("");
    setDescription("");
    setSelectedIcon("star");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setDescription("");
      setSelectedIcon("star");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Template</DialogTitle>
          <DialogDescription>
            Salve suas configurações atuais como um template reutilizável.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Nome do Template *</Label>
            <Input
              id="template-name"
              placeholder="Ex: Assistente Amanda"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Descrição (opcional)</Label>
            <Textarea
              id="template-description"
              placeholder="Ex: Configuração para atendimento de clínica médica"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="grid grid-cols-7 gap-2">
              {iconOptions.map((option) => {
                const IconComponent = option.icon;
                const isSelected = selectedIcon === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedIcon(option.id)}
                    className={cn(
                      "p-2 rounded-lg border-2 transition-all hover:bg-muted",
                      isSelected 
                        ? "border-primary bg-primary/10" 
                        : "border-transparent"
                    )}
                    title={option.label}
                  >
                    <IconComponent className="w-5 h-5 mx-auto" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isLoading}>
            {isLoading ? "Salvando..." : "Salvar Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
