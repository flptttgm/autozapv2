import { Lightbulb, AlertTriangle, Target, CheckCircle } from "lucide-react";
import { BEST_PRACTICES_TIPS, CRITICAL_WARNING, SUCCESS_CASE } from "./constants";

export const BestPracticesPanel = () => {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4">
      <div className="space-y-4">
        {/* Header with main insight */}
        <div className="flex items-start gap-3">
          <Target className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">
              🎯 O MAIS IMPORTANTE: Para QUEM você envia!
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Quantidade não é o problema - qualidade da base é.
            </p>
          </div>
        </div>

        {/* Best practices list */}
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">
              Boas Práticas Z-API - Evite Bloqueio
            </p>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
              {BEST_PRACTICES_TIPS.map((tip, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Success case highlight */}
        <div className="flex items-start gap-2 p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-200">
          <span className="text-lg shrink-0">💡</span>
          <div>
            <strong>Caso de sucesso:</strong> {SUCCESS_CASE}
          </div>
        </div>
        
        {/* Critical warning highlighted */}
        <div className="flex items-start gap-2 p-3 bg-red-100 dark:bg-red-950/50 rounded-lg text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>⚠️ ATENÇÃO:</strong> {CRITICAL_WARNING}
          </div>
        </div>
      </div>
    </div>
  );
};
