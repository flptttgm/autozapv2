import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

export default function AuthVerify() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuth = async () => {
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
            setStatus("success");
            toast({
              title: data.isNewUser ? "Conta criada com sucesso!" : "Autenticado com sucesso!",
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
          setStatus("success");
          toast({
            title: "Autenticado com sucesso!",
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
            
            if (redirectAfterAuth) {
              navigate(redirectAfterAuth);
            } else if (profile?.onboarding_completed) {
              navigate("/dashboard");
            } else {
              navigate("/onboarding");
            }
          }, 1500);
          return;
        }
      }
      
      // If no hash and no session after a moment, show error
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setStatus("success");
        toast({
          title: "Autenticado com sucesso!",
          description: "Você será redirecionado...",
        });
        
        // Check for custom redirect from localStorage
        const redirectAfterAuth = localStorage.getItem("redirect_after_auth");
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', session.user.id)
          .single();
        
        setTimeout(() => {
          // Clear custom redirect from localStorage
          localStorage.removeItem("skip_onboarding");
          localStorage.removeItem("redirect_after_auth");
          
          if (redirectAfterAuth) {
            navigate(redirectAfterAuth);
          } else if (profile?.onboarding_completed) {
            navigate("/dashboard");
          } else {
            navigate("/onboarding");
          }
        }, 1500);
      } else {
        // No session found - the link may be invalid or expired
        setStatus("error");
        setErrorMessage("Link inválido ou expirado. Por favor, solicite um novo link de acesso.");
      }
    };

    // Small delay to let Supabase process the hash fragment
    const timer = setTimeout(handleAuth, 500);
    return () => clearTimeout(timer);
  }, [location.hash, location.search, navigate, toast]);

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