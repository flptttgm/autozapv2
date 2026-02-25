import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle } from "lucide-react";

const STORAGE_KEY = "whatsapp_modal_dismissed";
const SESSION_KEY = "whatsapp_modal_shown";

export function WhatsAppConnectionModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Query para verificar se há WhatsApp conectado
  const { data: hasConnectedWhatsApp, isLoading } = useQuery({
    queryKey: ["whatsapp-connected-check", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return null;
      
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("workspace_id", profile.workspace_id)
        .eq("status", "connected");
      
      if (error) {
        console.error("Error checking WhatsApp:", error);
        return null;
      }
      
      return data && data.length > 0;
    },
    enabled: !!profile?.workspace_id,
  });

  useEffect(() => {
    // Não mostrar se:
    // - Está na página de WhatsApp
    // - Está no onboarding
    // - Usuário já dismissou permanentemente
    // - Já mostrou nesta sessão
    // - Ainda está carregando
    // - Já tem WhatsApp conectado
    
    const isWhatsAppPage = location.pathname === "/whatsapp";
    const isOnboarding = location.pathname === "/onboarding";
    const dismissed = localStorage.getItem(STORAGE_KEY) === "true";
    const shownThisSession = sessionStorage.getItem(SESSION_KEY) === "true";
    
    if (
      isWhatsAppPage ||
      isOnboarding ||
      dismissed ||
      shownThisSession ||
      isLoading ||
      hasConnectedWhatsApp !== false
    ) {
      return;
    }

    // Delay de 2s para não ser intrusivo
    const timer = setTimeout(() => {
      setIsOpen(true);
      sessionStorage.setItem(SESSION_KEY, "true");
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasConnectedWhatsApp, isLoading, location.pathname]);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    setIsOpen(false);
  };

  const handleConnect = () => {
    setIsOpen(false);
    navigate("/whatsapp");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <MessageCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-xl">Conecte seu WhatsApp</DialogTitle>
          <DialogDescription className="text-base">
            Para começar a receber mensagens e atender seus clientes automaticamente, 
            conecte seu WhatsApp agora.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="dont-show"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
          />
          <label
            htmlFor="dont-show"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Não mostrar novamente
          </label>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
            Lembrar Depois
          </Button>
          <Button onClick={handleConnect} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
            <MessageCircle className="h-4 w-4 mr-2" />
            Conectar Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
