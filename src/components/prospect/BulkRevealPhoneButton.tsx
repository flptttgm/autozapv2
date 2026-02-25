import { useState } from "react";
import { Phone, Loader2, AlertTriangle } from "lucide-react";
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
import { ApolloEnrichedPerson } from "@/types/apollo";

interface BulkRevealPhoneButtonProps {
  people: ApolloEnrichedPerson[];
  onReveal: (personIds: string[]) => Promise<void>;
  isRevealing?: boolean;
}

export function BulkRevealPhoneButton({
  people,
  onReveal,
  isRevealing = false,
}: BulkRevealPhoneButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { balance, canAfford, costs } = useProspectCredits();

  // Filtrar pessoas que podem ter telefone revelado (has_direct_phone != "No" e sem telefone ainda)
  const eligiblePeople = people.filter(p => 
    !p.phone_numbers?.length && 
    // Se não tem campo has_direct_phone, assume que pode ter
    (p as any).has_direct_phone !== "No"
  );

  const count = eligiblePeople.length;
  const totalCost = costs.reveal_phone * count;
  const canAffordAll = canAfford("reveal_phone", count);

  if (count === 0) {
    return null;
  }

  const handleClick = () => {
    if (!canAffordAll) {
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    await onReveal(eligiblePeople.map(p => p.id));
  };

  const maybeCount = eligiblePeople.filter(p => (p as any).has_direct_phone === "Maybe").length;

  return (
    <>
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={isRevealing || !canAffordAll}
        className="gap-2"
        title={!canAffordAll ? `Créditos insuficientes (precisa de ${totalCost}, você tem ${balance})` : undefined}
      >
        {isRevealing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Phone className="h-4 w-4" />
        )}
        Revelar {count} telefone(s) ({totalCost} créd.)
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar revelação em massa</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a gastar <strong>{totalCost} créditos</strong> para revelar 
                telefones de <strong>{count} contato(s)</strong>.
              </p>
              
              {maybeCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg text-yellow-700">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Atenção</p>
                    <p className="text-sm">
                      {maybeCount} contato(s) tem probabilidade <strong>média</strong> de ter telefone.
                      Os créditos serão cobrados mesmo se alguns telefones não estiverem disponíveis.
                    </p>
                  </div>
                </div>
              )}

              <div className="text-sm text-muted-foreground border-t pt-3">
                <p>Saldo atual: {balance} créditos</p>
                <p>Após revelação: {balance - totalCost} créditos</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmar ({totalCost} créditos)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
