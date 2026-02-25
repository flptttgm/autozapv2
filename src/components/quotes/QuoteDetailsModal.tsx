import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  DollarSign, 
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Bot,
  Trash2,
  Send,
  CalendarDays,
  UserPlus,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Quote, QuoteStatus, statusConfig, formatCurrencyFull } from "@/lib/quote-utils";
import { toast } from "sonner";

interface QuoteDetailsModalProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: QuoteStatus, leadId: string) => void;
  onDelete?: (id: string) => void;
}

export function QuoteDetailsModal({ quote, open, onOpenChange, onStatusChange, onDelete }: QuoteDetailsModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch recent messages from this chat
  const { data: messages } = useQuery({
    queryKey: ["quote-messages", quote?.chat_id],
    queryFn: async () => {
      if (!quote?.chat_id) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", quote.chat_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!quote?.chat_id,
  });

  // Send quote mutation
  const sendQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase.functions.invoke("send-quote", {
        body: { quoteId }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento enviado via WhatsApp!");
    },
    onError: (error) => {
      console.error("Error sending quote:", error);
      toast.error("Erro ao enviar orçamento");
    },
  });

  if (!quote) return null;

  const quoteAny = quote as any;
  const isSent = !!quoteAny.sent_at;
  const isManual = quoteAny.source === 'manual';
  const validUntil = quoteAny.valid_until ? new Date(quoteAny.valid_until) : null;
  const isExpired = validUntil && validUntil < new Date();

  const handleGoToConversation = () => {
    onOpenChange(false);
  };

  const handleGoToLead = () => {
    onOpenChange(false);
    navigate(`/leads/${quote.lead_id}`);
  };

  const handleSendQuote = () => {
    sendQuoteMutation.mutate(quote.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Detalhes do Orçamento
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4 scrollbar-hide">
          <div className="space-y-6 pb-4">
            {/* Status and Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${statusConfig[quote.status].bgColor} text-white`}>
                  {statusConfig[quote.status].label}
                </Badge>
                {isSent ? (
                  <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Send className="h-3 w-3" />
                    Enviado {quoteAny.sent_at && format(new Date(quoteAny.sent_at), "dd/MM", { locale: ptBR })}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Não enviado
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  {isManual ? <UserPlus className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                  {isManual ? 'Manual' : 'Automático'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Send button */}
                {!isSent && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleSendQuote}
                    disabled={sendQuoteMutation.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    {sendQuoteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-1" />
                    )}
                    Enviar WhatsApp
                  </Button>
                )}
                {/* Status buttons */}
                {quote.status !== 'completed' && quote.status !== 'rejected' && (
                  <>
                    {quote.status === 'accepted' ? (
                      <Button 
                        size="sm" 
                        onClick={() => onStatusChange(quote.id, 'completed', quote.lead_id)}
                        className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Concluído
                      </Button>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onStatusChange(quote.id, 'rejected', quote.lead_id)}
                          className="flex-1 sm:flex-none"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => onStatusChange(quote.id, 'accepted', quote.lead_id)}
                          className="flex-1 sm:flex-none"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Aceitar
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Validity */}
            {validUntil && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${isExpired ? 'bg-destructive/10 text-destructive' : 'bg-muted/50'}`}>
                <CalendarDays className="h-4 w-4" />
                <span>{isExpired ? 'Expirado em' : 'Válido até'}:</span>
                <span className="font-medium">{format(validUntil, "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            )}

            {/* Customer Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações do Cliente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nome</p>
                  <p className="font-medium">{quote.lead?.name || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="font-medium break-all">{quote.lead?.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Estimado</p>
                  <p className="font-medium text-green-600">{formatCurrencyFull(quote.estimated_value)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Criado em</p>
                  <p className="font-medium">
                    {format(new Date(quote.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={handleGoToLead} className="w-full sm:w-auto">
                  <User className="h-4 w-4 mr-1" />
                  Ver Lead
                </Button>
                <Button size="sm" variant="outline" onClick={handleGoToConversation} className="w-full sm:w-auto">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Ver Conversa
                </Button>
              </div>
            </div>

            {/* AI Summary */}
            {quote.ai_summary && (
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Resumo Gerado pela IA
                </h3>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{quote.ai_summary}</p>
                </div>
              </div>
            )}

            {/* Items */}
            {quote.items && quote.items.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Itens/Serviços</h3>
                <div className="space-y-2">
                  {quote.items.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{typeof item === 'string' ? item : item.name || JSON.stringify(item)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Notes */}
            {quote.customer_notes && (
              <div>
                <h3 className="font-medium mb-2">Observações do Cliente</h3>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                  {quote.customer_notes}
                </p>
              </div>
            )}

            <Separator />

            {/* Timeline */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </h3>
              <div className="space-y-3">
                <div className="flex flex-wrap items-start gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <span className="text-muted-foreground shrink-0">Criado</span>
                  <span className="font-medium">
                    {format(new Date(quote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {quote.accepted_at && (
                  <div className="flex flex-wrap items-start gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <span className="text-muted-foreground shrink-0">Aceito</span>
                    <span className="font-medium">
                      {format(new Date(quote.accepted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
                {quote.completed_at && (
                  <div className="flex flex-wrap items-start gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                    <span className="text-muted-foreground shrink-0">Concluído</span>
                    <span className="font-medium">
                      {format(new Date(quote.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Messages Preview */}
            {messages && messages.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Últimas Mensagens
                  </h3>
                  <div className="space-y-2">
                    {messages.slice(0, 5).map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2 rounded-lg text-sm ${
                          msg.direction === "inbound" ? "bg-muted" : "bg-primary/10"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {msg.direction === "inbound" ? (
                            <User className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Bot className="h-3 w-3 text-primary" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {msg.direction === "inbound" ? "Cliente" : "IA"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.created_at!), "dd/MM HH:mm")}
                          </span>
                        </div>
                        <p className="line-clamp-2">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Delete Button */}
            {onDelete && (
              <>
                <Separator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Orçamento
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O orçamento será permanentemente removido do sistema.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(quote.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
