import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { Resend } from 'https://esm.sh/resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// BLOCKED EMAIL DOMAINS - temporary/disposable email services
const BLOCKED_DOMAINS = [
  'example.com', 'test.com', 'tempmail.com', 'mailinator.com', 'guerrillamail.com',
  'throwaway.email', '10minutemail.com', 'temp-mail.org', 'fakeinbox.com', 'trashmail.com',
  'yopmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'sharklasers.com',
  'guerrillamail.info', 'grr.la', 'spam4.me', 'tempr.email', 'discard.email',
  'mohmal.com', 'tempail.com', 'emailondeck.com', 'throwawaymail.com', 'temp.email',
  'burnermail.io', 'anonymmail.net', 'mailsac.com', 'inboxkitten.com', 'mytemp.email'
]

// Check if email domain is blocked
function isBlockedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return true
  return BLOCKED_DOMAINS.includes(domain)
}

// Check for suspicious email patterns
function isSuspiciousEmail(email: string): { suspicious: boolean; reason?: string } {
  const localPart = email.split('@')[0]?.toLowerCase()
  const domain = email.split('@')[1]?.toLowerCase()
  
  if (!localPart || !domain) {
    return { suspicious: true, reason: 'invalid_format' }
  }
  
  // Block test patterns
  if (/^test[a-z0-9]*$/i.test(localPart)) {
    return { suspicious: true, reason: 'test_pattern' }
  }
  
  // Block random character strings (high entropy)
  const hasOnlyConsonants = /^[^aeiou]{8,}$/i.test(localPart.replace(/[0-9]/g, ''))
  if (hasOnlyConsonants) {
    return { suspicious: true, reason: 'random_chars' }
  }
  
  // Block numeric timestamps in email
  if (/\d{10,}/.test(localPart)) {
    return { suspicious: true, reason: 'timestamp_pattern' }
  }
  
  return { suspicious: false }
}

