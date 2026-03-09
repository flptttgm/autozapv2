import { cn } from "@/lib/utils";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import { getWorkspaceTemplate } from "@/lib/workspaceTemplates";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, ChevronsUpDown, Loader2, Plus, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface WorkspaceSwitcherProps {
    collapsed?: boolean;
    headerMode?: boolean;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

/** Renders the workspace icon — template icon if no avatar, or avatar image */
function WorkspaceIcon({
    avatarUrl,
    template,
    customIcon,
    name,
    size = "sm",
    active = false,
}: {
    avatarUrl?: string | null;
    template?: string | null;
    customIcon?: string | null;
    name: string;
    size?: "sm" | "lg";
    active?: boolean;
}) {
    // If workspace is "custom" and has a customIcon, use that template's icon/colors
    const effectiveTemplate = (template === "custom" && customIcon) ? customIcon : template;
    const tpl = getWorkspaceTemplate(effectiveTemplate);
    const Icon = tpl.icon;
    const dim = size === "lg" ? "h-9 w-9" : "h-8 w-8";
    const iconDim = size === "lg" ? "h-[18px] w-[18px]" : "h-4 w-4";

    if (avatarUrl) {
        return (
            <Avatar className={cn(dim, "shrink-0 rounded-xl border-2", tpl.borderColor)}>
                <AvatarImage src={avatarUrl} className="rounded-xl" />
                <AvatarFallback className={cn(
                    "text-[10px] font-bold rounded-xl",
                    active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                    {getInitials(name)}
                </AvatarFallback>
            </Avatar>
        );
    }

    // Template icon fallback
    return (
        <div className={cn(
            dim, "rounded-xl shrink-0 flex items-center justify-center border-2",
            tpl.bgColor, tpl.color, tpl.borderColor
        )}>
            <Icon className={iconDim} />
        </div>
    );
}

export function WorkspaceSwitcher({ collapsed = false, headerMode = false }: WorkspaceSwitcherProps) {
    const { workspaces, activeWorkspace, isLoading, switchWorkspace, isSwitching } =
        useUserWorkspaces();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { canManageWorkspace } = useWorkspaceRole();

    const ROLE_LABELS: Record<string, string> = {
        owner: t("workspaceSwitcher.owner"),
        admin: t("workspaceSwitcher.admin"),
        member: t("workspaceSwitcher.member"),
    };

    if (isLoading) {
        return (
            <div className={cn(headerMode ? "" : "px-3 py-2", collapsed && "lg:px-2")}>
                <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    if (!activeWorkspace) return null;

    const triggerButton = headerMode ? (
        <DropdownMenuTrigger asChild>
            <button
                className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-1.5 transition-all",
                    "hover:bg-muted/60 cursor-pointer group border border-border/50",
                    isSwitching && "opacity-60 pointer-events-none"
                )}
                disabled={isSwitching}
            >
                <WorkspaceIcon
                    avatarUrl={activeWorkspace.avatar_url}
                    template={activeWorkspace.template}
                    customIcon={activeWorkspace.customIcon}
                    name={activeWorkspace.name}
                    size="sm"
                    active
                />
                <span className="text-sm font-medium truncate max-w-[140px]">{activeWorkspace.name}</span>
                {isSwitching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                    <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                )}
            </button>
        </DropdownMenuTrigger>
    ) : (
        <DropdownMenuTrigger asChild>
            {(() => {
                const effectiveTpl = (activeWorkspace.template === "custom" && activeWorkspace.customIcon) ? activeWorkspace.customIcon : activeWorkspace.template;
                const activeTpl = getWorkspaceTemplate(effectiveTpl);
                return (
                    <button
                        className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 w-full text-left transition-all",
                            `${activeTpl.borderColor} ${activeTpl.bgColor}`,
                            collapsed && "lg:justify-center lg:p-2 lg:border-transparent lg:bg-transparent lg:hover:bg-muted/50",
                            isSwitching && "opacity-60 pointer-events-none"
                        )}
                        disabled={isSwitching}
                    >
                        <WorkspaceIcon
                            avatarUrl={activeWorkspace.avatar_url}
                            template={activeWorkspace.template}
                            customIcon={activeWorkspace.customIcon}
                            name={activeWorkspace.name}
                            size="lg"
                            active
                        />
                        <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
                            <p className="text-sm font-semibold truncate">{activeWorkspace.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                                {ROLE_LABELS[activeWorkspace.role] || t("workspaceSwitcher.member")}
                            </p>
                        </div>
                        {isSwitching ? (
                            <Loader2 className={cn("h-4 w-4 shrink-0 animate-spin text-muted-foreground", collapsed && "lg:hidden")} />
                        ) : (
                            <ChevronsUpDown className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity",
                                collapsed && "lg:hidden"
                            )} />
                        )}
                    </button>
                );
            })()}
        </DropdownMenuTrigger>
    );

    return (
        <div className={cn(headerMode ? "" : "px-3 py-1", !headerMode && collapsed && "lg:px-2")}>
            <DropdownMenu>
                {collapsed ? (
                    <Tooltip>
                        <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
                        <TooltipContent side="right" className="hidden lg:block">
                            {activeWorkspace.name}
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    triggerButton
                )}

                <DropdownMenuContent
                    side={collapsed ? "right" : "bottom"}
                    align="start"
                    className="w-[260px] z-[100] max-h-[70vh] overflow-y-auto"
                    sideOffset={8}
                >
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        {t("workspaceSwitcher.yourWorkspaces")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* Active workspace */}
                    {(() => {
                        const effectiveTpl2 = (activeWorkspace.template === "custom" && activeWorkspace.customIcon) ? activeWorkspace.customIcon : activeWorkspace.template;
                        const activeTpl = getWorkspaceTemplate(effectiveTpl2);
                        return (
                            <DropdownMenuItem className={cn("flex items-center gap-3 py-2.5 cursor-pointer", activeTpl.bgColor)}>
                                <WorkspaceIcon
                                    avatarUrl={activeWorkspace.avatar_url}
                                    template={activeWorkspace.template}
                                    customIcon={activeWorkspace.customIcon}
                                    name={activeWorkspace.name}
                                    active
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{activeWorkspace.name}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {ROLE_LABELS[activeWorkspace.role] || t("workspaceSwitcher.member")}
                                    </p>
                                </div>
                                <Check className={cn("h-4 w-4 shrink-0", activeTpl.color)} />
                            </DropdownMenuItem>
                        );
                    })()}

                    {/* Other workspaces */}
                    {workspaces
                        .filter((ws) => ws.id !== activeWorkspace.id)
                        .map((ws) => (
                            <DropdownMenuItem
                                key={ws.id}
                                onClick={() => switchWorkspace(ws.id)}
                                className="flex items-center gap-3 py-2.5 cursor-pointer"
                            >
                                <WorkspaceIcon
                                    avatarUrl={ws.avatar_url}
                                    template={ws.template}
                                    customIcon={ws.customIcon}
                                    name={ws.name}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{ws.name}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {ROLE_LABELS[ws.role] || t("workspaceSwitcher.member")}
                                    </p>
                                </div>
                            </DropdownMenuItem>
                        ))}

                    {canManageWorkspace && (
                        <>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={() => navigate("/workspaces")}
                                className="flex items-center gap-3 py-2 cursor-pointer text-muted-foreground"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="text-sm">{t("workspaceSwitcher.newWorkspace")}</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => navigate("/workspaces")}
                                className="flex items-center gap-3 py-2 cursor-pointer text-muted-foreground"
                            >
                                <Settings className="h-4 w-4" />
                                <span className="text-sm">{t("workspaceSwitcher.manageWorkspaces")}</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
