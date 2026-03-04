import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, User, Mail, Lock, Eye, EyeOff, Calendar, Shield, Building2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const ProfileSettings = () => {
    const queryClient = useQueryClient();
    const { user, profile, refreshProfile } = useAuth();
    const workspaceId = profile?.workspace_id;

    // Personal info state
    const [displayName, setDisplayName] = useState(profile?.display_name || "");

    // Company state
    const [companyName, setCompanyName] = useState("");
    const [companyDescription, setCompanyDescription] = useState("");
    const [companyAvatarUrl, setCompanyAvatarUrl] = useState<string | null>(null);

    // Password state
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Fetch workspace profile
    const { data: workspaceProfile, isLoading } = useQuery({
        queryKey: ["workspace-profile", workspaceId],
        queryFn: async () => {
            if (!workspaceId) return null;
            const { data, error } = await supabase
                .from("workspace_profiles" as any)
                .select("*")
                .eq("workspace_id", workspaceId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                console.error("Error fetching workspace profile:", error);
                return null;
            }
            return data;
        },
        enabled: !!workspaceId,
    });

    // Sync state from server
    useEffect(() => {
        if (profile) setDisplayName(profile.display_name || "");
    }, [profile]);

    useEffect(() => {
        if (workspaceProfile) {
            setCompanyName(workspaceProfile.name || profile?.company_name || "");
            setCompanyDescription(workspaceProfile.description || "");
            setCompanyAvatarUrl(workspaceProfile.avatar_url || null);
        }
    }, [workspaceProfile, profile]);

    // ── Save all profile info ───────────────────────
    const saveProfileMutation = useMutation({
        mutationFn: async () => {
            if (!workspaceId) throw new Error("Workspace não encontrado");

            // Update profiles table (display_name + company_name)
            const { error: profileError } = await supabase
                .from("profiles" as any)
                .update({ display_name: displayName, company_name: companyName } as any)
                .eq("id", profile?.id);

            if (profileError) throw new Error(`Erro ao atualizar perfil: ${profileError.message}`);

            // Upsert workspace_profile (company details)
            const { error: wpError } = await supabase
                .from("workspace_profiles" as any)
                .upsert({
                    workspace_id: workspaceId,
                    name: companyName,
                    description: companyDescription,
                    avatar_url: companyAvatarUrl,
                } as any, { onConflict: "workspace_id" });

            if (wpError) throw new Error(`Erro ao salvar dados da empresa: ${wpError.message}`);
        },
        onSuccess: async () => {
            toast.success("Perfil atualizado com sucesso!");
            await refreshProfile();
            queryClient.invalidateQueries({ queryKey: ["workspace-profile", workspaceId] });
        },
        onError: (error: any) => {
            toast.error(error?.message || "Erro ao salvar");
        },
    });

    // ── Update password ─────────────────────────────
    const updatePasswordMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Senha atualizada com sucesso!");
            setNewPassword("");
            setConfirmPassword("");
        },
        onError: (error: any) => {
            toast.error(error?.message || "Erro ao atualizar senha");
        },
    });

    const handlePasswordUpdate = () => {
        if (!newPassword) return toast.error("Digite a nova senha");
        if (newPassword.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres");
        if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem");
        updatePasswordMutation.mutate();
    };

    const handleAvatarUpload = (url: string) => {
        setCompanyAvatarUrl(url);
        // Auto-save when avatar changes
        saveProfileMutation.mutate();
    };

    // ── Helpers ──────────────────────────────────────
    const getInitials = (name: string) => {
        const parts = name.split(" ").filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const email = user?.email || "";
    const createdAt = user?.created_at
        ? format(new Date(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        : "—";
    const provider = user?.app_metadata?.provider || "email";

    if (isLoading) {
        return (
            <Card className="p-6 flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* ═══ Personal Info + Company ════════════════ */}
            <Card className="p-6">
                {/* Account header */}
                <div className="flex items-start gap-5 mb-6">
                    <Avatar className="h-16 w-16 shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xl font-semibold border border-primary/10">
                            {displayName ? getInitials(displayName) : <User className="h-7 w-7" />}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold truncate">{displayName || "Usuário"}</h2>
                        <p className="text-sm text-muted-foreground truncate">{email}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs gap-1">
                                <Shield className="h-3 w-3" />
                                {provider === "google" ? "Google" : "Email"}
                            </Badge>
                            <Badge variant="outline" className="text-xs gap-1">
                                <Calendar className="h-3 w-3" />
                                Desde {createdAt}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-border/50 mb-6" />

                {/* ── Personal section ─────────────────────── */}
                <div className="space-y-4 mb-8">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Informações Pessoais
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="profile-name">Seu Nome</Label>
                            <Input
                                id="profile-name"
                                placeholder="Nome completo"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={email} disabled className="bg-muted/50 cursor-not-allowed" />
                            <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-border/50 mb-6" />

                {/* ── Company section ──────────────────────── */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        Empresa
                    </h3>

                    {workspaceId && (
                        <div className="mb-2">
                            <Label className="mb-3 block">Logo da Empresa</Label>
                            <AvatarUpload
                                url={companyAvatarUrl}
                                onUpload={handleAvatarUpload}
                                workspaceId={workspaceId}
                                fallbackText={companyName}
                                userName={displayName}
                            />
                        </div>
                    )}

                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="company-name">Nome da Empresa</Label>
                            <Input
                                id="company-name"
                                placeholder="Nome da empresa"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="company-description">Descrição (Bio)</Label>
                            <Textarea
                                id="company-description"
                                placeholder="Breve descrição sobre a empresa ou serviços..."
                                value={companyDescription}
                                onChange={(e) => setCompanyDescription(e.target.value)}
                                className="resize-none h-24"
                            />
                            <p className="text-xs text-muted-foreground">
                                Esta descrição poderá ser usada por agentes IA para entender o contexto da empresa.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Save button ──────────────────────────── */}
                <div className="flex justify-end pt-6 mt-6 border-t border-border/50">
                    <Button
                        onClick={() => saveProfileMutation.mutate()}
                        disabled={saveProfileMutation.isPending}
                    >
                        {saveProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {saveProfileMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </Card>

            {/* ═══ Security Card ═════════════════════════ */}
            <Card className="p-6">
                <div className="flex items-center gap-2 mb-1">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Segurança</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                    Atualize sua senha de acesso à plataforma
                </p>

                <div className="grid gap-4 max-w-md">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">Nova Senha</Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                type={showNewPassword ? "text" : "password"}
                                placeholder="Mínimo 6 caracteres"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            placeholder="Repita a nova senha"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4 mt-4 border-t border-border/50">
                    <Button
                        onClick={handlePasswordUpdate}
                        disabled={updatePasswordMutation.isPending || !newPassword}
                        variant="outline"
                    >
                        {updatePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Alterar Senha
                    </Button>
                </div>
            </Card>
        </div>
    );
};
