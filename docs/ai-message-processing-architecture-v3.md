# Arquitetura de Processamento de Mensagens IA - Appi AutoZap
Version: 3.0
Updated: Fevereiro/2026

## Contexto da Plataforma

O **Appi AutoZap** é uma plataforma de atendimento automatizado via WhatsApp que utiliza Inteligência Artificial para responder clientes de forma personalizada. A plataforma evoluiu para uma arquitetura modular baseada em Edge Functions, suportando múltiplos workspaces (multi-tenant) com isolamento total de dados.

### Componentes Principais

| Componente | Descrição |
|------------|-----------|
| **WhatsApp Instances** | Conexões via Z-API com suporte a múltiplas instâncias por workspace |
| **Agentes (Templates)** | Personas de IA com scripts estruturados, RAG e comportamento configurável |
| **Admin Command Center** | Sistema de gestão total via WhatsApp (comandos, queries, pausa de IA) |
| **Automation Builder** | Criador de fluxos recorrentes com agendamento natural via IA |
| **Fast-Path Engine** | Otimização de latência para funis de vendas ativos |
| **Security Guard** | Camada de proteção de alta prioridade (Hands On, Modo Seletivo, Anti-Echo) |

---

## 1. Diagrama Principal - Visão Geral Completa (v3.0)

```mermaid
flowchart TD
    subgraph ENTRADA["1️⃣ ENTRADA (zapi-webhook)"]
        A[📱 Mensagem] --> B{Token válido?}
        B -->|Sim| ANTI_ECHO{🛡️ Cross-Instance Echo?}
        ANTI_ECHO -->|Não| C[Processa Evento]
        C -->|Texto/Áudio| D[Buffer de Mensagens]
        D -->|Timeout 3-5s| E[📤 process-message]
    end

    subgraph SECURITY["2️⃣ SECURITY GUARD (Prioridade Máxima)"]
        E --> SEC1{🛑 Admin Command?}
        SEC1 -->|Sim| ADM[👑 Admin System]
        SEC1 -->|Não| SEC2{🛑 Early Group Exit?}
        SEC2 -->|Sim| STOP[❌ Bloqueia]
        SEC2 -->|Não| SEC3{🛑 Hands On / Paused?}
        SEC3 -->|Sim| SENT[⏸️ Apenas Sentimento]
        SEC3 -->|Não| SEC4{🛑 Selective Mode?}
        SEC4 -->|Sim + sem permissão| QR_CHECK{Tem Quick Reply?}
        QR_CHECK -->|Não| SENT
        QR_CHECK -->|Sim| QR_EXEC[⚡ Executa QR]
    end

    subgraph FAST_PATH["3️⃣ FAST-PATH ENGINE"]
        SEC4 -->|Não| FP1{Funil Ativo?}
        FP1 -->|Sim| FP_EXEC[🚀 FAST-PATH: Skip Routing/RAG]
        FP1 -->|Não| ROUTING[🔄 Roteamento de Agentes]
        
        ROUTING -->|Keyword/AI| AGENT[👤 Agente Selecionado]
        AGENT -->|Transição?| TRANS[🗣️ Msg Transição]
    end

    subgraph VIDEO["4️⃣ VIDEO SHORT-CIRCUIT"]
        FP_EXEC --> VID1{Intenção Vídeo?}
        AGENT --> VID1
        VID1 -->|Sim + URL config| VID_SEND[🎥 Envia Vídeo + Follow-up]
        VID1 -->|Não| AI_FLOW
    end

    subgraph AI_CORE["5️⃣ AI PROCESSING CORE"]
        AI_FLOW --> RAG{Precisa RAG?}
        RAG -->|Sim| RAG_EXEC[📚 Adaptive RAG (3 Níveis)]
        RAG -->|Não| PROMPT[📝 Monta System Prompt (6 Níveis)]
        
        RAG_EXEC --> PROMPT
        PROMPT --> LLM[🧠 Lovable AI Gateway]
        LLM --> RESP[💬 Resposta Gerada]
    end

    subgraph ACTIONS["6️⃣ ACTION EXECUTION"]
        RESP --> ACT1{Detectou Ação?}
        ACT1 -->|Agendamento| APT[📅 Appointments Flow]
        ACT1 -->|Orçamento| QUOTE[💰 AI-First Quote Flow]
        ACT1 -->|Cobrança| PIX[💳 Invoice/Pix Flow]
        ACT1 -->|Transferência| HANDOFF[👤 Human Handoff]
    end

    ADM --> OUTPUT
    VID_SEND --> OUTPUT
    RESP --> OUTPUT
    TRANS --> OUTPUT

    subgraph OUTPUT["7️⃣ SAÍDA"]
        SAIDA[📤 Envia via Z-API] --> LOG[📝 Salva Histórico]
    end
```

