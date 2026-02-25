import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CalendarCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const errorParam = searchParams.get("error");

      if (errorParam) {
        setStatus("error");
        setError("Autorização negada pelo usuário");
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setError("Parâmetros inválidos");
        return;
      }

      try {
        const parsedState = JSON.parse(decodeURIComponent(state));
        const workspaceId = parsedState.workspace_id;

        if (!workspaceId) {
          throw new Error("workspace_id não encontrado");
        }

        const { error: fnError } = await supabase.functions.invoke("google-calendar-auth", {
          body: {
            action: "exchange_code",
            code,
            workspace_id: workspaceId,
            redirect_uri: `${window.location.origin}/calendar-callback`,
          },
        });

        if (fnError) throw fnError;

        setStatus("success");
        setTimeout(() => {
          navigate("/settings");
        }, 2000);
      } catch (err) {
        console.error("Callback error:", err);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Erro ao conectar");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="p-8 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Conectando...</h2>
            <p className="text-muted-foreground">
              Aguarde enquanto finalizamos a conexão com o Google Calendar.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Conectado com Sucesso!</h2>
            <p className="text-muted-foreground">
              O Google Calendar foi conectado. Você será redirecionado em instantes...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <X className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Erro na Conexão</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate("/settings")}>
              Voltar para Configurações
            </Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default CalendarCallback;
