import { useNavigate } from "react-router-dom";
import { Bot, FileText, Gift, Settings } from "lucide-react";

interface QuickAction {
  icon: React.ElementType;
  label: string;
  path?: string;
  color: string;
  bgColor: string;
  onClick?: () => void;
}

interface MobileQuickActionsProps {
  onOpenSupport?: () => void;
}

export function MobileQuickActions({ onOpenSupport }: MobileQuickActionsProps) {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      icon: Bot,
      label: "Agentes",
      path: "/ai-settings",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: FileText,
      label: "Orçamentos",
      path: "/quotes",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      icon: Gift,
      label: "Indicar",
      path: "/indicacao",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      icon: Settings,
      label: "Config",
      path: "/settings",
      color: "text-gray-500 dark:text-gray-400",
      bgColor: "bg-gray-500/10",
    },
  ];

  const handleClick = (action: QuickAction) => {
    if (action.onClick) {
      action.onClick();
    } else if (action.path) {
      navigate(action.path);
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-muted-foreground mb-4 px-1">
        Acesso Rápido
      </h2>
      <div className="grid grid-cols-4 gap-4">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleClick(action)}
            className="flex flex-col items-center gap-2.5 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-card shadow-sm border border-border/30 dark:border-white/5 flex items-center justify-center group-active:scale-95 transition-transform">
              <div className={`w-10 h-10 rounded-full ${action.bgColor} flex items-center justify-center`}>
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </div>
            </div>
            <span className="text-xs font-medium text-muted-foreground truncate w-full text-center">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
