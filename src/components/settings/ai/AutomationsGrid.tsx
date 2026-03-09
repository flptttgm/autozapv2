import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    HandMetal,
    MessageSquareReply,
    RefreshCw,
    Cake,
    PackageCheck,
    Bell,
    Receipt,
    Settings2,
    Sparkles,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface AutomationConfig {
    enabled: boolean;
    message: string;
    delay: number;
    delayUnit: string;
}

interface AutomationDef {
    id: string;
    name: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    trigger: string;
    delayLabel: string;
    delayUnit: string;
    defaultDelay: number;
    defaultMessage: string;
    comingSoon?: boolean;
}

const automations: AutomationDef[] = [
    {
        id: "welcome",
        name: "Boas-vindas",
        description: "Mensagem automática quando um novo lead é criado",
        icon: HandMetal,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-100 dark:bg-emerald-500/20",
        borderColor: "border-emerald-200 dark:border-emerald-500/30",
        trigger: "Novo lead criado",
        delayLabel: "Enviar após",
        delayUnit: "minutos",
        defaultDelay: 1,
        defaultMessage: "Olá! 👋 Seja bem-vindo(a)! Como posso te ajudar?",
    },
    {
        id: "followup",
        name: "Follow-up",
        description: "Lembrete se o lead não responder em X horas",
        icon: MessageSquareReply,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-100 dark:bg-blue-500/20",
        borderColor: "border-blue-200 dark:border-blue-500/30",
        trigger: "Lead sem resposta",
        delayLabel: "Aguardar",
        delayUnit: "horas",
        defaultDelay: 24,
        defaultMessage: "Oi! Vi que você entrou em contato. Ainda tem interesse? 😊",
    },
    {
        id: "reengagement",
        name: "Re-engajamento",
        description: "Reativar leads inativos após período de silêncio",
        icon: RefreshCw,
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-100 dark:bg-violet-500/20",
        borderColor: "border-violet-200 dark:border-violet-500/30",
        trigger: "Lead inativo",
        delayLabel: "Após inatividade de",
        delayUnit: "dias",
        defaultDelay: 7,
        defaultMessage: "Olá! Faz um tempo que não conversamos. Tudo bem por aí? Tem novidades que podem te interessar! 🚀",
    },
    {
        id: "birthday",
        name: "Aniversário",
        description: "Felicitação automática na data de nascimento",
        icon: Cake,
        color: "text-pink-600 dark:text-pink-400",
        bgColor: "bg-pink-100 dark:bg-pink-500/20",
        borderColor: "border-pink-200 dark:border-pink-500/30",
        trigger: "Data de nascimento",
        delayLabel: "Horário de envio",
        delayUnit: "horas",
        defaultDelay: 9,
        defaultMessage: "Feliz aniversário! 🎂🎉 Que seu dia seja incrível! Temos um presente especial pra você!",
    },
    {
        id: "postsale",
        name: "Pós-venda",
        description: "Check-in automático após fechar negócio",
        icon: PackageCheck,
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-100 dark:bg-amber-500/20",
        borderColor: "border-amber-200 dark:border-amber-500/30",
        trigger: "Lead marcado como ganho",
        delayLabel: "Enviar após",
        delayUnit: "dias",
        defaultDelay: 3,
        defaultMessage: "Oi! Passando pra saber se está tudo certo com seu pedido. Precisa de algo? 😊",
    },
    {
        id: "appointment_reminder",
        name: "Lembrete de Agendamento",
        description: "Notificar o cliente antes do horário marcado",
        icon: Bell,
        color: "text-cyan-600 dark:text-cyan-400",
        bgColor: "bg-cyan-100 dark:bg-cyan-500/20",
        borderColor: "border-cyan-200 dark:border-cyan-500/30",
        trigger: "Agendamento próximo",
        delayLabel: "Enviar antes de",
        delayUnit: "horas",
        defaultDelay: 2,
        defaultMessage: "Lembrete: você tem um compromisso agendado. Nos vemos em breve! ⏰",
    },
    {
        id: "quote_notification",
        name: "Notificação de Orçamento",
        description: "Aviso automático quando um orçamento é enviado",
        icon: Receipt,
        color: "text-teal-600 dark:text-teal-400",
        bgColor: "bg-teal-100 dark:bg-teal-500/20",
        borderColor: "border-teal-200 dark:border-teal-500/30",
        trigger: "Orçamento criado",
        delayLabel: "Enviar após",
        delayUnit: "minutos",
        defaultDelay: 0,
        defaultMessage: "Seu orçamento foi enviado! 📄 Qualquer dúvida, estou à disposição.",
    },
];

interface AutomationsGridProps {
    workspaceId: string;
}

