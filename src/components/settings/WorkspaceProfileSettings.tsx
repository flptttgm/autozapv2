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
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { Loader2 } from "lucide-react";

export const WorkspaceProfileSettings = () => {
    const queryClient = useQueryClient();
    const { profile, refreshProfile } = useAuth();
    const workspaceId = profile?.workspace_id;

    const [fullName, setFullName] = useState(profile?.display_name || "");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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

    useEffect(() => {
        if (workspaceProfile) {
            setName(workspaceProfile.name || profile?.company_name || "");
            setDescription(workspaceProfile.description || "");
            setAvatarUrl(workspaceProfile.avatar_url || null);
        }
    }, [workspaceProfile, profile]);

    useEffect(() => {
        if (profile) {
            setFullName(profile.display_name || "");
        }
    }, [profile]);

    const updateProfileMutation = useMutation({
        mutationFn: async ({
            fullName,
            name,
            description,
            avatarUrl
        }: {
            fullName: string;
            name: string;
            description: string;
            avatarUrl: string | null;
        }) => {
            if (!workspaceId) throw new Error("Workspace ID is required");

            // Step 1: Update user profile (full_name + company_name)
            console.log("[Settings] Updating profiles table...", { fullName, name, profileId: profile?.id });
            const { error: userError } = await supabase
                .from("profiles" as any)
                .update({ display_name: fullName, company_name: name } as any)
                .eq("id", profile?.id);

            if (userError) {
                console.error("[Settings] profiles update failed:", userError);
                throw new Error(`Erro ao atualizar perfil: ${userError.message}`);
            }
            console.log("[Settings] profiles updated successfully");

            // Step 2: Upsert workspace_profile (single atomic operation)
            console.log("[Settings] Upserting workspace_profile...", { workspaceId });
            const { error: wpError } = await supabase
                .from("workspace_profiles" as any)
                .upsert({
                    workspace_id: workspaceId,
                    name,
                    description,
                    avatar_url: avatarUrl
                } as any, { onConflict: "workspace_id" });

            if (wpError) {
                console.error("[Settings] workspace_profiles upsert failed:", wpError);
                throw new Error(`Erro ao salvar dados da empresa: ${wpError.message}`);
            }
            console.log("[Settings] All saved successfully!");
        },
        onSuccess: async () => {
            toast.success("Perfil atualizado com sucesso!");
            await refreshProfile();
            queryClient.invalidateQueries({ queryKey: ["workspace-profile", workspaceId] });
        },
        onError: (error: any) => {
            const message = error?.message || "Erro desconhecido";
            console.error("[Settings] Save error:", error);
            toast.error("Erro ao salvar: " + message);
        },
    });

    const handleAvatarUpload = (url: string) => {
        setAvatarUrl(url);
        updateProfileMutation.mutate({ fullName, name, description, avatarUrl: url });
    };

    if (isLoading) {
        return (
            <Card className="p-6 flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Perfil e Empresa</h2>
            <p className="text-sm text-muted-foreground mb-6">
                Configure suas informações pessoais e a identidade visual da sua empresa
            </p>

            <div className="space-y-6">
                {workspaceId && (
                    <div className="mb-6">
                        <Label className="mb-4 block">Logo da Empresa</Label>
                        <AvatarUpload
                            url={avatarUrl}
                            onUpload={handleAvatarUpload}
                            workspaceId={workspaceId}
                            fallbackText={name}
                            userName={fullName}
                        />
                    </div>
                )}

                <div className="grid gap-4">
                    <div>
                        <Label htmlFor="full-name">Seu Nome</Label>
                        <Input
                            id="full-name"
                            type="text"
                            placeholder="Digite seu nome"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>

                    <div>
                        <Label htmlFor="workspace-name">Nome da Empresa</Label>
                        <Input
                            id="workspace-name"
                            type="text"
                            placeholder="Digite o nome da empresa"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <Label htmlFor="workspace-description">Descrição (Bio)</Label>
                        <Textarea
                            id="workspace-description"
                            placeholder="Breve descrição sobre a empresa ou serviços..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="resize-none h-24"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Esta descrição poderá ser usada por agentes IA para entender o contexto da empresa.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border/50">
                    <Button
                        onClick={() => updateProfileMutation.mutate({ fullName, name, description, avatarUrl })}
                        disabled={updateProfileMutation.isPending}
                    >
                        {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {updateProfileMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </div>
        </Card>
    );
};
