import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  User,
  Calendar,
  DollarSign,
  Loader2,
  Plus,
  Send,
  Clock,
  Bot,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QuoteDetailsModal } from "@/components/quotes/QuoteDetailsModal";
import { CreateQuoteDialog } from "@/components/quotes/CreateQuoteDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Quote,
  QuoteStatus,
  statusConfig,
  formatCurrency,
} from "@/lib/quote-utils";
import { toast } from "sonner";

const Quotes = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes", profile?.workspace_id, statusFilter],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];

      let query = supabase
        .from("quotes")
        .select(
          `
          *,
          lead:leads(id, name, phone)
        `,
        )
        .eq("workspace_id", profile.workspace_id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!profile?.workspace_id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      leadId,
    }: {
      id: string;
      status: QuoteStatus;
      leadId: string;
    }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === "accepted") updates.accepted_at = new Date().toISOString();
      if (status === "completed")
        updates.completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("quotes")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Update lead score based on status change
      let scoreChange = 0;
      if (status === "accepted") scoreChange = 25;
      else if (status === "rejected") scoreChange = -5;

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

        console.log(
          `[Quotes] Lead score updated: ${scoreChange > 0 ? "+" : ""}${scoreChange} for quote_${status}`,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento excluído com sucesso");
      setModalOpen(false);
      setSelectedQuote(null);
    },
    onError: () => {
      toast.error("Erro ao excluir orçamento");
    },
  });

  const filteredQuotes = quotes?.filter((quote) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      quote.lead?.name?.toLowerCase().includes(searchLower) ||
      quote.lead?.phone?.includes(search) ||
      quote.ai_summary?.toLowerCase().includes(searchLower)
    );
  });

  const statusCounts = {
    all: quotes?.length || 0,
    pending: quotes?.filter((q) => q.status === "pending").length || 0,
    negotiating: quotes?.filter((q) => q.status === "negotiating").length || 0,
    accepted: quotes?.filter((q) => q.status === "accepted").length || 0,
    completed: quotes?.filter((q) => q.status === "completed").length || 0,
    rejected: quotes?.filter((q) => q.status === "rejected").length || 0,
  };

  const handleOpenQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 relative min-h-screen">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] ambient-glow-primary blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3 z-0" />
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] ambient-glow-secondary blur-[120px] rounded-full pointer-events-none -translate-x-1/3 z-0" />

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" />
              Orçamentos
            </h1>
            <p className="text-muted-foreground mt-1">
              Crie, envie e acompanhe seus orçamentos
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(statusCounts)
            .filter(([key]) => key !== "all")
            .map(([status, count]) => {
              const config = statusConfig[status as QuoteStatus];
              const iconBgColor =
                {
                  pending: "bg-amber-500/20",
                  negotiating: "bg-blue-500/20",
                  accepted: "bg-emerald-500/20",
                  completed: "bg-purple-500/20",
                  rejected: "bg-rose-500/20",
                }[status] || "bg-primary/20";

              return (
                <Card
                  key={status}
                  className="bg-card/40 border-border/40 backdrop-blur-md shadow-sm hover:bg-card/60 hover:border-primary/30 cursor-pointer transition-all duration-300"
                  onClick={() => setStatusFilter(status as QuoteStatus)}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground truncate">
                        {config?.label}
                      </span>
                      <div className={`p-2 rounded-xl ${iconBgColor}`}>
                        {config?.icon}
                      </div>
                    </div>
                    <span className="text-3xl font-bold text-foreground">
                      {count}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou resumo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as QuoteStatus | "all")}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({statusCounts.all})</SelectItem>
              <SelectItem value="pending">
                Pendentes ({statusCounts.pending})
              </SelectItem>
              <SelectItem value="negotiating">
                Em Negociação ({statusCounts.negotiating})
              </SelectItem>
              <SelectItem value="accepted">
                Aceitos ({statusCounts.accepted})
              </SelectItem>
              <SelectItem value="completed">
                Concluídos ({statusCounts.completed})
              </SelectItem>
              <SelectItem value="rejected">
                Rejeitados ({statusCounts.rejected})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quotes List */}
        <Card className="glass border-border/40 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredQuotes && filteredQuotes.length > 0 ? (
              <ScrollArea className={isMobile ? "h-[60vh]" : "h-[65vh]"}>
                <div className="divide-y">
                  {filteredQuotes.map((quote) => {
                    const quoteAny = quote as any;
                    const isSent = !!quoteAny.sent_at;
                    const isManual = quoteAny.source === "manual";
                    const validUntil = quoteAny.valid_until
                      ? new Date(quoteAny.valid_until)
                      : null;
                    const isExpired = validUntil && validUntil < new Date();

                    return (
                      <div
                        key={quote.id}
                        className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleOpenQuote(quote)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium truncate">
                                  {quote.lead?.name || "Cliente sem nome"}
                                </h3>
                                <Badge
                                  className={`${statusConfig[quote.status]?.color} text-white text-xs`}
                                >
                                  {statusConfig[quote.status]?.label}
                                </Badge>
                                {/* Sent indicator */}
                                {isSent ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  >
                                    <Send className="h-3 w-3" />
                                    Enviado
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-xs gap-1 text-muted-foreground"
                                  >
                                    <Clock className="h-3 w-3" />
                                    Não enviado
                                  </Badge>
                                )}
                                {/* Source indicator */}
                                <Badge
                                  variant="outline"
                                  className="text-xs gap-1"
                                >
                                  {isManual ? (
                                    <>
                                      <UserPlus className="h-3 w-3" />
                                      Manual
                                    </>
                                  ) : (
                                    <>
                                      <Bot className="h-3 w-3" />
                                      Auto
                                    </>
                                  )}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {quote.lead?.phone}
                              </p>
                              {quote.ai_summary && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {quote.ai_summary}
                                </p>
                              )}
                              {validUntil && (
                                <p
                                  className={`text-xs mt-1 ${isExpired ? "text-destructive" : "text-muted-foreground"}`}
                                >
                                  {isExpired ? "Expirado em" : "Válido até"}:{" "}
                                  {format(validUntil, "dd/MM/yyyy", {
                                    locale: ptBR,
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground sm:flex-col sm:items-end">
                            {quote.estimated_value && (
                              <div className="flex items-center gap-1 text-green-600 font-medium">
                                <DollarSign className="h-4 w-4" />
                                {formatCurrency(quote.estimated_value)}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDistanceToNow(new Date(quote.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg">
                  Nenhum orçamento encontrado
                </h3>
                <p className="text-muted-foreground text-sm mt-1 mb-4">
                  Crie seu primeiro orçamento ou aguarde a IA detectar
                  automaticamente
                </p>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Orçamento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quote Details Modal */}
        <QuoteDetailsModal
          quote={selectedQuote}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onStatusChange={(id, status, leadId) =>
            updateStatusMutation.mutate({ id, status, leadId })
          }
          onDelete={(id) => deleteMutation.mutate(id)}
        />

        {/* Create Quote Dialog */}
        <CreateQuoteDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>
    </div>
  );
};

export default Quotes;
