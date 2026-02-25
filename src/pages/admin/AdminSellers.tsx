import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  Search,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Plus,
  Loader2,
  UserPlus,
  Ban,
  Eye,
} from "lucide-react";

interface Seller {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf_cnpj: string | null;
  asaas_wallet_id: string | null;
  installation_fee: number;
  status: string;
  referral_code: string;
  total_sales: number;
  total_commission: number;
  created_at: string;
}

const AdminSellers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [newSeller, setNewSeller] = useState({
    email: "",
    name: "",
    phone: "",
    cpf_cnpj: "",
    asaas_wallet_id: "",
    installation_fee: "100",
  });
  const queryClient = useQueryClient();

  // Fetch all sellers
  const { data: sellers, isLoading } = useQuery({
    queryKey: ['admin-sellers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Seller[];
    },
  });

  // Update seller status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ sellerId, status }: { sellerId: string; status: string }) => {
      const { error } = await supabase
        .from('sellers')
        .update({ status })
        .eq('id', sellerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sellers'] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  // Update seller installation fee
  const updateFeeMutation = useMutation({
    mutationFn: async ({ sellerId, fee }: { sellerId: string; fee: number }) => {
      const { error } = await supabase
        .from('sellers')
        .update({ installation_fee: fee })
        .eq('id', sellerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sellers'] });
      toast.success("Taxa atualizada com sucesso!");
      setSelectedSeller(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar taxa");
    },
  });

  const filteredSellers = sellers?.filter(seller =>
    seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seller.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seller.referral_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'suspended':
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Suspenso
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calculate stats
  const stats = {
    total: sellers?.length || 0,
    active: sellers?.filter(s => s.status === 'active').length || 0,
    pending: sellers?.filter(s => s.status === 'pending').length || 0,
    totalCommissions: sellers?.reduce((acc, s) => acc + Number(s.total_commission), 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Vendedores
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie os vendedores da plataforma
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Vendedor
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Comissões Pagas</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalCommissions)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredSellers?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum vendedor encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Taxa Instalação</TableHead>
                      <TableHead>Vendas</TableHead>
                      <TableHead>Comissões</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSellers?.map((seller) => (
                      <TableRow key={seller.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{seller.name}</p>
                            <p className="text-sm text-muted-foreground">{seller.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {seller.referral_code}
                          </code>
                        </TableCell>
                        <TableCell>{formatCurrency(Number(seller.installation_fee))}</TableCell>
                        <TableCell>{seller.total_sales}</TableCell>
                        <TableCell className="font-medium text-primary">
                          {formatCurrency(Number(seller.total_commission))}
                        </TableCell>
                        <TableCell>{getStatusBadge(seller.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(seller.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedSeller(seller)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              {seller.status !== 'active' && (
                                <DropdownMenuItem
                                  onClick={() => updateStatusMutation.mutate({ sellerId: seller.id, status: 'active' })}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Aprovar
                                </DropdownMenuItem>
                              )}
                              {seller.status !== 'suspended' && (
                                <DropdownMenuItem
                                  onClick={() => updateStatusMutation.mutate({ sellerId: seller.id, status: 'suspended' })}
                                  className="text-destructive"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspender
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seller Details Dialog */}
        <Dialog open={!!selectedSeller} onOpenChange={() => setSelectedSeller(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Vendedor</DialogTitle>
            </DialogHeader>
            {selectedSeller && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Nome</Label>
                    <p className="font-medium">{selectedSeller.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedSeller.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Telefone</Label>
                    <p className="font-medium">{selectedSeller.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CPF/CNPJ</Label>
                    <p className="font-medium">{selectedSeller.cpf_cnpj || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Código</Label>
                    <p className="font-medium font-mono">{selectedSeller.referral_code}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Wallet ID Asaas</Label>
                    <p className="font-medium font-mono text-sm">{selectedSeller.asaas_wallet_id || '-'}</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="installationFee">Taxa de Instalação (R$)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="installationFee"
                      type="number"
                      defaultValue={selectedSeller.installation_fee}
                      onChange={(e) => {
                        setSelectedSeller({
                          ...selectedSeller,
                          installation_fee: Number(e.target.value),
                        });
                      }}
                    />
                    <Button
                      onClick={() =>
                        updateFeeMutation.mutate({
                          sellerId: selectedSeller.id,
                          fee: selectedSeller.installation_fee,
                        })
                      }
                      disabled={updateFeeMutation.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Seller Dialog - Placeholder */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Vendedor</DialogTitle>
              <DialogDescription>
                Para criar um novo vendedor, primeiro crie uma conta de usuário normal para a pessoa,
                depois adicione a role de vendedor e o registro na tabela sellers.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-center text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Funcionalidade em desenvolvimento.</p>
              <p className="text-sm mt-2">
                Por enquanto, crie o vendedor diretamente no banco de dados.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSellers;