---

## 2. Security Guard Flow (v2.0)

O Security Guard é a **primeira camada de defesa** na função `process-message`, executada antes de qualquer lógica de IA.

### Hierarquia de Bloqueio

1. **Check de Admin**: Se o remetente é um admin registrado enviando um comando, desvia para o `_shared/admin-system.ts` imediatamente.
2. **Early Hands-On**: Verifica `chat_memory.ai_paused`. Se `true`, bloqueia tudo (exceto comandos admin).
3. **Early Group Exit**: Verifica se é grupo E se `respond_in_groups` está desligado. Retorna `group_disabled_early` antes mesmo de carregar agentes.
4. **Instance Pause**: Verifica `whatsapp_instances.is_paused`. Se `true`, bloqueia globalmente para aquele número.
5. **Selective Mode**: Se instância está em modo `selective` e o lead tem `ai_enabled=false`:
   - Executa **Quick Reply Override**: Verifica se a mensagem ativa algum gatilho de resposta rápida (Keyword ou Semântico).
   - Se ativar: Permite APENAS a resposta rápida.
   - Se não: Bloqueia silenciosamente.

---

## 3. Variáveis de Controle de IA

| Variável | Tabela | Escopo | Descrição |
|----------|--------|--------|-----------|
| `ai_paused` | `chat_memory` | Lead | **Hands On Mode**: Bloqueio manual total por conversa. |
| `ai_force_enabled` | `chat_memory` | Lead | Override manual para forçar resposta mesmo em modo seletivo. |
| `is_paused` | `whatsapp_instances` | Global | Pause global da conexão (manutenção/fora de expediente). |
| `ai_mode` | `whatsapp_instances` | Global | `'all'` (responde todos) ou `'selective'` (apenas `ai_enabled`). |
| `contact_type` | `leads` | Lead | `'client'` (padrão) ou `'team'` (modo interno sem vendas). |
| `respond_in_groups` | `whatsapp_instances` | Global | Habilita/desabilita respostas em grupos. |
| `script_completed` | `chat_memory (JSON)` | Contexto | Indica se o funil de vendas já terminou (libera RAG completo). |

---

## 4. Proteção Anti-Echo - 4 Camadas

O sistema implementa defesa em profundidade contra loops infinitos:

1. **Cross-Instance Echo (Webhook)**: Verifica se a mensagem recebida é idêntica a um `outbound` recente de **qualquer** workspace. Previne loops entre duas instâncias do AutoZap conversando.
2. **Local Anti-Echo (Process)**: Verifica duplicidade exata no histórico recente do mesmo chat.
3. **Idempotência de ID**: Usa `zapi_message_id` para garantir processamento único.
4. **Intelligent Loop Detection**: Detecta 3+ respostas repetidas da IA em 2 minutos e ativa `ai_paused` automaticamente com razão `loop_detected_auto_protection`.

---

## 5. Fluxos Detalhados

### 5.1 Agendamentos (Appointments)
Utiliza um fluxo de dupla confirmação:
1. **Detecção**: Keywords (`agendar`, `horário`) ou IA.
2. **Validação**: Verifica disponibilidade real no banco (`findAvailableSlots`).
3. **Criação**: Cria registro com status `pending_owner`.
4. **Confirmação**: Envia mensagem com detalhes. Se o usuário confirmar, atualiza para `confirmed` e gera link Google Meet (se configurado).
5. **Context Merge**: Se o usuário fornecer data parcial ("dia 15"), o sistema mantém o contexto e pergunta apenas a hora, fazendo merge dos dados.

### 5.2 Orçamentos (AI-First Quote Flow)
**Novo na v3.0**: Arquitetura dinâmica baseada em inferência de campos.

- **Detecção**: `detectQuoteIntentWithAI` analisa se é pedido de orçamento vs dúvida de preço.
- **Extração**: `extractQuoteFieldsWithAI` extrai campos dinâmicos baseados no tipo de negócio (ex: "tipo de software" para dev, "metragem" para obras).
- **Circuit Breaker**: `field_ask_counts` impede que a IA pergunte o mesmo campo mais de 2 vezes. Se falhar, pula ou finaliza com dados parciais.
- **Cooling Period**: Após finalizar um orçamento, ignora novas detecções por 30 minutos para evitar duplicidade.