export const AutomationsGrid = ({ workspaceId }: AutomationsGridProps) => {
    const { t } = useTranslation("agents");
    const [configs, setConfigs] = useState<Record<string, AutomationConfig>>(() => {
        const initial: Record<string, AutomationConfig> = {};
        automations.forEach((a) => {
            initial[a.id] = {
                enabled: false,
                message: a.defaultMessage,
                delay: a.defaultDelay,
                delayUnit: a.delayUnit,
            };
        });
        return initial;
    });

    const [editingAutomation, setEditingAutomation] = useState<AutomationDef | null>(null);
    const [tempConfig, setTempConfig] = useState<AutomationConfig | null>(null);

    const handleToggle = (id: string, enabled: boolean) => {
        setConfigs((prev) => ({
            ...prev,
            [id]: { ...prev[id], enabled },
        }));
    };

    const handleOpenConfig = (automation: AutomationDef) => {
        setEditingAutomation(automation);
        setTempConfig({ ...configs[automation.id] });
    };

    const handleSaveConfig = () => {
        if (editingAutomation && tempConfig) {
            setConfigs((prev) => ({
                ...prev,
                [editingAutomation.id]: tempConfig,
            }));
            setEditingAutomation(null);
            setTempConfig(null);
        }
    };

    const enabledCount = Object.values(configs).filter((c) => c.enabled).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">{t("automationsSettings.title")}</h3>
                    <p className="text-sm text-muted-foreground">
                        {t("automationsSettings.description")}
                    </p>
                </div>
                {enabledCount > 0 && (
                    <Badge variant="secondary" className="gap-1.5">
                        <Sparkles className="h-3 w-3" />
                        {enabledCount !== 1
                            ? t("automationsSettings.activeCountPlural", { count: enabledCount })
                            : t("automationsSettings.activeCount", { count: enabledCount })}
                    </Badge>
                )}
            </div>

            {/* Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {automations.map((automation) => {
                    const Icon = automation.icon;
                    const config = configs[automation.id];
                    const isEnabled = config.enabled;

                    return (
                        <Card
                            key={automation.id}
                            className={cn(
                                "relative overflow-hidden transition-all duration-200 border",
                                isEnabled
                                    ? `${automation.borderColor} shadow-sm`
                                    : "border-border opacity-75 hover:opacity-100"
                            )}
                        >
                            {/* Subtle gradient top accent */}
                            {isEnabled && (
                                <div className={cn(
                                    "absolute top-0 left-0 right-0 h-1 rounded-t-lg",
                                    automation.bgColor
                                )} />
                            )}

                            <div className="p-4 space-y-3">
                                {/* Top row: icon + name + toggle */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-2 rounded-xl transition-colors",
                                            isEnabled ? automation.bgColor : "bg-muted"
                                        )}>
                                            <Icon className={cn(
                                                "h-4.5 w-4.5",
                                                isEnabled ? automation.color : "text-muted-foreground"
                                            )} />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-sm">{automation.name}</h4>
                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {automation.trigger}
                                            </span>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isEnabled}
                                        onCheckedChange={(checked) => handleToggle(automation.id, checked)}
                                    />
                                </div>

                                {/* Description */}
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {automation.description}
                                </p>

                                {/* Config info + button */}
                                <div className="flex items-center justify-between pt-1">
                                    {isEnabled ? (
                                        <span className="text-xs text-muted-foreground">
                                            {automation.delayLabel}: <strong>{config.delay} {config.delayUnit}</strong>
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic">{t("automationsSettings.disabled")}</span>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => handleOpenConfig(automation)}
                                    >
                                        <Settings2 className="h-3 w-3" />
                                        {t("automationsSettings.configure")}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Config Dialog */}
            <Dialog
                open={!!editingAutomation}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingAutomation(null);
                        setTempConfig(null);
                    }
                }}
            >
                {editingAutomation && tempConfig && (
                    <DialogContent className="max-w-md p-0">
                        <div className="px-6 pt-6 pb-4 border-b">
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "p-2 rounded-xl",
                                        editingAutomation.bgColor
                                    )}>
                                        {(() => {
                                            const Icon = editingAutomation.icon;
                                            return <Icon className={cn("h-5 w-5", editingAutomation.color)} />;
                                        })()}
                                    </div>
                                    <div>
                                        <DialogTitle>{editingAutomation.name}</DialogTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">{editingAutomation.trigger}</p>
                                    </div>
                                </div>
                            </DialogHeader>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {/* Enable toggle */}
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">{t("automationsSettings.enableAutomation")}</Label>
                                <Switch
                                    checked={tempConfig.enabled}
                                    onCheckedChange={(checked) =>
                                        setTempConfig((prev) => prev ? { ...prev, enabled: checked } : prev)
                                    }
                                />
                            </div>

                            {/* Delay */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">{editingAutomation.delayLabel}</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={tempConfig.delay}
                                        onChange={(e) =>
                                            setTempConfig((prev) =>
                                                prev ? { ...prev, delay: parseInt(e.target.value) || 0 } : prev
                                            )
                                        }
                                        min={0}
                                        className="w-24 h-9 text-center"
                                    />
                                    <span className="text-sm text-muted-foreground">{editingAutomation.delayUnit}</span>
                                </div>
                            </div>

                            {/* Message */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">{t("automationsSettings.messageLabel")}</Label>
                                <Textarea
                                    value={tempConfig.message}
                                    onChange={(e) =>
                                        setTempConfig((prev) =>
                                            prev ? { ...prev, message: e.target.value } : prev
                                        )
                                    }
                                    rows={4}
                                    className="resize-none"
                                    placeholder={t("automationsSettings.messagePlaceholder")}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t("automationsSettings.messageHelper")}
                                </p>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setEditingAutomation(null);
                                    setTempConfig(null);
                                }}
                            >
                                {t("automationsSettings.cancel")}
                            </Button>
                            <Button onClick={handleSaveConfig}>
                                {t("automationsSettings.save")}
                            </Button>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};
