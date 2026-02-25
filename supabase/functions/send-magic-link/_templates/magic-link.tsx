import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from 'https://esm.sh/@react-email/components@0.0.22'
import * as React from 'https://esm.sh/react@18.3.1'

interface MagicLinkEmailProps {
  app_url?: string
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
}

const APP_URL_DEFAULT = "https://appiautozap.com"

export const MagicLinkEmail = ({
  app_url,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
}: MagicLinkEmailProps) => {
  const appUrl = app_url || APP_URL_DEFAULT
  
  // If token_hash looks like our custom token (64 chars), use our verify page
  // Otherwise use Supabase's default auth endpoint
  const isCustomToken = token_hash && token_hash.length === 64 && !token_hash.includes('.')
  const magicLinkUrl = isCustomToken
    ? `${appUrl}/auth/verify?token=${token_hash}`
    : `${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${appUrl}`
  
  const getTitle = () => {
    switch (email_action_type) {
      case 'signup':
        return 'Bem-vindo ao Autozap! 🎉'
      case 'recovery':
        return 'Recuperar sua senha'
      case 'magiclink':
      default:
        return 'Acesse sua conta'
    }
  }

  const getMessage = () => {
    switch (email_action_type) {
      case 'signup':
        return 'Clique no botão abaixo para confirmar seu email e ativar sua conta no Autozap.'
      case 'recovery':
        return 'Você solicitou a recuperação da sua senha. Clique no botão abaixo para criar uma nova senha.'
      case 'magiclink':
      default:
        return 'Clique no botão abaixo para acessar sua conta no Autozap.'
    }
  }

  const getButtonText = () => {
    switch (email_action_type) {
      case 'signup':
        return '✨ Ativar Minha Conta'
      case 'recovery':
        return '🔐 Redefinir Senha'
      case 'magiclink':
      default:
        return '🚀 Acessar Minha Conta'
    }
  }

  return (
    <Html>
      <Head />
      <Preview>{getTitle()}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={headerSection}>
            <Text style={logo}>
              <span style={logoAccent}>{'{a}'}</span>
              <span style={logoText}>AutoZap</span>
            </Text>
          </Section>

          {/* Main Content */}
          <Section style={contentSection}>
            <Heading style={h1}>{getTitle()}</Heading>
            
            <Text style={text}>{getMessage()}</Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={magicLinkUrl}>
                {getButtonText()}
              </Button>
            </Section>

            <Text style={expiryText}>
              ⏰ Este link expira em 1 hora.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              © 2025 <Link href="https://appiautozap.com" style={footerLink}>Autozap</Link>
            </Text>
            <Text style={footerText}>
              Automatize seu WhatsApp com Inteligência Artificial
            </Text>
            <Text style={disclaimer}>
              Se você não solicitou este email, pode ignorá-lo com segurança.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default MagicLinkEmail

// Styles
const main = {
  backgroundColor: '#f4f4f5',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  padding: '40px 0',
}

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  margin: '0 auto',
  maxWidth: '480px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
}

const headerSection = {
  backgroundColor: '#25D366',
  padding: '24px 32px',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0',
  fontSize: '28px',
  fontWeight: '700',
  letterSpacing: '-0.5px',
}

const logoAccent = {
  color: '#ffffff',
  fontWeight: '800',
}

const logoText = {
  color: '#ffffff',
  marginLeft: '2px',
}

const contentSection = {
  padding: '32px',
}

const h1 = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '32px',
  margin: '0 0 16px 0',
  textAlign: 'center' as const,
}

const text = {
  color: '#4b5563',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const button = {
  backgroundColor: '#25D366',
  borderRadius: '12px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

const expiryText = {
  color: '#9ca3af',
  fontSize: '14px',
  margin: '24px 0 0 0',
  textAlign: 'center' as const,
}

const footerSection = {
  backgroundColor: '#f9fafb',
  borderTop: '1px solid #e5e7eb',
  padding: '24px 32px',
  textAlign: 'center' as const,
}

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 4px 0',
}

const footerLink = {
  color: '#25D366',
  textDecoration: 'none',
  fontWeight: '600',
}

const disclaimer = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '16px 0 0 0',
}