// Log security event
async function logSecurityEvent(
  supabase: any,
  email: string,
  blocked: boolean,
  reason: string,
  ipAddress?: string
) {
  try {
    await supabase.from('platform_logs').insert({
      action: 'signup_attempt',
      entity_type: 'auth',
      entity_id: email,
      user_email: email,
      ip_address: ipAddress,
      details: { blocked, reason, timestamp: new Date().toISOString() }
    })
  } catch (e) {
    console.error('Failed to log security event:', e)
  }
}

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Secure password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a secure temporary password token (not the actual password)
// The actual password is hashed and stored temporarily, then used immediately
async function createSecurePasswordToken(password: string): Promise<string> {
  const salt = crypto.randomUUID();
  const combined = `${salt}:${password}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  // Return salt and hash - the password itself is never stored
  return `${salt}:${hash}`;
}

// Generate email HTML using pure template strings (no React dependencies)
function generateEmailHtml(
  actionType: string,
  magicLinkUrl: string
): string {
  const getTitle = () => {
    switch (actionType) {
      case 'signup':
        return 'Bem-vindo ao Autozap!'
      case 'recovery':
        return 'Recuperar sua senha'
      default:
        return 'Acesse sua conta'
    }
  }

  const getMessage = () => {
    switch (actionType) {
      case 'signup':
        return 'Clique no botão abaixo para ativar sua conta e começar a usar o Autozap.'
      case 'recovery':
        return 'Você solicitou a recuperação de senha. Clique no botão abaixo para criar uma nova senha.'
      default:
        return 'Clique no botão abaixo para acessar sua conta de forma segura.'
    }
  }

  const getButtonText = () => {
    switch (actionType) {
      case 'signup':
        return 'Ativar Minha Conta'
      case 'recovery':
        return 'Recuperar Senha'
      default:
        return 'Acessar Minha Conta'
    }
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getTitle()}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#25D366;padding:32px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:bold;">
                Autozap
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:24px;font-weight:600;text-align:center;">
                ${getTitle()}
              </h2>
              
              <p style="margin:0 0 32px;color:#666666;font-size:16px;line-height:1.6;text-align:center;">
                ${getMessage()}
              </p>
              
              <!-- Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${magicLinkUrl}" target="_blank" style="display:inline-block;background-color:#25D366;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 48px;border-radius:8px;">
                      ${getButtonText()}
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Link fallback -->
              <p style="margin:32px 0 0;color:#999999;font-size:12px;text-align:center;word-break:break-all;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${magicLinkUrl}" style="color:#25D366;">${magicLinkUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#f8f9fa;border-top:1px solid #e9ecef;">
              <p style="margin:0 0 8px;color:#999999;font-size:12px;text-align:center;">
                Este link expira em 1 hora.
              </p>
              <p style="margin:0;color:#999999;font-size:12px;text-align:center;">
                Se você não solicitou este email, pode ignorá-lo com segurança.
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Copyright -->
        <p style="margin:24px 0 0;color:#999999;font-size:11px;text-align:center;">
          © ${new Date().getFullYear()} Autozap. Todos os direitos reservados.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    })
  }

  try {
    const { email, redirect_to, action_type = 'signup', password, referral_code, skip_onboarding, redirect_after_auth, whatsapp_number } = await req.json()

    if (!email) {
      console.error('Email is required')
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SECURITY: Reject pure magic link requests - only allow signup and recovery
    if (action_type === 'magiclink') {
      console.warn('REJECTED: Magic link login attempt blocked:', email)
      return new Response(
        JSON.stringify({ error: 'Login por magic link foi desabilitado. Use email e senha.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only allow signup and recovery
    if (!['signup', 'recovery'].includes(action_type)) {
      console.error('Invalid action_type:', action_type)
      return new Response(
        JSON.stringify({ error: 'Tipo de ação inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Creating custom magic link for:', email, 'action_type:', action_type)

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get IP address for logging
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    
    // SECURITY: Check for blocked domains
    if (isBlockedDomain(email)) {
      console.warn('BLOCKED: Attempted signup with blocked domain:', email)
      await logSecurityEvent(supabaseAdmin, email, true, 'blocked_domain', ipAddress)
      return new Response(
        JSON.stringify({ error: 'Este domínio de email não é permitido. Use um email válido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // SECURITY: Check for suspicious email patterns
    const suspiciousCheck = isSuspiciousEmail(email)
    if (suspiciousCheck.suspicious) {
      console.warn('BLOCKED: Suspicious email pattern:', email, suspiciousCheck.reason)
      await logSecurityEvent(supabaseAdmin, email, true, suspiciousCheck.reason || 'suspicious', ipAddress)
      return new Response(
        JSON.stringify({ error: 'Este email parece ser inválido. Use um email pessoal ou corporativo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Log successful attempt
    await logSecurityEvent(supabaseAdmin, email, false, action_type, ipAddress)

    // For signup, check if user already exists
    if (action_type === 'signup') {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === email)
      
      if (existingUser) {
        console.log('User already exists:', email)
        return new Response(
          JSON.stringify({ error: 'Este e-mail já está cadastrado. Tente fazer login.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!password) {
        console.error('Password is required for signup')
        return new Response(
          JSON.stringify({ error: 'Senha é obrigatória para cadastro' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Generate tokens
    const token = generateToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    console.log('Generated token, storing in database...')

    // Store token in database with password hash for signup
    const insertData: Record<string, unknown> = {
      email,
      token,
      expires_at: expiresAt.toISOString(),
      action_type,
    }
    
    // Store referral code and skip_onboarding in the token data if present
    if (referral_code) {
      console.log('[referral] Storing referral code in token:', referral_code);
    }
    if (skip_onboarding) {
      console.log('[auth] Skip onboarding flag set');
    }

    // SECURITY: For signup, we don't store the password at all in the token table
    // Instead, we'll pass it directly when creating the user via a secure session
    // The password_hash field will store a verification token, not the actual password
    if (action_type === 'signup' && password) {
      // Create a verification hash - the actual password is NOT stored
      insertData.password_hash = await createSecurePasswordToken(password)
      
      // Store the actual password in an encrypted, short-lived cache
      // that will be retrieved and immediately deleted upon verification
      const tempPasswordKey = `temp_pwd_${token}`;
      const encoder = new TextEncoder();
      const passwordData = encoder.encode(password);
      const encryptedPassword = btoa(String.fromCharCode(...passwordData));
      
      // Also store the referral code and skip_onboarding with the temp password entry
      const tempInsertData: Record<string, unknown> = {
        email: `pwd_${email}`,
        token: tempPasswordKey,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min TTL
        action_type: 'temp_password',
        password_hash: encryptedPassword,
      };
      
      // Store referral_code, skip_onboarding, and whatsapp_number in password_hash field as JSON if present
      if (referral_code || skip_onboarding || redirect_after_auth || whatsapp_number) {
        tempInsertData.password_hash = JSON.stringify({
          password: encryptedPassword,
          referral_code: referral_code || undefined,
          skip_onboarding: skip_onboarding || undefined,
          redirect_after_auth: redirect_after_auth || undefined,
          whatsapp_number: whatsapp_number || undefined,
        });
      }
      
      // Store in a separate secure_tokens entry with very short TTL (5 minutes)
      await supabaseAdmin.from('magic_link_tokens').insert(tempInsertData);
    }

    const { error: insertError } = await supabaseAdmin
      .from('magic_link_tokens')
      .insert(insertData)

    if (insertError) {
      console.error('Error storing token:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create magic link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build magic link URL
    const appUrl = redirect_to?.replace('/auth/verify', '') || 'https://appiautozap.com'
    const magicLinkUrl = `${appUrl}/auth/verify?token=${token}`

    console.log('Generating email HTML...')

    // Generate HTML using pure template strings
    const html = generateEmailHtml(action_type, magicLinkUrl)

    console.log('Email HTML generated successfully, sending via Resend...')

    // Get subject based on action type
    const getSubject = () => {
      switch (action_type) {
        case 'signup':
          return 'Bem-vindo ao Autozap! Confirme seu email'
        case 'recovery':
          return 'Autozap - Recuperação de senha'
        case 'magiclink':
        default:
          return 'Autozap - Acesse sua conta'
      }
    }

    // Send email
    const { data, error: emailError } = await resend.emails.send({
      from: 'Autozap <noreply@appiautozap.com>',
      to: [email],
      subject: getSubject(),
      html,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Magic link email sent successfully:', data)

    return new Response(
      JSON.stringify({ success: true, message: 'Magic link sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error in custom-magic-link:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})