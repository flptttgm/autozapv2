import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, CreditCard, Clock, AlertTriangle, XCircle, Zap, Rocket, Building, Eye, Users, MessageSquare, Phone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WorkspaceDetailsModal } from "@/components/admin/WorkspaceDetailsModal";

// Format phone number for display
const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  } else if (cleaned.length === 12) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }
  return phone;
};

// Interface matching the updated RPC return type
interface DetailedSubscription {
  subscription_id: string;
  workspace_id: string;
  workspace_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  plan_type: string;
  status: string;
  effective_status: string;
  billing_cycle: string | null;
  connections_limit: number;
  connections_extra: number;
  members_limit: number;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string;
  days_until_expiration: number | null;
  is_in_grace_period: boolean;
  grace_period_end: string | null;
  lead_count: number;
  message_count: number;
  whatsapp_phone: string | null;
}

// Type for WorkspaceDetailsModal compatibility
interface WorkspaceForModal {
  id: string;
  name: string | null;
  created_at: string | null;
  owner_email: string | null;
  owner_name: string | null;
  lead_count: number;
  message_count: number;
  subscription_status: string | null;
  plan_type: string | null;
}

interface SubscriptionStats {
  active: number;
  grace_period: number;
  expired: number;
  canceled: number;
  trial: number;
  start: number;
  pro: number;
  business: number;
}

