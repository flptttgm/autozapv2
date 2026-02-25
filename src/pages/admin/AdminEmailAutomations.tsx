import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, Edit, Eye, Clock, CheckCircle, XCircle, Zap, RefreshCw, Play, MessageSquare, AlertCircle, Info } from "lucide-react";

interface Automation {
  id: string;
  trigger_type: string;
  name: string;
  description: string | null;
  enabled: boolean;
  delay_hours: number;
  created_at: string;
  updated_at: string;
}

interface EmailTemplate {
  id: string;
  automation_id: string;
  subject: string;
  html_content: string;
  variables: string[];
}

interface EmailLog {
  id: string;
  automation_id: string;
  user_id: string;
  email: string;
  trigger_type: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  retry_count: number;
  next_retry_at: string | null;
  is_retryable: boolean;
}

const APP_URL = "https://appiautozap.com";
const PLAN_URL = "https://appiautozap.com/plans";

// Configurações de cor por tipo de trigger (verde como padrão)
function getHeaderColorForTrigger(triggerType: string): string {
  const colors: Record<string, string> = {
    trial_24h: "#22c55e",      // Verde padrão
    trial_6h: "#dc2626",       // Vermelho urgente
    trial_expired: "#1f2937",  // Cinza escuro
    welcome: "#22c55e",        // Verde padrão
    inactivity_7d: "#f59e0b",  // Amarelo/Laranja
    whatsapp_not_connected: "#25d366",  // Verde WhatsApp
    reactivation_coupon: "#8b5cf6",     // Roxo cupom
  };
  return colors[triggerType] || "#22c55e";
}

// CTA padrão por tipo de trigger
function getDefaultCtaForTrigger(triggerType: string): { text: string; url: string } {
  const ctas: Record<string, { text: string; url: string }> = {
    trial_24h: { text: "Ver Planos", url: PLAN_URL },
    trial_6h: { text: "Escolher Plano Agora", url: PLAN_URL },
    trial_expired: { text: "Reativar Minha Conta", url: PLAN_URL },
    welcome: { text: "Começar Configuração", url: `${APP_URL}/onboarding` },
    inactivity_7d: { text: "Voltar à Plataforma", url: APP_URL },
    whatsapp_not_connected: { text: "Conectar WhatsApp Agora", url: `${APP_URL}/whatsapp` },
    reactivation_coupon: { text: "Quero meu cupom!", url: "https://wa.me/5565996312685?text=Ol%C3%A1%2C%20eu%20quero%20o%20cupom%20de%20desconto%20do%20Autozap" },
  };
  return ctas[triggerType] || { text: "Acessar Plataforma", url: APP_URL };
}

// Detecta se o conteúdo HTML já tem um botão/CTA estilizado
function hasExistingButton(html: string): boolean {
  const buttonPatterns = [
    /<a[^>]*style[^>]*(background-color|background)[^>]*>/i,
    /<a[^>]*style[^>]*padding[^>]*>[^<]*<\/a>/i,
    /<td[^>]*style[^>]*(background-color|background)[^>]*>\s*<a/i,
  ];
  return buttonPatterns.some(pattern => pattern.test(html));
}

// Detecta se o conteúdo HTML já tem uma saudação/título próprio
function hasExistingGreeting(html: string): boolean {
  const greetingPatterns = [
    /<h1[^>]*>[^<]*(olá|oi|bem-vindo|sentimos|últimas|parabéns|obrigado)[^<]*<\/h1>/i,
    /<p[^>]*>\s*(olá|oi)\s*[^,<]*,/i,
    /<p>\s*(olá|oi)\s+[^<]+,?\s*<\/p>/i,
    /⚡\s*últimas\s+horas/i,
    /👋\s*sentimos\s+sua\s+falta/i,
    /🎉\s*bem-vindo/i,
  ];
  return greetingPatterns.some(pattern => pattern.test(html));
}

