import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const token = searchParams.get("token");

  useEffect(() => {
    const acceptInvite = async () => {
      if (!token) {
        setError("Token de convite inválido");
        setLoading(false);
        return;
      }

      try {
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Show message and redirect to auth with properly encoded return URL
          setError("Você precisa criar uma conta ou fazer login para aceitar o convite. Redirecionando...");
          setLoading(false);
          
          setTimeout(() => {
            const encodedRedirect = encodeURIComponent(`/accept-invite?token=${token}`);
            navigate(`/auth?redirect=${encodedRedirect}`);
          }, 2000);
          return;
        }

        // Accept the invite
        const { data, error } = await supabase.functions.invoke("accept-invite", {
          body: { invite_token: token },
        });

        if (error) throw error;

        setAccepted(true);
        toast.success("Convite aceito! Redirecionando...");
        
        // Redirect to member onboarding instead of dashboard
        setTimeout(() => {
          navigate("/member-onboarding");
        }, 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao aceitar convite");
        toast.error("Erro ao aceitar convite");
      } finally {
        setLoading(false);
      }
    };

    acceptInvite();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Convite para Equipe</CardTitle>
          <CardDescription className="text-center">
            {loading && "Processando convite..."}
            {accepted && "Convite aceito com sucesso!"}
            {error && "Erro ao processar convite"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {loading && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Aguarde...</p>
            </>
          )}

          {accepted && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-center">
                Você agora faz parte da equipe!
                <br />
                <span className="text-sm text-muted-foreground">Redirecionando para o dashboard...</span>
              </p>
            </>
          )}

          {error && (
            <>
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-center text-sm">{error}</p>
              <Button onClick={() => navigate("/auth")}>Ir para Login</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
