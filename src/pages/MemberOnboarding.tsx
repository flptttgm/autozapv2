import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowRight, Loader2, Sparkles, MessageSquare, Calendar, BarChart3 } from "lucide-react";

const MemberOnboarding = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.display_name || user?.user_metadata?.full_name || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleComplete = async () => {
    if (!user?.id) return;

    try {
      setIsSaving(true);

      // Update profile with name
      await supabase
        .from('profiles' as any)
        .update({
          display_name: fullName || undefined,
          onboarding_completed: true
        })
        .eq('user_id', user.id);

      // Refresh profile in context
      await refreshProfile();

      toast.success("Bem-vindo à equipe!");
      navigate('/dashboard');
    } catch (error) {
      console.error('Error completing member onboarding:', error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const features = [
    {
      icon: MessageSquare,
      title: "Conversas",
      description: "Gerencie todas as conversas do WhatsApp em um só lugar"
    },
    {
      icon: Users,
      title: "Leads",
      description: "Acompanhe e organize todos os contatos da empresa"
    },
    {
      icon: Calendar,
      title: "Agendamentos",
      description: "Visualize e gerencie compromissos da equipe"
    },
    {
      icon: BarChart3,
      title: "Estatísticas",
      description: "Acompanhe métricas e desempenho em tempo real"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
      {/* Header */}
      <header className="py-8 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Membro da Equipe
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Bem-vindo à equipe!</CardTitle>
              <CardDescription className="text-base">
                Você foi convidado para colaborar neste workspace.
                O WhatsApp e as configurações já estão prontos para uso.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Profile setup */}
              <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                <Label htmlFor="fullName" className="text-sm font-medium">
                  Seu nome (como deseja ser identificado)
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  className="bg-background"
                />
              </div>

              {/* Features overview */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  O que você pode fazer:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {features.map((feature) => (
                    <div
                      key={feature.title}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{feature.title}</p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complete button */}
              <Button
                onClick={handleComplete}
                disabled={isSaving}
                className="w-full h-12 text-base"
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Começar a usar
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-muted-foreground">
          AutoZap © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
};

export default MemberOnboarding;
