import { Coins, ShoppingCart, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProspectCredits } from "@/hooks/useProspectCredits";

interface ProspectCreditsBarProps {
  onBuyCredits?: () => void;
}

export function ProspectCreditsBar({ onBuyCredits }: ProspectCreditsBarProps) {
  const { balance, monthlyAllocation, isLoading, costs } = useProspectCredits();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  const isLowBalance = balance <= 10;
  const isZeroBalance = balance === 0;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border ${
      isZeroBalance 
        ? "bg-destructive/10 border-destructive/50" 
        : isLowBalance 
          ? "bg-yellow-500/10 border-yellow-500/50" 
          : "bg-muted/50 border-border"
    }`}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={`p-1.5 sm:p-2 rounded-full shrink-0 ${
          isZeroBalance 
            ? "bg-destructive/20" 
            : isLowBalance 
              ? "bg-yellow-500/20" 
              : "bg-primary/10"
        }`}>
          <Coins className={`h-4 w-4 sm:h-5 sm:w-5 ${
            isZeroBalance 
              ? "text-destructive" 
              : isLowBalance 
                ? "text-yellow-600" 
                : "text-primary"
          }`} />
        </div>
        
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="font-semibold text-base sm:text-lg">{balance}</span>
            <span className="text-muted-foreground text-xs sm:text-sm">créditos</span>
            {monthlyAllocation > 0 && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">
                    <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    +{monthlyAllocation}/mês
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Você recebe {monthlyAllocation} créditos todo mês no seu plano
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {/* Custos em layout responsivo */}
          <div className="flex flex-col sm:flex-row sm:gap-3 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            <span>Busca: grátis</span>
            <span className="hidden sm:inline">·</span>
            <span>Enriquecer: {costs.enrich} créd.</span>
            <span className="hidden sm:inline">·</span>
            <span>Revelar tel: {costs.reveal_phone} créd.</span>
          </div>
        </div>
      </div>

      {onBuyCredits && (
        <Button 
          size="sm" 
          variant={isLowBalance ? "default" : "outline"}
          onClick={onBuyCredits}
          className="w-full sm:w-auto"
        >
          <ShoppingCart className="h-4 w-4 mr-1" />
          Comprar Créditos
        </Button>
      )}
    </div>
  );
}
