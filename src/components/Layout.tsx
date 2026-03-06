import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutGrid, Link2, Settings, LogOut, Users, MessageSquareText, Share2, FileText, Receipt, X, PanelLeftClose, Building2 } from "lucide-react";
import { MdSupportAgent, MdCast, MdCastConnected, MdDashboard, MdOutlineAppRegistration } from "react-icons/md";
import { HiOutlineGift } from "react-icons/hi";
import { RiRobot2Fill } from "react-icons/ri";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PlanBadge } from "@/components/subscription/PlanBadge";


import { DashboardHeader } from "@/components/DashboardHeader";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { SupportChatSidebar } from "@/components/SupportChatSidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Logo from "@/components/Logo";
import { TrialBanner } from "@/components/TrialBanner";
import { WhatsAppConnectionModal } from "@/components/WhatsAppConnectionModal";
import { ConversationsSidebarItem } from "@/components/sidebar/ConversationsSidebarItem";
import { LeadsSidebarItem } from "@/components/sidebar/LeadsSidebarItem";
import { AppointmentsSidebarItem } from "@/components/sidebar/AppointmentsSidebarItem";
import { WorkspaceSwitcher } from "@/components/sidebar/WorkspaceSwitcher";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { AIPromotionBanner } from "@/components/AIPromotionBanner";
import { useSidebarVisibility } from "@/hooks/useSidebarVisibility";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import { useConnectedWhatsAppInstances } from "@/hooks/useConnectedWhatsAppInstances";
import { getWorkspaceTemplate } from "@/lib/workspaceTemplates";
import { useTranslation } from "react-i18next";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const isMobile = useIsMobile();
  const { isAppointmentsVisible, isQuotesVisible, isInvoicesVisible } = useSidebarVisibility();
  const { activeWorkspace } = useUserWorkspaces();
  const activeTemplate = getWorkspaceTemplate(activeWorkspace?.template);
  const templateItems = activeTemplate.sidebarItems;
  const { connectedCount } = useConnectedWhatsAppInstances(activeWorkspace?.id);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Persistir estado da sidebar no localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai-chat-open') === 'true';
    }
    return false;
  });
  const [supportChatOpen, setSupportChatOpen] = useState(false);

  // Persist AI chat state
  useEffect(() => {
    localStorage.setItem('ai-chat-open', String(aiChatOpen));
  }, [aiChatOpen]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer logout",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      navigate("/auth");
    }
  };

  // Navigation grouped for visual structure
  const primaryNav = [
    { name: t("sidebar.dashboard"), href: "/dashboard", icon: MdDashboard },
    { name: t("sidebar.workspaces"), href: "/workspaces", icon: MdOutlineAppRegistration },
  ];

  const toolsNav = [
    { name: t("sidebar.toolsConnections"), href: "/whatsapp", icon: connectedCount > 0 ? MdCastConnected : MdCast },
  ];

  const agentsNav = { name: t("sidebar.agents"), href: "/ai-settings", icon: RiRobot2Fill };

  const systemNav = [
    { name: t("sidebar.settings"), href: "/settings", icon: Settings },
  ];

  const renderNavItem = (item: { name: string; href: string; icon: React.ElementType }) => {
    const isActive = location.pathname === item.href ||
      (item.href !== "/dashboard" && location.pathname.startsWith(item.href + "/"));
    const linkContent = (
      <Link
        key={item.name}
        to={item.href}
        className={cn(
          "flex items-center gap-3 rounded-md font-medium transition-all duration-200 ease-out group",
          sidebarCollapsed && "lg:justify-center lg:w-14 lg:h-14 lg:mx-auto lg:p-0",
          isActive
            ? "bg-primary text-primary-foreground dark:bg-primary/20 dark:text-primary px-4 py-3 text-[15px] scale-[1.02] shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
            : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground dark:hover:bg-card/40 dark:hover:text-foreground px-3 py-2.5 text-sm hover:scale-[1.01]"
        )}
      >
        <item.icon className={cn(
          "shrink-0 transition-all duration-200 ease-out",
          sidebarCollapsed ? "lg:h-6 lg:w-6 h-5 w-5 lg:group-hover:scale-110" : isActive ? "h-[21px] w-[21px]" : "h-5 w-5 group-hover:scale-105"
        )} />
        <span className={cn(
          "transition-all duration-200",
          sidebarCollapsed && "lg:hidden"
        )}>{item.name}</span>
      </Link>
    );

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.name}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="hidden lg:block">{item.name}</TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };


  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <TrialBanner key={activeWorkspace?.id} />
        <div className="flex-1 flex overflow-hidden relative">
          {/* Mobile Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[45] lg:hidden"
              style={{ top: 'var(--top-banner-height, 0px)' }}
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={cn(
              "shrink-0 border-r border-border transition-all duration-300 will-change-transform z-[55]",
              "bg-card/95 supports-[backdrop-filter]:bg-card/60 backdrop-blur-xl dark:bg-card/20 dark:border-white/5",
              "flex flex-col overflow-x-hidden",
              sidebarCollapsed ? "lg:overflow-y-auto lg:scrollbar-hide" : "overflow-y-auto",
              // Mobile/Tablet: fixed overlay; Desktop: relative
              "fixed lg:relative lg:translate-x-0 lg:top-0",
              sidebarOpen ? "translate-x-0" : "-translate-x-full",
              // Mobile/Tablet: leave space for bottom nav and add rounded corner
              "rounded-br-2xl shadow-xl lg:rounded-none lg:shadow-none",
              // Height: fixed on mobile/tablet (max-h restricted), full height on desktop flex
              "h-screen lg:h-full",
              // Desktop: collapsible width
              sidebarCollapsed ? "lg:w-[82px]" : "lg:w-64",
              "w-64",
              "sidebar-pattern-bg"
            )}
            style={{
              // Only apply top offset on fixed screens (less than lg: 1024px)
              top: !isMobile && typeof window !== 'undefined' && window.innerWidth >= 1024 ? '0' : 'var(--top-banner-height, 0px)',
              maxHeight: isMobile
                ? 'calc(100vh - var(--top-banner-height, 0px) - var(--mobile-bottom-nav-height, 80px))'
                : !isMobile && typeof window !== 'undefined' && window.innerWidth < 1024 // Tablet case (fixed but not isMobile)
                  ? 'calc(100vh - var(--top-banner-height, 0px))'
                  : '100%' // Desktop relative
            }}
          >
            <div className="flex flex-col h-full min-h-0 relative z-10">
              <div className={cn(
                "flex flex-col flex-1 min-h-0 transition-transform duration-300 origin-top",
                !sidebarCollapsed && "scale-[0.95]"
              )}>
                <div className={cn("p-4", sidebarCollapsed ? "lg:px-3 lg:py-5" : "p-6")}>
                  {sidebarCollapsed ? (
                    <div
                      className="hidden lg:flex justify-center items-center h-12 cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setSidebarCollapsed(false)}
                    >
                      <span className="font-funnel font-bold text-[33px] text-primary">{"{a}"}</span>
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "flex items-center justify-between cursor-pointer group rounded-lg transition-colors p-1 -m-1 hover:bg-muted/50",
                      sidebarCollapsed && "lg:hidden"
                    )}
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setSidebarOpen(false);
                      } else {
                        setSidebarCollapsed(true);
                      }
                    }}
                  >
                    <Logo size="md" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden lg:inline-flex h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground opacity-70 group-hover:opacity-100 transition-opacity items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                          setSidebarCollapsed(true);
                        }
                      }}
                    >
                      <PanelLeftClose className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Workspace Switcher — hidden when collapsed (shown in header instead) */}
                {!sidebarCollapsed && (
                  <div className="pb-2">
                    <div className="px-4 pb-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("sidebar.currentWorkspace")}
                      </span>
                    </div>
                    <WorkspaceSwitcher collapsed={false} />
                  </div>
                )}

                <nav className={cn(
                  "space-y-1 flex-1 min-h-0 overflow-y-auto",
                  sidebarCollapsed ? "lg:px-3" : "px-3",
                  "px-3"
                )}>
                  {/* Primary Navigation: Dashboard + Workspaces (only on principal workspace) */}
                  {!activeWorkspace?.template && primaryNav.map(renderNavItem)}

                  {/* Template-specific items */}
                  {templateItems.length > 0 && (
                    <>
                      {!sidebarCollapsed && (
                        <div className="pt-4 pb-1 px-1">
                          <span className={cn(
                            "text-[10px] font-semibold uppercase tracking-wider",
                            activeTemplate.color
                          )}>
                            {activeTemplate.name}
                          </span>
                        </div>
                      )}
                      {sidebarCollapsed && <div className="hidden lg:block border-t border-border mx-0 my-1" />}
                      {templateItems.map(renderNavItem)}
                    </>
                  )}

                  {/* Separator */}
                  {templateItems.length > 0 && !sidebarCollapsed && (
                    <div className="pt-3 pb-1 px-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("sidebar.general")}
                      </span>
                    </div>
                  )}
                  {templateItems.length > 0 && sidebarCollapsed && <div className="hidden lg:block border-t border-border mx-0 my-1" />}

                  {/* Agentes - logo após Dashboard */}
                  {renderNavItem(agentsNav)}

                  {/* Leads with dropdown - force expanded on mobile overlay */}
                  <LeadsSidebarItem collapsed={isMobile ? false : sidebarCollapsed} />

                  {/* Conversations with dropdown - force expanded on mobile overlay */}
                  <ConversationsSidebarItem collapsed={isMobile ? false : sidebarCollapsed} />

                  {/* Appointments with dropdown - force expanded on mobile overlay */}
                  {isAppointmentsVisible && <AppointmentsSidebarItem collapsed={isMobile ? false : sidebarCollapsed} />}

                  {/* Orçamentos */}
                  {isQuotesVisible && renderNavItem({ name: t("sidebar.quotes"), href: "/quotes", icon: FileText })}

                  {/* Cobranças */}
                  {isInvoicesVisible && renderNavItem({ name: t("sidebar.invoices"), href: "/invoices", icon: Receipt })}

                  {/* Tools Navigation: Conexões WhatsApp */}
                  {toolsNav.map(renderNavItem)}

                  {/* Separator: SUPORTE E AJUSTES */}
                  {!sidebarCollapsed && (
                    <div className="pt-4 pb-1 px-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("sidebar.supportAndAdjustments")}
                      </span>
                    </div>
                  )}
                  {sidebarCollapsed && <div className="hidden lg:block border-t border-border mx-0 my-1" />}

                  {/* Support Button */}
                  {sidebarCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            setSidebarOpen(false);
                            setSupportChatOpen(!supportChatOpen);
                          }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full group",
                            "lg:justify-center lg:w-14 lg:h-14 lg:mx-auto lg:p-0",
                            "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground dark:hover:bg-card/40 dark:hover:text-foreground"
                          )}
                        >
                          <MdSupportAgent className="h-5 w-5 lg:h-6 lg:w-6 shrink-0 transition-transform duration-200 lg:group-hover:scale-110" />
                          <span className="lg:hidden">{t("sidebar.support")}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="hidden lg:block">{t("sidebar.support")}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <button
                      onClick={() => {
                        setSidebarOpen(false);
                        setSupportChatOpen(!supportChatOpen);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full",
                        "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground dark:hover:bg-card/40 dark:hover:text-foreground"
                      )}
                    >
                      <MdSupportAgent className="h-5 w-5 shrink-0" />
                      <span>{t("sidebar.support")}</span>
                    </button>
                  )}

                  {/* Indicações Link */}
                  {sidebarCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to="/indicacao"
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors group",
                            "lg:justify-center lg:w-14 lg:h-14 lg:mx-auto lg:p-0",
                            location.pathname === "/indicacao"
                              ? "bg-primary text-primary-foreground dark:bg-primary/20 dark:text-primary dark:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                              : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground dark:hover:bg-card/40 dark:hover:text-foreground"
                          )}
                        >
                          <HiOutlineGift className="h-5 w-5 lg:h-6 lg:w-6 shrink-0 transition-transform duration-200 lg:group-hover:scale-110" />
                          <span className="lg:hidden">{t("sidebar.referrals")}</span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="hidden lg:block">{t("sidebar.referrals")}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      to="/indicacao"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                        location.pathname === "/indicacao"
                          ? "bg-primary text-primary-foreground dark:bg-primary/20 dark:text-primary dark:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground dark:hover:bg-card/40 dark:hover:text-foreground"
                      )}
                    >
                      <HiOutlineGift className="h-5 w-5 shrink-0" />
                      <span>{t("sidebar.referrals")}</span>
                    </Link>
                  )}

                  {/* Configurações */}
                  {systemNav.map(renderNavItem)}

                  {/* Bottom spacer inside nav */}
                  <div className="pb-2" />
                </nav>

                {/* BOTTOM SCALED GROUP: Container inferior (PlanBadge + Botão Sair) */}
                <div className={cn(
                  "flex flex-col gap-2 pb-4 transition-transform duration-300 origin-bottom shrink-0",
                  !sidebarCollapsed && "scale-[0.95]"
                )}>
                  {/* PlanBadge */}
                  <div className={cn(sidebarCollapsed && "lg:hidden")}>
                    <PlanBadge key={activeWorkspace?.id} />
                  </div>

                  {/* Botão Sair */}
                  <div className={cn(sidebarCollapsed ? "lg:px-3" : "px-3", "px-3")}>
                    {sidebarCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="hidden lg:flex w-14 h-14 mx-auto group"
                            onClick={handleLogout}
                          >
                            <LogOut className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">{t("sidebar.logout")}</TooltipContent>
                      </Tooltip>
                    ) : null}
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start gap-3", sidebarCollapsed && "lg:hidden")}
                      onClick={handleLogout}
                    >
                      <LogOut className="h-5 w-5" />
                      {t("sidebar.logout")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content + AI Sidebar flex layout */}
          <div className="flex-1 flex min-h-0 min-w-0">
            <main
              className="flex-1 flex flex-col transition-all duration-300 min-h-0 min-w-0"
            >
              {/* Header - hidden on mobile */}
              {!isMobile && (
                <DashboardHeader
                  onToggleAIChat={() => setAiChatOpen(!aiChatOpen)}
                  aiChatOpen={aiChatOpen}
                  onToggleMobileSidebar={() => setSidebarOpen(!sidebarOpen)}
                  sidebarCollapsed={sidebarCollapsed}
                />
              )}

              {/* Mobile Header - apenas páginas internas (não dashboard) */}
              {isMobile && location.pathname !== '/' && location.pathname !== '/dashboard' && (
                <div className="flex items-center justify-end px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <Logo size="sm" />
                </div>
              )}
              <div
                ref={scrollContainerRef}
                data-main-scroll
                className={cn(
                  "flex-1 min-h-0",
                  "overflow-y-auto overflow-x-hidden",
                )}
                style={{
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {children}
                {/* Spacer para mobile - páginas com altura fixa (conversations, appointments) gerenciam seu próprio layout */}
                {isMobile && !location.pathname.startsWith('/conversations') && (
                  <div className="h-40 shrink-0" aria-hidden="true" />
                )}
              </div>
            </main>

            {/* AI Chat Sidebar - inline on desktop (push), overlay on mobile/conversations */}
            <AIChatSidebar
              isOpen={aiChatOpen}
              onClose={() => setAiChatOpen(false)}
              isOverlay={isMobile || location.pathname.startsWith('/conversations')}
            />
          </div>

          {/* Mobile Bottom Navigation */}
          <MobileBottomNav
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
            visiblePages={{
              appointments: isAppointmentsVisible,
              quotes: isQuotesVisible
            }}
          />

          {/* Support Chat Sidebar */}
          <SupportChatSidebar isOpen={supportChatOpen} onClose={() => setSupportChatOpen(false)} />

          {/* WhatsApp Connection Modal */}
          <WhatsAppConnectionModal />

          {/* AI Promotion Banner */}
          <AIPromotionBanner key={activeWorkspace?.id} onOpenAIChat={() => setAiChatOpen(true)} />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Layout;
