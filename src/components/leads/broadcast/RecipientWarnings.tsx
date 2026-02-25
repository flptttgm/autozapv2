import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, MessageSquareWarning } from "lucide-react";
import { 
  getMaxAllowedComplaints,
  detectSensitiveWords 
} from "./constants";

interface RecipientWarningsProps {
  recipientCount: number;
  message: string;
}

/**
 * Simplified warnings for Step 2 (compose) - only critical alerts
 * Best practices, time estimates, and suggestions are now in Step 1
 */
export const RecipientWarnings = ({ recipientCount, message }: RecipientWarningsProps) => {
  const sensitiveWords = detectSensitiveWords(message);
  const maxComplaints = getMaxAllowedComplaints(recipientCount);

  // Only show warnings if there's something to warn about
  const hasSpamWarning = recipientCount >= 50;
  const hasSensitiveWords = sensitiveWords.length > 0;

  if (!hasSpamWarning && !hasSensitiveWords) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* 3% spam threshold warning - critical for 50+ recipients */}
      {hasSpamWarning && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-sm text-red-800 dark:text-red-200">
            Com <strong>{recipientCount} destinatários</strong>, apenas{' '}
            <strong>{maxComplaints} denúncia{maxComplaints !== 1 ? 's' : ''}</strong>{' '}
            de spam {maxComplaints !== 1 ? 'podem' : 'pode'} banir seu número.
          </AlertDescription>
        </Alert>
      )}

      {/* Sensitive words warning */}
      {hasSensitiveWords && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
          <MessageSquareWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Palavras de risco:</strong>{' '}
            {sensitiveWords.map(w => `"${w}"`).join(', ')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
