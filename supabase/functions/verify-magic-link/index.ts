import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

// Securely retrieve and immediately delete temporary password
interface PasswordData {
  password: string;
  referral_code?: string;
  skip_onboarding?: boolean;
  redirect_after_auth?: string;
  whatsapp_number?: string;
}

async function retrieveAndDeletePassword(supabase: any, token: string, email: string): Promise<PasswordData | null> {
  const tempPasswordKey = `temp_pwd_${token}`;
  
  // Retrieve the temporary password entry
  const { data: tempData, error } = await supabase
    .from('magic_link_tokens')
    .select('password_hash, expires_at')
    .eq('token', tempPasswordKey)
    .eq('email', `pwd_${email}`)
    .is('used_at', null)
    .single();
  
  if (error || !tempData) {
    console.error('[verify-magic-link] Temp password not found');
    return null;
  }
  
  // Check if expired
  if (new Date(tempData.expires_at) < new Date()) {
    console.error('[verify-magic-link] Temp password expired');
    // Delete expired entry
    await supabase.from('magic_link_tokens').delete().eq('token', tempPasswordKey);
    return null;
  }
  
  // IMMEDIATELY mark as used and delete
  await supabase
    .from('magic_link_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', tempPasswordKey);
  
  // Decode the password - check if it's JSON with additional data
  try {
    let encryptedPassword: string;
    let referral_code: string | undefined;
    let skip_onboarding: boolean | undefined;
    let redirect_after_auth: string | undefined;
    let whatsapp_number: string | undefined;
    
    // Try to parse as JSON first (new format with additional data)
    try {
      const parsed = JSON.parse(tempData.password_hash);
      encryptedPassword = parsed.password;
      referral_code = parsed.referral_code;
      skip_onboarding = parsed.skip_onboarding;
      redirect_after_auth = parsed.redirect_after_auth;
      whatsapp_number = parsed.whatsapp_number;
      if (referral_code) console.log('[verify-magic-link] Found referral code:', referral_code);
      if (skip_onboarding) console.log('[verify-magic-link] Skip onboarding enabled');
      if (redirect_after_auth) console.log('[verify-magic-link] Redirect after auth:', redirect_after_auth);
      if (whatsapp_number) console.log('[verify-magic-link] WhatsApp number:', whatsapp_number);
    } catch {
      // Old format - just the encrypted password
      encryptedPassword = tempData.password_hash;
    }
    
    const decoded = atob(encryptedPassword);
    const decoder = new TextDecoder();
    const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
    const password = decoder.decode(bytes);
    
    return { password, referral_code, skip_onboarding, redirect_after_auth, whatsapp_number };
  } catch (e) {
    console.error('[verify-magic-link] Error decoding password:', e);
    return null;
  }
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
    const { token } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Verifying magic link token')

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Find token in database
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('magic_link_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single()

    if (tokenError || !tokenData) {
      console.error('Token not found or already used:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Token inválido ou já utilizado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Token expirado. Por favor, solicite um novo link.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark token as used
    await supabaseAdmin
      .from('magic_link_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id)

    // Get IP address for logging
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    
    // SECURITY: Check for blocked domains
    if (isBlockedDomain(tokenData.email)) {
      console.warn('BLOCKED: Attempted signup with blocked domain:', tokenData.email)
      await logSecurityEvent(supabaseAdmin, tokenData.email, true, 'blocked_domain', ipAddress)
      return new Response(
        JSON.stringify({ error: 'Este domínio de email não é permitido. Use um email válido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // SECURITY: Check for suspicious email patterns
    const suspiciousCheck = isSuspiciousEmail(tokenData.email)
    if (suspiciousCheck.suspicious) {
      console.warn('BLOCKED: Suspicious email pattern:', tokenData.email, suspiciousCheck.reason)
      await logSecurityEvent(supabaseAdmin, tokenData.email, true, suspiciousCheck.reason || 'suspicious', ipAddress)
      return new Response(
        JSON.stringify({ error: 'Este email parece ser inválido. Use um email pessoal ou corporativo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Token verified, action_type:', tokenData.action_type)

    // SECURITY: Reject pure magic link tokens - only allow signup and recovery
    if (tokenData.action_type === 'magiclink') {
      console.warn('REJECTED: Magic link token verification blocked for:', tokenData.email)
      return new Response(
        JSON.stringify({ error: 'Login por magic link foi desabilitado. Use email e senha.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle signup with password
    if (tokenData.action_type === 'signup' && tokenData.password_hash) {
      console.log('Processing signup with password for:', tokenData.email)
      
      // Log successful signup attempt
      await logSecurityEvent(supabaseAdmin, tokenData.email, false, 'signup_success', ipAddress)
      
      // SECURITY: Retrieve password from secure temporary storage and immediately delete it
      const passwordData = await retrieveAndDeletePassword(supabaseAdmin, token, tokenData.email);
      
      if (!passwordData) {
        console.error('[verify-magic-link] Could not retrieve password - may have expired or been used');
        return new Response(
          JSON.stringify({ error: 'Link expirado ou já utilizado. Por favor, cadastre-se novamente.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Build user metadata with referral code and tracking info
      const userMetadata: Record<string, unknown> = {};
      
      // Determine signup source for tracking
      if (passwordData.referral_code) {
        userMetadata.referral_code = passwordData.referral_code;
        userMetadata.signup_source = passwordData.skip_onboarding 
          ? 'referral_custom' 
          : 'referral_standard';
        console.log('[verify-magic-link] Setting referral_code in user metadata:', passwordData.referral_code);
        console.log('[verify-magic-link] Signup source:', userMetadata.signup_source);
      } else {
        userMetadata.signup_source = 'organic';
      }
      
      if (passwordData.skip_onboarding) {
        userMetadata.skip_onboarding = true;
        console.log('[verify-magic-link] Setting skip_onboarding in user metadata');
      }
      
      if (passwordData.redirect_after_auth) {
        userMetadata.redirect_after_auth = passwordData.redirect_after_auth;
        console.log('[verify-magic-link] Setting redirect_after_auth in user metadata:', passwordData.redirect_after_auth);
      }
      
      if (passwordData.whatsapp_number) {
        userMetadata.whatsapp_number = passwordData.whatsapp_number;
        console.log('[verify-magic-link] Setting whatsapp_number in user metadata:', passwordData.whatsapp_number);
      }
      
      // Create user with password (password is immediately discarded after use)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: tokenData.email,
        password: passwordData.password,
        email_confirm: true,
        user_metadata: userMetadata,
      })

      if (createError) {
        console.error('Error creating user:', createError)
        
        // Check if user already exists
        if (createError.message.includes('already registered') || createError.message.includes('already been registered')) {
          return new Response(
            JSON.stringify({ error: 'Este e-mail já está cadastrado. Tente fazer login.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        return new Response(
          JSON.stringify({ error: 'Erro ao criar conta: ' + createError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('User created successfully:', newUser.user?.id)
      if (passwordData.referral_code) {
        console.log('[referral] User created with referral code:', passwordData.referral_code);
      }
      
      // If skip_onboarding is set, update the profile to mark onboarding as completed
      if (passwordData.skip_onboarding && newUser.user?.id) {
        console.log('[verify-magic-link] Marking onboarding as completed for user:', newUser.user.id);
        
        // Wait a moment for the trigger to create the profile
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', newUser.user.id);
        
        if (updateError) {
          console.error('[verify-magic-link] Error updating profile:', updateError);
        } else {
          console.log('[verify-magic-link] Profile updated with onboarding_completed = true');
        }
      }

      // Generate login link for the new user
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: tokenData.email,
      })

      if (linkError) {
        console.error('Error generating auth link:', linkError)
        return new Response(
          JSON.stringify({ error: 'Conta criada, mas erro ao gerar link de login' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Login link generated for new user')

      return new Response(
        JSON.stringify({ 
          success: true, 
          email: tokenData.email,
          action_link: linkData.properties.action_link,
          hashed_token: linkData.properties.hashed_token,
          isNewUser: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user exists (for regular magic link)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === tokenData.email)

    if (existingUser) {
      // User exists - generate magic link for login
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: tokenData.email,
      })

      if (linkError) {
        console.error('Error generating auth link:', linkError)
        return new Response(
          JSON.stringify({ error: 'Erro ao autenticar' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          email: tokenData.email,
          action_link: linkData.properties.action_link,
          hashed_token: linkData.properties.hashed_token,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // User doesn't exist - create new user without password (magic link only)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: tokenData.email,
        email_confirm: true,
      })

      if (createError) {
        console.error('Error creating user:', createError)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar conta' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Generate login link for new user
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: tokenData.email,
      })

      if (linkError) {
        console.error('Error generating auth link:', linkError)
        return new Response(
          JSON.stringify({ error: 'Erro ao autenticar' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          email: tokenData.email,
          action_link: linkData.properties.action_link,
          hashed_token: linkData.properties.hashed_token,
          isNewUser: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: unknown) {
    console.error('Error in verify-magic-link:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})