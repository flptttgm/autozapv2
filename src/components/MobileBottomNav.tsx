import { useLocation, useNavigate } from "react-router-dom";
import { Menu, Users, MessageSquare, Calendar, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { LucideIcon } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { routePreloaders } from "./AnimatedRoutes";

interface MobileBottomNavProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  visiblePages?: {
    appointments: boolean;
    quotes: boolean;
  };
  canManageConnections?: boolean;
}

interface NavItem {
  icon: LucideIcon;
  label: string;
  action?: "sidebar";
  href?: string;
  isCenter?: boolean;
  pageKey?: "appointments" | "quotes";
}

interface RippleEffect {
  x: number;
  y: number;
  id: number;
}

const allNavItems: (NavItem & { requiresManageConnections?: boolean })[] = [
  { icon: MessageSquare, label: "Conversas", href: "/conversations" },
  { icon: Users, label: "Clientes", href: "/leads" },
  { icon: Menu, label: "Menu", action: "sidebar", isCenter: true },
  { icon: Calendar, label: "Agenda", href: "/appointments", pageKey: "appointments" },
  { icon: Link2, label: "Conexões", href: "/whatsapp", requiresManageConnections: true },
];

// Track already prefetched routes to avoid duplicate imports
const prefetchedRoutes = new Set<string>();

