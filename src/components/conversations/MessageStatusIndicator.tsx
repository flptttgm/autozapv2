import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type DeliveryStatus = 'pending' | 'sent' | 'received' | 'read' | 'played' | 'failed' | null | undefined;

interface MessageStatusIndicatorProps {
  status: DeliveryStatus;
  className?: string;
}

/**
 * Indicador visual de status de entrega de mensagem
 * - pending: ○ (relógio)
 * - sent: ✓ (um check cinza)
 * - received: ✓✓ (dois checks cinza)
 * - read/played: ✓✓ (dois checks azuis)
 * - failed: ! (vermelho)
 */
export function MessageStatusIndicator({ status, className }: MessageStatusIndicatorProps) {
  // Mensagens sem status (antigas ou inbound) - não exibir nada
  if (status === null || status === undefined) {
    return null;
  }
  
  // Apenas mensagens genuinamente pendentes mostram relógio
  if (status === 'pending') {
    return (
      <Clock 
        className={cn("h-3 w-3 text-muted-foreground/50", className)} 
      />
    );
  }
  
  // Mensagem falhou
  if (status === 'failed') {
    return (
      <AlertCircle 
        className={cn("h-3 w-3 text-destructive", className)} 
      />
    );
  }
  
  // Mensagem enviada (um check)
  if (status === 'sent') {
    return (
      <Check 
        className={cn("h-3 w-3 text-muted-foreground", className)} 
      />
    );
  }
  
  // Mensagem recebida (dois checks cinza)
  if (status === 'received') {
    return (
      <CheckCheck 
        className={cn("h-3.5 w-3.5 text-muted-foreground", className)} 
      />
    );
  }
  
  // Mensagem lida ou reproduzida (dois checks azuis - padrão WhatsApp)
  if (status === 'read' || status === 'played') {
    return (
      <CheckCheck 
        className={cn("h-3.5 w-3.5 text-blue-500", className)} 
      />
    );
  }
  
  // Fallback
  return null;
}
