import { Check, Crown, Zap, Gem, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PlanCardProps {
  name: string;
  price: number;
  annualPrice: number;
  connections: number;
  features: string[];
  isPopular?: boolean;
  isCurrent?: boolean;
  isAnnual: boolean;
  currentPlan?: string;
  onSelect: () => void;
}

const planIcons = {
  Start: Zap,
  Pro: Crown,
  Business: Gem,
};

const planOrder = ['trial', 'start', 'pro', 'business'];

export const PlanCard = ({
  name,
  price,
  annualPrice,
  connections,
  features,
  isPopular,
  isCurrent,
  isAnnual,
  currentPlan,
  onSelect,
}: PlanCardProps) => {
  const Icon = planIcons[name as keyof typeof planIcons] || Zap;
  const displayPrice = isAnnual ? annualPrice : price;
  const savings = isAnnual ? (price - annualPrice) * 12 : 0;

  // Determine if this is an upgrade or downgrade
  const currentPlanIndex = planOrder.indexOf(currentPlan?.toLowerCase() || 'trial');
  const thisPlanIndex = planOrder.indexOf(name.toLowerCase());
  const isUpgrade = thisPlanIndex > currentPlanIndex;
  const isDowngrade = thisPlanIndex < currentPlanIndex;

  // Determine button text
  const getButtonText = () => {
    if (isCurrent) return "Plano Atual";
    if (isUpgrade) return "Fazer Upgrade";
    if (isDowngrade) return "Alterar Plano";
    return "Escolher Plano";
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border-2 p-6 transition-all flex flex-col h-full",
        isPopular && !isCurrent
          ? "border-primary bg-gradient-to-b from-primary/10 to-primary/5 shadow-xl scale-105"
          : isCurrent
            ? "border-muted-foreground/30 bg-muted/50"
            : "border-border bg-card hover:border-primary/50"
      )}
    >
      {isPopular && !isCurrent && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground z-10">
          Mais Popular
        </Badge>
      )}
      {isCurrent && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground z-10 flex items-center gap-1">
          <Check className="h-3 w-3" />
          Plano Atual
        </Badge>
      )}

      <div className="text-center mb-6">
        <div className={cn(
          "inline-flex items-center justify-center w-12 h-12 rounded-full mb-3",
          isPopular && !isCurrent 
            ? "bg-primary text-primary-foreground" 
            : isCurrent 
              ? "bg-muted-foreground/20"
              : "bg-primary/10"
        )}>
          <Icon className={cn(
            "h-6 w-6", 
            isPopular && !isCurrent 
              ? "text-primary-foreground" 
              : isCurrent 
                ? "text-muted-foreground" 
                : "text-primary"
          )} />
        </div>
        <h3 className="text-xl font-bold">{name}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {connections} {connections === 1 ? 'Conexão WhatsApp' : 'Conexões WhatsApp'}
        </p>
      </div>

      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-sm text-muted-foreground">R$</span>
          <span className="text-4xl font-bold">{displayPrice.toLocaleString('pt-BR')}</span>
          <span className="text-muted-foreground">/mês</span>
        </div>
        {isAnnual && savings > 0 && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
            Economia de R$ {savings.toLocaleString('pt-BR')}/ano
          </p>
        )}
      </div>

      <ul className="space-y-3 mb-6 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        className={cn("w-full mt-auto", isUpgrade && !isCurrent && "gap-2")}
        variant={isCurrent ? "outline" : isPopular ? "default" : "secondary"}
        onClick={onSelect}
        disabled={isCurrent}
      >
        {isUpgrade && !isCurrent && <ArrowUp className="h-4 w-4" />}
        {getButtonText()}
      </Button>
    </div>
  );
};