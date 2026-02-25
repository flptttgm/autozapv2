import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, 
  Play, 
  CheckCircle, 
  XCircle, 
  Ban,
  Users,
  Calendar,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
}

interface Campaign {
  id: string;
  name: string;
  content: string;
  audience_type: string;
  scheduled_at: string;
  status: string;
  stats: CampaignStats | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-500', icon: Clock },
  scheduled: { label: 'Agendada', color: 'bg-yellow-500', icon: Clock },
  running: { label: 'Executando', color: 'bg-blue-500', icon: Play },
  completed: { label: 'Concluída', color: 'bg-green-500', icon: CheckCircle },
  failed: { label: 'Falhou', color: 'bg-red-500', icon: XCircle },
  cancelled: { label: 'Cancelada', color: 'bg-gray-400', icon: Ban },
};

export function CampaignsList() {
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["whatsapp-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Parse stats from JSON safely
      return (data || []).map(campaign => ({
        ...campaign,
        stats: campaign.stats as unknown as CampaignStats | null
      })) as Campaign[];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from("whatsapp_campaigns")
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq("id", campaignId)
        .in("status", ['draft', 'scheduled']);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
      toast.success("Campanha cancelada");
    },
    onError: () => {
      toast.error("Erro ao cancelar campanha");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Nenhuma campanha criada ainda.<br />
            Clique em "Nova Campanha" para começar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => {
        const status = statusConfig[campaign.status] || statusConfig.draft;
        const StatusIcon = status.icon;
        const stats = campaign.stats || { total: 0, sent: 0, failed: 0 };

        return (
          <Card key={campaign.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {campaign.name}
                    <Badge className={`${status.color} text-white`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {campaign.audience_type === 'leads' ? 'Base de Leads' : 'CSV Importado'}
                    </span>
                  </CardDescription>
                </div>
                {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Tem certeza que deseja cancelar esta campanha?')) {
                        cancelMutation.mutate(campaign.id);
                      }
                    }}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap line-clamp-2 mb-3">
                {campaign.content}
              </div>
              
              {/* Stats */}
              {(campaign.status === 'running' || campaign.status === 'completed' || campaign.status === 'failed') && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Total: <span className="font-medium text-foreground">{stats.total}</span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Enviados: <span className="font-medium">{stats.sent}</span>
                  </span>
                  {stats.failed > 0 && (
                    <span className="text-destructive">
                      Falhas: <span className="font-medium">{stats.failed}</span>
                    </span>
                  )}
                  {campaign.status === 'running' && (
                    <span className="flex items-center gap-1 text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processando...
                    </span>
                  )}
                </div>
              )}

              {campaign.status === 'scheduled' && (
                <div className="text-sm text-muted-foreground">
                  📊 {stats.total} destinatários aguardando envio
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
