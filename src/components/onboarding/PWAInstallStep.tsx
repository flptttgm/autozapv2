import { motion } from "framer-motion";
import { Smartphone, Check, Zap, Bell, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

interface PWAInstallStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const PWAInstallStep = ({ onComplete, onSkip }: PWAInstallStepProps) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      onComplete();
    }
  };

  const benefits = [
    { icon: Zap, text: "Acesso rápido com um toque" },
    { icon: Bell, text: "Notificações em tempo real" },
  ];

  // If already installed, skip this step
  if (isInstalled) {
    onComplete();
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto text-center"
    >
      {/* Animated phone icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.2 }}
        className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center"
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <Smartphone className="w-10 h-10 text-primary" />
        </motion.div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold mb-3"
      >
        Instale o Appi AutoZap
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-6"
      >
        Tenha acesso mais rápido direto da tela inicial do seu dispositivo
      </motion.p>

      {/* Benefits list */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-muted/50 rounded-xl p-4 mb-6"
      >
        <div className="space-y-3">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="flex items-center gap-3 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <benefit.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm">{benefit.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* iOS specific instructions */}
      {isIOS ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6"
        >
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
            Como instalar no iPhone/iPad:
          </p>
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <span className="flex items-center gap-1">
                Toque em <Share className="w-4 h-4" /> (compartilhar)
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <span>Role para baixo</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <span className="flex items-center gap-1">
                Toque em <Plus className="w-4 h-4" /> "Adicionar à Tela de Início"
              </span>
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="space-y-3"
      >
        {!isIOS && isInstallable && (
          <Button onClick={handleInstall} size="lg" className="w-full gap-2">
            <Smartphone className="w-4 h-4" />
            Instalar Appi AutoZap
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={onSkip}
          className="w-full text-muted-foreground"
        >
          {isIOS ? "Entendi, continuar" : "Continuar no navegador"}
        </Button>
      </motion.div>
    </motion.div>
  );
};
