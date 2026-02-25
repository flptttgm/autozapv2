import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Coins, ShoppingCart, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PROSPECT_CREDITS, CreditPackage } from "@/lib/prospect-credits";
import { cn } from "@/lib/utils";

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
}

export function BuyCreditsDialog({ 
  open, 
  onOpenChange, 
  currentBalance 
}: BuyCreditsDialogProps) {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);

  const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const getPricePerCredit = (pkg: CreditPackage) => {
    return (pkg.price / pkg.credits / 100).toFixed(2);
  };

  const handleBuy = () => {
    if (!selectedPackage) return;
    
    // Navigate to checkout with credits type
    navigate(`/checkout?type=credits&package=${selectedPackage.credits}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Comprar Créditos de Prospecção
          </DialogTitle>
          <DialogDescription>
            Selecione um pacote de créditos. Cada crédito permite enriquecer 1 lead ou revelar 1 telefone.
          </DialogDescription>
        </DialogHeader>

        {/* Current Balance */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <span className="text-muted-foreground">Saldo atual:</span>
          <Badge variant="outline" className="text-lg font-semibold">
            {currentBalance} créditos
          </Badge>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROSPECT_CREDITS.packages.map((pkg) => (
            <button
              key={pkg.credits}
              onClick={() => setSelectedPackage(pkg)}
              className={cn(
                "relative p-4 rounded-xl border-2 text-left transition-all hover:border-primary/50",
                selectedPackage?.credits === pkg.credits
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:bg-muted/50"
              )}
            >
              {/* Saving Badge */}
              {pkg.saving > 0 && (
                <Badge 
                  className="absolute -top-2 -right-2 bg-green-500 hover:bg-green-500"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  -{pkg.saving}%
                </Badge>
              )}

              {/* Selected Check */}
              {selectedPackage?.credits === pkg.credits && (
                <div className="absolute top-3 right-3">
                  <Check className="h-5 w-5 text-primary" />
                </div>
              )}

              <div className="space-y-2">
                <div className="text-2xl font-bold">{pkg.credits}</div>
                <div className="text-sm text-muted-foreground">créditos</div>
                <div className="pt-2 border-t border-border/50">
                  <div className="text-lg font-semibold text-primary">
                    {formatPrice(pkg.price)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    R$ {getPricePerCredit(pkg)} por crédito
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Summary & Buy Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          {selectedPackage ? (
            <div className="text-center sm:text-left">
              <p className="font-medium">
                {selectedPackage.credits} créditos por {formatPrice(selectedPackage.price)}
              </p>
              <p className="text-sm text-muted-foreground">
                Novo saldo: {currentBalance + selectedPackage.credits} créditos
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Selecione um pacote para continuar
            </p>
          )}
          
          <Button 
            onClick={handleBuy} 
            disabled={!selectedPackage}
            className="w-full sm:w-auto gap-2"
            size="lg"
          >
            <ShoppingCart className="w-4 h-4" />
            Comprar Agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}