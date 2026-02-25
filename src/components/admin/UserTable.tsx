import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, ChevronLeft, ChevronRight, Eye, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserDetailsModal } from "./UserDetailsModal";

// Interface that matches the RPC return type
interface UserFromRPC {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  full_name: string | null;
  company_name: string | null;
  workspace_id: string | null;
  onboarding_completed: boolean | null;
}

// Extended interface for UI display
interface UserWithStats extends UserFromRPC {
  workspace_name?: string | null;
  plan_type?: string | null;
  plan_status?: string | null;
  leads_count?: number;
  messages_count?: number;
  whatsapp_connected?: boolean;
  whatsapp_phone?: string | null;
}

const formatPhone = (phone: string): string => {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // Format: 5511999999999 -> +55 11 99999-9999
  if (digits.length >= 12) {
    const country = digits.slice(0, 2);
    const area = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9);
    return `+${country} ${area} ${part1}-${part2}`;
  }
  if (digits.length >= 10) {
    const area = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7);
    return `(${area}) ${part1}-${part2}`;
  }
  return phone;
};

export function UserTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: async () => {
      const { data: allUsers, error } = await supabase.rpc('get_admin_users_with_email');
      
      if (error) throw error;
      
      // Map RPC response to UserWithStats format
      let filtered: UserWithStats[] = (allUsers || []).map((u: UserFromRPC) => ({
        ...u,
        workspace_name: null,
        plan_type: null,
        plan_status: null,
        leads_count: 0,
        messages_count: 0,
        whatsapp_connected: false,
        whatsapp_phone: null,
      }));
      
      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(u => 
          u.full_name?.toLowerCase().includes(searchLower) ||
          u.email?.toLowerCase().includes(searchLower) ||
          u.company_name?.toLowerCase().includes(searchLower)
        );
      }
      
      const total = filtered.length;
      const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
      
      return { users: paginated, count: total };
    },
  });

  const totalPages = Math.ceil((data?.count ?? 0) / pageSize);

  const getPlanBadge = (planType: string | null) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      enterprise: "default",
      pro: "default",
      basic: "secondary",
      trial: "outline",
    };
    return variants[planType || 'trial'] || "secondary";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou empresa..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="self-start sm:self-auto">{data?.count ?? 0} usuários</Badge>
      </div>

      <ScrollArea className="w-full whitespace-nowrap rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Usuário</TableHead>
              <TableHead className="min-w-[150px] hidden md:table-cell">Empresa</TableHead>
              <TableHead className="min-w-[90px]">Cadastro</TableHead>
              <TableHead className="min-w-[90px] hidden md:table-cell">Último Login</TableHead>
              <TableHead className="min-w-[80px] text-center hidden md:table-cell">Onboarding</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data?.users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              data?.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{user.full_name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email || '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p className="text-sm truncate">{user.company_name || '-'}</p>
                  </TableCell>
                  <TableCell>
                    {user.created_at 
                      ? format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })
                      : '-'
                    }
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {user.last_sign_in_at 
                      ? format(new Date(user.last_sign_in_at), "dd/MM HH:mm", { locale: ptBR })
                      : '-'
                    }
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    {user.onboarding_completed ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setSelectedUser(user)}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <UserDetailsModal
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}