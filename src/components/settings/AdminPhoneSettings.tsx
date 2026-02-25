import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Smartphone, MessageSquare, Trash2, Loader2, Info } from "lucide-react";
import { useAdminPhone } from "@/hooks/useAdminPhone";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Format phone for display: +55 (11) 99999-9999
const formatPhoneDisplay = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  } else if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  
  return phone;
};

const EXAMPLE_QUESTIONS = [
  "quantos leads hoje?",
  "agendamentos de amanhã",
  "orçamentos pendentes",
  "resumo do dia",
  "últimos 5 leads",
];

export const AdminPhoneSettings = () => {
  const {
    adminPhone,
    isLoading,
    savePhone,
    isSaving,
    toggleActive,
    isToggling,
    deletePhone,
    isDeleting,
  } = useAdminPhone();

  const [phone, setPhone] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (adminPhone?.phone) {
      setPhone(formatPhoneDisplay(adminPhone.phone));
    }
  }, [adminPhone?.phone]);

  const handleSave = () => {
    savePhone(phone);
    setIsEditing(false);
  };

  const handlePhoneChange = (value: string) => {
    // Allow only digits, spaces, parentheses, and dashes
    const cleaned = value.replace(/[^\d\s()-+]/g, "");
    setPhone(cleaned);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">WhatsApp Pessoal (Modo Admin)</h2>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Cadastre seu WhatsApp pessoal para consultar dados do AutoZap
                diretamente pelo celular. Envie mensagens para o número da sua
                instância e receba respostas com dados reais.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Consulte leads, agendamentos e métricas diretamente pelo WhatsApp.
      </p>

      <div className="space-y-4">
        {/* Phone Input */}
        <div className="space-y-2">
          <Label htmlFor="admin-phone">Seu WhatsApp</Label>
          <div className="flex gap-2">
            <Input
              id="admin-phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              disabled={adminPhone && !isEditing}
              className="flex-1"
            />
            {adminPhone && !isEditing ? (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                Editar
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isSaving || !phone.replace(/\D/g, "").length}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Status and Controls */}
        {adminPhone && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-3">
              <Switch
                checked={adminPhone.is_active}
                onCheckedChange={(checked) => toggleActive(checked)}
                disabled={isToggling}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm">Modo Admin</span>
                <Badge variant={adminPhone.is_active ? "default" : "secondary"}>
                  {adminPhone.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover número admin?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você não poderá mais consultar dados pelo WhatsApp até
                    cadastrar um novo número.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletePhone()}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Removendo..." : "Remover"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Example Questions */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Exemplos de perguntas:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((question) => (
              <Badge key={question} variant="outline" className="text-xs">
                "{question}"
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};
