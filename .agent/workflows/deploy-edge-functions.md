---
description: Como deployar Edge Functions do Supabase corretamente
---

# Deploy de Edge Functions

## Pré-requisito
Certifique-se de ter o Supabase CLI instalado via `npx`.

## Funções que NÃO verificam JWT (webhooks externos)

Essas funções recebem chamadas de serviços externos que NÃO enviam JWT. **Sempre** use `--no-verify-jwt`:

- `zapi-webhook` (Z-API WhatsApp)
- `asaas-webhook` (Asaas pagamentos)
- `apollo-phone-webhook` (Apollo)

// turbo
1. Deploy com --no-verify-jwt:
```
npx supabase functions deploy <FUNCTION_NAME> --project-ref hmoekghvlyfyfjobyufq --no-verify-jwt --import-map supabase/functions/import_map.json
```

## Funções que verificam JWT (chamadas internas/frontend)

Todas as outras funções usam JWT normalmente:

- `process-message`
- `send-message`
- `zapi-partners`
- `manual-inbox`
- `transcribe-audio`
- `send-invite`
- `generate-avatar`
- `zapi-check-status`
- `zapi-get-qrcode`
- `zapi-send-message`
- `zapi-connection`
- `keep-warm`

// turbo
2. Deploy padrão (com verify-jwt):
```
npx supabase functions deploy <FUNCTION_NAME> --project-ref hmoekghvlyfyfjobyufq --import-map supabase/functions/import_map.json
```

## Deploy de TODAS as funções de uma vez

// turbo
3. Deploy de todas (cuidado: não aplica --no-verify-jwt seletivamente):
```
npx supabase functions deploy --project-ref hmoekghvlyfyfjobyufq --import-map supabase/functions/import_map.json
```

> ⚠️ **ATENÇÃO**: O deploy em massa (`functions deploy` sem nome) aplica `verify_jwt: true` em TODAS as funções. Após rodar, você DEVE re-deployar os webhooks individualmente com `--no-verify-jwt`. Caso contrário, os webhooks retornarão 401 e mensagens serão perdidas silenciosamente.
