import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import { AnimatedRoutes } from "./components/AnimatedRoutes";
import CookieConsent from "./components/CookieConsent";
import PageTracker from "./components/PageTracker";
import StatusBarManager from "./components/StatusBarManager";
import { ThemeClassManager } from "./components/ThemeClassManager";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem themes={["light", "dark", "antigravity"]}>
    <ThemeClassManager />
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StatusBarManager />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PageTracker />
            <AnimatedRoutes />
            <CookieConsent />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
