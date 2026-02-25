import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Gift, 
  Share2, 
  UserPlus, 
  CreditCard, 
  Copy, 
  Check, 
  Clock,
  Infinity,
  Sparkles,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SEOHead from "@/components/SEOHead";

const REFERRAL_BONUS = 50;

const sourceLabels: Record<string, string> = {
  'custom': 'Personalizada',
  'whatsapp': 'WhatsApp',
  'email': 'E-mail',
  'instagram': 'Instagram',
  'facebook': 'Facebook',
  'twitter': 'Twitter',
  'linkedin': 'LinkedIn',
  'website': 'Site',
  'standard': 'Padrão',
};

const Referral = () => {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: workspace, isLoading: isLoadingWorkspace } = useQuery({
    queryKey: ['workspace-referral', profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return null;
      const { data, error } = await supabase
        .from('workspaces')
        .select('referral_code, referral_balance')
        .eq('id', profile.workspace_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.workspace_id
  });

  const { data: referrals, isLoading: isLoadingReferrals } = useQuery({
    queryKey: ['referrals-history', profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_workspace_id', profile.workspace_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.workspace_id
  });

  const referralLink = workspace?.referral_code 
    ? `https://appiautozap.com/auth?ref=${workspace.referral_code}` 
    : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const handleShareWhatsApp = () => {
    const text = `Conheça o ClickZap! Use meu link para se cadastrar: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const completedReferrals = referrals?.filter(r => r.status === 'completed').length || 0;
  const pendingReferrals = referrals?.filter(r => r.status === 'pending').length || 0;
  const totalEarned = workspace?.referral_balance || 0;

  const steps = [
    { icon: Share2, title: "Compartilhe", description: "Envie seu link para amigos" },
    { icon: UserPlus, title: "Cadastro", description: "Amigo cria uma conta" },
    { icon: CreditCard, title: "Assinatura", description: "Amigo assina um plano" },
    { icon: Gift, title: "Recompensa", description: `Você ganha R$${REFERRAL_BONUS}` },
  ];

  const benefits = [
    { icon: Infinity, title: "Sem limites", description: "Indique quantas pessoas quiser" },
    { icon: Clock, title: "Nunca expira", description: "Seus créditos não têm prazo" },
    { icon: Sparkles, title: "Acumulativo", description: "Combine com outras promoções" },
    { icon: Users, title: "Para todos", description: "Qualquer pessoa pode participar" },
  ];

  // Don't show loading skeleton if user is not authenticated
  // Let ProtectedRoute handle the redirect to /auth
  if (!profile) {
    return null;
  }

  if (isLoadingWorkspace) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <>
      <SEOHead 
        title="Programa de Indicação | ClickZap"
        description="Indique amigos e ganhe R$50 em créditos para cada assinatura confirmada"
      />
      
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 md:space-y-8">
        {/* Hero Header */}
        <div className="text-center space-y-3 md:space-y-4">
          <div className="mx-auto w-14 h-14 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Gift className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          </div>
          <h1 className="text-xl md:text-3xl font-bold">Programa de Indicação</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
            Indique amigos e ganhe <span className="text-primary font-semibold">R${REFERRAL_BONUS}</span> em créditos 
            para cada assinatura confirmada
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4 text-center">
              <p className="text-xl md:text-3xl font-bold text-primary">
                R${totalEarned.toFixed(0)}
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">Saldo Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 text-center">
              <p className="text-xl md:text-3xl font-bold text-green-500">
                {completedReferrals}
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">Concluídas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 text-center">
              <p className="text-xl md:text-3xl font-bold text-yellow-500">
                {pendingReferrals}
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 text-center">
              <p className="text-xl md:text-3xl font-bold text-muted-foreground">
                R${REFERRAL_BONUS}
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">Por indicação</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link Box */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-base md:text-lg">Seu Link de Indicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4">
            <div className="flex gap-2">
              <Input 
                value={referralLink} 
                readOnly 
                className="font-mono text-xs md:text-sm"
              />
              <Button onClick={handleCopyLink} variant="outline" size="icon" className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleCopyLink} className="flex-1 text-sm">
                <Copy className="h-4 w-4 mr-2" />
                Copiar Link
              </Button>
              <Button onClick={handleShareWhatsApp} variant="outline" className="flex-1 text-sm">
                <Share2 className="h-4 w-4 mr-2" />
                Enviar via WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How it Works - Timeline */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-base md:text-lg">Como Funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {steps.map((step, index) => (
                <div key={index} className="text-center space-y-1.5 md:space-y-2">
                  <div className="mx-auto w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center relative">
                    <step.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 md:w-5 md:h-5 bg-primary text-primary-foreground text-[10px] md:text-xs rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                  </div>
                  <p className="font-medium text-xs md:text-sm">{step.title}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground leading-tight">{step.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-4">
          {benefits.map((benefit, index) => (
            <Card key={index}>
              <CardContent className="p-3 md:p-4 flex items-start gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <benefit.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-xs md:text-sm">{benefit.title}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground leading-tight">{benefit.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Referral History */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-base md:text-lg">Histórico de Indicações</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingReferrals ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : referrals && referrals.length > 0 ? (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div 
                    key={referral.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <UserPlus className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          Indicação #{referral.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Criada em {format(new Date(referral.created_at!), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {referral.status === 'completed' && referral.completed_at && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Concluída em {format(new Date(referral.completed_at), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <Badge 
                        variant={referral.status === 'completed' ? 'default' : 'secondary'}
                        className={referral.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : ''}
                      >
                        {referral.status === 'completed' ? 'Concluída' : 'Pendente'}
                      </Badge>
                      {referral.status === 'completed' && (
                        <p className="text-sm text-green-500 font-semibold">
                          +R${referral.credit_amount}
                        </p>
                      )}
                      {referral.status === 'pending' && (
                        <p className="text-xs text-muted-foreground">
                          Aguardando assinatura
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma indicação ainda</p>
                <p className="text-sm">Compartilhe seu link e comece a ganhar!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Referral;
