import { NavLink, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  ScrollText, 
  CreditCard, 
  MessageSquare,
  ArrowLeft,
  Shield,
  Receipt,
  Bell,
  Mail,
  Gift,
  LogIn,
  Ticket,
  Phone,
  UserCheck,
  Bug
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Debug Mode", href: "/admin/debug", icon: Bug },
  { title: "Usuários", href: "/admin/users", icon: Users },
  { title: "Vendedores", href: "/admin/sellers", icon: UserCheck },
  { title: "Assinaturas", href: "/admin/subscriptions", icon: CreditCard },
  { title: "Pagamentos", href: "/admin/payments", icon: Receipt },
  { title: "Cupons", href: "/admin/coupons", icon: Ticket },
  { title: "Indicações", href: "/admin/referrals", icon: Gift },
  { title: "WhatsApp", href: "/admin/whatsapp", icon: MessageSquare },
  { title: "Msgs WhatsApp", href: "/admin/whatsapp-messages", icon: Phone },
  { title: "Notificações", href: "/admin/notifications", icon: Bell },
  { title: "Emails Auto", href: "/admin/email-automations", icon: Mail },
  { title: "Logs", href: "/admin/logs", icon: ScrollText },
  { title: "Logins", href: "/admin/logins", icon: LogIn },
];

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const navigate = useNavigate();

  const handleNavigation = (href: string) => {
    navigate(href);
    onNavigate?.();
  };

  return (
    <aside className="w-64 border-r border-border bg-card min-h-screen flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 text-primary">
          <Shield className="h-6 w-6" />
          <span className="font-bold text-lg">Admin Panel</span>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/admin"}
            onClick={() => onNavigate?.()}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => handleNavigation("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao App
        </Button>
      </div>
    </aside>
  );
}