### 5.3 Cobranças PIX
Fluxo determinístico:
- **Geração**: `generate-pix` cria código EMV estático (QR Code).
- **Envio**: `send-invoice` formata mensagem com código "copia e cola".
- **Integração**: Suporte nativo a Asaas para conciliação automática via webhook.

### 5.4 Grupos WhatsApp
**Early Group Exit**: A decisão de responder ou não é tomada na primeira linha do processamento, economizando custos de IA.
- **Mention Mode**: Se configurado, só responde se mencionado (@bot).
- **Welcome**: `send-welcome-whatsapp` detecta entrada de membros e pode chamar no privado (anti-spam em grupos).

### 5.5 Transferência Humana
Prioridade sobre a IA.
- Ao detectar intenção de falar com humano, o sistema define `ai_paused = true` **antes** de enviar a resposta.
- Envia notificação Push/Email para a equipe.
- Preserva o histórico (`conversation_history`) para que o humano tenha contexto.

### 5.6 Sentimento
Executa em paralelo (non-blocking) via `_shared/sentiment.ts`.
- **Score**: 0 (crítico) a 100 (fã).
- **Alerta**: Envia notificação crítica se score cair < 25.
- Funciona mesmo com IA pausada para monitoramento passivo.

### 5.7 Integracoes Externas
- **Google Calendar**: Sync bidirecional de agendamentos.
- **Apollo.io**: Enriquecimento de leads e busca de prospects.
- **Asaas**: Geração de boletos/PIX e gestão de assinaturas.

### 5.8 System Prompt - Arquitetura de 6 Níveis (v3.0)
O prompt do sistema é montado dinamicamente em camadas, da maior para a menor prioridade:

1. **🔴 Regras de Ouro**: Identidade, segurança e "Não invente dados".
2. **🟣 Regra de Escopo**: Validação de nicho (ex: Tech vs Físico). Se fora do escopo, rejeita imediatamente.
3. **🔵 Script Completion Override**: Se `script_completed=true`, injeta instrução para liberar acesso total à Base de Conhecimento e preços.
4. **🟡 Base de Conhecimento (RAG)**: Contexto recuperado semanticamente (Sua única fonte de verdade).
5. **🟢 Estilo e Comportamento**: Tom de voz, formatação e limites de tamanho.
6. **⚪ Buttons Override**: Instrução para forçar formato `[BOTOES]` (removido se script completo).

### 5.9 [NOVO] Admin Command Center
Sistema de gestão via WhatsApp localizado em `_shared/admin-system.ts`.
- **Camada 1 (Intérprete)**: Classifica intenção (Comando vs Consulta vs Saudação).
- **Camada 2 (Executor)**: Executa ações (`approve`, `reject`, `pause_ai`).
- **Camada 3 (Gerador)**: Gera respostas naturais com dados do banco.
- **Funcionalidades**:
  - `pausar ia do [nome]`: Ativa Hands On.
  - `responder [nome]: [texto]`: Envia mensagem proxy.
  - `resumo do dia`: Gera relatório financeiro/leads.

### 5.10 [NOVO] Structured Scripts / Funnel System
Sistema de controle de script de vendas.
- **Detecção**: Tags `[Etapa X]` no prompt.
- **Rastreamento**: `current_funnel_step` incrementado monotonicamente no `chat_memory`.
- **Enforcement**: Injeta regra "Você acabou de fazer a Etapa X, DEVE fazer a Etapa X+1".
- **Conclusão**: Detecta marcadores de fim (ex: "vou te passar pro especialista") e seta `script_completed=true`.

### 5.11 [NOVO] Fast-Path Architecture
Otimização para leads em funil ativo.
- Se `isActiveFunnel=true`:
  - Modelo: Troca `flash` por `flash-lite`.
  - Routing: Pula detecção de agente (mantém o atual).
  - RAG: Pula busca semântica (usa apenas script).
  - Timezone: Pula query de timezone (usa default -3).
- **Resultado**: Latência reduzida de 12s para ~5s.

### 5.12 [NOVO] Selective Mode + Hybrid Quick Replies
Permite "IA Híbrida" (apenas botões funcionam).
- **Database**: Tabela `quick_reply_embeddings` com vetores de todos os gatilhos.
- **RPC**: `match_quick_replies` busca gatilho semanticamente similar.
- **Lógica**: Se lead tem IA desativada mas mandou mensagem que bate com um Quick Reply (similaridade > 0.85), a IA responde APENAS com o texto configurado do botão e volta a dormir.

