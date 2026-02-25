import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Ticket, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Loader2
} from "lucide-react";
import { CouponFormDialog } from "@/components/admin/CouponFormDialog";

type Coupon = {
  id: string;
  code: string;
  discount_percent: number;
  is_universal: boolean | null;
  workspace_id: string | null;
  max_uses: number | null;
  current_uses: number | null;
  min_value: number | null;
  expires_at: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type CouponStatus = "all" | "active" | "inactive" | "expired" | "exhausted";

export default function AdminCoupons() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CouponStatus>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Coupon[];
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("user_coupons")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Status do cupom atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar status do cupom");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_coupons")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Cupom excluído com sucesso");
      setDeletingCoupon(null);
    },
    onError: () => {
      toast.error("Erro ao excluir cupom");
    },
  });

  const getCouponStatus = (coupon: Coupon): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    if (coupon.is_active === false) {
      return { label: "Inativo", variant: "secondary" };
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { label: "Expirado", variant: "destructive" };
    }
    if (coupon.max_uses && coupon.current_uses && coupon.current_uses >= coupon.max_uses) {
      return { label: "Esgotado", variant: "outline" };
    }
    return { label: "Ativo", variant: "default" };
  };

  const filteredCoupons = coupons?.filter((coupon) => {
    const matchesSearch = coupon.code.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (statusFilter === "all") return true;
    
    const status = getCouponStatus(coupon);
    
    switch (statusFilter) {
      case "active":
        return status.label === "Ativo";
      case "inactive":
        return status.label === "Inativo";
      case "expired":
        return status.label === "Expirado";
      case "exhausted":
        return status.label === "Esgotado";
      default:
        return true;
    }
  });

  const stats = {
    total: coupons?.length || 0,
    active: coupons?.filter((c) => getCouponStatus(c).label === "Ativo").length || 0,
    inactive: coupons?.filter((c) => getCouponStatus(c).label === "Inativo").length || 0,
    expired: coupons?.filter((c) => getCouponStatus(c).label === "Expirado").length || 0,
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCoupon(null);
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Ticket className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Cupons de Desconto
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Gerencie cupons de desconto da plataforma
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cupom
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total de Cupons</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div>
              <p className="text-xs text-muted-foreground">Inativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-destructive">{stats.expired}</div>
              <p className="text-xs text-muted-foreground">Expirados</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CouponStatus)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
              <SelectItem value="exhausted">Esgotados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Valor Mín.</TableHead>
                    <TableHead>Expiração</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum cupom encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCoupons?.map((coupon) => {
                      const status = getCouponStatus(coupon);
                      return (
                        <TableRow key={coupon.id}>
                          <TableCell className="font-mono font-medium">
                            {coupon.code}
                          </TableCell>
                          <TableCell>{coupon.discount_percent}%</TableCell>
                          <TableCell>
                            <Badge variant={coupon.is_universal ? "default" : "outline"}>
                              {coupon.is_universal ? "Universal" : "Específico"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {coupon.max_uses 
                              ? `${coupon.current_uses || 0}/${coupon.max_uses}` 
                              : `${coupon.current_uses || 0}/∞`}
                          </TableCell>
                          <TableCell>
                            {coupon.min_value 
                              ? `R$ ${coupon.min_value.toFixed(2)}` 
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {coupon.expires_at 
                              ? format(new Date(coupon.expires_at), "dd/MM/yyyy", { locale: ptBR })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(coupon)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleActiveMutation.mutate({ 
                                  id: coupon.id, 
                                  is_active: !coupon.is_active 
                                })}
                                title={coupon.is_active ? "Desativar" : "Ativar"}
                              >
                                {coupon.is_active ? (
                                  <ToggleRight className="h-4 w-4 text-green-600" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingCoupon(coupon)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <CouponFormDialog
        open={isFormOpen}
        onOpenChange={handleCloseForm}
        coupon={editingCoupon}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCoupon} onOpenChange={() => setDeletingCoupon(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cupom</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cupom <strong>{deletingCoupon?.code}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCoupon && deleteMutation.mutate(deletingCoupon.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
