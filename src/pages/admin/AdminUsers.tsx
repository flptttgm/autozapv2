import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { UserTable } from "@/components/admin/UserTable";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

export default function AdminUsers() {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    deleted: number;
    failed: number;
  } | null>(null);

  const handleCleanupFakeAccounts = async () => {
    setIsCleaningUp(true);
    setCleanupResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await supabase.functions.invoke("cleanup-fake-accounts", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao executar limpeza");
      }

      const result = response.data;
      setCleanupResult({
        deleted: result.stats.total_deleted,
        failed: result.stats.total_failed,
      });

      toast.success(`Limpeza concluída: ${result.stats.total_deleted} contas removidas`);
      
      // Reload page to refresh user list
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: unknown) {
      console.error("Cleanup error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro na limpeza: ${errorMessage}`);
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Usuários</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Gerencie todos os usuários da plataforma
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isCleaningUp} className="w-full sm:w-auto">
                {isCleaningUp ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">Limpar Contas Fake</span>
                <span className="sm:hidden">Limpar Fake</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Confirmar Limpeza de Contas Fake
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Esta ação irá deletar permanentemente todas as contas com:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Emails terminando em @example.com, @test.com</li>
                    <li>Emails de domínios temporários (tempmail, mailinator, etc.)</li>
                    <li>Padrões suspeitos (test + caracteres aleatórios)</li>
                  </ul>
                  <p className="font-semibold text-destructive">
                    Esta ação não pode ser desfeita!
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCleanupFakeAccounts}
                  className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Confirmar Limpeza
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {cleanupResult && (
          <div className="p-4 rounded-lg bg-muted border">
            <p className="font-medium">Resultado da limpeza:</p>
            <p className="text-sm text-muted-foreground">
              {cleanupResult.deleted} contas removidas
              {cleanupResult.failed > 0 && ` • ${cleanupResult.failed} falhas`}
            </p>
          </div>
        )}

        <UserTable />
      </div>
    </AdminLayout>
  );
}
