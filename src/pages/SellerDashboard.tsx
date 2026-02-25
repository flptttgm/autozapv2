import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSeller } from "@/hooks/useSeller";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import { SellerMetricsCards } from "@/components/seller/SellerMetricsCards";
import { SellerLinkShare } from "@/components/seller/SellerLinkShare";
import { SellerSalesTable } from "@/components/seller/SellerSalesTable";
import {
  Loader2,
  LogOut,
  User,
  ChevronDown,
  Home,
  RefreshCw,
  Settings,
  DollarSign,
} from "lucide-react";

const SellerDashboard = () => {
  const { user } = useAuth();
  const { seller, sales, stats, isLoading, refetchSales } = useSeller();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/vendedores");
  };

  const handleRefresh = () => {
    refetchSales();
    toast.success("Dados atualizados!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Erro ao carregar dados do vendedor.</p>
          <Button onClick={() => navigate("/vendedores/login")}>Voltar ao Login</Button>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Logo size="sm" />
            </Link>
            <Badge variant="outline" className="hidden sm:flex">
              <DollarSign className="h-3 w-3 mr-1" />
              Vendedor
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(seller.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium">{seller.name.split(" ")[0]}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{seller.name}</p>
                  <p className="text-xs text-muted-foreground">{seller.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/" className="cursor-pointer">
                    <Home className="h-4 w-4 mr-2" />
                    Ir para o Site
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Olá, {seller.name.split(" ")[0]}! 👋
            </h1>
            <p className="text-muted-foreground">
              Acompanhe suas vendas e comissões aqui.
            </p>
          </div>
          <Badge
            className={
              seller.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
            }
          >
            {seller.status === 'active' ? 'Conta Ativa' : 'Conta Pendente'}
          </Badge>
        </div>

        {/* Metrics Cards */}
        <SellerMetricsCards
          totalSales={stats.totalSales}
          pendingCommission={stats.pendingCommission}
          paidCommission={stats.paidCommission}
          totalCommission={stats.totalCommission}
        />

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Link Share - Takes 1 column */}
          <div className="lg:col-span-1">
            <SellerLinkShare
              referralCode={seller.referral_code}
              sellerName={seller.name}
            />

            {/* Installation Fee Info Card */}
            <Card className="mt-6 border-border">
              <CardHeader>
                <CardTitle className="text-lg">Sua Taxa de Instalação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-primary/5 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Valor Atual</p>
                  <p className="text-3xl font-bold text-primary">
                    R$ {(seller.installation_fee || 100).toLocaleString("pt-BR")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Este valor é adicionado ao preço do plano. O cliente paga o total e você recebe 100% da taxa de instalação.
                </p>
                <div className="border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground mb-2">Exemplo com Plano Start (R$287):</p>
                  <div className="flex justify-between text-sm">
                    <span>Preço do plano</span>
                    <span>R$ 287,00</span>
                  </div>
                  <div className="flex justify-between text-sm text-primary font-medium">
                    <span>+ Sua taxa</span>
                    <span>R$ {(seller.installation_fee || 100).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t border-border">
                    <span>Cliente paga</span>
                    <span>R$ {(287 + (seller.installation_fee || 100)).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sales Table - Takes 2 columns */}
          <div className="lg:col-span-2">
            <SellerSalesTable sales={sales || []} isLoading={false} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default SellerDashboard;
