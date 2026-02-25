import React from 'https://esm.sh/react@18.3.1'
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { Resend } from 'https://esm.sh/resend@4.0.0'
import { renderAsync } from 'https://esm.sh/@react-email/components@0.0.22'
import { MagicLinkEmail } from './_templates/magic-link.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  user: {
    email: string
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
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
    const payload: EmailRequest = await req.json()
    
    console.log('Received email request:', {
      email: payload.user?.email,
      type: payload.email_data?.email_action_type,
    })

    const { user, email_data } = payload

    if (!user?.email || !email_data) {
      console.error('Missing required fields:', { user, email_data })
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { token_hash, redirect_to, email_action_type } = email_data

    // Render React Email template
    const html = await renderAsync(
      React.createElement(MagicLinkEmail, {
        app_url: 'https://appiautozap.com',
        supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
        token_hash,
        redirect_to,
        email_action_type,
      })
    )

    console.log('Sending email to:', user.email)

    // Get subject based on email type
    const getSubject = () => {
      switch (email_action_type) {
        case 'signup':
          return 'Bem-vindo ao Autozap! Confirme seu email'
        case 'recovery':
          return 'Autozap - Recuperação de senha'
        case 'magiclink':
        default:
          return 'Autozap - Acesse sua conta'
      }
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Autozap <noreply@appiautozap.com>',
      to: [user.email],
      subject: getSubject(),
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: error.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Email sent successfully:', data)

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    console.error('Error in send-magic-link:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: { http_code: 500, message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
