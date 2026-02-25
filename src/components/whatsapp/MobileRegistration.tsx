import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Phone as PhoneIcon,
  MessageSquare,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Shield,
  KeyRound
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type RegistrationStep = 
  | 'phone-input'
  | 'checking'
  | 'method-select'
  | 'captcha'
  | 'waiting-code'
  | 'code-input'
  | 'pin-input'
  | 'connected'
  | 'error';

interface AvailabilityResult {
  available: boolean;
  blocked: boolean;
  appealToken?: string | null;
  smsWaitSeconds: number;
  voiceWaitSeconds: number;
  waOldWaitSeconds: number;
  waOldEligible: boolean;
  reason?: string | null;
}

export interface MobileRegistrationState {
  step: RegistrationStep;
  phone: string;
  phoneDigits: string;
  method?: 'sms' | 'voice' | 'wa_old';
  availability?: AvailabilityResult | null;
  startedAt: string;
  expiresAt: string;
  captchaImage?: string | null;
}

interface MobileRegistrationProps {
  instanceId: string;
  savedState?: MobileRegistrationState | null;
  onConnected?: () => void;
  onCancel?: () => void;
}

export const MobileRegistration = ({ 
  instanceId, 
  savedState,
  onConnected,
  onCancel
}: MobileRegistrationProps) => {
  const [step, setStep] = useState<RegistrationStep>('phone-input');
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'sms' | 'voice' | 'wa_old'>('sms');
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [stateStartedAt, setStateStartedAt] = useState<string | null>(null);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Restore saved state on mount
  useEffect(() => {
    if (savedState && new Date(savedState.expiresAt) > new Date()) {
      console.log('[MobileRegistration] Restoring saved state:', savedState.step);
      setPhoneNumber(savedState.phone);
      setStep(savedState.step);
      if (savedState.method) setSelectedMethod(savedState.method);
      if (savedState.availability) setAvailability(savedState.availability);
      if (savedState.captchaImage) setCaptchaImage(savedState.captchaImage);
      if (savedState.startedAt) setStateStartedAt(savedState.startedAt);
      toast.info("Continuando registro anterior...");
    }
  }, [savedState]);

  // Format phone number as user types
  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length > 0) {
      formatted = `(${digits.slice(0, 2)}`;
      if (digits.length > 2) {
        formatted += `) ${digits.slice(2, 7)}`;
        if (digits.length > 7) {
          formatted += `-${digits.slice(7, 11)}`;
        }
      }
    }
    setPhoneNumber(formatted);
  };

  const getCleanPhone = () => phoneNumber.replace(/\D/g, "");

  const callApi = async (action: string, body: Record<string, any>) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=${action}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ instance_db_id: instanceId, ...body })
      }
    );
    return response.json();
  };

  // Save state to database
  const saveState = async (newStep: RegistrationStep) => {
    // Only save persistable steps
    const persistableSteps: RegistrationStep[] = ['method-select', 'captcha', 'code-input', 'pin-input'];
    if (!persistableSteps.includes(newStep)) return;

    const state: MobileRegistrationState = {
      step: newStep,
      phone: phoneNumber,
      phoneDigits: getCleanPhone(),
      method: selectedMethod,
      availability,
      startedAt: stateStartedAt || new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      captchaImage,
    };
    
    try {
      await callApi('mobile-save-state', { state });
      if (!stateStartedAt) setStateStartedAt(state.startedAt);
    } catch (err) {
      console.warn('[MobileRegistration] Failed to save state:', err);
    }
  };

  // Clear state from database
  const clearState = async () => {
    try {
      await callApi('mobile-clear-state', {});
      setStateStartedAt(null);
    } catch (err) {
      console.warn('[MobileRegistration] Failed to clear state:', err);
    }
  };

  // Step 1: Check availability
  const checkAvailability = async () => {
    const digits = getCleanPhone();
    if (digits.length < 10 || digits.length > 11) {
      toast.error("Digite um número de telefone válido");
      return;
    }

    try {
      setIsLoading(true);
      setStep('checking');
      setError(null);

      const data = await callApi('mobile-check-availability', { phone: digits, ddi: '55' });
      console.log('[MobileRegistration] Availability:', data);

      if (!data.success) {
        throw new Error(data.error || 'Erro ao verificar disponibilidade');
      }

      setAvailability(data);

      if (data.blocked) {
        setError('Número bloqueado/banido pelo WhatsApp');
        setStep('error');
      } else if (!data.available) {
        setError(data.reason || 'Número indisponível para registro mobile');
        setStep('error');
      } else {
        // Auto-select best method
        if (data.smsWaitSeconds === 0) {
          setSelectedMethod('sms');
        } else if (data.voiceWaitSeconds === 0) {
          setSelectedMethod('voice');
        } else if (data.waOldEligible && data.waOldWaitSeconds === 0) {
          setSelectedMethod('wa_old');
        } else {
          setSelectedMethod('sms');
        }
        setStep('method-select');
        // Save state after successful availability check
        saveState('method-select');
      }
    } catch (err) {
      console.error('[MobileRegistration] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Request code
  const requestCode = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await callApi('mobile-request-code', { 
        phone: getCleanPhone(), 
        ddi: '55',
        method: selectedMethod 
      });
      console.log('[MobileRegistration] Request code:', data);

      if (!data.success) {
        throw new Error(data.error || 'Erro ao solicitar código');
      }

      if (data.blocked) {
        setError('Número foi bloqueado durante a solicitação');
        setStep('error');
        return;
      }

      if (data.captcha) {
        // Captcha required
        setCaptchaImage(data.captcha);
        setStep('captcha');
        saveState('captcha');
      } else if (data.codeSent) {
        // Code sent successfully
        toast.success(`Código enviado via ${selectedMethod === 'sms' ? 'SMS' : selectedMethod === 'voice' ? 'chamada de voz' : 'pop-up'}`);
        setCountdown(120); // 2 minutes to enter code
        setStep('code-input');
        saveState('code-input');
      } else if (data.retryAfter > 0) {
        setCountdown(data.retryAfter);
        setError(`Aguarde ${data.retryAfter} segundos para solicitar novamente`);
      }
    } catch (err) {
      console.error('[MobileRegistration] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast.error("Erro ao solicitar código");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Respond to captcha
  const respondCaptcha = async () => {
    if (captchaInput.length < 3) {
      toast.error("Digite o texto do captcha");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await callApi('mobile-respond-captcha', { captcha: captchaInput });
      console.log('[MobileRegistration] Captcha response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Captcha incorreto');
      }

      if (data.codeSent) {
        toast.success("Captcha verificado! Código enviado.");
        setCountdown(120);
        setStep('code-input');
        saveState('code-input');
      }
    } catch (err) {
      console.error('[MobileRegistration] Error:', err);
      setError(err instanceof Error ? err.message : 'Captcha incorreto');
      setCaptchaInput("");
      toast.error("Captcha incorreto, tente novamente");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Confirm verification code
  const confirmCode = async () => {
    if (verificationCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await callApi('mobile-confirm-code', { 
        code: verificationCode,
        registeredPhone: getCleanPhone()
      });
      console.log('[MobileRegistration] Confirm code:', data);

      if (!data.success) {
        throw new Error(data.error || 'Código inválido');
      }

      if (data.needsPin) {
        toast.info("Verificação em duas etapas ativada. Digite seu PIN.");
        setStep('pin-input');
        saveState('pin-input');
      } else if (data.connected) {
        toast.success("WhatsApp conectado com sucesso!");
        setStep('connected');
        await clearState();
        onConnected?.();
      }
    } catch (err) {
      console.error('[MobileRegistration] Error:', err);
      setError(err instanceof Error ? err.message : 'Código inválido');
      setVerificationCode("");
      toast.error("Código inválido");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 5: Confirm PIN
  const confirmPin = async () => {
    if (pinCode.length !== 6) {
      toast.error("Digite o PIN de 6 dígitos");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await callApi('mobile-confirm-pin', { 
        code: pinCode,
        registeredPhone: getCleanPhone()
      });
      console.log('[MobileRegistration] Confirm PIN:', data);

      if (!data.success) {
        throw new Error(data.error || 'PIN inválido');
      }

      if (data.connected) {
        toast.success("WhatsApp conectado com sucesso!");
        setStep('connected');
        await clearState();
        onConnected?.();
      }
    } catch (err) {
      console.error('[MobileRegistration] Error:', err);
      setError(err instanceof Error ? err.message : 'PIN inválido');
      setPinCode("");
      toast.error("PIN inválido");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = async () => {
    await clearState();
    setStep('phone-input');
    setPhoneNumber("");
    setAvailability(null);
    setCaptchaImage(null);
    setCaptchaInput("");
    setVerificationCode("");
    setPinCode("");
    setError(null);
    setCountdown(0);
  };

  const getStepProgress = () => {
    const steps: RegistrationStep[] = ['phone-input', 'method-select', 'code-input', 'connected'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex === -1) return 25;
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-5 w-full max-w-sm mx-auto">
      {/* Progress */}
      {step !== 'error' && step !== 'connected' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Registro Mobile</span>
            <span>{Math.round(getStepProgress())}%</span>
          </div>
          <Progress value={getStepProgress()} className="h-1.5" />
        </div>
      )}

      {/* Step: Phone Input */}
      {step === 'phone-input' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <Smartphone className="w-5 h-5 text-purple-500 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Registro como Dispositivo Primário
              </p>
              <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-0.5">
                Receba código por SMS ou chamada de voz
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="phone-mobile" className="text-sm font-medium">
              Número do WhatsApp
            </Label>
            <Input
              id="phone-mobile"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="text-center text-lg h-14 font-medium"
              maxLength={16}
            />
          </div>

          <Button 
            onClick={checkAvailability}
            size="lg"
            className="w-full gap-2"
            disabled={getCleanPhone().length < 10}
          >
            <ArrowRight className="w-5 h-5" />
            Verificar e Continuar
          </Button>
        </div>
      )}

      {/* Step: Checking */}
      {step === 'checking' && (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando disponibilidade...</p>
        </div>
      )}

      {/* Step: Method Select */}
      {step === 'method-select' && availability && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              Número disponível!
            </p>
            <p className="text-xs text-muted-foreground">{phoneNumber}</p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Como deseja receber o código?
            </Label>
            
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod('sms')}
                disabled={availability.smsWaitSeconds > 0}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                  selectedMethod === 'sms' && availability.smsWaitSeconds === 0
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50",
                  availability.smsWaitSeconds > 0 && "opacity-50 cursor-not-allowed"
                )}
              >
                <MessageSquare className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">SMS</p>
                  <p className="text-xs text-muted-foreground">
                    {availability.smsWaitSeconds === 0 
                      ? "Disponível agora" 
                      : `Aguardar ${formatTime(availability.smsWaitSeconds)}`}
                  </p>
                </div>
                {selectedMethod === 'sms' && availability.smsWaitSeconds === 0 && (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('voice')}
                disabled={availability.voiceWaitSeconds > 0}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                  selectedMethod === 'voice' && availability.voiceWaitSeconds === 0
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50",
                  availability.voiceWaitSeconds > 0 && "opacity-50 cursor-not-allowed"
                )}
              >
                <PhoneIcon className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Chamada de Voz</p>
                  <p className="text-xs text-muted-foreground">
                    {availability.voiceWaitSeconds === 0 
                      ? "Disponível agora" 
                      : `Aguardar ${formatTime(availability.voiceWaitSeconds)}`}
                  </p>
                </div>
                {selectedMethod === 'voice' && availability.voiceWaitSeconds === 0 && (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                )}
              </button>

              {availability.waOldEligible && (
                <button
                  type="button"
                  onClick={() => setSelectedMethod('wa_old')}
                  disabled={availability.waOldWaitSeconds > 0}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                    selectedMethod === 'wa_old' && availability.waOldWaitSeconds === 0
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50",
                    availability.waOldWaitSeconds > 0 && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Smartphone className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Pop-up no App</p>
                    <p className="text-xs text-muted-foreground">
                      {availability.waOldWaitSeconds === 0 
                        ? "Disponível agora" 
                        : `Aguardar ${formatTime(availability.waOldWaitSeconds)}`}
                    </p>
                  </div>
                  {selectedMethod === 'wa_old' && availability.waOldWaitSeconds === 0 && (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={reset}
              className="flex-1 gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <Button 
              onClick={requestCode}
              disabled={isLoading}
              className="flex-1 gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              Enviar Código
            </Button>
          </div>
        </div>
      )}

      {/* Step: Captcha */}
      {step === 'captcha' && captchaImage && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <Shield className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm font-medium">Verificação de Segurança</p>
            <p className="text-xs text-muted-foreground">Digite o texto da imagem</p>
          </div>

          <div className="flex justify-center">
            <img 
              src={`data:image/png;base64,${captchaImage}`} 
              alt="Captcha" 
              className="rounded-lg border"
            />
          </div>

          <Input
            type="text"
            placeholder="Digite o texto acima"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
            className="text-center text-lg h-14 font-medium uppercase"
            maxLength={10}
          />

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                setCaptchaInput("");
                requestCode(); // Request new captcha
              }}
              className="flex-1 gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Novo Captcha
            </Button>
            <Button 
              onClick={respondCaptcha}
              disabled={isLoading || captchaInput.length < 3}
              className="flex-1 gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              Confirmar
            </Button>
          </div>
        </div>
      )}

      {/* Step: Code Input */}
      {step === 'code-input' && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <MessageSquare className="w-10 h-10 text-primary mx-auto" />
            <p className="text-sm font-medium">Digite o código de 6 dígitos</p>
            <p className="text-xs text-muted-foreground">
              Enviado via {selectedMethod === 'sms' ? 'SMS' : selectedMethod === 'voice' ? 'chamada de voz' : 'pop-up'} para {phoneNumber}
            </p>
          </div>

          {countdown > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Expira em {formatTime(countdown)}</span>
            </div>
          )}

          <Input
            type="text"
            inputMode="numeric"
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-2xl h-16 font-mono tracking-[0.5em]"
            maxLength={6}
          />

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setStep('method-select')}
              className="flex-1 gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <Button 
              onClick={confirmCode}
              disabled={isLoading || verificationCode.length !== 6}
              className="flex-1 gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Confirmar
            </Button>
          </div>

          <button
            onClick={requestCode}
            disabled={countdown > 0 || isLoading}
            className="w-full text-center text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {countdown > 0 ? `Reenviar código em ${formatTime(countdown)}` : 'Reenviar código'}
          </button>
        </div>
      )}

      {/* Step: PIN Input */}
      {step === 'pin-input' && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <KeyRound className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm font-medium">Verificação em Duas Etapas</p>
            <p className="text-xs text-muted-foreground">
              Digite o PIN de 6 dígitos configurado no seu WhatsApp
            </p>
          </div>

          <Input
            type="password"
            inputMode="numeric"
            placeholder="••••••"
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-2xl h-16 font-mono tracking-[0.5em]"
            maxLength={6}
          />

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button 
            onClick={confirmPin}
            disabled={isLoading || pinCode.length !== 6}
            className="w-full gap-2"
            size="lg"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            Confirmar PIN
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Esqueceu o PIN? Você pode{' '}
            <a 
              href="https://faq.whatsapp.com/1276498063087498" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              recuperá-lo no WhatsApp
            </a>
          </p>
        </div>
      )}

      {/* Step: Connected */}
      {step === 'connected' && (
        <div className="space-y-5 text-center py-4">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
            <div className="relative flex items-center justify-center w-20 h-20 bg-green-500/10 rounded-full border-2 border-green-500">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
          </div>
          
          <div className="space-y-1">
            <p className="text-lg font-semibold text-green-700 dark:text-green-300">
              WhatsApp Conectado!
            </p>
            <p className="text-sm text-muted-foreground">
              Dispositivo primário configurado com sucesso
            </p>
            <p className="text-xs text-muted-foreground">{phoneNumber}</p>
          </div>

          <Button 
            onClick={onCancel}
            className="w-full gap-2"
            size="lg"
          >
            Concluir
          </Button>
        </div>
      )}

      {/* Step: Error */}
      {step === 'error' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Erro no Registro
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80">
                  {error}
                </p>
                {availability?.blocked && availability?.appealToken && (
                  <a 
                    href={`https://web.whatsapp.com/appeal?token=${availability.appealToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Solicitar desbanimento
                  </a>
                )}
              </div>
            </div>
          </div>

          <Button 
            onClick={reset}
            variant="outline"
            className="w-full gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Info box */}
      {step === 'phone-input' && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            O registro mobile faz do Z-API o dispositivo primário do WhatsApp, 
            oferecendo maior estabilidade e evitando desconexões.
          </p>
        </div>
      )}
    </div>
  );
};

export default MobileRegistration;
