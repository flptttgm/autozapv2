import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  user_name?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, user_name }: WelcomeEmailRequest = await req.json();

    if (!email) {
      console.error("Missing email in request");
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract name from email if not provided
    const userName = user_name || email.split("@")[0];
    
    // Get app URL from environment or use default
    const appUrl = Deno.env.get("APP_URL") || "https://www.autozap.co";

    console.log(`Sending welcome email to: ${email}, userName: ${userName}`);

    // Build the HTML email template
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Autozap!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #22c55e; padding: 24px 40px; text-align: center;">
              <span style="color: #ffffff; font-size: 28px; font-weight: bold;">⚡ Autozap</span>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="color: #1a1a1a; font-size: 28px; font-weight: bold; margin: 0 0 24px 0;">Olá, ${userName}! 👋</h1>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 26px; margin: 0 0 20px 0;">
                Bem-vindo ao <strong>Autozap</strong>! Estamos muito felizes em ter você conosco.
              </p>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 26px; margin: 0 0 20px 0;">
                Seu período de teste de <strong>48 horas</strong> já começou! Durante esse tempo, 
                você terá acesso completo a todas as funcionalidades da plataforma.
              </p>

              <!-- Highlight Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="color: #166534; font-size: 16px; font-weight: bold; margin: 0 0 12px 0;">🚀 Próximos passos:</p>
                    <p style="color: #15803d; font-size: 14px; line-height: 24px; margin: 0;">1. Conecte seu WhatsApp</p>
                    <p style="color: #15803d; font-size: 14px; line-height: 24px; margin: 0;">2. Configure seu assistente de IA</p>
                    <p style="color: #15803d; font-size: 14px; line-height: 24px; margin: 0;">3. Comece a automatizar seus atendimentos</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/onboarding" style="display: inline-block; background-color: #22c55e; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 32px;">
                      Começar Configuração
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 26px; margin: 0 0 20px 0;">
                Se precisar de ajuda, estamos à disposição! Basta responder este email ou 
                acessar nossa central de suporte.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #e6e6e6; padding: 24px 40px; text-align: center;">
              <p style="color: #8898aa; font-size: 12px; line-height: 20px; margin: 0 0 8px 0;">
                <a href="${appUrl}/termos" style="color: #8898aa; text-decoration: underline;">Termos de Uso</a>
                &bull;
                <a href="${appUrl}/privacidade" style="color: #8898aa; text-decoration: underline;">Política de Privacidade</a>
              </p>
              <p style="color: #8898aa; font-size: 12px; line-height: 20px; margin: 0;">
                © ${new Date().getFullYear()} Autozap. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send the email
    const { data, error } = await resend.emails.send({
      from: "Autozap <noreply@autozap.co>",
      to: [email],
      subject: "Bem-vindo ao Autozap! 🎉",
      html,
    });

    if (error) {
      console.error("Error sending welcome email:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Welcome email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
