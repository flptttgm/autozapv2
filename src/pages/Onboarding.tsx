import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { QuickSetupStep } from "@/components/onboarding/QuickSetupStep";
import { WhatsAppStep } from "@/components/onboarding/WhatsAppStep";

const TOTAL_STEPS = 2;

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, loading } = useAuth();
  const { isTrialExpired } = useSubscription();
  const [currentStep, setCurrentStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [templateConfig, setTemplateConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Redirect if not logged in after loading
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Redirect to dashboard if onboarding is already completed (prevents loop)
  useEffect(() => {
    if (!loading && profile?.onboarding_completed === true) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, profile?.onboarding_completed, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (profile?.company_name) {
      setCompanyName(profile.company_name);
    }

    // Tenta pegar do profile primeiro, depois do user metadata como fallback
    const whatsapp = profile?.whatsapp_number
      || user?.user_metadata?.whatsapp_number;

    if (whatsapp) {
      setWhatsappNumber(whatsapp);
    }
  }, [profile, user]);

  const saveAndComplete = async () => {
    console.log('[Onboarding] saveAndComplete called');
    console.log('[Onboarding] User:', user?.id);
    console.log('[Onboarding] Profile:', profile);
    console.log('[Onboarding] WorkspaceID:', profile?.workspace_id);

    if (!user?.id) {
      console.error('[Onboarding] Missing user ID');
      toast.error("Erro: Usuário não identificado");
      return;
    }

    if (!profile?.workspace_id) {
      console.error('[Onboarding] Missing workspace ID');
      toast.error("Erro: Workspace não encontrado. Tente recarregar a página.");
      return;
    }

    try {
      setIsSaving(true);
      console.log('[Onboarding] Starting save process...');

      // Save company name and whatsapp to profile
      if (companyName || whatsappNumber) {
        console.log('[Onboarding] Updating profile...');
        const { error: profileError } = await supabase
          .from('profiles' as any)
          .update({
            company_name: companyName || undefined,
            whatsapp_number: whatsappNumber || undefined
          })
          .eq('user_id', user.id);

        if (profileError) {
          console.error('[Onboarding] Profile update error:', profileError);
          throw profileError;
        }
      }

      // Save AI settings from template
      const aiSettings = templateConfig || {
        template: 'custom',
        personality: {
          tone: 50,
          verbosity: 50,
          proactivity: 50,
          assistant_name: companyName ? `Assistente ${companyName}` : "Assistente Virtual",
          use_emojis: true
        },
        system_prompt: "Você é um assistente virtual prestativo. Ajude o cliente com suas dúvidas de forma clara e eficiente. Seja educado e profissional.",
        behavior: {
          business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
          out_of_hours_message: "",
          human_transfer_keywords: ["atendente", "humano", "falar com alguém"],
          appointment_detection: true,
          appointment_keywords: ["agendar", "marcar"],
        },
        quick_replies: []
      };

      // Check if ai_settings exists
      const { data: existingConfig } = await supabase
        .from('system_config')
        .select('id')
        .eq('workspace_id', profile.workspace_id)
        .eq('config_key', 'ai_settings')
        .maybeSingle();

      if (existingConfig) {
        await supabase
          .from('system_config')
          .update({ config_value: aiSettings })
          .eq('id', existingConfig.id);
      } else {
        await supabase
          .from('system_config')
          .insert({
            workspace_id: profile.workspace_id,
            config_key: 'ai_settings',
            config_value: aiSettings,
            description: 'AI behavior and personality settings'
          });
      }

      // Mark onboarding as completed
      await supabase
        .from('profiles' as any)
        .update({ onboarding_completed: true })
        .eq('user_id', user.id);

      // Refresh profile in context before navigating
      await refreshProfile();

      // Small delay to let React state propagate before ProtectedRoute checks profile
      await new Promise(resolve => setTimeout(resolve, 100));

      // Always navigate to dashboard - trial expired users can still use the app
      // They just can't use WhatsApp automations
      toast.success("Configuração concluída!");
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving onboarding progress:', error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickSetupComplete = (name: string, whatsapp: string, categoryId: string, config: any) => {
    setCompanyName(name);
    setWhatsappNumber(whatsapp);
    setTemplateConfig(config);
    setCurrentStep(2);
  };

  const handleWhatsAppComplete = async () => {
    await saveAndComplete();
  };

  const handleWhatsAppSkip = async () => {
    await saveAndComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
      {/* Urgent banner for expired trials */}
      {isTrialExpired && (
        <div className="bg-destructive/10 border-b border-destructive/20">
          <div className="max-w-2xl mx-auto px-6 py-3">
            <Alert variant="destructive" className="border-0 bg-transparent p-0">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="ml-2">
                <strong>Seu período de teste expirou!</strong> Complete a configuração para escolher um plano e continuar usando.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Header with progress */}
      <header className="py-8 px-6">
        <div className="max-w-2xl mx-auto">
          <OnboardingProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <QuickSetupStep
              key="quicksetup"
              initialCompanyName={companyName}
              initialWhatsappNumber={whatsappNumber}
              onComplete={handleQuickSetupComplete}
              onSkip={saveAndComplete}
            />
          )}

          {currentStep === 2 && (
            <WhatsAppStep
              key="whatsapp"
              workspaceId={profile?.workspace_id ?? null}
              onNext={handleWhatsAppComplete}
              onSkip={handleWhatsAppSkip}
              isSaving={isSaving}
            />
          )}
        </AnimatePresence>
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

export default Onboarding;
