import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Send, AlertTriangle, Settings } from "lucide-react";
import { format, addDays } from "date-fns";

interface Lead {
  id: string;
  name: string | null;
  phone: string;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
}

export function CreateInvoiceDialog({ open, onOpenChange, lead }: CreateInvoiceDialogProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check if PIX is configured (without is_active filter to differentiate errors)
  const { data: pixConfig, isLoading: isLoadingPix } = useQuery({
    queryKey: ["pix-config-status", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return null;
      const { data, error } = await supabase
        .from("pix_config")
        .select("*")
        .eq("workspace_id", profile.workspace_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.workspace_id && open,
  });

  const pixNotConfigured = !isLoadingPix && !pixConfig;
  const pixInactive = !isLoadingPix && pixConfig && !pixConfig.is_active;
  const pixReady = !isLoadingPix && pixConfig?.is_active;

  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    dueDate: format(addDays(new Date(), 3), "yyyy-MM-dd"),
    isRecurring: false,
    frequency: "monthly",
    sendNow: true,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.workspace_id) throw new Error("Workspace não encontrado");

      const amount = parseFloat(formData.amount.replace(",", "."));
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Valor inválido");
      }

      // Generate PIX and create invoice
      const { data, error } = await supabase.functions.invoke("generate-pix", {
        body: {
          workspaceId: profile.workspace_id,
          amount,
          description: formData.description || `Cobrança para ${lead.name || lead.phone}`,
          leadId: lead.id,
          dueDate: formData.dueDate,
          source: "manual",
          createdBy: user?.id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Create recurring invoice if enabled
      if (formData.isRecurring) {
        const { error: recurringError } = await supabase
          .from("scheduled_invoices")
          .insert({
            workspace_id: profile.workspace_id,
            lead_id: lead.id,
            amount,
            description: formData.description,
            frequency: formData.frequency,
            next_due_date: formData.dueDate,
            is_active: true,
          });

        if (recurringError) {
          console.error("Error creating recurring invoice:", recurringError);
          toast.error("Cobrança criada, mas erro ao agendar recorrência");
        }
      }

      // Send invoice via WhatsApp if enabled
      if (formData.sendNow && data.invoice) {
        const { error: sendError } = await supabase.functions.invoke("send-invoice", {
          body: { invoiceId: data.invoice.id },
        });

        if (sendError) {
          console.error("Error sending invoice:", sendError);
          toast.error("Cobrança criada, mas erro ao enviar via WhatsApp");
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["lead-invoices", lead.id] });
      toast.success(
        formData.sendNow
          ? "Cobrança criada e enviada com sucesso!"
          : "Cobrança criada com sucesso!"
      );
      onOpenChange(false);
      setFormData({
        amount: "",
        description: "",
        dueDate: format(addDays(new Date(), 3), "yyyy-MM-dd"),
        isRecurring: false,
        frequency: "monthly",
        sendNow: true,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar cobrança");
    },
  });

  const handleGoToSettings = () => {
    onOpenChange(false);
    navigate("/settings?tab=pix");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Cobrança PIX</DialogTitle>
          <DialogDescription>
            Gere e envie uma cobrança PIX para {lead.name || lead.phone}
          </DialogDescription>
        </DialogHeader>

        {/* PIX Not Configured Warning */}
        {pixNotConfigured && (
          <Alert variant="destructive" className="my-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>PIX não configurado</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">
                Você precisa configurar sua chave PIX antes de criar cobranças.
              </p>
              <Button size="sm" onClick={handleGoToSettings}>
                <Settings className="h-4 w-4 mr-2" />
                Configurar PIX
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* PIX Inactive Warning */}
        {pixInactive && (
          <Alert variant="default" className="my-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-200">PIX desativado</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3 text-yellow-700 dark:text-yellow-300">
                Sua configuração PIX está desativada. Ative para criar cobranças.
              </p>
              <Button size="sm" variant="outline" onClick={handleGoToSettings}>
                <Settings className="h-4 w-4 mr-2" />
                Ativar PIX
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          {/* Lead Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium">{lead.name || "Sem nome"}</p>
            <p className="text-sm text-muted-foreground">{lead.phone}</p>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0,00"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Mensalidade Janeiro 2026"
              rows={2}
            />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="dueDate">Vencimento</Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>

          {/* Recurring Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Cobrança Recorrente</Label>
              <p className="text-xs text-muted-foreground">
                Criar cobrança automática periódica
              </p>
            </div>
            <Switch
              checked={formData.isRecurring}
              onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
            />
          </div>

          {/* Frequency (if recurring) */}
          {formData.isRecurring && (
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData({ ...formData, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Send Now Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enviar Agora</Label>
              <p className="text-xs text-muted-foreground">
                Enviar via WhatsApp imediatamente
              </p>
            </div>
            <Switch
              checked={formData.sendNow}
              onCheckedChange={(checked) => setFormData({ ...formData, sendNow: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createInvoiceMutation.mutate()}
            disabled={createInvoiceMutation.isPending || !formData.amount || !pixReady}
          >
            {createInvoiceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {formData.sendNow ? "Criar e Enviar" : "Criar Cobrança"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
