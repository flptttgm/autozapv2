import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, User, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { QuoteStatus, statusConfig, formatCurrency } from "@/lib/quote-utils";
import { cn } from "@/lib/utils";

interface RecentQuotesProps {
  className?: string;
}

export function RecentQuotes({ className }: RecentQuotesProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["recent-quotes", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];

      // @ts-ignore - Ignore type error as Supabase type generation is failing locally
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          lead:leads(id, name, phone)
        `)
        .eq("workspace_id", profile.workspace_id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.workspace_id,
  });

  if (isLoading) {
    return (
      <Card className={cn("flex flex-col border-border shadow-none overflow-hidden", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-md bg-orange-500/20 shrink-0">
                <FileText className="h-3.5 w-3.5 text-orange-400" />
              </div>
              <span className="truncate">Orçamentos Recentes</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col border-border shadow-sm overflow-hidden relative", className)}>
      <div className="absolute -top-10 -left-10 w-[200px] h-[200px] bg-orange-500/5 rounded-full blur-[80px] -z-10 pointer-events-none" />
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <CardTitle className="text-xl font-bold flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 shrink-0">
              <FileText className="h-4 w-4 text-orange-400" />
            </div>
            <span className="truncate">Orçamentos Recentes</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/quotes")}
            className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 group"
          >
            Ver todos
            <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-6 pb-4 z-10 relative">
        {quotes && quotes.length > 0 ? (
          <ScrollArea className="h-full max-h-[280px]">
            <div className="space-y-3 pr-4">
              {quotes.map((quote: any) => (
                <div
                  key={quote.id}
                  className="flex items-start gap-4 p-4 rounded-xl border border-transparent hover:border-border hover:bg-muted/50 cursor-pointer transition-all duration-300 group"
                  onClick={() => navigate("/quotes")}
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:bg-purple-500/20 transition-colors">
                    <User className="h-4 w-4 text-purple-400" />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    {/* Linha 1: Nome + Badge + Data */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm truncate max-w-[100px] xl:max-w-[140px] text-foreground group-hover:text-primary transition-colors">
                        {quote.lead?.name || "Cliente"}
                      </span>
                      <Badge className={cn(
                        "text-[10px] px-2 py-0.5 h-auto font-medium rounded-sm border",
                        statusConfig[quote.status as QuoteStatus]?.color.replace('bg-', 'bg-opacity-20 text-').replace('text-white', '')
                      )}>
                        {statusConfig[quote.status as QuoteStatus]?.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0 font-medium px-2 py-0.5 rounded-full bg-muted">
                        {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>

                    {/* Linha 2: Resumo */}
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {quote.ai_summary || "Aguardando resumo..."}
                    </p>
                  </div>

                  {/* Valor (se existir) */}
                  {quote.estimated_value && (
                    <div className="flex items-center h-full">
                      <span className="text-sm font-bold text-emerald-400 shrink-0 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                        {formatCurrency(quote.estimated_value)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-10 flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">Nenhum orçamento registrado ainda</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
