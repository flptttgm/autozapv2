import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  Lock,
  Check,
  Bot,
  Shield,
  Clock,
  MessageSquare,
  EyeOff,
  Phone,
  User,
  Star,
} from "lucide-react";
import { z } from "zod";
import YouTubeEmbed from "@/components/landing/YouTubeEmbed";
import videoThumbnail from "@/assets/video-thumbnail.png";
import { motion } from "framer-motion";
import { isSuspiciousEmail, maskPhone } from "@/lib/validators";
import { trackSignupConversion, trackTrialConversion } from "@/lib/gtag";

// Key for storing referral code in localStorage
const REFERRAL_CODE_KEY = "autozap_ref_code";

const signUpSchema = z.object({
  email: z.string().trim().email("Email inválido").refine((email) => {
    const result = isSuspiciousEmail(email);
    return !result.suspicious;
  }, "Este email parece inválido. Por favor, use um email real."),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
  whatsappNumber: z.string().refine((val) => val.replace(/\D/g, '').length >= 10, {
    message: "WhatsApp deve ter pelo menos 10 dígitos",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

// emailOnlySchema removido - Magic Link desativado

const features = [
  { icon: Bot, text: "Atendimento inteligente com IA" },
  { icon: Clock, text: "48h de teste grátis - sem cartão" },
  { icon: MessageSquare, text: "Captura automática de leads" },
  { icon: Shield, text: "Dados protegidos e seguros" },
];

export default function Auth() {
  const { user, profile, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") === "login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    whatsappNumber: "",
  });
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    whatsappNumber?: string;
  }>({});
  const [touched, setTouched] = useState<{
    email?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
    whatsappNumber?: boolean;
  }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Capture referral code and custom redirect parameters from URL on mount
  useEffect(() => {
    const refCode = searchParams.get("ref");
    const skipOnboarding = searchParams.get("skip_onboarding");
    const redirectTo = searchParams.get("redirect");

    if (refCode) {
      localStorage.setItem(REFERRAL_CODE_KEY, refCode);
      console.log("[referral] Captured referral code:", refCode);
    }
    if (skipOnboarding === "true") {
      localStorage.setItem("skip_onboarding", "true");
      console.log("[auth] Skip onboarding enabled");
    }
    if (redirectTo) {
      localStorage.setItem("redirect_after_auth", redirectTo);
      console.log("[auth] Redirect after auth:", redirectTo);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && user) {
      // If profile is loaded and onboarding is NOT completed, go to onboarding
      if (profile && profile.onboarding_completed === false) {
        navigate("/onboarding");
      } else {
        // Otherwise, go to dashboard (or stored redirect)
        const redirectAfterAuth = localStorage.getItem("redirect_after_auth");
        if (redirectAfterAuth) {
          navigate(redirectAfterAuth);
          localStorage.removeItem("redirect_after_auth");
        } else {
          navigate("/dashboard");
        }
      }
    }
  }, [user, profile, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const validateField = (field: string, value: string) => {
    try {
      if (field === "email") {
        z.string().trim().email("Email inválido").parse(value);
        // Validação adicional de padrão suspeito (apenas no cadastro)
        if (!isLogin) {
          const suspiciousCheck = isSuspiciousEmail(value);
          if (suspiciousCheck.suspicious) {
            throw new z.ZodError([{
              code: "custom" as const,
              message: suspiciousCheck.reason || "Este email parece inválido",
              path: ["email"]
            }]);
          }
        }
      } else if (field === "password") {
        z.string().min(6, "Senha deve ter pelo menos 6 caracteres").parse(value);
      } else if (field === "confirmPassword") {
        if (value !== formData.password) {
          throw new z.ZodError([{ code: "custom" as const, message: "As senhas não coincidem", path: ["confirmPassword"] }]);
        }
      } else if (field === "whatsappNumber") {
        const digits = value.replace(/\D/g, '');
        if (digits.length < 10) {
          throw new z.ZodError([{ code: "custom" as const, message: "WhatsApp deve ter pelo menos 10 dígitos", path: ["whatsappNumber"] }]);
        }
      }
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [field]: error.errors[0].message }));
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field as keyof typeof touched]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, formData[field as keyof typeof formData]);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Preserve referral code for OAuth flow
      const refCode = localStorage.getItem(REFERRAL_CODE_KEY);
      const redirectUrl = refCode
        ? `${window.location.origin}/dashboard?ref=${refCode}`
        : `${window.location.origin}/dashboard`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        // Report OAuth errors to monitoring
        if (error.status === 500 || error.message.includes('Database')) {
          await reportAuthError(
            'oauth_failed',
            error.message,
            error.status?.toString() || '500'
          );
        }
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao fazer login com Google";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira seu email.",
        variant: "destructive",
      });
      return;
    }

    try {
      z.string().email("Email inválido").parse(resetEmail.trim());
    } catch {
      toast({
        title: "Erro",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/auth/verify`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      setResetDialogOpen(false);
      setResetEmail("");
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar email de recuperação",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  // Report auth errors to monitoring system
  const reportAuthError = async (
    errorType: string,
    errorMessage: string,
    errorCode: string,
    userEmail?: string
  ) => {
    try {
      await supabase.functions.invoke('auth-error-monitor', {
        body: {
          error_type: errorType,
          error_message: errorMessage,
          error_code: errorCode,
          user_email: userEmail,
          metadata: {
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            url: window.location.href
          }
        }
      });
      console.log('[auth-monitor] Error reported successfully');
    } catch (e) {
      console.error('[auth-monitor] Failed to report error:', e);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signUpSchema.parse(formData);

      // Get referral code and custom redirect parameters from localStorage
      const refCode = localStorage.getItem(REFERRAL_CODE_KEY);
      const skipOnboarding = localStorage.getItem("skip_onboarding") === "true";
      const redirectAfterAuth = localStorage.getItem("redirect_after_auth");

      // Create user directly via Supabase Auth (no email confirmation)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: {
            whatsapp_number: validated.whatsappNumber,
            referral_code: refCode || undefined,
            skip_onboarding: skipOnboarding || undefined,
            redirect_after_auth: redirectAfterAuth || undefined,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        }
      });

      if (signUpError) {
        // Report critical errors (500, database errors) to monitoring
        const isCriticalError =
          signUpError.status === 500 ||
          signUpError.message.includes('Database error') ||
          signUpError.message.includes('trigger') ||
          signUpError.message.includes('function');

        if (isCriticalError) {
          await reportAuthError(
            'signup_failed',
            signUpError.message,
            signUpError.status?.toString() || '500',
            validated.email
          );
        }

        if (signUpError.message.includes("already registered") || signUpError.message.includes("User already registered")) {
          toast({
            title: "Email já cadastrado",
            description: "Este email já está em uso. Tente fazer login ou use outro email.",
            variant: "destructive",
          });
          return;
        }
        throw signUpError;
      }

      // Track signup conversion for Google Ads
      trackSignupConversion();
      trackTrialConversion();

      // Check if email confirmation is required (session is null)
      if (signUpData.user && !signUpData.session) {
        toast({
          title: "Verifique seu email 📧",
          description: "Enviamos um link de confirmação para " + validated.email,
          duration: 6000,
        });
        return;
      }

      // User is automatically logged in after signup (auto-confirm enabled)
      toast({
        title: "Conta criada com sucesso! 🎉",
        description: "Bem-vindo ao Autozap. Vamos configurar sua conta.",
      });

      // Send welcome email (fire and forget - don't block the flow)
      supabase.functions.invoke('send-welcome-email', {
        body: {
          email: validated.email,
          user_name: validated.email.split('@')[0],
        }
      }).catch((err) => console.error('Error sending welcome email:', err));

      // Clean up localStorage
      localStorage.removeItem(REFERRAL_CODE_KEY);
      localStorage.removeItem("skip_onboarding");
      localStorage.removeItem("redirect_after_auth");

      // Redirect to onboarding or dashboard
      if (redirectAfterAuth) {
        navigate(redirectAfterAuth);
      } else {
        navigate("/onboarding");
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        // Report unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('500') || errorMessage.includes('Database')) {
          await reportAuthError(
            'signup_exception',
            errorMessage,
            '500',
            formData.email
          );
        }

        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signInSchema.parse(formData);

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Erro",
            description: "Email ou senha incorretos.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta.",
        });

        // Check for custom redirect (e.g., affiliates coming from /afiliados)
        const redirectAfterAuth = localStorage.getItem("redirect_after_auth");
        localStorage.removeItem("redirect_after_auth");
        localStorage.removeItem("skip_onboarding");

        if (redirectAfterAuth) {
          navigate(redirectAfterAuth);
        } else {
          navigate("/dashboard");
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao fazer login",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // handleMagicLinkLogin removido - Magic Link desativado

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-dark p-6 xl:p-10 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-80" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('/images/grid-pattern.svg')] opacity-5" />

        {/* Top Content */}
        <div className="relative z-10">
          <Link to="/" className="inline-block mb-8">
            <Logo size="lg" className="[&>span:last-child]:text-white" />
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              Transforme seu WhatsApp em uma <br />
              <span className="text-primary">Máquina de Vendas</span>
            </h2>
            <p className="text-base lg:text-lg text-white/60 mb-6 max-w-md leading-relaxed">
              Automatize atendimentos, recupere carrinhos e venda 24/7 com a IA mais avançada do mercado.
            </p>
          </motion.div>
        </div>

        {/* Middle Content - Video/Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="relative z-10 flex-1 flex items-center justify-center my-6"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-2 shadow-2xl ring-1 ring-black/5">
            <div className="rounded-xl overflow-hidden aspect-video relative bg-black/40">
              <YouTubeEmbed
                videoId="z-OR_7Kfn7Y"
                title="Demo do Autozap"
                customThumbnail={videoThumbnail}
              />
            </div>
          </div>
        </motion.div>

        {/* Bottom Content - Social Proof & Features */}
        <div className="relative z-10 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 gap-4"
          >
            {features.map((feature, index) => (
              <div key={feature.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <feature.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-white/80 text-sm font-medium">{feature.text}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex items-center gap-4 pt-6 border-t border-white/10"
          >
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center text-xs text-white">
                  <User className="w-5 h-5 text-white/40" />
                </div>
              ))}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
              <p className="text-sm text-white/60">
                Escolhido por <strong className="text-white">+100 empresas</strong>
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col lg:items-center lg:justify-center p-4 lg:p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-[360px] py-4 lg:py-0 lg:my-auto mx-auto space-y-5">
          {/* Header section */}
          <div className="text-center space-y-1.5">
            <Link to="/" className="flex lg:hidden mb-4 justify-center">
              <Logo size="md" />
            </Link>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isLogin ? "Bem-vindo de volta" : "Crie sua conta grátis"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isLogin
                ? "Entre para gerenciar seu atendimento"
                : "Teste por 48h sem compromisso. Sem cartão."}
            </p>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 bg-muted/50 rounded-lg border border-border/50">
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`py-2 text-sm font-medium rounded-md transition-all duration-200 ${!isLogin
                ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
            >
              Criar Conta
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`py-2 text-sm font-medium rounded-md transition-all duration-200 ${isLogin
                ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
            >
              Entrar
            </button>
          </div>

          {/* Google OAuth */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 bg-card hover:bg-accent/50 border-input transition-all relative group overflow-hidden"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
            >
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex items-center gap-3 relative z-10">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="font-medium">Continuar com Google</span>
                </div>
              )}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground font-medium">ou continue com email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={isLogin ? handleSignIn : handleSignUp} className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-foreground text-sm font-medium">
                Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  required
                  disabled={loading}
                  className={`pl-10 bg-muted/40 border-border h-10 focus:bg-background transition-all ${touched.email && errors.email ? "border-destructive focus-visible:ring-destructive" : "hover:border-primary/50 focus:border-primary"}`}
                />
              </div>
              {touched.email && errors.email && (
                <p className="text-xs text-destructive animate-fade-in">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground text-sm font-medium">
                  Senha
                </Label>
                {isLogin && (
                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                        Esqueceu a senha?
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Recuperar senha</DialogTitle>
                        <DialogDescription>
                          Insira seu email e enviaremos um link para redefinir sua senha.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="resetEmail">Email</Label>
                          <Input
                            id="resetEmail"
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            placeholder="seu@email.com"
                            disabled={resetLoading}
                          />
                        </div>
                        <Button onClick={handlePasswordReset} className="w-full" disabled={resetLoading}>
                          {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de recuperação"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  onBlur={() => handleBlur("password")}
                  required
                  disabled={loading}
                  className={`pl-10 pr-10 bg-muted/40 border-border h-10 focus:bg-background transition-all ${touched.password && errors.password ? "border-destructive focus-visible:ring-destructive" : "hover:border-primary/50 focus:border-primary"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              {touched.password && errors.password && (
                <p className="text-xs text-destructive animate-fade-in">{errors.password}</p>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-1">
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className="text-foreground text-sm font-medium">
                    Confirmar Senha
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      onBlur={() => handleBlur("confirmPassword")}
                      required
                      disabled={loading}
                      className={`pl-10 pr-10 bg-muted/40 border-border h-10 focus:bg-background transition-all ${touched.confirmPassword && errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : "hover:border-primary/50 focus:border-primary"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                  {touched.confirmPassword && errors.confirmPassword && (
                    <p className="text-xs text-destructive animate-fade-in">{errors.confirmPassword}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="whatsappNumber" className="text-foreground text-sm font-medium">
                    WhatsApp
                  </Label>
                  <div className="relative group">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="whatsappNumber"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={formData.whatsappNumber}
                      onChange={(e) => handleInputChange("whatsappNumber", maskPhone(e.target.value))}
                      onBlur={() => handleBlur("whatsappNumber")}
                      required
                      disabled={loading}
                      className={`pl-10 bg-muted/40 border-border h-10 focus:bg-background transition-all ${touched.whatsappNumber && errors.whatsappNumber ? "border-destructive focus-visible:ring-destructive" : "hover:border-primary/50 focus:border-primary"}`}
                    />
                  </div>
                  {touched.whatsappNumber && errors.whatsappNumber && (
                    <p className="text-xs text-destructive animate-fade-in">{errors.whatsappNumber}</p>
                  )}
                </div>
              </div>
            )}

            <Button type="submit" className="w-full h-10 text-sm font-medium transition-all hover:scale-[1.02]" disabled={loading}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? "Entrar na Plataforma" : "Criar Conta Grátis"}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>

            {/* Temporary Dashboard Access */}


            {!isLogin && (
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                Ao clicar em "Criar Conta", você concorda com nossos{" "}
                <Link to="/termos-de-uso" target="_blank" className="text-primary hover:underline">
                  Termos de Uso
                </Link>{" "}
                e{" "}
                <Link to="/politica-de-privacidade" target="_blank" className="text-primary hover:underline">
                  Política de Privacidade
                </Link>
              </p>
            )}
          </form>

          {/* Footer Links */}
          <div className="mt-3 text-center space-y-1.5">
            <p className="text-muted-foreground text-xs">
              {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
                disabled={loading}
              >
                {isLogin ? "Criar conta grátis" : "Fazer login"}
              </button>
            </p>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-[11px]"
            >
              <ArrowLeft className="w-3 h-3" />
              Voltar para o início
            </Link>
          </div>

          {/* Mobile/Tablet Video */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 lg:hidden"
          >
            <YouTubeEmbed
              videoId="z-OR_7Kfn7Y"
              title="Demo do Autozap"
              customThumbnail={videoThumbnail}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
