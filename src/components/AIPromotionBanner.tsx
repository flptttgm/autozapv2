import { useState, useEffect } from "react";
import { X, Sparkles, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface AIPromotionBannerProps {
  onOpenAIChat: () => void;
}

const STORAGE_KEY = "ai-promotion-dismissed";
const DISMISS_DURATION_DAYS = 7;

export const AIPromotionBanner = ({ onOpenAIChat }: AIPromotionBannerProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verificar se o usuário já dispensou o banner
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      // Se marcou como "used", nunca mais mostrar
      if (dismissed === "used") {
        return;
      }
      
      const dismissedDate = new Date(dismissed);
      const now = new Date();
      const diffDays = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Mostrar novamente após X dias
      if (diffDays < DISMISS_DURATION_DAYS) {
        return;
      }
    }
    
    // Delay para não aparecer imediatamente ao carregar
    const timer = setTimeout(() => setIsVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setIsVisible(false);
  };

  const handleOpenChat = () => {
    // Marcar como "já usou" - não mostrar mais
    localStorage.setItem(STORAGE_KEY, "used");
    onOpenAIChat();
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 
                     w-[calc(100%-2rem)] sm:w-[320px] max-w-sm
                     bg-card border border-border rounded-xl shadow-2xl p-3"
        >
          {/* Botão de fechar */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full 
                       hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          <div className="flex gap-3">
            {/* Conteúdo */}
            <div className="flex-1 space-y-2 pr-3">
              {/* Header com ícone */}
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-full bg-primary/20 
                                flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  Assistente IA
                </span>
              </div>

              {/* Texto */}
              <p className="text-xs text-foreground leading-normal">
                Precisa de ajuda? Nosso assistente IA pode te ajudar 
                a usar a plataforma e tirar dúvidas!
              </p>

              {/* Botão de ação */}
              <Button
                onClick={handleOpenChat}
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                Experimentar agora
              </Button>
            </div>

            {/* Ilustração decorativa */}
            <div className="hidden sm:flex items-center justify-center 
                            w-12 h-12 rounded-lg bg-primary/10 shrink-0 self-center">
              <Bot className="h-6 w-6 text-primary/60" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
