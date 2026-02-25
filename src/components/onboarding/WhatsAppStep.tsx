import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Smartphone,
  Loader2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  QrCode,
  KeyRound,
  AlertTriangle,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { PhoneCodeConnection } from "@/components/whatsapp/PhoneCodeConnection";

interface WhatsAppStepProps {
  workspaceId: string | null;
  onNext: () => void;
  onSkip: () => void;
  isSaving?: boolean;
}

interface WhatsAppInstance {
  id: string;
  instance_id: string;
  instance_token: string;
  status: string;
}

const MAX_RECREATE_ATTEMPTS = 3;

interface BlockedState {
  isBlocked: boolean;
  message: string;
}

export const WhatsAppStep = ({ workspaceId, onNext, onSkip, isSaving }: WhatsAppStepProps) => {
  const isMobile = useIsMobile();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRecreating, setIsRecreating] = useState(false);
  const [recreateAttempt, setRecreateAttempt] = useState(0);
  const [blockedState, setBlockedState] = useState<BlockedState>({ isBlocked: false, message: '' });
  const [connectionMethod, setConnectionMethod] = useState<'code' | 'qr'>(isMobile ? 'code' : 'qr');

  // Flag síncrona para evitar múltiplos toasts de conexão
  const hasShownConnectedToast = useRef(false);

  // Check for existing instance on mount
  useEffect(() => {
    const checkExistingInstance = async () => {
      if (!workspaceId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=list&workspace_id=${workspaceId}`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.instances && data.instances.length > 0) {
            const existingInstance = data.instances[0];
            setInstance(existingInstance);

            if (existingInstance.status === 'blocked') {
              setBlockedState({
                isBlocked: true,
                message: 'Este número já está vinculado a outra conta. Por favor, use um número diferente.'
              });
              return;
            }

            if (existingInstance.status === 'connected') {
              setIsConnected(true);
            } else if (!isMobile) {
              // Only auto-fetch QR if on desktop
              setTimeout(() => fetchQRCode(existingInstance.id), 500);
            }
          }
        }
      } catch (error) {
        console.error('Error checking existing instance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingInstance();
  }, [workspaceId, isMobile]);

  const createInstance = async () => {
    if (!workspaceId) {
      toast.error("Erro ao criar instância");
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ workspace_id: workspaceId })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error?.includes('duplicate') || errorData.error?.includes('already exists')) {
          toast.info("Você já tem uma conexão WhatsApp. Carregando...");
          const listResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=list&workspace_id=${workspaceId}`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
            }
          );
          if (listResponse.ok) {
            const listData = await listResponse.json();
            if (listData.instances?.length > 0) {
              setInstance(listData.instances[0]);
            }
          }
          return;
        }
        throw new Error('Failed to create instance');
      }

      const data = await response.json();
      setInstance(data.instance);

      // Fallback: garantir modo seletivo após criação
      if (data.instance?.id && data.instance?.ai_mode !== 'selective') {
        console.log('[WhatsAppStep] Forcing selective mode for new instance');
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        );
        await supabase
          .from('whatsapp_instances')
          .update({ ai_mode: 'selective' })
          .eq('id', data.instance.id);
      }

      // Don't auto-fetch QR on mobile - user will use phone code
      if (!isMobile && connectionMethod === 'qr') {
        setTimeout(() => fetchQRCode(data.instance.id), 2000);
      }
    } catch (error) {
      console.error('Error creating instance:', error);
      toast.error("Erro ao criar conexão WhatsApp");
    } finally {
      setIsCreating(false);
    }
  };

  const recreateInstance = async (): Promise<boolean> => {
    if (!workspaceId || !instance) return false;

    if (recreateAttempt >= MAX_RECREATE_ATTEMPTS) {
      setQrError("Não foi possível conectar após várias tentativas. Entre em contato com o suporte.");
      setIsRecreating(false);
      return false;
    }

    try {
      setIsRecreating(true);
      const currentAttempt = recreateAttempt + 1;
      setRecreateAttempt(currentAttempt);

      console.log(`[recreate] Attempt ${currentAttempt}/${MAX_RECREATE_ATTEMPTS}`);
      toast.info(`Recriando conexão... Tentativa ${currentAttempt}/${MAX_RECREATE_ATTEMPTS}`);

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=delete&instance_db_id=${instance.id}`,
        {
          method: 'DELETE',
          headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        }
      );

      const createResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ workspace_id: workspaceId })
        }
      );

      if (!createResponse.ok) {
        throw new Error('Failed to recreate instance');
      }

      const data = await createResponse.json();
      console.log('[recreate] New instance created:', data.instance?.id);
      setInstance(data.instance);

      setTimeout(() => {
        setIsRecreating(false);
        if (connectionMethod === 'qr') {
          fetchQRCode(data.instance.id, 0);
        }
      }, 3000);

      return true;
    } catch (error) {
      console.error('[recreate] Error:', error);
      setQrError("Erro ao recriar conexão. Tente novamente.");
      setIsRecreating(false);
      return false;
    }
  };

  const fetchQRCode = async (instanceId: string, retry = 0) => {
    try {
      setQrLoading(true);
      setQrError(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=qrcode&instance_db_id=${instanceId}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const data = await response.json();

      if (data.needsRecreate || data.error === 'INSTANCE_EXPIRED') {
        setQrError("Conexão expirada. Recriando automaticamente...");
        setQrLoading(false);

        const recreated = await recreateInstance();
        if (!recreated && retry < 2) {
          setTimeout(() => fetchQRCode(instanceId, retry + 1), 5000);
        }
        return;
      }

      const qrValue = data.value || data.qrcode || data.image;

      if (qrValue) {
        setQrCode(qrValue);
        setCountdown(30);
        setRetryCount(0);
        setQrError(null);
        setRecreateAttempt(0);
      } else {
        setRetryCount(retry + 1);

        if (retry < 5) {
          setQrError("Preparando conexão... Aguarde alguns segundos");
          setTimeout(() => fetchQRCode(instanceId, retry + 1), 3000);
        } else {
          setQrError("QR Code ainda não disponível. Clique para tentar novamente.");
        }
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
      setQrError("Erro ao obter QR Code");

      if (retry < 3) {
        setTimeout(() => fetchQRCode(instanceId, retry + 1), 3000);
      }
    } finally {
      setQrLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!instance) return;

    try {
      setCheckingStatus(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=status&instance_db_id=${instance.id}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to check status');

      const data = await response.json();

      if (data.blocked) {
        setBlockedState({
          isBlocked: true,
          message: 'Este número de WhatsApp já está vinculado a outra conta. Por favor, use um número diferente.'
        });
        toast.error("Número bloqueado! Este WhatsApp já está em uso em outra conta.", { duration: 8000 });
        setQrCode(null);
        return;
      }

      if (data.connected) {
        setIsConnected(true);
        setQrCode(null);
        // Toast apenas se ainda não foi exibido
        if (!hasShownConnectedToast.current) {
          hasShownConnectedToast.current = true;
          toast.success("WhatsApp conectado com sucesso!");
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleRetryWithNewNumber = async () => {
    if (!instance) return;

    setBlockedState({ isBlocked: false, message: '' });
    setQrCode(null);

    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=delete&instance_db_id=${instance.id}`,
        {
          method: 'DELETE',
          headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        }
      );
    } catch (error) {
      console.error('Error deleting blocked instance:', error);
    }

    setInstance(null);
    toast.info("Instância removida. Conecte com um número diferente.");
  };

  const handlePhoneCodeExpired = () => {
    recreateInstance();
  };

  // Auto-refresh QR code countdown
  useEffect(() => {
    if (qrCode && countdown > 0 && !isConnected) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && qrCode && instance && !isConnected) {
      fetchQRCode(instance.id);
    }
  }, [countdown, qrCode, instance, isConnected]);

  // Poll for connection status
  useEffect(() => {
    if (instance && !isConnected) {
      const interval = setInterval(checkStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [instance, isConnected]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center max-w-md mx-auto"
      >
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-primary/10">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <p className="text-muted-foreground">Verificando conexões existentes...</p>
      </motion.div>
    );
  }

  // Blocked UI
  if (blockedState.isBlocked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col items-center text-center max-w-md mx-auto"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-red-500/10 relative"
        >
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <span className="absolute -top-1 -right-1 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-6 w-6 bg-red-600 items-center justify-center">
              <XCircle className="w-4 h-4 text-white" />
            </span>
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-red-600 dark:text-red-400 mb-3"
        >
          Conexão Bloqueada
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-xl bg-red-500/10 border-2 border-red-500/30 mb-6 text-left"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Este número já está vinculado a outra conta
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80">
                Por segurança, cada número de WhatsApp só pode ser usado em uma única conta.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col gap-3 w-full"
        >
          <Button
            onClick={handleRetryWithNewNumber}
            size="lg"
            className="w-full gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar com outro número
          </Button>

          <Button onClick={onSkip} variant="ghost" size="sm">
            Pular esta etapa
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center text-center max-w-md mx-auto"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.2 }}
        className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isConnected ? 'bg-green-500/10' : 'bg-primary/10'
          }`}
      >
        {isConnected ? (
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        ) : (
          <Smartphone className="w-10 h-10 text-primary" />
        )}
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold text-foreground mb-2"
      >
        {isConnected ? "WhatsApp Conectado!" : "Conecte seu WhatsApp"}
      </motion.h1>

      {!isConnected && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="inline-block px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded-full mb-3"
        >
          Opcional - você pode configurar depois
        </motion.span>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-6"
      >
        {isConnected
          ? "Tudo pronto para enviar e receber mensagens"
          : isMobile
            ? "Digite seu número para gerar o código de conexão"
            : "Escaneie o QR Code ou use o código de pareamento"
        }
      </motion.p>

      {/* Create Instance Button */}
      {!instance && !isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={createInstance}
            size="lg"
            className="gap-2"
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Criando conexão...
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" />
                Conectar WhatsApp
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* Connection Methods */}
      {instance && !isConnected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full space-y-4"
        >
          {/* Mobile: Default to Phone Code */}
          {isMobile ? (
            <PhoneCodeConnection
              instanceId={instance.id}
              onConnected={() => {
                setIsConnected(true);
                if (!hasShownConnectedToast.current) {
                  hasShownConnectedToast.current = true;
                  toast.success("WhatsApp conectado com sucesso!");
                }
              }}
              onExpired={handlePhoneCodeExpired}
            />
          ) : (
            /* Desktop: Tabs for QR Code and Phone Code */
            <Tabs
              value={connectionMethod}
              onValueChange={(v) => {
                setConnectionMethod(v as 'code' | 'qr');
                if (v === 'qr' && !qrCode && instance) {
                  fetchQRCode(instance.id);
                }
              }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full mb-6">
                <TabsTrigger value="qr" className="gap-2">
                  <QrCode className="w-4 h-4" />
                  QR Code
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-2">
                  <KeyRound className="w-4 h-4" />
                  Código
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="space-y-4">
                {/* QR Code Display */}
                {qrCode ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative bg-white rounded-xl shadow-xl ring-1 ring-black/5 overflow-hidden">
                      <img
                        src={qrCode}
                        alt="QR Code WhatsApp"
                        className="w-56 h-56 block"
                      />
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-full shadow-md border text-xs font-medium">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        <span className="text-muted-foreground">Atualiza em</span>
                        <span className="text-foreground font-bold">{countdown}s</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => instance && fetchQRCode(instance.id, 0)}
                      variant="ghost"
                      size="sm"
                      className="gap-2 mt-4"
                      disabled={qrLoading}
                    >
                      <RefreshCw className={`w-4 h-4 ${qrLoading ? 'animate-spin' : ''}`} />
                      Atualizar QR Code
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 bg-muted/30 p-8 rounded-2xl border border-dashed w-60 h-60 mx-auto">
                    {qrLoading || isRecreating ? (
                      <>
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground text-center">
                          {isRecreating ? (
                            <>
                              Recriando conexão...
                              <span className="block text-xs mt-1 font-medium">
                                Tentativa {recreateAttempt}/{MAX_RECREATE_ATTEMPTS}
                              </span>
                            </>
                          ) : (
                            <>
                              Gerando QR Code...
                              {retryCount > 0 && <span className="block text-xs mt-1">Tentativa {retryCount}/5</span>}
                            </>
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-10 h-10 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground text-center">
                          {qrError || "Clique para gerar QR Code"}
                        </p>
                        <Button
                          onClick={() => instance && fetchQRCode(instance.id, 0)}
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          disabled={qrLoading}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Gerar QR Code
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="code">
                <PhoneCodeConnection
                  instanceId={instance.id}
                  onConnected={() => {
                    setIsConnected(true);
                    if (!hasShownConnectedToast.current) {
                      hasShownConnectedToast.current = true;
                      toast.success("WhatsApp conectado com sucesso!");
                    }
                  }}
                  onExpired={handlePhoneCodeExpired}
                />
              </TabsContent>
            </Tabs>
          )}
        </motion.div>
      )}

      {/* Connected Success */}
      {isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm text-green-700 dark:text-green-300 font-medium">
              Pronto para receber mensagens
            </span>
          </div>

          <Button onClick={onNext} size="lg" className="gap-2 px-8 mt-4" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* Skip Button */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6"
        >
          <Button
            onClick={onSkip}
            variant="outline"
            size="lg"
            className="gap-2"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                Fazer isso depois
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Você pode conectar a qualquer momento nas configurações
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};