export default function AdminSubscriptions() {
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceForModal | null>(null);

  // Fetch detailed subscriptions
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["admin-subscriptions-detailed"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_subscriptions_detailed");
      if (error) throw error;
      return data as DetailedSubscription[];
    },
  });

  // Calculate stats from subscriptions
  const stats: SubscriptionStats = subscriptions?.reduce(
    (acc, sub) => {
      // Status counts
      if (sub.effective_status === "active") acc.active++;
      else if (sub.effective_status === "grace_period") acc.grace_period++;
      else if (sub.effective_status === "expired") acc.expired++;
      else if (sub.effective_status === "canceled") acc.canceled++;

      // Plan counts
      if (sub.plan_type === "trial") acc.trial++;
      else if (sub.plan_type === "start") acc.start++;
      else if (sub.plan_type === "pro") acc.pro++;
      else if (sub.plan_type === "business") acc.business++;

      return acc;
    },
    { active: 0, grace_period: 0, expired: 0, canceled: 0, trial: 0, start: 0, pro: 0, business: 0 }
  ) || { active: 0, grace_period: 0, expired: 0, canceled: 0, trial: 0, start: 0, pro: 0, business: 0 };

  // Filter subscriptions
  const filteredSubscriptions = subscriptions?.filter((sub) => {
    const matchesPlan = planFilter === "all" || sub.plan_type === planFilter;
    const matchesStatus = statusFilter === "all" || sub.effective_status === statusFilter;
    const matchesSearch =
      searchQuery === "" ||
      sub.owner_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.workspace_name?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesPlan && matchesStatus && matchesSearch;
  });

  const getPlanBadge = (planType: string) => {
    switch (planType) {
      case "trial":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Trial</Badge>;
      case "start":
        return <Badge className="bg-blue-500/10 text-blue-500 gap-1"><Zap className="h-3 w-3" /> Start</Badge>;
      case "pro":
        return <Badge className="bg-purple-500/10 text-purple-500 gap-1"><Rocket className="h-3 w-3" /> Pro</Badge>;
      case "business":
        return <Badge className="bg-amber-500/10 text-amber-500 gap-1"><Building className="h-3 w-3" /> Business</Badge>;
      default:
        return <Badge variant="outline">{planType}</Badge>;
    }
  };

  const getEffectiveStatusBadge = (sub: DetailedSubscription) => {
    const graceDaysLeft = sub.grace_period_end 
      ? Math.max(0, Math.ceil((new Date(sub.grace_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    switch (sub.effective_status) {
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-500">Ativo</Badge>;
      case "grace_period":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Grace ({graceDaysLeft}d)
          </Badge>
        );
      case "expiring_soon":
        if (sub.plan_type === "trial") {
          return (
            <Badge className="bg-amber-500/10 text-amber-500 gap-1">
              <Clock className="h-3 w-3" />
              Trial Ativo
            </Badge>
          );
        }
        return (
          <Badge className="bg-amber-500/10 text-amber-500 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Expira em breve
          </Badge>
        );
      case "expired":
        if (sub.plan_type === "trial") {
          return (
            <Badge className="bg-slate-500/10 text-slate-500 gap-1">
              <Clock className="h-3 w-3" />
              Trial Expirado
            </Badge>
          );
        }
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Expirado
          </Badge>
        );
      case "canceled":
        return (
          <Badge variant="outline" className="gap-1">
            <XCircle className="h-3 w-3" />
            Cancelado
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Inadimplente
          </Badge>
        );
      default:
        return <Badge variant="outline">{sub.effective_status}</Badge>;
    }
  };

  const getDaysRemainingText = (days: number | null) => {
    if (days === null) return "-";
    if (days > 0) return <span className="text-emerald-500">{days} dias</span>;
    if (days === 0) return <span className="text-amber-500">Hoje</span>;
    return <span className="text-destructive">{Math.abs(days)} dias atrás</span>;
  };

  const handleViewWorkspace = (sub: DetailedSubscription) => {
    setSelectedWorkspace({
      id: sub.workspace_id,
      name: sub.workspace_name,
      created_at: sub.created_at,
      owner_email: sub.owner_email,
      owner_name: sub.owner_name,
      lead_count: sub.lead_count,
      message_count: sub.message_count,
      subscription_status: sub.status,
      plan_type: sub.plan_type,
    });
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Assinaturas</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Gerencie os planos e assinaturas dos workspaces
          </p>
        </div>

        {/* Stats Cards - Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === "active" ? "border-emerald-500" : "hover:border-emerald-500/50"}`} 
            onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ativas</p>
                  <p className="text-2xl font-bold text-emerald-500">{stats.active}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === "grace_period" ? "border-amber-500" : "hover:border-amber-500/50"}`}
            onClick={() => setStatusFilter(statusFilter === "grace_period" ? "all" : "grace_period")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Grace Period</p>
                  <p className="text-2xl font-bold text-amber-500">{stats.grace_period}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === "expired" ? "border-destructive" : "hover:border-destructive/50"}`}
            onClick={() => setStatusFilter(statusFilter === "expired" ? "all" : "expired")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expiradas</p>
                  <p className="text-2xl font-bold text-destructive">{stats.expired}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === "canceled" ? "border-muted-foreground" : "hover:border-muted-foreground/50"}`}
            onClick={() => setStatusFilter(statusFilter === "canceled" ? "all" : "canceled")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Canceladas</p>
                  <p className="text-2xl font-bold text-muted-foreground">{stats.canceled}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards - Plans */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            className={`cursor-pointer transition-colors ${planFilter === "trial" ? "border-secondary" : "hover:border-secondary/50"}`}
            onClick={() => setPlanFilter(planFilter === "trial" ? "all" : "trial")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Trial</p>
                  <p className="text-2xl font-bold">{stats.trial}</p>
                </div>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${planFilter === "start" ? "border-blue-500" : "hover:border-blue-500/50"}`}
            onClick={() => setPlanFilter(planFilter === "start" ? "all" : "start")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Start</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.start}</p>
                </div>
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${planFilter === "pro" ? "border-purple-500" : "hover:border-purple-500/50"}`}
            onClick={() => setPlanFilter(planFilter === "pro" ? "all" : "pro")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pro</p>
                  <p className="text-2xl font-bold text-purple-500">{stats.pro}</p>
                </div>
                <Rocket className="h-5 w-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${planFilter === "business" ? "border-amber-500" : "hover:border-amber-500/50"}`}
            onClick={() => setPlanFilter(planFilter === "business" ? "all" : "business")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Business</p>
                  <p className="text-2xl font-bold text-amber-500">{stats.business}</p>
                </div>
                <Building className="h-5 w-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, nome ou workspace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos planos</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="start">Start</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="grace_period">Grace Period</SelectItem>
              <SelectItem value="expired">Expiradas</SelectItem>
              <SelectItem value="canceled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          {filteredSubscriptions?.length || 0} assinaturas encontradas
        </p>

        {/* Table */}
        <Card>
          <ScrollArea className="w-full whitespace-nowrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Usuário</TableHead>
                  <TableHead className="min-w-[120px]">Workspace</TableHead>
                  <TableHead className="min-w-[100px]">Plano</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> WhatsApp
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[60px] text-center">
                    <span className="flex items-center gap-1 justify-center">
                      <Users className="h-3 w-3" /> Leads
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[60px] text-center">
                    <span className="flex items-center gap-1 justify-center">
                      <MessageSquare className="h-3 w-3" /> Msgs
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[80px]">Ciclo</TableHead>
                  <TableHead className="min-w-[100px]">Prazo</TableHead>
                  <TableHead className="min-w-[100px]">Criado em</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 11 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredSubscriptions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      Nenhuma assinatura encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscriptions?.map((sub) => (
                    <TableRow key={sub.subscription_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.owner_name || "-"}</p>
                          <p className="text-sm text-muted-foreground">{sub.owner_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="truncate max-w-[120px]">{sub.workspace_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPlanBadge(sub.plan_type)}
                        </div>
                      </TableCell>
                      <TableCell>{getEffectiveStatusBadge(sub)}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {sub.whatsapp_phone ? formatPhone(sub.whatsapp_phone) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center">{sub.lead_count || 0}</TableCell>
                      <TableCell className="text-center">{sub.message_count || 0}</TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">
                          {sub.billing_cycle === "monthly" ? "Mensal" : sub.billing_cycle === "annual" ? "Anual" : "-"}
                        </span>
                      </TableCell>
                      <TableCell>{getDaysRemainingText(sub.days_until_expiration)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(sub.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewWorkspace(sub)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      </div>

      <WorkspaceDetailsModal
        workspace={selectedWorkspace}
        open={!!selectedWorkspace}
        onClose={() => setSelectedWorkspace(null)}
      />
    </AdminLayout>
  );
}
