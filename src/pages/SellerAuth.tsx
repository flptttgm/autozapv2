import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSeller } from "@/hooks/useSeller";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import { Loader2, ArrowLeft, Mail, Lock, AlertCircle } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

const SellerAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { isSeller, isCheckingRole, seller } = useSeller();
  const navigate = useNavigate();

  // Redirect authenticated sellers to dashboard
  useEffect(() => {
    if (!authLoading && !isCheckingRole && user && isSeller) {
      if (seller?.status === 'active') {
        navigate("/vendedores/dashboard");
      }
    }
  }, [user, authLoading, isSeller, isCheckingRole, seller, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate input
      const validated = loginSchema.parse({ email, password });

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Email ou senha incorretos");
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user) {
        // Check if user is a seller
        const { data: sellerRole } = await supabase
          .from('seller_roles')
          .select('id')
          .eq('user_id', data.user.id)
          .eq('role', 'seller')
          .maybeSingle();

        if (!sellerRole) {
          await supabase.auth.signOut();
          setError("Esta conta não está cadastrada como vendedor. Entre em contato para solicitar acesso.");
          return;
        }

        toast.success("Login realizado com sucesso!");
        navigate("/vendedores/dashboard");
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError("Erro ao fazer login. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/vendedores" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-border">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Área do Vendedor</CardTitle>
              <CardDescription>
                Faça login para acessar seu painel de vendas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="request">Solicitar Acesso</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                      <div className="p-3 rounded-lg bg-destructive/10 text-destructive flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                        <p className="text-sm">{error}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        "Entrar"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="request">
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Mail className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Quer ser um vendedor?</h3>
                    <p className="text-muted-foreground mb-6">
                      Entre em contato conosco para solicitar acesso ao programa de vendedores.
                    </p>
                    <a href="mailto:vendedores@autozap.com.br?subject=Solicitação de Acesso - Programa de Vendedores">
                      <Button className="w-full">
                        <Mail className="h-4 w-4 mr-2" />
                        Enviar Solicitação
                      </Button>
                    </a>
                    <p className="text-xs text-muted-foreground mt-4">
                      Você receberá uma resposta em até 48 horas úteis.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Não é vendedor?{" "}
            <Link to="/auth" className="text-primary hover:underline">
              Acessar como cliente
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SellerAuth;
