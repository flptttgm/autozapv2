import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Gift, Copy, Check, Users, Loader2, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const REFERRAL_BONUS = 50;

export function ReferralSection() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Fetch workspace with referral info
  const { data: workspace, isLoading: loadingWorkspace } = useQuery({
    queryKey: ["workspace-referral", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return null;
      
      const { data, error } = await supabase
        .from("workspaces")
        .select("referral_code, referral_balance")
        .eq("id", profile.workspace_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.workspace_id,
  });

  // Fetch referral history
  const { data: referrals, isLoading: loadingReferrals } = useQuery({
    queryKey: ["referrals", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      
      const { data, error } = await supabase
        .from("referrals")
        .select(`
          id,
          status,
          credit_amount,
          created_at,
          completed_at,
          referred_workspace_id
        `)
        .eq("referrer_workspace_id", profile.workspace_id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.workspace_id,
  });

  const referralLink = workspace?.referral_code 
    ? `https://appiautozap.com/auth?ref=${workspace.referral_code}`
    : null;

  const handleCopyLink = async () => {
    if (!referralLink) return;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "Compartilhe com seus amigos e ganhe R$50 por cada indicação.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };


  const completedReferrals = referrals?.filter(r => r.status === "completed").length || 0;
  const pendingReferrals = referrals?.filter(r => r.status === "pending").length || 0;
  const totalEarned = workspace?.referral_balance || 0;

  if (loadingWorkspace) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Programa de Indicação</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Indique amigos e ganhe R${REFERRAL_BONUS} por assinatura
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/indicacao")}
            className="w-full sm:w-auto shrink-0"
          >
            Ver página completa
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="text-center p-2 sm:p-4 bg-muted/50 rounded-lg">
            <p className="text-lg sm:text-2xl font-bold text-primary">
              R$ {Number(totalEarned).toFixed(0)}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Saldo</p>
          </div>
          <div className="text-center p-2 sm:p-4 bg-muted/50 rounded-lg">
            <p className="text-lg sm:text-2xl font-bold text-green-600">{completedReferrals}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Concluídas</p>
          </div>
          <div className="text-center p-2 sm:p-4 bg-muted/50 rounded-lg">
            <p className="text-lg sm:text-2xl font-bold text-amber-600">{pendingReferrals}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Pendentes</p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Seu link de indicação:</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-xs sm:text-sm truncate">
              {referralLink || "Carregando..."}
            </div>
            <Button 
              onClick={handleCopyLink} 
              disabled={!referralLink}
              className="w-full sm:w-auto shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar link
                </>
              )}
            </Button>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-2">
          <p className="font-medium text-sm">Como funciona?</p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Compartilhe seu link de indicação com amigos</li>
            <li>Quando eles criarem uma conta pelo seu link, a indicação fica pendente</li>
            <li>Quando confirmarem o pagamento de qualquer plano, você ganha R${REFERRAL_BONUS}</li>
          </ol>
        </div>

        {/* Referral History */}
        {referrals && referrals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Suas indicações</p>
            </div>
            
            <div className="space-y-2">
              {loadingReferrals ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {referral.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          Indicação #{referral.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(referral.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          {referral.completed_at && (
                            <span className="hidden sm:inline"> · Concluída em {format(new Date(referral.completed_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right sm:shrink-0 ml-8 sm:ml-0">
                      {referral.status === "completed" ? (
                        <span className="text-green-600 font-semibold text-sm">
                          +R${Number(referral.credit_amount).toFixed(0)}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Pendente</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
