---
description: Como deployar Edge Functions do Supabase corretamente
---

# Deploy de Edge Functions

Todas as Edge Functions do Autozap precisam ser deployadas com `--no-verify-jwt` porque:
- Funções de webhook recebem chamadas externas (Z-API, Asaas, Apollo)
- Funções do frontend são chamadas com `apikey` (não JWT de sessão)
- Funções de cron não têm JWT

## Deploy de uma função específica

// turbo-all

1. Deploy da função:
```bash
npx supabase functions deploy NOME_DA_FUNCAO --no-verify-jwt --project-ref hmoekghvlyfyfjobyufq
```

## Deploy de TODAS as funções (após mudanças globais)

Use este script para redeployar todas as funções que precisam de `--no-verify-jwt`:

```bash
for fn in zapi-webhook zapi-partners asaas-webhook apollo-phone-webhook zapi-connection keep-warm check-expired-subscriptions check-instance-subscriptions check-new-accounts sync-instance-subscription sync-workspace-instances process-orphan-buffers process-automated-triggers appointment-reminders send-automated-emails process-scheduled-invoices transcribe-audio-base64 custom-magic-link send-magic-link verify-magic-link send-welcome-whatsapp ai-chat accept-invite admin-delete-user apollo-enrich apollo-search approve-appointment asaas-payments auth-error-monitor backfill-sentiment cleanup-duplicate-leads cleanup-fake-accounts convert-audio create-campaign-recipients create-default-agents delete-workspace generate-avatar generate-embedding generate-pix generate-template-content google-calendar-auth google-calendar-sync manual-inbox media-signed-url populate-agents preview-ai-response process-campaign process-message send-broadcast-notification send-invite send-invoice send-message send-push-notification send-quote send-welcome-email support-chat sync-embeddings sync-quick-reply-embeddings transcribe-audio validate-coupon zapi-list-groups; do npx supabase functions deploy $fn --no-verify-jwt --project-ref hmoekghvlyfyfjobyufq; done
```

> ⚠️ **NUNCA** deploy sem `--no-verify-jwt` — isso causa 401 em TODAS as chamadas externas e do frontend.