### 5.13 [NOVO] Video Short-Circuit
Pipeline dedicada para envio de vídeo.
- Se a mensagem contém intenção de vídeo ("ver vídeo") E existe `video_url` configurado:
  1. Pula RAG e LLM.
  2. Envia vídeo via Z-API imediatamente.
  3. Envia mensagem de follow-up ("Gostou?") 3s depois.
  4. Salva no histórico como `[video enviado]`.

### 5.14 [NOVO] Automation Builder
Módulo independente em `automation-chat` + `execute-automation`.
- **Chat**: IA especializada coleta parâmetros (Quem, O Que, Quando) e monta JSON.
- **Execution**: CRON roda a cada minuto, verifica `next_run_at`, executa envio em batch (rate limit 12s entre envios) e recalcula próxima execução.

### 5.15 [NOVO] First Interaction Funnel Forcing
Para novos leads (sem histórico), o sistema força o agente de "Triagem/Funil".
- Se o agente atual não tem `[Etapa` no prompt e é a primeira interação, o sistema busca um agente que tenha e faz a troca automática antes de responder.

---

## 6. Fluxos de Saída WhatsApp (v3.0)

O sistema de saída foi padronizado para suportar interatividade:

- **Smart Split**: Mensagens longas são divididas inteligentemente em parágrafos.
- **Interactive Buttons**: O sistema converte automaticamente listas do Markdown ou blocos `[BOTOES]` em botões nativos do WhatsApp (até 3 opções) ou List Messages (até 10 opções).
- **Mídia**: Suporte nativo a envio de Áudio (OGG Base64), Imagem e Documentos com legendas.

---

## 7. Referência Técnica

### 7.1 Edge Functions (Principais)

| Função | Função |
|--------|--------|
| `process-message` | Núcleo de IA (Monólito modularizado) |
| `zapi-webhook` | Entrada, Anti-Echo, Buffer |
| `automation-chat` | Builder de automações via chat |
| `execute-automation` | Runner de automações agendadas |
| `send-video` | Envio otimizado de MP4 |
| `admin-response-generator` | Geração de relatórios admin |
| `generate-embedding` | Geração vetorial determinística |

### 7.2 Módulos Compartilhados (`_shared/`)

A lógica foi extraída para módulos reutilizáveis:
- `admin-system.ts`: Lógica do Command Center.
- `agent-routing.ts`: Classificação e troca de agentes.
- `quote-flow.ts`: Máquina de estados de orçamento.
- `notifications.ts`: Envio multi-canal (Push/Zap/Email).
- `sentiment.ts`: Análise de sentimento isolada.
- `zapi-sender.ts`: Utilitário de envio com rate limiting.
- `utils.ts`: Formatadores e parsers seguros.

### 7.3 Tabelas do Banco (Novas/Críticas)

| Tabela | Uso |
|--------|-----|
| `chat_memory` | Estado da conversa, contexto e controle de pausa |
| `whatsapp_automations` | Configuração de envios recorrentes |
| `automation_executions` | Logs de execução de automações |
| `quick_reply_embeddings` | Vetores para Hybrid Mode |
| `debug_traces` | Logs detalhados de execução (input/output) |

### 7.4 Secrets

- `LOVABLE_API_KEY`: Gateway para LLMs (Gemini/GPT).
- `ZAPI_USER_TOKEN`: Token de cliente Z-API (envio).
- `ZAPI_SECURITY_TOKEN`: Validação de webhook (entrada).

---

## 8. Pontos de Risco (v3.0)

| Risco | Mitigação Implementada |
|-------|------------------------|
| **Alucinação de Preço** | Regra de Escopo + Frases de Escape obrigatórias no System Prompt. |
| **Loop de Agendamento** | Validação de `field_ask_counts` (Circuit Breaker) para não perguntar 3x a mesma coisa. |
| **Race Condition** | Locking atômico no `message_buffer` e `upsert` com `onConflict` no `chat_memory`. |
| **Timeout de Edge Function** | Fast-Path para funis e RAG com timeout de 5s + Fallback inteligente. |
| **Spam em Grupo** | Early Group Exit + Configuração `respond_in_groups` padrão `false`. |

---

## 9. Fluxo de Debug

1. **Check Logs**: Filtrar logs por `chat_id` ou `lead_id`.
2. **Trace ID**: Cada execução gera um `trace_id` único gravado em `debug_traces`.
3. **Memory Inspection**: Verificar coluna `context_summary` na tabela `chat_memory` para ver o estado interno (etapa do funil, campos coletados).
4. **Buffer Check**: Se a mensagem não chega, verificar `message_buffer` (pode estar travada ou expirada).
5. **Admin Query**: Usar o próprio WhatsApp Admin para consultar status (`pausar ia do X` para testar controle).
