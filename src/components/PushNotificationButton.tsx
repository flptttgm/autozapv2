import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushNotificationButton() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const getIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-5 w-5 animate-spin" />;
    }
    if (isSubscribed) {
      return <BellRing className="h-5 w-5" />;
    }
    if (permission === 'denied') {
      return <BellOff className="h-5 w-5" />;
    }
    return <Bell className="h-5 w-5" />;
  };

  const getTooltip = () => {
    if (isLoading) {
      return 'Carregando...';
    }
    if (isSubscribed) {
      return 'Notificações ativadas - Clique para desativar';
    }
    if (permission === 'denied') {
      return 'Notificações bloqueadas - Habilite nas configurações do navegador';
    }
    return 'Ativar notificações push';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isSubscribed ? "default" : "ghost"}
            size="icon"
            onClick={handleClick}
            disabled={isLoading || permission === 'denied'}
            className={isSubscribed ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltip()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
