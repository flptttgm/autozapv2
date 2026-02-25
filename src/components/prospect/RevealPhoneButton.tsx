import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProspectCredits } from "@/hooks/useProspectCredits";

interface RevealPhoneButtonProps {
  personId: string;
  hasDirectPhone: "Yes" | "Maybe" | "No";
  isRevealed: boolean;
  onReveal: (personId: string) => Promise<void>;
  isRevealing?: boolean;
  size?: "sm" | "default";
}

export function RevealPhoneButton({
  personId,
  hasDirectPhone,
  isRevealed,
  onReveal,
  isRevealing = false,
  size = "sm",
}: RevealPhoneButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { balance, getCost, canAfford, costs } = useProspectCredits();

  const cost = costs.reveal_phone;
  const canAffordReveal = canAfford("reveal_phone", 1);

  // Não mostrar botão se já revelado ou se não tem telefone
  if (isRevealed || hasDirectPhone === "No") {
    return null;
  }

  const handleClick = () => {
    if (!canAffordReveal) {
      return; // Deveria mostrar modal de comprar créditos
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    await onReveal(personId);
  };

  return (
    <>
      <Button
        size={size}
        variant="outline"
        onClick={handleClick}
        disabled={isRevealing || !canAffordReveal}
        className={`gap-1 ${hasDirectPhone === "Maybe" ? "text-yellow-600 border-yellow-500/50" : "text-primary"}`}
        title={!canAffordReveal ? `Créditos insuficientes (precisa de ${cost}, você tem ${balance})` : undefined}
      >
        {isRevealing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Phone className="h-3 w-3" />
        )}
        <span className="text-xs">
          {hasDirectPhone === "Yes" ? "Revelar" : "Tentar"}
          ({cost} créd.)
        </span>
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar revelação de telefone</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a gastar <strong>{cost} créditos</strong> para revelar o telefone deste contato.
              </p>
              {hasDirectPhone === "Maybe" && (
                <p className="text-yellow-600">
                  ⚠️ Este contato tem probabilidade <strong>média</strong> de ter telefone disponível.
                  Os créditos serão cobrados mesmo se o telefone não estiver disponível.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Saldo atual: {balance} créditos → Após: {balance - cost} créditos
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmar ({cost} créditos)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
