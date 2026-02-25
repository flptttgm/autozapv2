import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configurações de retry
const MAX_RETRIES = 3;
const RETRY_DELAYS_MINUTES = [5, 15, 60];

// Configurações de frequência (padrão, pode ser sobrescrito por config do banco)
const DEFAULT_GLOBAL_COOLDOWN_HOURS = 24;

interface Automation {
  id: string;
  trigger_type: string;
  name: string;
  enabled: boolean;
  delay_hours: number;
  max_sends_per_user: number | null;
  min_hours_between_sends: number | null;
}

interface EmailTemplate {
  id: string;
  automation_id: string;
  subject: string;
  html_content: string;
  variables: string[];
}

interface EligibleUser {
  user_id: string;
  email: string;
  full_name: string | null;
  workspace_id: string;
}

interface PendingRetry {
  id: string;
  automation_id: string;
  user_id: string;
  email: string;
  trigger_type: string;
  retry_count: number;
}

interface FrequencyCheckResult {
  canSend: boolean;
  reason?: string;
}

const APP_URL = "https://appiautozap.com";
const PLAN_URL = "https://appiautozap.com/plans";

// Determina se um erro permite retry
function isRetryableError(errorMessage: string | null): boolean {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  
  const retryablePatterns = [
    "too many requests", "rate limit", "timeout", "timed out",
    "connection", "network", "econnreset", "econnrefused",
    "temporarily unavailable", "service unavailable",
    "503", "502", "504", "internal server error", "500",
  ];
  
  const nonRetryablePatterns = [
    "invalid email", "invalid address", "unsubscribed", "bounced",
    "does not exist", "not found", "blocked", "spam", "rejected",
  ];
  
  for (const pattern of nonRetryablePatterns) {
    if (lower.includes(pattern)) return false;
  }
  
  for (const pattern of retryablePatterns) {
    if (lower.includes(pattern)) return true;
  }
  
  return true;
}

function calculateNextRetryAt(currentRetryCount: number): Date {
  const delayMinutes = RETRY_DELAYS_MINUTES[currentRetryCount] || RETRY_DELAYS_MINUTES[RETRY_DELAYS_MINUTES.length - 1];
  const nextRetry = new Date();
  nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);
  return nextRetry;
}

// ============================================
// VERIFICAÇÃO DE FREQUÊNCIA DE EMAILS
// ============================================

async function checkGlobalCooldown(
  supabase: any,
  userId: string,
  globalCooldownHours: number
): Promise<FrequencyCheckResult> {
  const cooldownTime = new Date();
  cooldownTime.setHours(cooldownTime.getHours() - globalCooldownHours);

  const { data: recentEmail } = await supabase
    .from("email_logs")
    .select("id, trigger_type, sent_at")
    .eq("user_id", userId)
    .eq("status", "sent")
    .gte("sent_at", cooldownTime.toISOString())
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentEmail) {
    return {
      canSend: false,
      reason: `Global cooldown: email "${recentEmail.trigger_type}" sent at ${recentEmail.sent_at}`,
    };
  }

  return { canSend: true };
}

async function checkTriggerLimits(
  supabase: any,
  userId: string,
  triggerType: string,
  maxSendsPerUser: number | null,
  minHoursBetweenSends: number | null
): Promise<FrequencyCheckResult> {
  // Se há limite máximo de envios
  if (maxSendsPerUser !== null) {
    const { count } = await supabase
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("trigger_type", triggerType)
      .eq("status", "sent");

    if (count !== null && count >= maxSendsPerUser) {
      return {
        canSend: false,
        reason: `Max sends reached: ${count}/${maxSendsPerUser} for ${triggerType}`,
      };
    }
  }

  // Se há intervalo mínimo entre envios do mesmo tipo
  if (minHoursBetweenSends !== null) {
    const minTime = new Date();
    minTime.setHours(minTime.getHours() - minHoursBetweenSends);

    const { data: recentSameType } = await supabase
      .from("email_logs")
      .select("id, sent_at")
      .eq("user_id", userId)
      .eq("trigger_type", triggerType)
      .eq("status", "sent")
      .gte("sent_at", minTime.toISOString())
      .maybeSingle();

    if (recentSameType) {
      return {
        canSend: false,
        reason: `Min interval not met: last ${triggerType} sent at ${recentSameType.sent_at}`,
      };
    }
  }

  return { canSend: true };
}

