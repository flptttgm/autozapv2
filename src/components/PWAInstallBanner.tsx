import { useState } from "react";
import { X, Smartphone, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

export const PWAInstallBanner = () => {
  const { isInstallable, isInstalled, isIOS, install, dismiss } = usePWAInstall();
  const { profile, refreshProfile } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Don't show if not installable, already installed, or user dismissed
  if (!isInstallable || isInstalled || profile?.pwa_dismissed || !isVisible) {
    return null;
  }

  const handleDismiss = async () => {
    setIsLoading(true);
    try {
      if (profile?.id) {
        await supabase
          .from("profiles")
          .update({ pwa_dismissed: true })
          .eq("id", profile.id);
        await refreshProfile();
      }
      setIsVisible(false);
      dismiss();
    } catch (error) {
      console.error("Error dismissing PWA banner:", error);
      setIsVisible(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setIsVisible(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20 p-4 sm:p-5">
            {/* Close button */}
            <button
              onClick={handleDismiss}
              disabled={isLoading}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 p-3 rounded-full bg-primary/10">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-6 sm:pr-0">
                <h3 className="font-semibold text-foreground text-base sm:text-lg">
                  Instale o Appi AutoZap no seu dispositivo
                </h3>
                {isIOS ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    Toque em <Share className="inline h-4 w-4 mx-1" /> (compartilhar) → "Adicionar à Tela de Início"
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Acesso rápido • Notificações em tempo real
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {isIOS ? (
                  <Button
                    onClick={handleDismiss}
                    disabled={isLoading}
                    className="w-full sm:w-auto"
                  >
                    Entendi
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleInstall}
                      className="flex-1 sm:flex-none gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Instalar App
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleDismiss}
                      disabled={isLoading}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Agora não
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
