import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { toast } from "sonner";
import { Search, Receipt, AlertCircle, Settings, List, Clock, Send, CheckCircle, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type InvoiceStatus = "all" | "pending" | "sent" | "paid" | "overdue" | "canceled";

interface Invoice {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  amount: number;
  description: string | null;
  due_date: string;
  status: string;
  pix_code: string | null;
  pix_qr_code: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  source: string;
  lead?: {
    id: string;
    name: string | null;
    phone: string;
  } | null;
}

export default function Invoices() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Check if PIX is configured
  const { data: pixConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["pix-config", profile?.workspace_id],
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
    enabled: !!profile?.workspace_id,
  });

  // Fetch invoices
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", profile?.workspace_id, statusFilter],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];

      let query = supabase
        .from("invoices")
        .select(`
          *,
          lead:leads(id, name, phone)
        `)
        .eq("workspace_id", profile.workspace_id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!profile?.workspace_id,
  });

  // Resend invoice mutation
  const resendMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.functions.invoke("send-invoice", {
        body: { invoiceId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Cobrança enviada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao enviar cobrança");
    },
  });

  // Mark as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Cobrança marcada como paga!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar cobrança");
    },
  });

  // Cancel invoice mutation
  const cancelMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "canceled" })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Cobrança cancelada!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao cancelar cobrança");
    },
  });

  // Filter invoices by search
  const filteredInvoices = invoices?.filter((invoice) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      invoice.lead?.name?.toLowerCase().includes(searchLower) ||
      invoice.lead?.phone?.includes(searchQuery) ||
      invoice.description?.toLowerCase().includes(searchLower)
    );
  });

  // Calculate stats
  const stats = {
    pending: invoices?.filter((i) => i.status === "pending").length || 0,
    sent: invoices?.filter((i) => i.status === "sent").length || 0,
    paid: invoices?.filter((i) => i.status === "paid").length || 0,
    overdue: invoices?.filter((i) => i.status === "overdue").length || 0,
  };

  // Don't show loading skeleton if user is not authenticated
  // Let ProtectedRoute handle the redirect to /auth
  if (!profile) {
    return null;
  }

  if (isLoadingConfig) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Show configuration prompt if PIX not configured
  if (!pixConfig) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">Cobranças</h1>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configure sua Chave PIX</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-4">
              Para enviar cobranças via WhatsApp, você precisa primeiro configurar sua chave PIX.
            </p>
            <Button asChild>
              <Link to="/settings?tab=pix">
                <Settings className="h-4 w-4 mr-2" />
                Configurar PIX
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="relative p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 min-h-screen overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3 z-0" />
      <div className="absolute top-[40%] left-0 w-[400px] h-[400px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none -translate-x-1/3 z-0" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Cobranças</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas cobranças PIX via WhatsApp
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="glass border-border/40 shadow-sm rounded-xl p-4">
            <p className="text-2xl font-bold">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </div>
          <div className="glass border-border/40 shadow-sm rounded-xl p-4">
            <p className="text-2xl font-bold text-blue-500">{stats.sent}</p>
            <p className="text-sm text-muted-foreground">Enviadas</p>
          </div>
          <div className="glass border-border/40 shadow-sm rounded-xl p-4">
            <p className="text-2xl font-bold text-green-500">{stats.paid}</p>
            <p className="text-sm text-muted-foreground">Pagas</p>
          </div>
          <div className="glass border-border/40 shadow-sm rounded-xl p-4">
            <p className="text-2xl font-bold text-red-500">{stats.overdue}</p>
            <p className="text-sm text-muted-foreground">Vencidas</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus)} className="w-full">
            <TabsList className="w-full bg-muted/40 backdrop-blur-md border border-border/50 shadow-sm p-1 rounded-xl">
              <TabsTrigger value="all" className="gap-1.5 flex-1 data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Todas</span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5 flex-1 data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Pendentes</span>
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-1.5 flex-1 data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Enviadas</span>
              </TabsTrigger>
              <TabsTrigger value="paid" className="gap-1.5 flex-1 data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg">
                <CheckCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Pagas</span>
              </TabsTrigger>
              <TabsTrigger value="overdue" className="gap-1.5 flex-1 data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">Vencidas</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Invoice List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filteredInvoices?.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma cobrança encontrada</h3>
            {statusFilter === "all" && (
              <p className="text-muted-foreground mb-4">
                Acesse um lead para enviar sua primeira cobrança PIX.
              </p>
            )}
            <Button asChild variant="outline">
              <Link to="/leads">Ver Leads</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInvoices?.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onResend={(id) => resendMutation.mutate(id)}
                onMarkPaid={(id) => markPaidMutation.mutate(id)}
                onCancel={(id) => cancelMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
