# Edge Functions — Controle de Deploy

> Gerado em: 26/02/2026
> Projeto Supabase: `hmoekghvlyfyfjobyufq` (appiAutoZap)

## Legenda

- ✅ = Deployada e funcionando
- ❌ = Não deployada (apenas código local)
- **Decisão**: marque `DEPLOY`, `IGNORAR` ou `AVALIAR` para cada função

---

## Core — WhatsApp / Mensagens

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 1 | `zapi-webhook` | ✅ | — | Recebe mensagens do Z-API. Muito ativa |
| 2 | `process-message` | ✅ | — | Processa mensagens com IA/agentes |
| 3 | `send-message` | ✅ | — | Envia mensagens WhatsApp |
| 4 | `zapi-send-message` | ✅ | — | Envio direto via Z-API |
| 5 | `zapi-check-status` | ✅ | — | Verifica status da instância |
| 6 | `zapi-get-qrcode` | ✅ | — | Gera QR code para conexão |
| 7 | `zapi-connection` | ✅ | — | Gerencia conexão WhatsApp |
| 8 | `zapi-partners` | ✅ | — | API de parceiros Z-API |

## Core — Outros (Deployados)

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 9 | `generate-avatar` | ✅ | — | Gera avatares para leads |
| 10 | `manual-inbox` | ✅ | — | Inbox manual |
| 11 | `transcribe-audio` | ✅ | — | Transcrição de áudio (Whisper) |
| 12 | `send-invite` | ✅ | — | Envia convites de workspace |

---

## IA e Automação

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 13 | `ai-chat` | ❌ | | Chatbot IA genérico |
| 14 | `preview-ai-response` | ❌ | | Preview de resposta IA |
| 15 | `landing-ai-demo` | ❌ | | Demo de IA na landing page |
| 16 | `generate-embedding` | ❌ | | Gera embeddings para RAG |
| 17 | `backfill-sentiment` | ❌ | | Preenche scores de sentimento |
| 18 | `process-automated-triggers` | ❌ | | Triggers automáticos |
| 19 | `process-orphan-buffers` | ❌ | | Processa buffers órfãos |
| 20 | `create-default-agents` | ❌ | | Cria agentes padrão no workspace |
| 21 | `populate-agents` | ❌ | | Popula agentes |

## Campanhas e Broadcasts

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 22 | `create-campaign-recipients` | ❌ | | Cria lista de destinatários |
| 23 | `process-campaign` | ❌ | | Processa envio de campanha |
| 24 | `send-broadcast-notification` | ❌ | | Notificação de broadcast |
| 25 | `generate-template-content` | ❌ | | Gera conteúdo de templates |

## Integrações — Apollo.io (Prospecção)

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 26 | `apollo-enrich` | ❌ | | Enriquece dados de leads |
| 27 | `apollo-search` | ❌ | | Busca leads no Apollo |
| 28 | `apollo-phone-webhook` | ❌ | | Webhook de telefone Apollo |

## Integrações — Google Calendar

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 29 | `google-calendar-auth` | ❌ | | Autenticação Google Calendar |
| 30 | `google-calendar-sync` | ❌ | | Sincronização de eventos |

## Integrações — Asaas (Pagamentos)

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 31 | `asaas-payments` | ❌ | | Processa pagamentos Asaas |
| 32 | `asaas-webhook` | ❌ | | Webhook de pagamentos |
| 33 | `generate-pix` | ❌ | | Gera chave PIX |

## Emails

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 34 | `send-automated-emails` | ❌ | | Emails automatizados |
| 35 | `send-welcome-email` | ❌ | | Email de boas-vindas |
| 36 | `send-magic-link` | ❌ | | Magic link para login |
| 37 | `custom-magic-link` | ❌ | | Magic link customizado |

## Financeiro (Faturas / Orçamentos)

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 38 | `send-invoice` | ❌ | | Envia faturas |
| 39 | `send-quote` | ❌ | | Envia orçamentos |
| 40 | `process-scheduled-invoices` | ❌ | | Faturas agendadas |

## Agendamentos

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 41 | `appointment-reminders` | ❌ | | Lembretes de agendamento |
| 42 | `approve-appointment` | ❌ | | Aprovação de agendamento |

## Notificações

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 43 | `send-push-notification` | ❌ | | Push notification |
| 44 | `send-welcome-whatsapp` | ❌ | | Mensagem de boas-vindas WhatsApp |

## Mídia

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 45 | `convert-audio` | ❌ | | Converte áudio |
| 46 | `media-signed-url` | ❌ | | URLs assinadas para mídia |

## Admin / Manutenção

| # | Função | Status | Decisão | Observações |
|---|--------|--------|---------|-------------|
| 47 | `admin-delete-user` | ❌ | | Deleta usuário (admin) |
| 48 | `delete-workspace` | ❌ | | Deleta workspace |
| 49 | `accept-invite` | ❌ | | Aceita convite de workspace |
| 50 | `cleanup-duplicate-leads` | ❌ | | Limpa leads duplicados |
| 51 | `cleanup-fake-accounts` | ❌ | | Limpa contas falsas |
| 52 | `check-expired-subscriptions` | ❌ | | Verifica assinaturas expiradas |
| 53 | `check-instance-subscriptions` | ❌ | | Verifica instâncias |
| 54 | `check-new-accounts` | ❌ | | Verifica novas contas |
| 55 | `auth-error-monitor` | ❌ | | Monitora erros de auth |
| 56 | `keep-warm` | ❌ | | Mantém funções quentes |

---

## Resumo

| Situação | Quantidade |
|----------|-----------|
| ✅ Deployadas | 12 |
| ❌ Não deployadas | 44 |
| **Total** | **56** |

## Notas

- Funções ❌ precisam de **secrets** configurados no Supabase antes do deploy (ex: chaves Apollo, Google, Asaas)
- Algumas funções podem ser **stubs** do Lovable sem implementação real
- Recomendar revisar o código de cada função antes de deployar
