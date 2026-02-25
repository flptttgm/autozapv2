import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Send, CheckCircle2, XCircle, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

import { BestPracticesPanel } from "./broadcast/BestPracticesPanel";
import { RecipientWarnings } from "./broadcast/RecipientWarnings";
import { SendingProgress } from "./broadcast/SendingProgress";
import { 
  getRandomDelay, 
  getEstimatedTime 
} from "./broadcast/constants";

const PRACTICES_DISMISSED_KEY = 'broadcast_practices_dismissed';

interface Lead {
  id: string;
  name: string | null;
  phone: string;
}

interface BroadcastMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeads: Lead[];
  onComplete: () => void;
}

interface SendResult {
  leadId: string;
  leadName: string;
  success: boolean;
  error?: string;
}

export const BroadcastMessageDialog = ({
  open,
  onOpenChange,
  selectedLeads,
  onComplete,
}: BroadcastMessageDialogProps) => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextDelayMs, setNextDelayMs] = useState<number | null>(null);
  const [step, setStep] = useState<'practices' | 'compose'>(() => {
    const dismissed = localStorage.getItem(PRACTICES_DISMISSED_KEY);
    return dismissed === 'true' ? 'compose' : 'practices';
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { profile } = useAuth();

  const resetState = () => {
    setMessage("");
    setIsSending(false);
    setResults([]);
    setProgress(0);
    setCurrentIndex(0);
    setNextDelayMs(null);
    // Reset step based on localStorage preference
    const dismissed = localStorage.getItem(PRACTICES_DISMISSED_KEY);
    setStep(dismissed === 'true' ? 'compose' : 'practices');
    setDontShowAgain(false);
  };

  const handleAcknowledgePractices = () => {
    if (dontShowAgain) {
      localStorage.setItem(PRACTICES_DISMISSED_KEY, 'true');
    }
    setStep('compose');
  };

  const handleClose = () => {
    if (!isSending) {
      resetState();
      onOpenChange(false);
    }
  };

  const estimatedTime = getEstimatedTime(selectedLeads.length);

  const sendBroadcast = async () => {
    if (!message.trim()) {
      toast.error("Digite uma mensagem para enviar");
      return;
    }

    if (selectedLeads.length === 0) {
      toast.error("Nenhum lead selecionado");
      return;
    }

    // Removed hard limit blocking - Z-API says quality matters, not quantity

    setIsSending(true);
    setResults([]);
    setProgress(0);
    setCurrentIndex(0);

    const newResults: SendResult[] = [];
    const total = selectedLeads.length;

    // Get a connected instance for this workspace
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_id")
      .eq("workspace_id", profile?.workspace_id)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!instance) {
      toast.error("Nenhuma conexão WhatsApp ativa. Conecte seu WhatsApp primeiro.");
      setIsSending(false);
      return;
    }

    for (let i = 0; i < selectedLeads.length; i++) {
      const lead = selectedLeads[i];
      setCurrentIndex(i + 1);

      try {
        const { data, error } = await supabase.functions.invoke("send-message", {
          body: {
            chat_id: lead.phone,
            message: message.trim(),
            lead_id: lead.id,
            is_manual: true,
            instance_id: instance.instance_id,
            metadata: {
              broadcast: true,
              broadcast_timestamp: new Date().toISOString(),
            },
          },
        });

        if (error) throw error;

        newResults.push({
          leadId: lead.id,
          leadName: lead.name || lead.phone,
          success: true,
        });
      } catch (error: any) {
        console.error(`Error sending to ${lead.phone}:`, error);
        newResults.push({
          leadId: lead.id,
          leadName: lead.name || lead.phone,
          success: false,
          error: error.message || "Erro desconhecido",
        });
      }

      setResults([...newResults]);
      setProgress(((i + 1) / total) * 100);

      // Safe delay between messages (12-20 seconds randomized)
      if (i < selectedLeads.length - 1) {
        const delay = getRandomDelay();
        setNextDelayMs(delay);
        await new Promise((resolve) => setTimeout(resolve, delay));
        setNextDelayMs(null);
      }
    }

    setIsSending(false);

    const successCount = newResults.filter((r) => r.success).length;
    const failCount = newResults.filter((r) => !r.success).length;

    if (failCount === 0) {
      toast.success(`Mensagem enviada para ${successCount} contatos!`);
    } else if (successCount === 0) {
      toast.error(`Falha ao enviar para todos os ${failCount} contatos`);
    } else {
      toast.warning(`Enviado: ${successCount} | Falhou: ${failCount}`);
    }
  };

  const handleDone = () => {
    resetState();
    onComplete();
    onOpenChange(false);
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar mensagem em massa</DialogTitle>
        </DialogHeader>

        {results.length === 0 ? (
          step === 'practices' ? (
            // Step 1: Best practices
            <div className="space-y-4 py-4">
              <BestPracticesPanel />

              <div className="flex items-center space-x-2 pt-2 border-t">
                <Checkbox
                  id="dontShowAgain"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                />
                <label
                  htmlFor="dontShowAgain"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Não mostrar novamente
                </label>
              </div>
            </div>
          ) : (
            // Step 2: Compose message
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                A mensagem será enviada para{" "}
                <span className="font-semibold text-foreground">
                  {selectedLeads.length} contato{selectedLeads.length > 1 ? "s" : ""}
                </span>
                {selectedLeads.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}(~{estimatedTime} min)
                  </span>
                )}
              </p>

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite a mensagem que será enviada..."
                  rows={5}
                  disabled={isSending}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  💡 Use <code className="bg-muted px-1 rounded">{"{userName}"}</code> para inserir o nome do contato
                </p>
              </div>

              {/* Simplified warnings - only critical ones */}
              <RecipientWarnings 
                recipientCount={selectedLeads.length} 
                message={message} 
              />

              {isSending && (
                <SendingProgress
                  progress={progress}
                  current={currentIndex}
                  total={selectedLeads.length}
                  nextDelayMs={nextDelayMs}
                />
              )}
            </div>
          )
        ) : (
          // Results view
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="font-medium">{successCount} enviados</span>
              </div>
              {failCount > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="font-medium">{failCount} falharam</span>
                </div>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {results.map((result) => (
                <div
                  key={result.leadId}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg text-sm",
                    result.success
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  <span className="truncate">{result.leadName}</span>
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {results.length === 0 ? (
            step === 'practices' ? (
              // Step 1 footer
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleAcknowledgePractices}>
                  Li e entendi
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            ) : (
              // Step 2 footer
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setStep('practices')} 
                  disabled={isSending}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button 
                  onClick={sendBroadcast} 
                  disabled={isSending || !message.trim()}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar para {selectedLeads.length}
                    </>
                  )}
                </Button>
              </>
            )
          ) : (
            <Button onClick={handleDone}>Concluir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
