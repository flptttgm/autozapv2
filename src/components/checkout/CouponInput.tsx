import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag, Check, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AppliedCoupon {
  code: string;
  discount_percent: number;
  coupon_id: string;
}

interface CouponInputProps {
  onCouponApplied: (coupon: AppliedCoupon) => void;
  onCouponRemoved: () => void;
  appliedCoupon: AppliedCoupon | null;
  workspaceId: string;
  orderValue: number;
}

export function CouponInput({
  onCouponApplied,
  onCouponRemoved,
  appliedCoupon,
  workspaceId,
  orderValue,
}: CouponInputProps) {
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleApplyCoupon = async () => {
    if (!code.trim()) {
      setError("Digite o código do cupom");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("validate-coupon", {
        body: {
          code: code.trim().toUpperCase(),
          workspace_id: workspaceId,
          value: orderValue,
        },
      });

      if (fnError) {
        throw new Error("Erro ao validar cupom");
      }

      if (data.valid) {
        onCouponApplied({
          code: data.code,
          discount_percent: data.discount_percent,
          coupon_id: data.coupon_id,
        });
        setCode("");
        toast({
          title: "Cupom aplicado!",
          description: `Desconto de ${data.discount_percent}% aplicado ao seu pedido.`,
        });
      } else {
        setError(data.reason || "Cupom inválido");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao validar cupom");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    onCouponRemoved();
    setCode("");
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyCoupon();
    }
  };

  if (appliedCoupon) {
    return (
      <Card className="border-emerald-500/50 bg-emerald-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Cupom aplicado</span>
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-0">
                    {appliedCoupon.discount_percent}% OFF
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono">
                  {appliedCoupon.code}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveCoupon}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <Label className="text-sm font-medium flex items-center gap-2 mb-3">
          <Tag className="h-4 w-4" />
          Cupom de Desconto
        </Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Digite o código"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              className={error ? "border-destructive" : ""}
              disabled={isValidating}
            />
          </div>
          <Button
            onClick={handleApplyCoupon}
            disabled={isValidating || !code.trim()}
            variant="secondary"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Aplicar"
            )}
          </Button>
        </div>
        {error && (
          <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
            <X className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
