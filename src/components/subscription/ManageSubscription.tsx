import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreditCard, Calendar, AlertTriangle, XCircle, RefreshCw, Loader2, BadgePercent, Sparkles } from "lucide-react";
import { ReferralSection } from "./ReferralSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PLAN_PRICES } from "@/hooks/useSubscription";

const PLAN_NAMES: Record<string, string> = {
  trial: "Trial",
  start: "Start",
  pro: "Pro",
  business: "Business",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativa", variant: "default" },
  trial: { label: "Trial", variant: "secondary" },
  expired: { label: "Expirada", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "outline" },
  overdue: { label: "Atrasada", variant: "destructive" },
};

export function ManageSubscription() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch subscription data
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription-details", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return null;
      
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("workspace_id", profile.workspace_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.workspace_id,
  });

  // Fetch payment history
  const { data: payments } = useQuery({
    queryKey: ["payment-history", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      
      const { data, error } = await supabase
        .from("payments_history")
        .select("*")
        .eq("workspace_id", profile.workspace_id)
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.workspace_id,
  });

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      // If there's an Asaas subscription, cancel it via API
      if (subscription?.asaas_subscription_id) {
        const { error } = await supabase.functions.invoke("asaas-payments", {
          body: {
            action: "cancel_subscription",
            data: { subscriptionId: subscription.asaas_subscription_id },
          },
        });

        if (error) throw error;
      }

      // Update local subscription status regardless of Asaas status
      await supabase
        .from("subscriptions")
        .update({ 
          status: "cancelled",
          asaas_subscription_id: null,
        })
        .eq("workspace_id", profile?.workspace_id);

      queryClient.invalidateQueries({ queryKey: ["subscription-details"] });
      
      toast({
        title: "Assinatura cancelada",
        description: "Sua assinatura foi cancelada. Você ainda tem acesso até o fim do período pago.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Não foi possível cancelar a assinatura.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Nenhuma assinatura encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  const isRecurring = !!subscription.asaas_subscription_id;
  const isTrial = subscription.plan_type === "trial";
  const planPrice = !isTrial && PLAN_PRICES[subscription.plan_type as keyof typeof PLAN_PRICES];
  const basePlanPrice = planPrice 
    ? (subscription.billing_cycle === "annual" ? planPrice.annual : planPrice.monthly)
    : 0;
  
  // Use effective_price if available, otherwise calculate from discount or use base price
  const hasDiscount = subscription.discount_percent && subscription.discount_percent > 0;
  const currentPrice = subscription.effective_price 
    ? Number(subscription.effective_price)
    : hasDiscount 
      ? basePlanPrice * (1 - subscription.discount_percent! / 100)
      : basePlanPrice;
  
  const hasCardSaved = !!subscription.card_last_digits;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Sua Assinatura
              </CardTitle>
              <CardDescription>Gerencie seu plano e pagamentos</CardDescription>
            </div>
            <Badge variant={STATUS_LABELS[subscription.status]?.variant || "secondary"}>
              {STATUS_LABELS[subscription.status]?.label || subscription.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Plano</p>
              <p className="font-semibold text-lg">
                {PLAN_NAMES[subscription.plan_type] || subscription.plan_type}
              </p>
            </div>
            
            {!isTrial && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Ciclo de cobrança</p>
                <p className="font-medium">
                  {subscription.billing_cycle === "annual" ? "Anual" : "Mensal"}
                </p>
              </div>
            )}

            {subscription.current_period_end && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {isRecurring ? "Próxima cobrança" : "Válido até"}
                </p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            )}

            {!isTrial && currentPrice > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Valor</p>
                <div className="space-y-1">
                  <p className="font-semibold text-lg">
                    R$ {currentPrice.toFixed(2).replace(".", ",")}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{subscription.billing_cycle === "annual" ? "ano" : "mês"}
                    </span>
                  </p>
                  {hasDiscount && (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {subscription.discount_percent}% de desconto
                        {subscription.applied_coupon && ` (${subscription.applied_coupon})`}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Conexões WhatsApp</p>
              <p className="font-medium">
                {subscription.connections_limit + subscription.connections_extra} conexão(ões)
                {subscription.connections_extra > 0 && (
                  <span className="text-sm text-muted-foreground ml-1">
                    (+{subscription.connections_extra} extra)
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cobrança recorrente</p>
              <div className="space-y-1.5">
                {isRecurring ? (
                  <>
                    {hasCardSaved && (
                      <p className="font-medium flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>Cartão •••• {subscription.card_last_digits}</span>
                      </p>
                    )}
                    <p className="font-medium flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      <span className="text-primary">Cobrança automática ativada</span>
                    </p>
                  </>
                ) : (
                  <p className="font-medium flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Sem renovação automática</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {isTrial && subscription.trial_ends_at && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-600 rounded-lg">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">
                Seu período de teste expira em{" "}
                <strong>
                  {format(new Date(subscription.trial_ends_at), "dd 'de' MMMM", { locale: ptBR })}
                </strong>
                . Escolha um plano para continuar usando.{" "}
                <a 
                  href="https://crm-appi-company.lovable.app/suporte-publico"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  Dúvidas? Fale conosco
                </a>
              </p>
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => window.location.href = "/plans"}>
              {isTrial ? "Escolher Plano" : "Mudar Plano"}
            </Button>
            
            {!isTrial && subscription.status !== "cancelled" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive">
                    {isRecurring ? "Cancelar Assinatura" : "Cancelar Plano"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ao cancelar, a renovação automática será desativada. Você ainda terá acesso ao plano 
                      até o fim do período atual ({subscription.current_period_end && 
                        format(new Date(subscription.current_period_end), "dd/MM/yyyy")}).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelSubscription}
                      disabled={isCancelling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cancelando...
                        </>
                      ) : (
                        "Confirmar cancelamento"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Referral Section */}
      <ReferralSection />

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      {payment.plan_type === "connection" 
                        ? "Conexão Extra" 
                        : `Plano ${PLAN_NAMES[payment.plan_type] || payment.plan_type}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {" · "}
                      {payment.billing_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      R$ {Number(payment.value).toFixed(2).replace(".", ",")}
                    </p>
                    <Badge
                      variant={
                        payment.status === "CONFIRMED" || payment.status === "RECEIVED"
                          ? "default"
                          : payment.status === "PENDING"
                          ? "secondary"
                          : "destructive"
                      }
                      className="text-xs"
                    >
                      {payment.status === "CONFIRMED" || payment.status === "RECEIVED"
                        ? "Pago"
                        : payment.status === "PENDING"
                        ? "Pendente"
                        : payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