async function canSendEmail(
  supabase: any,
  userId: string,
  triggerType: string,
  automation: Automation,
  globalCooldownHours: number
): Promise<FrequencyCheckResult> {
  // 1. Verificar cooldown global (não envia se já recebeu qualquer email nas últimas X horas)
  const globalCheck = await checkGlobalCooldown(supabase, userId, globalCooldownHours);
  if (!globalCheck.canSend) {
    return globalCheck;
  }

  // 2. Verificar limites específicos do trigger
  const triggerCheck = await checkTriggerLimits(
    supabase,
    userId,
    triggerType,
    automation.max_sends_per_user,
    automation.min_hours_between_sends
  );
  if (!triggerCheck.canSend) {
    return triggerCheck;
  }

  return { canSend: true };
}

// ============================================
// TEMPLATES DE EMAIL
// ============================================

// Detecta se o conteúdo HTML já tem um botão/CTA estilizado
function hasExistingButton(html: string): boolean {
  // Detecta links com estilo de botão (background-color, background, ou padding significativo)
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

function getBaseEmailTemplate(content: {
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  headerColor?: string;
  skipCta?: boolean;
  skipTitle?: boolean; // Novo parâmetro para pular o título quando já existe saudação
}): string {
  const primaryGreen = "#22c55e";
  const primaryGreenDark = "#1ca34d";
  const headerBgColor = content.headerColor || primaryGreen;
  
  // Gerar o bloco do CTA apenas se não for para pular
  const ctaBlock = content.skipCta ? '' : `
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, ${primaryGreen} 0%, ${primaryGreenDark} 100%); box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">
                    <a href="${content.ctaUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 0.3px;">
                      ${content.ctaText} →
                    </a>
                  </td>
                </tr>
              </table>`;
  
  // Gerar o bloco do título apenas se não for para pular
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
          <tr>
            <td class="content" style="padding: 40px 30px;">
              ${titleBlock}
              <div style="color: #4b5563; font-size: 16px; line-height: 1.7;">
                ${content.body}
              </div>
              ${ctaBlock}
              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 14px;">
                Se você tiver dúvidas, responda este email ou acesse nossa central de ajuda.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; font-weight: 500;">
                      <span style="color: rgba(34, 197, 94, 0.7);">{a}</span><span style="color: #1f2937; font-weight: 600;">AutoZap</span> - Atendimento automatizado via WhatsApp
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      © ${new Date().getFullYear()} AutoZap. Todos os direitos reservados.
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

function getHeaderColorForTrigger(triggerType: string): string {
  const colors: Record<string, string> = {
    trial_24h: "#22c55e",
    trial_6h: "#dc2626",
    trial_expired: "#1f2937",
    welcome: "#22c55e",
    inactivity_7d: "#f59e0b",
    whatsapp_not_connected: "#25d366",
    reactivation_coupon: "#8b5cf6", // Roxo para cupom
  };
  return colors[triggerType] || "#22c55e";
}

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

function extractMainContent(html: string): string {
  const hasOldStructure = html.includes("logo-white.png") || 
                          (html.includes('<div style="') && html.includes("max-width: 600px"));
  
  if (!hasOldStructure) return html;
  
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  
  while ((match = pRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content && 
        !content.includes("©") && 
        !content.includes("Autozap. Todos os direitos") &&
        !content.toLowerCase().includes("automação inteligente") &&
        content.length > 10) {
      paragraphs.push(`<p>${content}</p>`);
    }
  }
  
  if (paragraphs.length === 0) {
    const divRegex = /<div[^>]*style="[^"]*padding[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    while ((match = divRegex.exec(html)) !== null) {
      const content = match[1].trim();
      if (content && content.length > 50 && !content.includes("logo-white.png")) {
        return content;
      }
    }
  }
  
  return paragraphs.length > 0 ? paragraphs.join('\n') : html;
}

function ensureCompleteHtml(
  htmlContent: string, 
  triggerType: string,
  variables: Record<string, string>
): string {
  let processed = processTemplate(htmlContent, variables);
  
  const isCompleteHtml = processed.toLowerCase().includes("<!doctype") || 
                         processed.toLowerCase().includes("<html");
  
  const hasOldStructure = processed.includes("logo-white.png") || 
                          (processed.includes('<div style="') && 
                           processed.includes("max-width: 600px") &&
                           !processed.includes("⚡ Autozap"));
  
  if (hasOldStructure) {
    processed = extractMainContent(processed);
  }
  
  // CORREÇÃO: Verificar se o conteúdo já tem um botão antes de adicionar outro
  const contentHasButton = hasExistingButton(processed);
  // CORREÇÃO: Verificar se o conteúdo já tem uma saudação antes de adicionar outra
  const contentHasGreeting = hasExistingGreeting(processed);
  
  if (!isCompleteHtml || hasOldStructure) {
    const cta = getDefaultCtaForTrigger(triggerType);
    const headerColor = getHeaderColorForTrigger(triggerType);
    
    return getBaseEmailTemplate({
      title: variables.user_name ? `Olá, ${variables.user_name}!` : "Olá!",
      body: processed,
      ctaText: cta.text,
      ctaUrl: processTemplate(cta.url, variables),
      headerColor,
      skipCta: contentHasButton, // Pula o CTA se o conteúdo já tem um botão
      skipTitle: contentHasGreeting, // Pula o título se o conteúdo já tem saudação
    });
  }
  
  return processed;
}

function processTemplate(content: string, variables: Record<string, string>): string {
  let processed = content;
  for (const [key, value] of Object.entries(variables)) {
    processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return processed;
}

// ============================================
// PRIORIDADE DE TRIGGERS (mais importantes primeiro)
// ============================================

const TRIGGER_PRIORITY: Record<string, number> = {
  trial_expired: 1,
  trial_6h: 2,
  trial_24h: 3,
  subscription_activated: 4,
  welcome: 5,
  whatsapp_not_connected: 6,
  inactive_7_days: 7,
  reactivation_coupon: 8,
};

function getAutomationPriority(triggerType: string): number {
  return TRIGGER_PRIORITY[triggerType] || 999;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar se foi passado um trigger_type específico
    let specificTrigger: string | null = null;
    try {
      const body = await req.json();
      specificTrigger = body?.trigger_type || null;
      if (specificTrigger) {
        console.log(`Running specific automation: ${specificTrigger}`);
      }
    } catch {
      // Sem body ou body inválido, continua normalmente
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      skippedByFrequency: 0,
      retried: 0,
      retryScheduled: 0,
      details: [] as any[],
    };

    // Buscar configuração global de cooldown
    let globalCooldownHours = DEFAULT_GLOBAL_COOLDOWN_HOURS;
    const { data: cooldownConfig } = await supabase
      .from("system_config")
      .select("config_value")
      .eq("config_key", "global_email_cooldown_hours")
      .is("workspace_id", null)
      .maybeSingle();

    if (cooldownConfig?.config_value) {
      const parsed = parseInt(String(cooldownConfig.config_value), 10);
      if (!isNaN(parsed) && parsed > 0) {
        globalCooldownHours = parsed;
      }
    }

    console.log(`Using global email cooldown: ${globalCooldownHours} hours`);

    // ============================================
    // ETAPA 1: Processar retries pendentes
    // ============================================
    console.log("=== ETAPA 1: Processando retries pendentes ===");
    
    const { data: pendingRetries, error: retriesError } = await supabase
      .from("email_logs")
      .select("id, automation_id, user_id, email, trigger_type, retry_count")
      .eq("status", "failed")
      .eq("is_retryable", true)
      .lt("retry_count", MAX_RETRIES)
      .lte("next_retry_at", new Date().toISOString());

    if (retriesError) {
      console.error("Error fetching pending retries:", retriesError);
    } else {
      console.log(`Found ${pendingRetries?.length || 0} pending retries`);
    }

    // Buscar automações - se trigger específico, busca mesmo desativada
    let automationsQuery = supabase
      .from("email_automations")
      .select("*");
    
    if (specificTrigger) {
      // Buscar apenas a automação específica, mesmo se desativada
      automationsQuery = automationsQuery.eq("trigger_type", specificTrigger);
    } else {
      // Comportamento padrão: apenas automações ativas
      automationsQuery = automationsQuery.eq("enabled", true);
    }
    
    const { data: automations, error: automationsError } = await automationsQuery;

    if (automationsError) {
      console.error("Error fetching automations:", automationsError);
      throw automationsError;
    }

    // Ordenar por prioridade
    const sortedAutomations = (automations || []).sort((a: Automation, b: Automation) => 
      getAutomationPriority(a.trigger_type) - getAutomationPriority(b.trigger_type)
    );

    console.log(`Found ${sortedAutomations.length} active automations (sorted by priority)`);

    // Buscar todos os templates
    const { data: allTemplates, error: templatesError } = await supabase
      .from("email_templates")
      .select("*");

    if (templatesError) {
      console.error("Error fetching templates:", templatesError);
    }

    const getTemplateByAutomationId = (automationId: string) => {
      return allTemplates?.find((t: EmailTemplate) => t.automation_id === automationId);
    };

    const getAutomationByTriggerType = (triggerType: string) => {
      return sortedAutomations.find((a: Automation) => a.trigger_type === triggerType);
    };

    // Set para rastrear usuários que já receberam email nesta execução
    const usersEmailedThisRun = new Set<string>();

    // Processar retries pendentes
    for (let i = 0; i < (pendingRetries?.length || 0); i++) {
      const retry = pendingRetries![i];
      const newRetryCount = retry.retry_count + 1;
      
      // Verificar se já enviamos email para este usuário nesta execução
      if (usersEmailedThisRun.has(retry.user_id)) {
        console.log(`Skipping retry for ${retry.email} - already emailed in this run`);
        continue;
      }

      const automation = getAutomationByTriggerType(retry.trigger_type);
      if (!automation) {
        console.log(`Automation ${retry.trigger_type} not found or disabled, skipping retry`);
        continue;
      }

      // Verificar limites de frequência
      const frequencyCheck = await canSendEmail(
        supabase,
        retry.user_id,
        retry.trigger_type,
        automation,
        globalCooldownHours
      );

      if (!frequencyCheck.canSend) {
        console.log(`Skipping retry for ${retry.email}: ${frequencyCheck.reason}`);
        results.skippedByFrequency++;
        continue;
      }

      console.log(`Processing retry ${newRetryCount}/${MAX_RETRIES} for ${retry.email}`);

      const template = getTemplateByAutomationId(automation.id);
      if (!template) {
        console.log(`Template not found for ${retry.trigger_type}, skipping retry`);
        continue;
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", retry.user_id)
        .single();

      const variables = {
        user_name: userProfile?.full_name || "Usuário",
        plan_url: PLAN_URL,
        app_url: APP_URL,
      };

      const processedHtml = ensureCompleteHtml(
        template.html_content,
        automation.trigger_type,
        variables
      );

      const processedSubject = processTemplate(template.subject, variables);

      try {
        const emailResponse = await resend.emails.send({
          from: "Autozap <noreply@appiautozap.com>",
          to: [retry.email],
          subject: processedSubject,
          html: processedHtml,
        });

        if (emailResponse.error) {
          console.error(`Retry failed for ${retry.email}:`, emailResponse.error);
          
          const errorMessage = emailResponse.error.message || JSON.stringify(emailResponse.error);
          const canRetryAgain = isRetryableError(errorMessage) && newRetryCount < MAX_RETRIES;

          await supabase
            .from("email_logs")
            .update({
              retry_count: newRetryCount,
              error_message: errorMessage,
              is_retryable: canRetryAgain,
              next_retry_at: canRetryAgain ? calculateNextRetryAt(newRetryCount).toISOString() : null,
              sent_at: new Date().toISOString(),
            })
            .eq("id", retry.id);

          results.failed++;
          if (canRetryAgain) {
            results.retryScheduled++;
          }
        } else {
          console.log(`Retry successful for ${retry.email}`);
          
          await supabase
            .from("email_logs")
            .update({
              status: "sent",
              retry_count: newRetryCount,
              error_message: null,
              is_retryable: false,
              next_retry_at: null,
              sent_at: new Date().toISOString(),
            })
            .eq("id", retry.id);

          results.retried++;
          results.sent++;
          usersEmailedThisRun.add(retry.user_id);
        }

        if (i < (pendingRetries?.length || 0) - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      } catch (error: any) {
        console.error(`Exception on retry for ${retry.email}:`, error);
        
        const canRetryAgain = isRetryableError(error.message) && newRetryCount < MAX_RETRIES;

        await supabase
          .from("email_logs")
          .update({
            retry_count: newRetryCount,
            error_message: error.message,
            is_retryable: canRetryAgain,
            next_retry_at: canRetryAgain ? calculateNextRetryAt(newRetryCount).toISOString() : null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", retry.id);

        results.failed++;
        if (canRetryAgain) {
          results.retryScheduled++;
        }
        
        if (i < (pendingRetries?.length || 0) - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }

    // ============================================
    // ETAPA 2: Processar novos usuários elegíveis
    // ============================================
    console.log("=== ETAPA 2: Processando novos usuários elegíveis ===");

    for (const automation of sortedAutomations) {
      console.log(`Processing automation: ${automation.trigger_type} (priority: ${getAutomationPriority(automation.trigger_type)})`);

      const template = getTemplateByAutomationId(automation.id);

      if (!template) {
        console.error(`No template found for ${automation.trigger_type}`);
        continue;
      }

      const eligibleUsers = await getEligibleUsers(supabase, automation.trigger_type);
      console.log(`Found ${eligibleUsers.length} eligible users for ${automation.trigger_type}`);

      for (let i = 0; i < eligibleUsers.length; i++) {
        const user = eligibleUsers[i];
        results.processed++;

        // Verificar se já enviamos email para este usuário nesta execução
        if (usersEmailedThisRun.has(user.user_id)) {
          console.log(`Skipping ${user.email} - already emailed in this run`);
          results.skipped++;
          continue;
        }

        // Verificar limites de frequência
        const frequencyCheck = await canSendEmail(
          supabase,
          user.user_id,
          automation.trigger_type,
          automation,
          globalCooldownHours
        );

        if (!frequencyCheck.canSend) {
          console.log(`Skipping ${user.email}: ${frequencyCheck.reason}`);
          results.skippedByFrequency++;
          results.details.push({
            email: user.email,
            trigger: automation.trigger_type,
            status: "skipped_frequency",
            reason: frequencyCheck.reason,
          });
          continue;
        }

        // Verificar se já foi enviado COM SUCESSO hoje (para este trigger específico)
        const { data: existingLog } = await supabase
          .from("email_logs")
          .select("id, status")
          .eq("user_id", user.user_id)
          .eq("trigger_type", automation.trigger_type)
          .eq("sent_date", new Date().toISOString().split("T")[0])
          .eq("status", "sent")
          .maybeSingle();

        if (existingLog) {
          console.log(`Skipping ${user.email} - already sent ${automation.trigger_type} today`);
          results.skipped++;
          continue;
        }

        // Verificar se já existe um registro de falha pendente de retry
        const { data: pendingLog } = await supabase
          .from("email_logs")
          .select("id")
          .eq("user_id", user.user_id)
          .eq("trigger_type", automation.trigger_type)
          .eq("sent_date", new Date().toISOString().split("T")[0])
          .eq("status", "failed")
          .eq("is_retryable", true)
          .lt("retry_count", MAX_RETRIES)
          .maybeSingle();

        if (pendingLog) {
          console.log(`Skipping ${user.email} - has pending retry for ${automation.trigger_type}`);
          results.skipped++;
          continue;
        }

        const variables = {
          user_name: user.full_name || "Usuário",
          plan_url: PLAN_URL,
          app_url: APP_URL,
        };

        const processedHtml = ensureCompleteHtml(
          template.html_content,
          automation.trigger_type,
          variables
        );

        const processedSubject = processTemplate(template.subject, variables);

        try {
          const emailResponse = await resend.emails.send({
            from: "Autozap <noreply@appiautozap.com>",
            to: [user.email],
            subject: processedSubject,
            html: processedHtml,
          });

          console.log(`Email response for ${user.email}:`, JSON.stringify(emailResponse));

          if (emailResponse.error) {
            console.error(`Resend error for ${user.email}:`, emailResponse.error);

            const errorMessage = emailResponse.error.message || JSON.stringify(emailResponse.error);
            const canRetry = isRetryableError(errorMessage);

            await supabase.from("email_logs").insert({
              automation_id: automation.id,
              user_id: user.user_id,
              email: user.email,
              trigger_type: automation.trigger_type,
              status: "failed",
              error_message: errorMessage,
              sent_date: new Date().toISOString().split("T")[0],
              retry_count: 0,
              is_retryable: canRetry,
              next_retry_at: canRetry ? calculateNextRetryAt(0).toISOString() : null,
            });

            results.failed++;
            if (canRetry) {
              results.retryScheduled++;
            }
            results.details.push({
              email: user.email,
              trigger: automation.trigger_type,
              status: "failed",
              willRetry: canRetry,
              error: errorMessage,
            });
          } else {
            console.log(`Email sent successfully to ${user.email}`);

            await supabase.from("email_logs").insert({
              automation_id: automation.id,
              user_id: user.user_id,
              email: user.email,
              trigger_type: automation.trigger_type,
              status: "sent",
              sent_date: new Date().toISOString().split("T")[0],
              retry_count: 0,
              is_retryable: false,
              next_retry_at: null,
            });

            results.sent++;
            usersEmailedThisRun.add(user.user_id);
            results.details.push({
              email: user.email,
              trigger: automation.trigger_type,
              status: "sent",
            });
          }

          if (i < eligibleUsers.length - 1) {
            console.log(`Waiting 600ms before next email (rate limit protection)...`);
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        } catch (emailError: any) {
          console.error(`Exception sending email to ${user.email}:`, emailError);

          const canRetry = isRetryableError(emailError.message);

          await supabase.from("email_logs").insert({
            automation_id: automation.id,
            user_id: user.user_id,
            email: user.email,
            trigger_type: automation.trigger_type,
            status: "failed",
            error_message: emailError.message,
            sent_date: new Date().toISOString().split("T")[0],
            retry_count: 0,
            is_retryable: canRetry,
            next_retry_at: canRetry ? calculateNextRetryAt(0).toISOString() : null,
          });

          results.failed++;
          if (canRetry) {
            results.retryScheduled++;
          }
          results.details.push({
            email: user.email,
            trigger: automation.trigger_type,
            status: "failed",
            willRetry: canRetry,
            error: emailError.message,
          });

          if (i < eligibleUsers.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        }
      }
    }

    console.log("Automation results:", results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-automated-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getEligibleUsers(supabase: any, triggerType: string): Promise<EligibleUser[]> {
  const now = new Date();

  switch (triggerType) {
    case "trial_24h": {
      const minTime = new Date(now.getTime() + 18 * 60 * 60 * 1000);
      const maxTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("workspace_id")
        .eq("plan_type", "trial")
        .eq("status", "active")
        .gte("trial_ends_at", minTime.toISOString())
        .lte("trial_ends_at", maxTime.toISOString());

      if (!subscriptions?.length) return [];
      return getUsersFromWorkspaces(supabase, subscriptions.map((s: any) => s.workspace_id));
    }

    case "trial_6h": {
      const minTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      const maxTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);

      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("workspace_id")
        .eq("plan_type", "trial")
        .eq("status", "active")
        .gte("trial_ends_at", minTime.toISOString())
        .lte("trial_ends_at", maxTime.toISOString());

      if (!subscriptions?.length) return [];
      return getUsersFromWorkspaces(supabase, subscriptions.map((s: any) => s.workspace_id));
    }

    case "trial_expired": {
      const minTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const maxTime = now;

      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("workspace_id")
        .eq("plan_type", "trial")
        .gte("trial_ends_at", minTime.toISOString())
        .lte("trial_ends_at", maxTime.toISOString());

      if (!subscriptions?.length) return [];
      return getUsersFromWorkspaces(supabase, subscriptions.map((s: any) => s.workspace_id));
    }

    case "welcome": {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, workspace_id")
        .gte("created_at", yesterday.toISOString());

      if (!profiles?.length) return [];

      const users: EligibleUser[] = [];
      for (const profile of profiles) {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        if (authUser?.user?.email) {
          users.push({
            user_id: profile.id,
            email: authUser.user.email,
            full_name: profile.full_name,
            workspace_id: profile.workspace_id,
          });
        }
      }
      return users;
    }

    case "inactivity_7d": {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

      const { data: activeWorkspaces } = await supabase
        .from("messages")
        .select("workspace_id")
        .gte("created_at", sevenDaysAgo.toISOString())
        .limit(1000);

      const activeWorkspaceIds = [...new Set(activeWorkspaces?.map((m: any) => m.workspace_id) || [])];

      const { data: allWorkspaces } = await supabase
        .from("workspaces")
        .select("id")
        .gte("created_at", eightDaysAgo.toISOString());

      const inactiveWorkspaceIds = allWorkspaces
        ?.filter((w: any) => !activeWorkspaceIds.includes(w.id))
        .map((w: any) => w.id) || [];

      if (!inactiveWorkspaceIds.length) return [];
      return getUsersFromWorkspaces(supabase, inactiveWorkspaceIds);
    }

    case "whatsapp_not_connected": {
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

      const { data: workspacesWithWhatsapp } = await supabase
        .from("whatsapp_instances")
        .select("workspace_id")
        .eq("status", "connected");

      const connectedWorkspaceIds = workspacesWithWhatsapp?.map((w: any) => w.workspace_id) || [];

      const { data: allWorkspaces } = await supabase
        .from("workspaces")
        .select("id")
        .gte("created_at", threeDaysAgo.toISOString())
        .lte("created_at", twoDaysAgo.toISOString());

      const notConnectedWorkspaceIds = allWorkspaces
        ?.filter((w: any) => !connectedWorkspaceIds.includes(w.id))
        .map((w: any) => w.id) || [];

      if (!notConnectedWorkspaceIds.length) return [];
      return getUsersFromWorkspaces(supabase, notConnectedWorkspaceIds);
    }

    case "reactivation_coupon": {
      // APENAS trials que JÁ EXPIRARAM (trial_ends_at no passado)
      const { data: expiredTrials } = await supabase
        .from("subscriptions")
        .select("workspace_id")
        .eq("plan_type", "trial")
        .lt("trial_ends_at", now.toISOString());

      if (!expiredTrials?.length) return [];

      const expiredWorkspaceIds = expiredTrials.map((s: any) => s.workspace_id);

      // Verificar se NÃO existe assinatura paga ativa no mesmo workspace
      const { data: paidSubscriptions } = await supabase
        .from("subscriptions")
        .select("workspace_id")
        .in("plan_type", ["start", "pro", "business"])
        .eq("status", "active");

      const paidWorkspaceIds = paidSubscriptions?.map((s: any) => s.workspace_id) || [];

      // Apenas trials expirados SEM assinatura paga
      const eligibleWorkspaceIds = expiredWorkspaceIds.filter(
        (id: string) => !paidWorkspaceIds.includes(id)
      );

      if (!eligibleWorkspaceIds.length) return [];
      return getUsersFromWorkspaces(supabase, eligibleWorkspaceIds);
    }

    default:
      return [];
  }
}

async function getUsersFromWorkspaces(supabase: any, workspaceIds: string[]): Promise<EligibleUser[]> {
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, owner_id")
    .in("id", workspaceIds);

  if (!workspaces?.length) return [];

  const users: EligibleUser[] = [];
  for (const workspace of workspaces) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", workspace.owner_id)
      .single();

    const { data: authUser } = await supabase.auth.admin.getUserById(workspace.owner_id);

    if (authUser?.user?.email) {
      users.push({
        user_id: workspace.owner_id,
        email: authUser.user.email,
        full_name: profile?.full_name || null,
        workspace_id: workspace.id,
      });
    }
  }

  return users;
}
