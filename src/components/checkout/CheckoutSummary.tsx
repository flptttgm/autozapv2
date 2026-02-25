import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Plus, Tag, Coins, Sparkles, Wrench } from "lucide-react";
import { PLAN_PRICES } from "@/hooks/useSubscription";
import { getCheckoutFeatures, CONNECTION_PRICE, connectionFeatures } from "@/lib/plan-definitions";
import { CreditPackage } from "@/lib/prospect-credits";

interface AppliedCoupon {
  code: string;
  discount_percent: number;
  coupon_id: string;
}

interface CheckoutSummaryProps {
  planName: string;
  isAnnual: boolean;
  isConnectionPurchase?: boolean;
  isCreditsPurchase?: boolean;
  creditsPackage?: CreditPackage | null;
  appliedCoupon?: AppliedCoupon | null;
  installationFee?: number;
  sellerName?: string;
}

export function CheckoutSummary({ 
  planName, 
  isAnnual, 
  isConnectionPurchase = false,
  isCreditsPurchase = false,
  creditsPackage,
  appliedCoupon,
  installationFee = 0,
  sellerName 
}: CheckoutSummaryProps) {
  const calculateDiscount = (originalPrice: number) => {
    if (!appliedCoupon) return { discountValue: 0, finalPrice: originalPrice };
    const discountValue = originalPrice * (appliedCoupon.discount_percent / 100);
    return { discountValue, finalPrice: originalPrice - discountValue };
  };

  // Credits purchase summary
  if (isCreditsPurchase && creditsPackage) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Resumo do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b">
            <div>
              <h3 className="font-semibold text-lg">
                {creditsPackage.credits} Créditos
              </h3>
              <p className="text-sm text-muted-foreground">
                Prospecção de leads
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                R$ {(creditsPackage.price / 100).toLocaleString("pt-BR")}
              </p>
              <p className="text-sm text-muted-foreground">pagamento único</p>
            </div>
          </div>

          {creditsPackage.saving > 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-lg">
              <Sparkles className="h-4 w-4" />
              Economia de {creditsPackage.saving}% neste pacote!
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">O que você recebe:</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                {creditsPackage.credits} créditos de prospecção
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                Enriquecer dados de leads (1 crédito/lead)
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                Revelar telefones (1 crédito/telefone)
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                Créditos não expiram
              </div>
            </div>
          </div>

          <div className="pt-3 border-t">
            <div className="flex items-center justify-between font-semibold text-lg">
              <span>Total</span>
              <span className="text-primary">
                R$ {(creditsPackage.price / 100).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connection purchase summary
  if (isConnectionPurchase) {
    const originalPrice = isAnnual ? CONNECTION_PRICE.annual : CONNECTION_PRICE.monthly;
    const monthlyPrice = CONNECTION_PRICE.monthly;
    const { discountValue, finalPrice } = calculateDiscount(originalPrice);

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Resumo do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b">
            <div>
              <h3 className="font-semibold text-lg">Conexão Extra</h3>
              <p className="text-sm text-muted-foreground">
                {isAnnual ? "Cobrança anual" : "Cobrança mensal"}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${appliedCoupon ? "text-muted-foreground line-through text-lg" : ""}`}>
                R$ {originalPrice.toLocaleString("pt-BR")}
              </p>
              {appliedCoupon && (
                <p className="text-2xl font-bold text-primary">
                  R$ {finalPrice.toLocaleString("pt-BR")}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                /{isAnnual ? "ano" : "mês"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">O que você recebe:</p>
            {connectionFeatures.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                {feature}
              </div>
            ))}
          </div>

          {appliedCoupon && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Cupom {appliedCoupon.code}
                </span>
                <span className="text-emerald-600 font-medium">
                  - R$ {discountValue.toLocaleString("pt-BR")} ({appliedCoupon.discount_percent}%)
                </span>
              </div>
            </div>
          )}

          {isAnnual && !appliedCoupon && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Economia anual</span>
                <span className="text-emerald-600 font-medium">
                  R$ {((monthlyPrice * 12 - originalPrice)).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t">
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span className="text-lg">
                R$ {finalPrice.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const plan = planName.toLowerCase();
  const prices = PLAN_PRICES[plan as keyof typeof PLAN_PRICES];
  const originalPrice = isAnnual ? prices.annual : prices.monthly;
  const features = getCheckoutFeatures(planName);
  const { discountValue, finalPrice } = calculateDiscount(originalPrice);
  const totalWithInstallation = finalPrice + installationFee;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Resumo do Pedido
          </CardTitle>
          {plan === "pro" && (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Popular
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h3 className="font-semibold text-lg capitalize">Plano {planName}</h3>
            <p className="text-sm text-muted-foreground">
              {isAnnual ? "Cobrança anual" : "Cobrança mensal"}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${appliedCoupon ? "text-muted-foreground line-through text-lg" : ""}`}>
              R$ {originalPrice.toLocaleString("pt-BR")}
            </p>
            {appliedCoupon && (
              <p className="text-2xl font-bold text-primary">
                R$ {finalPrice.toLocaleString("pt-BR")}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              /{isAnnual ? "ano" : "mês"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Incluso no plano:</p>
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary shrink-0" />
              {feature}
            </div>
          ))}
        </div>

        {appliedCoupon && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Cupom {appliedCoupon.code}
              </span>
              <span className="text-emerald-600 font-medium">
                - R$ {discountValue.toLocaleString("pt-BR")} ({appliedCoupon.discount_percent}%)
              </span>
            </div>
          </div>
        )}

        {isAnnual && !appliedCoupon && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Economia anual</span>
              <span className="text-emerald-600 font-medium">
                R$ {((prices.monthly * 12 - prices.annual)).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        )}

        {/* Installation fee when referred by seller */}
        {installationFee > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Taxa de instalação
                {sellerName && (
                  <span className="text-xs">({sellerName})</span>
                )}
              </span>
              <span className="font-medium">
                R$ {installationFee.toLocaleString("pt-BR")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cobrada apenas na primeira compra
            </p>
          </div>
        )}

        <div className="pt-3 border-t">
          <div className="flex items-center justify-between font-semibold">
            <span>Total</span>
            <span className="text-lg">
              R$ {totalWithInstallation.toLocaleString("pt-BR")}
            </span>
          </div>
          {installationFee > 0 && (
            <p className="text-xs text-muted-foreground mt-1 text-right">
              Renovação: R$ {finalPrice.toLocaleString("pt-BR")}/{isAnnual ? "ano" : "mês"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
