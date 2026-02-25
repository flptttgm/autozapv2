import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Plus, HelpCircle, MessageCircle } from "lucide-react";
import Layout from "@/components/Layout";
import { PlanCard } from "@/components/subscription/PlanCard";
import { useSubscription, PLAN_PRICES } from "@/hooks/useSubscription";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { plans as planDefinitions, getShortFeatures, CONNECTION_PRICE } from "@/lib/plan-definitions";

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
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSelectPlan = (planName: string) => {
    const cycle = isAnnual ? "annual" : "monthly";
    navigate(`/checkout?plan=${planName.toLowerCase()}&cycle=${cycle}`);
  };

  const handleAddConnection = () => {
    const cycle = isAnnual ? "annual" : "monthly";
    navigate(`/checkout?type=connection&cycle=${cycle}`);
  };

  // Don't show loading skeleton if user is not authenticated
  // Let ProtectedRoute handle the redirect to /auth
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
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Escolha seu Plano</h1>
          <p className="text-muted-foreground">
            Selecione o plano ideal para o seu negócio
          </p>
        </div>

        {/* Current Plan Badge */}
        {subscription && (
          <Card className="mb-8">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    Plano Atual: <span className="capitalize">{subscription.plan_type}</span>
                  </span>
                  {subscription.plan_type === 'trial' && trialDaysLeft > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {trialDaysLeft} dias restantes
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/settings?tab=subscription')}
                >
                  Gerenciar
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <span>
                  {connectionsUsed}/{totalConnections} conexões em uso
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <Label htmlFor="billing" className={!isAnnual ? "font-medium" : "text-muted-foreground"}>
            Mensal
          </Label>
          <Switch
            id="billing"
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="billing" className={isAnnual ? "font-medium" : "text-muted-foreground"}>
              Anual
            </Label>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              -17%
            </Badge>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12 items-stretch">
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
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Conexões Adicionais
            </CardTitle>
            <CardDescription>
              Precisa de mais conexões? Adicione quantas precisar ao seu plano.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                R$ {CONNECTION_PRICE.monthly}<span className="text-base font-normal text-muted-foreground">/mês por conexão</span>
              </p>
              {isAnnual && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  R$ {CONNECTION_PRICE.annual}/mês no plano anual
                </p>
              )}
            </div>
            <Button variant="outline" onClick={handleAddConnection}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Conexão
            </Button>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Perguntas Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Plans;
