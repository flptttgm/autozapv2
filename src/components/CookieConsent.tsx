import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem("cookie-consent", JSON.stringify({ 
      essential: true, 
      performance: true, 
      functionality: true, 
      marketing: true,
      timestamp: new Date().toISOString()
    }));
    setIsVisible(false);
  };

  const acceptEssential = () => {
    localStorage.setItem("cookie-consent", JSON.stringify({ 
      essential: true, 
      performance: false, 
      functionality: false, 
      marketing: false,
      timestamp: new Date().toISOString()
    }));
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[60] p-4 md:p-6"
        >
          <div className="container mx-auto max-w-4xl">
            <div className="bg-card/95 backdrop-blur-lg border border-border rounded-2xl p-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex items-center justify-center w-12 h-12 bg-primary/20 rounded-full shrink-0">
                  <Cookie className="w-6 h-6 text-primary" />
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        Utilizamos cookies 🍪
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Usamos cookies para melhorar sua experiência, personalizar conteúdo e analisar nosso tráfego. 
                        Ao clicar em "Aceitar todos", você concorda com o uso de todos os cookies. 
                        Leia nossa{" "}
                        <Link to="/politica-de-cookies" className="text-primary hover:underline">
                          Política de Cookies
                        </Link>{" "}
                        para saber mais.
                      </p>
                    </div>
                    <button 
                      onClick={acceptEssential}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      onClick={acceptAll}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    >
                      Aceitar todos
                    </Button>
                    <Button 
                      onClick={acceptEssential}
                      variant="outline"
                      className="border-border text-foreground hover:bg-secondary"
                    >
                      Apenas essenciais
                    </Button>
                    <Link to="/politica-de-cookies">
                      <Button 
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground w-full sm:w-auto"
                      >
                        Personalizar
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