export function MobileBottomNav({ onToggleSidebar, sidebarOpen, visiblePages, canManageConnections = true }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [pressedItem, setPressedItem] = useState<string | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const [ripples, setRipples] = useState<{ [key: string]: RippleEffect[] }>({});
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rippleIdRef = useRef(0);

  // Filter nav items based on visibility settings
  const navItems = useMemo(() => {
    return allNavItems.filter(item => {
      // Hide connection items for members without permission
      if (item.requiresManageConnections && !canManageConnections) return false;
      if (!item.pageKey) return true;
      if (!visiblePages) return true;
      return visiblePages[item.pageKey] ?? true;
    });
  }, [visiblePages, canManageConnections]);

  // Calculate grid columns based on visible items
  const gridCols = navItems.length;

  const isActive = useCallback((item: NavItem) => {
    if (item.action === "sidebar") return sidebarOpen;
    if (!item.href) return false;
    return location.pathname === item.href || location.pathname.startsWith(item.href + "/");
  }, [location.pathname, sidebarOpen]);

  // Find active index (excluding menu button for sliding indicator)
  const getActiveIndex = useCallback(() => {
    return navItems.findIndex((item) => !item.isCenter && isActive(item));
  }, [navItems, isActive]);

  // Update indicator position when route changes
  useEffect(() => {
    const activeIndex = getActiveIndex();

    if (activeIndex === -1 || !navRef.current) {
      setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      return;
    }

    const activeButton = itemRefs.current[activeIndex];
    const navContainer = navRef.current;

    if (activeButton && navContainer) {
      const navRect = navContainer.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      setIndicatorStyle({
        left: buttonRect.left - navRect.left + (buttonRect.width / 2) - 12,
        width: 24,
        opacity: 1,
      });
    }
  }, [location.pathname, sidebarOpen, getActiveIndex]);

  // Create ripple effect
  const createRipple = useCallback((event: React.MouseEvent | React.TouchEvent, label: string) => {
    const button = event.currentTarget as HTMLButtonElement;
    const rect = button.getBoundingClientRect();

    let x: number, y: number;

    if ('touches' in event) {
      x = event.touches[0].clientX - rect.left;
      y = event.touches[0].clientY - rect.top;
    } else {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }

    const newRipple: RippleEffect = {
      x,
      y,
      id: rippleIdRef.current++,
    };

    setRipples(prev => ({
      ...prev,
      [label]: [...(prev[label] || []), newRipple],
    }));

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => ({
        ...prev,
        [label]: (prev[label] || []).filter(r => r.id !== newRipple.id),
      }));
    }, 600);
  }, []);

  // Measure nav height and set CSS variable for Layout padding
  const navContainerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!isMobile) {
      document.documentElement.style.removeProperty('--mobile-bottom-nav-height');
      return;
    }

    // Altura inicial do nav (apenas a barra, sem extras)
    document.documentElement.style.setProperty('--mobile-bottom-nav-height', '88px');

    let raf1 = 0;
    let raf2 = 0;

    const updateHeight = () => {
      const el = navContainerRef.current;
      if (!el) return;

      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          const height = el.getBoundingClientRect().height;
          document.documentElement.style.setProperty('--mobile-bottom-nav-height', `${Math.ceil(height)}px`);
        });
      });
    };

    const ro = new ResizeObserver(updateHeight);
    if (navContainerRef.current) ro.observe(navContainerRef.current);

    updateHeight();
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      document.documentElement.style.removeProperty('--mobile-bottom-nav-height');
    };
  }, [isMobile]);

  // Prefetch route on touch start for faster navigation
  const handlePrefetch = useCallback((href: string | undefined) => {
    if (href && routePreloaders[href] && !prefetchedRoutes.has(href)) {
      prefetchedRoutes.add(href);
      routePreloaders[href]();
    }
  }, []);

  const handleItemClick = useCallback((item: NavItem, event: React.MouseEvent | React.TouchEvent) => {
    createRipple(event, item.label);

    if (item.action === "sidebar") {
      onToggleSidebar();
    } else if (item.href) {
      navigate(item.href);
    }
  }, [createRipple, navigate, onToggleSidebar]);

  const handlePressStart = useCallback((label: string) => {
    setPressedItem(label);
  }, []);

  const handlePressEnd = useCallback(() => {
    setPressedItem(null);
  }, []);

  // Early return AFTER all hooks are defined
  if (!isMobile) return null;

  return (
    <nav ref={navContainerRef} className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-safe-area-bottom pt-2" style={{ isolation: 'isolate' }}>
      {/* Glassmorphism container with refined effect */}
      <div className="bg-card/80 backdrop-blur-xl rounded-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.12)] border border-white/20 dark:border-white/10 relative overflow-hidden">
        {/* Sliding indicator */}
        <div
          className="absolute top-0 h-[3px] bg-gradient-to-r from-primary/80 via-primary to-primary/80 rounded-full transition-all duration-300 ease-out"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: indicatorStyle.opacity,
            boxShadow: '0 2px 8px hsl(var(--primary) / 0.4)',
          }}
        />

        <div
          ref={navRef}
          className="grid items-center py-2.5"
          style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
        >
          {navItems.map((item, index) => {
            const active = isActive(item);
            const isMenuButton = item.isCenter;
            const isPressed = pressedItem === item.label;
            const itemRipples = ripples[item.label] || [];

            return (
              <button
                key={item.label}
                ref={(el) => { itemRefs.current[index] = el; }}
                onClick={(e) => handleItemClick(item, e)}
                onTouchStart={(e) => {
                  handlePressStart(item.label);
                  createRipple(e, item.label);
                  handlePrefetch(item.href); // Prefetch on touch for faster navigation
                }}
                onTouchEnd={handlePressEnd}
                onMouseDown={() => handlePressStart(item.label)}
                onMouseUp={handlePressEnd}
                onMouseEnter={() => handlePrefetch(item.href)} // Prefetch on hover for desktop
                onMouseLeave={handlePressEnd}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200 w-full overflow-hidden",
                  isMenuButton
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white -mt-5 shadow-[0_2px_8px_rgba(16,185,129,0.25)] dark:shadow-[0_2px_10px_rgba(16,185,129,0.3)]"
                    : active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  isPressed && !isMenuButton && "scale-90",
                  isPressed && isMenuButton && "scale-95 shadow-[0_1px_4px_rgba(16,185,129,0.2)]",
                  !isPressed && "active:scale-95"
                )}
              >
                {/* Ripple effects */}
                {itemRipples.map((ripple) => (
                  <span
                    key={ripple.id}
                    className={cn(
                      "absolute rounded-full animate-ripple pointer-events-none",
                      isMenuButton
                        ? "bg-white/30"
                        : "bg-primary/20"
                    )}
                    style={{
                      left: ripple.x,
                      top: ripple.y,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                ))}

                <item.icon className={cn(
                  "h-5 w-5 transition-all duration-300 relative z-10",
                  isMenuButton ? "text-white" : active && "text-primary",
                  active && !isMenuButton && "scale-110"
                )} />
                <span className={cn(
                  "text-[10px] font-medium transition-all duration-300 relative z-10 whitespace-nowrap",
                  isMenuButton && "text-white",
                  active && !isMenuButton && "font-semibold"
                )}>{item.label}</span>

                {/* Subtle glow effect for menu button - reduced intensity */}
                {isMenuButton && (
                  <span className="absolute inset-0 rounded-xl bg-emerald-400/10 blur-sm -z-10" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Safe area spacer for iPhone */}
      <div className="h-safe-area-bottom" />
    </nav>
  );
}
