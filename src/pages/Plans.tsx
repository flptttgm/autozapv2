import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Plus, HelpCircle, MessageCircle, Sparkles, Zap, ArrowRight, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { PlanCard } from "@/components/subscription/PlanCard";
import { useSubscription, PLAN_PRICES } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { plans as planDefinitions, getShortFeatures, CONNECTION_PRICE, PLAN_MEMBER_LIMITS } from "@/lib/plan-definitions";
import { cn } from "@/lib/utils";

// Usar definições centralizadas
const plans = planDefinitions.map(plan => ({
  name: plan.name,
  connections: plan.connections,
  isPopular: plan.isPopular,
  features: getShortFeatures(plan.name),
}));

const faqs = [
  {
    question: "O que é uma Conexão de WhatsApp?",
    answer: "Uma Conexão é um número de WhatsApp seu (pessoal ou empresarial) conectado à plataforma AutoZap via QR Code. Cada conexão funciona como um atendente virtual exclusivo, com IA, captura de leads e agendamento automático.",
  },
  {
    question: "O uso é realmente ilimitado?",
    answer: "Sim! Não cobramos por mensagem, atendimento, lead ou agendamento. Você pode usar sem limites dentro do seu plano.",
  },
  {
    question: "Como funciona a captação de leads?",
    answer: "Cada plano inclui créditos mensais para prospectar leads qualificados. Start: 50 leads/mês, Pro: 80 leads/mês, Business: 100 leads/mês. Você pode comprar créditos extras a partir de R$1 por lead.",
  },
  {
    question: "Como funciona o disparo de mensagens em fila?",
    answer: "As mensagens são enviadas de forma espaçada e inteligente, simulando comportamento humano. Isso protege seu WhatsApp de bloqueios por spam e garante entregas consistentes.",
  },
  {
    question: "Posso enviar cobranças pelo WhatsApp?",
    answer: "Sim! O sistema gera QR Code PIX automaticamente e envia para o cliente. Você pode configurar confirmação automática ou manual de pagamentos.",
  },
  {
    question: "Posso adicionar mais conexões?",
    answer: "Sim! Você pode adicionar conexões extras por R$197/mês cada. Ou fazer upgrade para um plano maior com mais conexões incluídas.",
  },
  {
    question: "Como funciona o upgrade/downgrade?",
    answer: "Você pode mudar de plano a qualquer momento. O valor é ajustado proporcionalmente ao período restante.",
  },
];

const Plans = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const { subscription, isLoading, connectionsUsed, totalConnections, trialDaysLeft } = useSubscription();
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Query member count
  const memberLimit = PLAN_MEMBER_LIMITS[subscription?.plan_type as keyof typeof PLAN_MEMBER_LIMITS] || 1;
  const { data: membersCount = 0 } = useQuery({
    queryKey: ["workspace-members-count", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;
      const { count, error } = await supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", profile.workspace_id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.workspace_id,
  });

  const handleSelectPlan = (planName: string) => {
    const cycle = isAnnual ? "annual" : "monthly";
    navigate(`/checkout?plan=${planName.toLowerCase()}&cycle=${cycle}`);
  };

  const handleAddConnection = () => {
    const cycle = isAnnual ? "annual" : "monthly";
    navigate(`/checkout?type=connection&cycle=${cycle}`);
  };

  if (!subscription && isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[500px] rounded-2xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Hero Header */}
        <div className="text-center mb-10 relative">
          {/* Decorative background glow */}
          <div className="absolute inset-x-0 -top-16 h-40 bg-gradient-to-b from-primary/5 via-primary/3 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
              <Sparkles className="h-3 w-3" />
              Potencialize seu atendimento
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Escolha o plano ideal
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Automatize o atendimento do seu WhatsApp com IA avançada. Sem limite de mensagens, sem surpresas no final do mês.
            </p>
          </div>
        </div>

        {/* Current Plan Badge */}
        {subscription && (
          <div className="mb-8 flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Crown className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Plano <span className="capitalize">{subscription.plan_type}</span>
                  {subscription.plan_type === 'trial' && trialDaysLeft > 0 && (
                    <Badge variant="secondary" className="ml-2 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      {trialDaysLeft} dias restantes
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="h-3 w-3" />
                    {connectionsUsed}/{totalConnections} conexões
                  </span>
                  <span className="h-3 w-px bg-border" />
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    {membersCount}/{memberLimit} membros
                  </span>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => navigate('/settings?tab=subscription')}
            >
              Gerenciar
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <Label
            htmlFor="billing"
            className={cn(
              "text-sm transition-colors cursor-pointer",
              !isAnnual ? "font-semibold text-foreground" : "text-muted-foreground"
            )}
          >
            Mensal
          </Label>
          <Switch
            id="billing"
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <div className="flex items-center gap-2">
            <Label
              htmlFor="billing"
              className={cn(
                "text-sm transition-colors cursor-pointer",
                isAnnual ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              Anual
            </Label>
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold hover:bg-emerald-500/15">
              Economize 17%
            </Badge>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-5 md:gap-4 mb-16 items-stretch">
          {plans.map((plan) => (
            <PlanCard
              key={plan.name}
              name={plan.name}
              price={PLAN_PRICES[plan.name.toLowerCase() as keyof typeof PLAN_PRICES].monthly}
              annualPrice={PLAN_PRICES[plan.name.toLowerCase() as keyof typeof PLAN_PRICES].annual}
              connections={plan.connections}
              features={plan.features}
              isPopular={plan.isPopular}
              isCurrent={subscription?.plan_type === plan.name.toLowerCase()}
              isAnnual={isAnnual}
              currentPlan={subscription?.plan_type}
              onSelect={() => handleSelectPlan(plan.name)}
            />
          ))}
        </div>

        {/* Extra Connections */}
        <div className="mb-16 rounded-2xl border border-border/50 bg-gradient-to-r from-card via-card to-primary/[0.03] overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-base">Conexões Adicionais</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Adicione mais números de WhatsApp ao seu plano
                </p>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-2xl font-extrabold tracking-tight">
                  R$ {isAnnual ? CONNECTION_PRICE.annual : CONNECTION_PRICE.monthly}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                {isAnnual && (
                  <p className="text-xs text-emerald-500 font-medium">
                    Economia no plano anual
                  </p>
                )}
              </div>
              <Button
                onClick={handleAddConnection}
                variant="outline"
                className="rounded-xl h-10 px-5 gap-2 font-medium"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <div className="px-6 pt-6 pb-2 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <HelpCircle className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-base">Perguntas Frequentes</h3>
              <p className="text-xs text-muted-foreground">Tire suas dúvidas antes de assinar</p>
            </div>
          </div>
          <div className="px-6 pb-6">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-border/50">
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Plans;