// Template base com branding AutoZap - cores verdes da plataforma
function getBaseEmailTemplate(content: {
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  headerColor?: string;
  skipCta?: boolean;
  skipTitle?: boolean; // Novo parâmetro para pular o título quando já existe saudação
}): string {
  // Cores corretas da plataforma (verde WhatsApp)
  const primaryGreen = "#22c55e";
  const primaryGreenDark = "#1ca34d";
  const headerBgColor = content.headerColor || primaryGreen;
  const year = new Date().getFullYear();
  
  // CTA condicional - só renderiza se skipCta não for true
  const ctaBlock = content.skipCta ? '' : `
              <!-- CTA Button com cor verde -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, ${primaryGreen} 0%, ${primaryGreenDark} 100%); box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">
                    <a href="${content.ctaUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 0.3px;">
                      ${content.ctaText} →
                    </a>
                  </td>
                </tr>
              </table>`;
  
  // Título condicional - só renderiza se skipTitle não for true
  const titleBlock = content.skipTitle ? '' : `
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 22px; font-weight: 600; line-height: 1.3;">
                ${content.title}
              </h2>`;
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${content.title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    table { border-collapse: collapse; }
    img { border: 0; line-height: 100%; text-decoration: none; }
    a { color: ${primaryGreen}; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header com Logo {a}AutoZap -->
          <tr>
            <td style="background: linear-gradient(135deg, ${headerBgColor} 0%, ${primaryGreenDark} 100%); padding: 32px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                <span style="color: rgba(255, 255, 255, 0.7);">{a}</span><span style="color: #ffffff;">AutoZap</span>
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                Automação inteligente para WhatsApp
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content" style="padding: 40px 30px;">
              \${titleBlock}
              <div style="color: #4b5563; font-size: 16px; line-height: 1.7;">
                \${content.body}
              </div>
              \${ctaBlock}
              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 14px;">
                Se você tiver dúvidas, responda este email ou acesse nossa central de ajuda.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; font-weight: 500;">
                      <span style="color: rgba(34, 197, 94, 0.7);">{a}</span><span style="color: #1f2937; font-weight: 600;">AutoZap</span> - Atendimento automatizado via WhatsApp
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      © ${year} AutoZap. Todos os direitos reservados.
                    </p>
                    <p style="margin: 12px 0 0; color: #9ca3af; font-size: 11px;">
                      <a href="${APP_URL}" style="color: #9ca3af; text-decoration: underline;">Acessar plataforma</a>
                      &nbsp;•&nbsp;
                      <a href="${APP_URL}/terms" style="color: #9ca3af; text-decoration: underline;">Termos de uso</a>
                      &nbsp;•&nbsp;
                      <a href="${APP_URL}/privacy" style="color: #9ca3af; text-decoration: underline;">Privacidade</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default function AdminEmailAutomations() {
  const queryClient = useQueryClient();
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedHtml, setEditedHtml] = useState("");

  // Fetch automations
  const { data: automations, isLoading: automationsLoading } = useQuery({
    queryKey: ["email-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Automation[];
    },
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Fetch logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("id, automation_id, user_id, email, trigger_type, status, error_message, sent_at, retry_count, next_retry_at, is_retryable")
        .order("sent_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as EmailLog[];
    },
  });

  // Toggle automation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("email_automations")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-automations"] });
      toast.success("Automação atualizada");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  // Update template
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, subject, html_content }: { id: string; subject: string; html_content: string }) => {
      const { error } = await supabase
        .from("email_templates")
        .update({ subject, html_content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template atualizado");
      setIsEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  // Run all automations manually
  const runAutomationsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-automated-emails");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-logs"] });
      toast.success(`Automações processadas: ${data.sent} enviados, ${data.failed} falhas, ${data.skipped} ignorados`);
    },
    onError: (error: Error) => {
      toast.error("Erro ao executar: " + error.message);
    },
  });

  // Run a single automation manually
  const runSingleAutomationMutation = useMutation({
    mutationFn: async (triggerType: string) => {
      const { data, error } = await supabase.functions.invoke("send-automated-emails", {
        body: { trigger_type: triggerType }
      });
      if (error) throw error;
      return { data, triggerType };
    },
    onSuccess: ({ data, triggerType }) => {
      queryClient.invalidateQueries({ queryKey: ["email-logs"] });
      const automationName = automations?.find(a => a.trigger_type === triggerType)?.name || triggerType;
      toast.success(`${automationName}: ${data.sent} enviados, ${data.failed} falhas`);
    },
    onError: (error: Error) => {
      toast.error("Erro ao executar: " + error.message);
    },
  });

  const getTemplateForAutomation = (automationId: string) => {
    return templates?.find((t) => t.automation_id === automationId);
  };

  const handleEditTemplate = (automation: Automation) => {
    const template = getTemplateForAutomation(automation.id);
    if (template) {
      setSelectedAutomation(automation);
      setSelectedTemplate(template);
      setEditedSubject(template.subject);
      setEditedHtml(template.html_content);
      setIsEditDialogOpen(true);
    }
  };

  const handlePreview = (automation: Automation) => {
    const template = getTemplateForAutomation(automation.id);
    if (template) {
      setSelectedAutomation(automation);
      setSelectedTemplate(template);
      setIsPreviewOpen(true);
    }
  };

  const handleSaveTemplate = () => {
    if (selectedTemplate) {
      updateTemplateMutation.mutate({
        id: selectedTemplate.id,
        subject: editedSubject,
        html_content: editedHtml,
      });
    }
  };

  const getLogsForAutomation = (triggerType: string) => {
    return logs?.filter((l) => l.trigger_type === triggerType) || [];
  };

  const getStats = (triggerType: string) => {
    const automationLogs = getLogsForAutomation(triggerType);
    const today = new Date().toISOString().split("T")[0];
    const todayLogs = automationLogs.filter((l) => l.sent_at.startsWith(today));
    
    // Separar falhas definitivas de pendentes de retry
    const failedLogs = todayLogs.filter((l) => l.status === "failed");
    const pendingRetries = failedLogs.filter((l) => l.is_retryable && l.retry_count < 3);
    const definitiveFailures = failedLogs.filter((l) => !l.is_retryable || l.retry_count >= 3);
    
    // Agrupar erros por tipo
    const errorBreakdown: Record<string, number> = {};
    failedLogs.forEach((log) => {
      const errorType = categorizeError(log.error_message);
      errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
    });
    
    return {
      total: automationLogs.length,
      today: todayLogs.filter((l) => l.status === "sent").length,
      failed: definitiveFailures.length,
      pendingRetries: pendingRetries.length,
      errorBreakdown,
    };
  };

  // Categoriza o erro para exibição mais amigável
  const categorizeError = (errorMessage: string | null): string => {
    if (!errorMessage) return "Erro desconhecido";
    const lower = errorMessage.toLowerCase();
    if (lower.includes("too many requests") || lower.includes("rate limit")) return "Rate limit";
    if (lower.includes("invalid") && lower.includes("email")) return "Email inválido";
    if (lower.includes("not found")) return "Não encontrado";
    if (lower.includes("timeout")) return "Timeout";
    if (lower.includes("network") || lower.includes("connection")) return "Rede";
    return "Outro";
  };

  // Formata o breakdown de erros para exibição
  const formatErrorBreakdown = (breakdown: Record<string, number>): string => {
    const parts = Object.entries(breakdown).map(([type, count]) => `${type}: ${count}`);
    return parts.join(", ");
  };

  const getTriggerIcon = (triggerType: string) => {
    if (triggerType.includes("trial")) return <Clock className="h-4 w-4" />;
    if (triggerType === "welcome") return <Zap className="h-4 w-4" />;
    if (triggerType === "whatsapp_not_connected") return <MessageSquare className="h-4 w-4" />;
    if (triggerType === "reactivation_coupon") return <Zap className="h-4 w-4 text-purple-500" />;
    return <Mail className="h-4 w-4" />;
  };

  // Extrai apenas o conteúdo principal de templates antigos
  const extractMainContent = (html: string): string => {
    // Detectar templates antigos que usam logo-white.png ou estrutura div antiga
    const hasOldStructure = html.includes("logo-white.png") || 
                            (html.includes('<div style="') && html.includes("max-width: 600px"));
    
    if (!hasOldStructure) {
      return html;
    }
    
    // Tentar extrair os parágrafos principais de conteúdo
    // Remover o header (div com background e logo)
    // Remover o footer (copyright)
    
    // Buscar conteúdo entre tags <p> que não sejam o copyright
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    
    while ((match = pRegex.exec(html)) !== null) {
      const content = match[1].trim();
      // Ignorar parágrafos de copyright, header ou footer
      if (content && 
          !content.includes("©") && 
          !content.includes("Autozap. Todos os direitos") &&
          !content.toLowerCase().includes("automação inteligente") &&
          content.length > 10) {
        paragraphs.push(`<p>${content}</p>`);
      }
    }
    
    // Se não encontrou parágrafos, tentar extrair o conteúdo do body principal
    if (paragraphs.length === 0) {
      // Buscar divs com conteúdo de texto
      const divRegex = /<div[^>]*style="[^"]*padding[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      while ((match = divRegex.exec(html)) !== null) {
        const content = match[1].trim();
        if (content && content.length > 50 && !content.includes("logo-white.png")) {
          // Limpar tags internas e manter apenas texto formatado
          return content;
        }
      }
    }
    
    return paragraphs.length > 0 ? paragraphs.join('\n') : html;
  };

  // Processa variáveis e aplica template base se necessário
  const processPreviewHtml = (html: string, triggerType: string) => {
    // Substituir variáveis de exemplo
    let processed = html
      .replace(/{{user_name}}/g, "João Silva")
      .replace(/{{plan_url}}/g, PLAN_URL)
      .replace(/{{app_url}}/g, APP_URL);
    
    // Detectar se já é HTML completo com doctype/html tags
    const isCompleteHtml = processed.toLowerCase().includes("<!doctype") || 
                           processed.toLowerCase().includes("<html");
    
    // Detectar templates antigos com estrutura própria (logo-white.png que não existe)
    const hasOldStructure = processed.includes("logo-white.png") || 
                            (processed.includes('<div style="') && 
                             processed.includes("max-width: 600px") &&
                             !processed.includes("⚡ Autozap"));
    
    // Se tem estrutura antiga, extrair conteúdo e envolver no template base
    if (hasOldStructure) {
      processed = extractMainContent(processed);
    }
    
    // CORREÇÃO: Verificar se o conteúdo já tem um botão antes de adicionar outro
    const contentHasButton = hasExistingButton(processed);
    // CORREÇÃO: Verificar se o conteúdo já tem uma saudação antes de adicionar outra
    const contentHasGreeting = hasExistingGreeting(processed);
    
    // Se não é HTML completo (ou foi extraído de estrutura antiga), envolver no template base
    if (!isCompleteHtml || hasOldStructure) {
      const cta = getDefaultCtaForTrigger(triggerType);
      const headerColor = getHeaderColorForTrigger(triggerType);
      
      processed = getBaseEmailTemplate({
        title: "Olá, João Silva!",
        body: processed,
        ctaText: cta.text,
        ctaUrl: cta.url,
        headerColor,
        skipCta: contentHasButton, // Pula o CTA se já existe um botão no conteúdo
        skipTitle: contentHasGreeting, // Pula o título se já existe saudação no conteúdo
      });
    }
    
    return processed;
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Mail className="h-5 w-5 sm:h-6 sm:w-6" />
              Emails Automáticos
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Configure emails automáticos para diferentes eventos
            </p>
          </div>
          <Button
            onClick={() => runAutomationsMutation.mutate()}
            disabled={runAutomationsMutation.isPending}
          >
            {runAutomationsMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Executar Agora
          </Button>
        </div>

        <Tabs defaultValue="automations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="automations">Automações</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="space-y-4">
            {automationsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {automations?.map((automation) => {
                  const stats = getStats(automation.trigger_type);
                  return (
                    <Card key={automation.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getTriggerIcon(automation.trigger_type)}
                            <CardTitle className="text-base">{automation.name}</CardTitle>
                          </div>
                          <Switch
                            checked={automation.enabled}
                            onCheckedChange={(enabled) =>
                              toggleMutation.mutate({ id: automation.id, enabled })
                            }
                          />
                        </div>
                        <CardDescription>{automation.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant={automation.enabled ? "default" : "secondary"}>
                            {automation.enabled ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Enviados hoje</span>
                          <span className="font-medium">{stats.today}</span>
                        </div>
                        {stats.pendingRetries > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Aguardando retry</span>
                            <div className="flex items-center gap-1.5">
                              <RefreshCw className="h-3 w-3 text-amber-500 animate-spin" />
                              <span className="font-medium text-amber-600">{stats.pendingRetries}</span>
                            </div>
                          </div>
                        )}
                        {stats.failed > 0 && (
                          <TooltipProvider>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Falhas definitivas</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5 cursor-help">
                                    <span className="font-medium text-destructive">{stats.failed}</span>
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[200px]">
                                  <p className="text-xs font-medium mb-1">Tipos de erro:</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatErrorBreakdown(stats.errorBreakdown)}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runSingleAutomationMutation.mutate(automation.trigger_type)}
                            disabled={runSingleAutomationMutation.isPending}
                          >
                            {runSingleAutomationMutation.isPending ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEditTemplate(automation)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handlePreview(automation)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Envios</CardTitle>
                <CardDescription>Últimos 100 emails enviados</CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : logs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum email enviado ainda
                  </div>
                ) : (
                  <TooltipProvider>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Automação</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Retry</TableHead>
                            <TableHead>Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs?.map((log) => {
                            const isPendingRetry = log.status === "failed" && log.is_retryable && log.retry_count < 3;
                            const isDefinitiveFailed = log.status === "failed" && (!log.is_retryable || log.retry_count >= 3);
                            
                            return (
                              <TableRow key={log.id}>
                                <TableCell className="whitespace-nowrap">
                                  {format(new Date(log.sent_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {log.email}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{log.trigger_type}</Badge>
                                </TableCell>
                                <TableCell>
                                  {log.status === "sent" ? (
                                    <div className="flex items-center gap-1.5">
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                      {log.retry_count > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          (após {log.retry_count} {log.retry_count === 1 ? 'retry' : 'retries'})
                                        </span>
                                      )}
                                    </div>
                                  ) : isPendingRetry ? (
                                    <div className="flex items-center gap-1.5">
                                      <RefreshCw className="h-4 w-4 text-amber-500" />
                                      <span className="text-xs text-amber-600">Aguardando</span>
                                    </div>
                                  ) : (
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {log.status === "failed" ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1 cursor-help">
                                          <span className="text-xs font-medium">
                                            {log.retry_count}/3
                                          </span>
                                          {isPendingRetry && log.next_retry_at && (
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="left">
                                        {isPendingRetry && log.next_retry_at ? (
                                          <p className="text-xs">
                                            Próxima tentativa: {format(new Date(log.next_retry_at), "HH:mm", { locale: ptBR })}
                                          </p>
                                        ) : isDefinitiveFailed ? (
                                          <p className="text-xs">Falha definitiva (máx. tentativas atingido)</p>
                                        ) : (
                                          <p className="text-xs">Erro não permite retry</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {log.status === "failed" && log.error_message ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1.5 cursor-help">
                                          <AlertCircle className="h-4 w-4 text-destructive" />
                                          <span className="text-xs text-muted-foreground max-w-[120px] truncate">
                                            {categorizeError(log.error_message)}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-[300px]">
                                        <p className="text-xs font-medium mb-1">Mensagem de erro:</p>
                                        <p className="text-xs text-muted-foreground break-words">
                                          {log.error_message}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : log.status === "sent" ? (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] max-w-4xl max-h-[90vh] transition-all duration-200 ease-out">
            <DialogHeader>
              <DialogTitle>Editar Template: {selectedAutomation?.name}</DialogTitle>
              <DialogDescription>
                Edite apenas o conteúdo do email. O branding e estrutura são aplicados automaticamente.
                <br />
                Variáveis disponíveis: <code className="text-xs bg-muted px-1 rounded">{"{{user_name}}"}</code>, <code className="text-xs bg-muted px-1 rounded">{"{{plan_url}}"}</code>, <code className="text-xs bg-muted px-1 rounded">{"{{app_url}}"}</code>
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Input
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    placeholder="Assunto do email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo do Email</Label>
                  <Textarea
                    value={editedHtml}
                    onChange={(e) => setEditedHtml(e.target.value)}
                    className="min-h-[400px] font-mono text-xs"
                    placeholder="<p>Seu período de teste...</p>"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dica: Você pode usar HTML simples. O header, footer e botão CTA são adicionados automaticamente.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Preview (com branding)</Label>
                <div className="border rounded-lg overflow-hidden bg-muted/30 h-[470px]">
                  <iframe
                    srcDoc={processPreviewHtml(editedHtml, selectedAutomation?.trigger_type || "")}
                    className="w-full h-full"
                    title="Email Preview"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={updateTemplateMutation.isPending}
              >
                {updateTemplateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] max-w-2xl transition-all duration-200 ease-out">
            <DialogHeader>
              <DialogTitle>Preview: {selectedAutomation?.name}</DialogTitle>
              <DialogDescription>
                Assunto: {selectedTemplate?.subject.replace(/{{user_name}}/g, "João Silva")}
              </DialogDescription>
            </DialogHeader>
            <div className="border rounded-lg overflow-hidden bg-muted/30">
              <iframe
                srcDoc={selectedTemplate ? processPreviewHtml(selectedTemplate.html_content, selectedAutomation?.trigger_type || "") : ""}
                className="w-full h-[500px]"
                title="Email Preview"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
