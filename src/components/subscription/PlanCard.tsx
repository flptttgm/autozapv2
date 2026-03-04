import { Check, Crown, Zap, Gem, ArrowUp, Sparkles } from "lucide-react";
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

const planColors = {
  Start: {
    gradient: "from-blue-500/20 via-cyan-500/10 to-transparent",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-500",
    border: "border-blue-500/20 hover:border-blue-500/40",
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    button: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20",
    glow: "shadow-blue-500/5",
    accent: "text-blue-500",
  },
  Pro: {
    gradient: "from-primary/20 via-amber-500/10 to-transparent",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    border: "border-primary/30 hover:border-primary/50",
    badge: "bg-primary/10 text-primary border-primary/30",
    button: "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25",
    glow: "shadow-primary/10",
    accent: "text-primary",
  },
  Business: {
    gradient: "from-purple-500/20 via-fuchsia-500/10 to-transparent",
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-500",
    border: "border-purple-500/20 hover:border-purple-500/40",
    badge: "bg-purple-500/10 text-purple-500 border-purple-500/30",
    button: "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20",
    glow: "shadow-purple-500/5",
    accent: "text-purple-500",
  },
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
  const colors = planColors[name as keyof typeof planColors] || planColors.Start;
  const displayPrice = isAnnual ? annualPrice : price;
  const savings = isAnnual ? (price - annualPrice) * 12 : 0;

  const currentPlanIndex = planOrder.indexOf(currentPlan?.toLowerCase() || 'trial');
  const thisPlanIndex = planOrder.indexOf(name.toLowerCase());
  const isUpgrade = thisPlanIndex > currentPlanIndex;
  const isDowngrade = thisPlanIndex < currentPlanIndex;

  const getButtonText = () => {
    if (isCurrent) return "Plano Atual";
    if (isUpgrade) return "Fazer Upgrade";
    if (isDowngrade) return "Alterar Plano";
    return "Escolher Plano";
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-px transition-all duration-300 flex flex-col h-full group",
        isPopular && !isCurrent
          ? "shadow-2xl shadow-primary/10 scale-[1.03] z-10"
          : `hover:shadow-xl ${colors.glow}`,
        isCurrent
          ? "border-muted-foreground/20 opacity-80"
          : colors.border
      )}
    >
      {/* Inner wrapper for the gradient background */}
      <div className="flex flex-col h-full rounded-[15px] bg-card overflow-hidden">
        {/* Top gradient accent */}
        <div className={cn("h-32 bg-gradient-to-b relative", colors.gradient)}>
          {/* Popular badge */}
          {isPopular && !isCurrent && (
            <div className="absolute -top-0 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground shadow-lg shadow-primary/30 px-4 py-1 text-xs font-semibold tracking-wide rounded-b-lg rounded-t-none">
                <Sparkles className="h-3 w-3 mr-1.5" />
                Mais Popular
              </Badge>
            </div>
          )}
          {isCurrent && (
            <div className="absolute -top-0 left-1/2 -translate-x-1/2">
              <Badge className="bg-muted-foreground/50 text-white px-4 py-1 text-xs font-semibold tracking-wide rounded-b-lg rounded-t-none">
                <Check className="h-3 w-3 mr-1.5" />
                Plano Atual
              </Badge>
            </div>
          )}

          {/* Icon centered in gradient */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn(
              "h-16 w-16 rounded-2xl flex items-center justify-center backdrop-blur-sm transition-transform group-hover:scale-110 duration-300",
              colors.iconBg,
            )}>
              <Icon className={cn("h-8 w-8", colors.iconColor)} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 px-6 pb-6 -mt-2">
          {/* Plan name & connections */}
          <div className="text-center mb-5">
            <h3 className="text-xl font-bold tracking-tight">{name}</h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">
              {connections} {connections === 1 ? 'Conexão WhatsApp' : 'Conexões WhatsApp'}
            </p>
          </div>

          {/* Price */}
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="text-sm text-muted-foreground font-medium">R$</span>
              <span className="text-4xl font-extrabold tracking-tight">{displayPrice.toLocaleString('pt-BR')}</span>
              <span className="text-sm text-muted-foreground font-medium">/mês</span>
            </div>
            {isAnnual && savings > 0 ? (
              <p className="text-xs font-medium text-emerald-500 mt-1.5 flex items-center justify-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Economia de R$ {savings.toLocaleString('pt-BR')}/ano
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/50 mt-1.5">cobrado mensalmente</p>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border/50 mb-5" />

          {/* Features */}
          <ul className="space-y-2.5 mb-6 flex-grow">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2.5 text-sm">
                <div className={cn("h-4 w-4 rounded-full flex items-center justify-center mt-0.5 shrink-0", colors.iconBg)}>
                  <Check className={cn("h-2.5 w-2.5", colors.iconColor)} />
                </div>
                <span className="text-foreground/80">{feature}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Button
            className={cn(
              "w-full mt-auto h-11 rounded-xl font-semibold transition-all duration-200",
              isCurrent
                ? "bg-muted text-muted-foreground cursor-default"
                : cn(colors.button, "hover:shadow-lg")
            )}
            onClick={onSelect}
            disabled={isCurrent}
          >
            {isUpgrade && !isCurrent && <ArrowUp className="h-4 w-4 mr-1.5" />}
            {getButtonText()}
          </Button>
        </div>
      </div>
    </div>
  );
};