import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Lock, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";

export default function AuthVerify() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "reset_password">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Detect recovery flow IMMEDIATELY from the hash before Supabase clears it
  const isRecoveryFlowRef = useRef(false);

  // Check the hash on the very first render (before Supabase processes and clears it)
  if (!isRecoveryFlowRef.current && window.location.hash.includes('type=recovery')) {
    isRecoveryFlowRef.current = true;
    console.log('[AuthVerify] Recovery flow detected from initial hash');
  }

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthVerify] Auth event:', event);
        if (event === 'PASSWORD_RECOVERY') {
          console.log('[AuthVerify] PASSWORD_RECOVERY event detected');
          isRecoveryFlowRef.current = true;
          setStatus("reset_password");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleAuth = async () => {
      // If we already detected a recovery flow, show the reset form and stop
      if (isRecoveryFlowRef.current) {
        console.log('[AuthVerify] Recovery flow active — showing password reset form');
        setStatus("reset_password");
        return;
      }

      // Check if there's a custom token in URL (our custom flow)
      const searchParams = new URLSearchParams(location.search);
      const customToken = searchParams.get('token');

      if (customToken) {
        console.log('Processing custom magic link token...');
        
        try {
          // Call our edge function to verify the token
          const { data, error } = await supabase.functions.invoke('verify-magic-link', {
            body: { token: customToken }
          });

          if (error) {
            console.error('Edge function error:', error);
            setStatus("error");
            setErrorMessage(error.message || "Erro ao verificar o link");
            return;
          }

          if (!data?.success) {
            console.error('Verification failed:', data?.error);
            setStatus("error");
            setErrorMessage(data?.error || "Link inválido ou expirado");
            return;
          }

          console.log('Token verified, redirecting to action_link...');

          // If we got an action_link, redirect to it to complete authentication
          if (data.action_link) {
            window.location.href = data.action_link;
            return;
          }

          // Fallback: try to get session
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            handleSuccessRedirect(session, data.isNewUser);
          } else {
            setStatus("error");
            setErrorMessage("Erro ao completar autenticação. Tente fazer login novamente.");
          }
          
        } catch (err) {
          console.error('Error processing custom token:', err);
          setStatus("error");
          setErrorMessage("Erro ao processar o link. Tente novamente.");
        }
        return;
      }

      // Check if there's a hash fragment (native Supabase OTP flow)
      const hashParams = location.hash;
      
      if (hashParams && (hashParams.includes('access_token') || hashParams.includes('error'))) {
        // Supabase processes hash fragments automatically via onAuthStateChange
        // We just need to wait for the session to be established
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth error:", error);
          setStatus("error");
          setErrorMessage(error.message || "Erro na autenticação");
          return;
        }
        
        if (session) {
          // Double-check: did recovery get detected while we were waiting?
          if (isRecoveryFlowRef.current) {
            setStatus("reset_password");
            return;
          }
          handleSuccessRedirect(session);
          return;
        }
      }
      
      // If no hash and no session after a moment, check once more
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Final check for recovery
        if (isRecoveryFlowRef.current) {
          setStatus("reset_password");
          return;
        }
        handleSuccessRedirect(session);
      } else {
        // No session found - the link may be invalid or expired
        setStatus("error");
        setErrorMessage("Link inválido ou expirado. Por favor, solicite um novo link de acesso.");
      }
    };

    const handleSuccessRedirect = async (session: any, isNewUser?: boolean) => {
      setStatus("success");
      toast({
        title: isNewUser ? "Conta criada com sucesso!" : "Autenticado com sucesso!",
        description: "Você será redirecionado...",
      });

      // Check for custom redirect from localStorage
      const redirectAfterAuth = localStorage.getItem("redirect_after_auth");
      
      // Check if user completed onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', session.user.id)
        .single();

      setTimeout(() => {
        // Clear custom redirect from localStorage
        localStorage.removeItem("skip_onboarding");
        localStorage.removeItem("redirect_after_auth");
        
        // Priority: custom redirect > onboarding check > dashboard
        if (redirectAfterAuth) {
          navigate(redirectAfterAuth);
        } else if (profile?.onboarding_completed) {
          navigate("/dashboard");
        } else {
          navigate("/onboarding");
        }
      }, 1500);
    };

    // Small delay to let Supabase process the hash fragment
    const timer = setTimeout(handleAuth, 800);
    return () => clearTimeout(timer);
  }, [location.hash, location.search, navigate, toast]);

  const handlePasswordUpdate = async () => {
    if (!newPassword.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira sua nova senha.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setStatus("success");
      toast({
        title: "Senha atualizada! 🎉",
        description: "Sua senha foi alterada com sucesso. Redirecionando...",
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar a senha.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <Logo size="md" className="mx-auto" />

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Verificando seu link...</p>
          </div>
        )}

        {status === "reset_password" && (
          <div className="space-y-6 text-left">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Redefinir senha
              </h2>
              <p className="text-muted-foreground text-sm">
                Digite sua nova senha abaixo para continuar.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-foreground text-sm font-medium">
                  Nova Senha
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={resetLoading}
                    className="pl-10 pr-10 bg-muted/40 border-border h-10 focus:bg-background transition-all hover:border-primary/50 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword" className="text-foreground text-sm font-medium">
                  Confirmar Nova Senha
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="confirmNewPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={resetLoading}
                    className="pl-10 pr-10 bg-muted/40 border-border h-10 focus:bg-background transition-all hover:border-primary/50 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                onClick={handlePasswordUpdate}
                className="w-full h-10"
                disabled={resetLoading || !newPassword || !confirmPassword}
              >
                {resetLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Redefinir senha"
                )}
              </Button>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-2xl font-semibold text-foreground">
              Verificado com sucesso!
            </h2>
            <p className="text-muted-foreground">
              Redirecionando para sua conta...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-2xl font-semibold text-foreground">
              Erro na verificação
            </h2>
            <p className="text-muted-foreground">{errorMessage}</p>
            <Button onClick={() => navigate("/auth")} className="mt-4">
              Voltar para Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}