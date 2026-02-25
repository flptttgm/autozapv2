import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Calendar, Bot } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { QuoteDetailsModal } from "./QuoteDetailsModal";
import { Quote, QuoteStatus, statusConfig, formatCurrency } from "@/lib/quote-utils";
import { toast } from "sonner";

interface LeadQuotesTabProps {
  leadId: string;
}

export function LeadQuotesTab({ leadId }: LeadQuotesTabProps) {
  const queryClient = useQueryClient();
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["lead-quotes", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          lead:leads(id, name, phone)
        `)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!leadId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuoteStatus }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'accepted') updates.accepted_at = new Date().toISOString();
      if (status === 'completed') updates.completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("quotes")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Update lead score based on status change
      let scoreChange = 0;
      if (status === 'accepted') scoreChange = 25;
      else if (status === 'rejected') scoreChange = -5;

      if (scoreChange !== 0) {
        const { data: lead } = await supabase
          .from("leads")
          .select("score")
          .eq("id", leadId)
          .single();
        
        const currentScore = lead?.score || 0;
        const newScore = Math.max(0, currentScore + scoreChange);
        
        await supabase
          .from("leads")
          .update({ score: newScore, updated_at: new Date().toISOString() })
          .eq("id", leadId);
        
        console.log(`[LeadQuotesTab] Lead score updated: ${scoreChange > 0 ? '+' : ''}${scoreChange} for quote_${status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-quotes", leadId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-quotes", leadId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento excluído com sucesso");
      setModalOpen(false);
      setSelectedQuote(null);
    },
    onError: () => {
      toast.error("Erro ao excluir orçamento");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <h3 className="font-medium text-lg">Nenhum orçamento</h3>
            <p className="text-sm mt-1">
              Orçamentos serão criados automaticamente quando o cliente confirmar uma compra
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {quotes.map((quote) => (
          <Card 
            key={quote.id} 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => {
              setSelectedQuote(quote);
              setModalOpen(true);
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Orçamento
                </CardTitle>
                <Badge className={`${statusConfig[quote.status]?.color} text-white`}>
                  {statusConfig[quote.status]?.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Estimado</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(quote.estimated_value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {quote.ai_summary && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1 text-xs text-primary font-medium">
                    <Bot className="h-3 w-3" />
                    Resumo da IA
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {quote.ai_summary}
                  </p>
                </div>
              )}

              {quote.items && quote.items.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Itens ({quote.items.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {quote.items.slice(0, 3).map((item: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {typeof item === 'string' ? item : item.name || 'Item'}
                      </Badge>
                    ))}
                    {quote.items.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{quote.items.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <QuoteDetailsModal
        quote={selectedQuote}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onStatusChange={(id, status, leadId) => updateStatusMutation.mutate({ id, status })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </>
  );
}
