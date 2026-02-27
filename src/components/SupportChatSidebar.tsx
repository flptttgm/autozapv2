import { useState, useRef, useEffect } from "react";
import { X, Send, Trash2, ExternalLink, Loader2, Zap, Wifi, MessageCircleQuestion, BookOpen, HelpCircle } from "lucide-react";
import { MdSupportAgent } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { SUPPORT_TICKET_URL } from "@/lib/constants";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  hasOpenTicket?: boolean;
  isInstant?: boolean;
}

interface SupportChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FAQEntry {
  keywords: string[];
  question: string;
  answer: string;
}

// ============================================
// BANCO DE DADOS DE FAQs - RESPOSTAS PRÉ-PRONTAS
// ============================================
const FAQ_DATABASE: Record<string, FAQEntry> = {
  "conectar-whatsapp": {
    keywords: ["conectar", "whatsapp", "qr", "qr code", "instância", "vincular", "adicionar whatsapp"],
    question: "Como conectar o WhatsApp?",
    answer: `Para conectar seu WhatsApp ao Appi AutoZap:

1. **Acesse o menu Conexões** no painel lateral
2. Clique em **"Nova Instância"** ou **"Conectar"**
3. Um **QR Code** será exibido na tela
4. No seu celular, abra o **WhatsApp > Configurações > Aparelhos conectados > Conectar um aparelho**
5. Escaneie o QR Code com a câmera do celular
6. Aguarde alguns segundos até a conexão ser estabelecida

⚡ **Dica:** Mantenha o celular conectado à internet durante o uso para evitar desconexões.

[IR PARA: Conexões]`
  },
  "ia-nao-responde": {
    keywords: ["ia não responde", "bot não responde", "automático", "ia parada", "não está respondendo", "ia pausada"],
    question: "A IA não está respondendo",
    answer: `Se a IA não está respondendo automaticamente, verifique:

1. **Conexão WhatsApp:** Confira se a instância está conectada (ícone verde em Conexões)
2. **IA pausada:** Em Conversas, veja se a IA está pausada para esse lead específico
3. **Configurações de Agentes:** Verifique se há pelo menos um agente configurado

**Para verificar:**
- Vá em **Conversas** e selecione o lead
- No topo da conversa, veja se há um indicador de "IA pausada"
- Se pausada, clique para reativar

[IR PARA: Conversas]`
  },
  "importar-leads": {
    keywords: ["importar", "leads", "contatos", "planilha", "csv", "excel", "adicionar leads"],
    question: "Como importar leads?",
    answer: `Para importar leads em massa:

1. Acesse o menu **Leads**
2. Clique no botão **"Importar"** no canto superior
3. Faça download do **modelo de planilha** (se necessário)
4. Preencha a planilha com: nome, telefone (com DDD), email (opcional)
5. Faça o **upload do arquivo** (.csv ou .xlsx)
6. Revise os dados e confirme a importação

⚠️ **Importante:** O telefone deve estar no formato: 5511999998888 (código do país + DDD + número)

[IR PARA: Leads]`
  },
  "agendar-mensagem": {
    keywords: ["agendar", "agendamento", "mensagem programada", "enviar depois", "programar"],
    question: "Como agendar mensagens?",
    answer: `Atualmente o Appi AutoZap funciona com respostas automáticas em tempo real através da IA.

Para **agendamentos de compromissos** com leads:
1. Acesse **Agendamentos** no menu
2. Clique em **"Novo Agendamento"**
3. Selecione o lead, data e horário
4. A IA pode ser configurada para lembrar o lead automaticamente

[IR PARA: Agendamentos]`
  },
  "configurar-agentes": {
    keywords: ["agente", "agentes", "criar agente", "configurar ia", "ia", "bot", "atendente virtual", "personalidade"],
    question: "Como criar e configurar agentes IA?",
    answer: `Para criar e configurar seus agentes de IA:

1. Acesse **Agentes** no menu lateral
2. Na aba **Agentes**, você verá os agentes já criados
3. Clique em **"Criar Novo Agente"** para adicionar um novo
4. Escolha o tipo: **Vendas, Suporte, Agendamentos, Financeiro ou Técnico**
5. Personalize:
   - **Nome e Avatar** do agente
   - **Personalidade** (tom, formalidade, uso de emojis)
   - **Palavras-chave** que ativam este agente
   - **Prompt personalizado** com instruções

💡 **Dica:** Cada tipo de agente vem com configurações pré-definidas otimizadas para sua função!

[IR PARA: Agentes]`
  },
  "roteamento-agentes": {
    keywords: ["roteamento", "trocar agente", "mudar agente", "transferir", "transição", "automático", "encaminhar"],
    question: "Como funciona o roteamento de agentes?",
    answer: `O roteamento inteligente troca automaticamente de agente durante a conversa:

1. Acesse **Agentes** no menu lateral
2. Vá na aba **Roteamento**
3. Ative o **"Roteamento Inteligente"**
4. Escolha o modo de detecção:
   - **Por Palavras-chave:** Detecta termos específicos (ex: "preço" → Vendas)
   - **Por IA:** Análise contextual automática

5. Configure o **Estilo de Transição:**
   - 😊 **Amigável:** Apresentação calorosa do novo agente
   - 📋 **Formal:** Mensagem profissional
   - 🔇 **Silenciosa:** Troca sem aviso

6. Defina o **agente padrão** para conversas gerais

[IR PARA: Agentes]`
  },
  "base-conhecimento": {
    keywords: ["conhecimento", "base de conhecimento", "informações", "faq", "perguntas frequentes", "treinar ia"],
    question: "Como adicionar informações à base de conhecimento?",
    answer: `Para ensinar a IA sobre seu negócio:

1. Acesse **Agentes** no menu lateral
2. Vá na aba **Conhecimento**
3. Clique em **"Adicionar Item"**
4. Escolha uma categoria (Produto, Serviço, FAQ, etc.)
5. Preencha o título e conteúdo
6. Salve as informações

📚 A base de conhecimento é **compartilhada** entre todos os agentes do seu workspace.

💡 **Dica:** Quanto mais detalhadas as informações, melhores serão as respostas da IA!

[IR PARA: Agentes]`
  },
  "pausar-ia": {
    keywords: ["pausar ia", "desativar ia", "parar ia", "atendimento manual", "assumir conversa"],
    question: "Como pausar a IA para atender manualmente?",
    answer: `Para assumir uma conversa manualmente:

1. Acesse **Conversas** no menu
2. Selecione a conversa desejada
3. No topo da conversa, clique no botão **"Pausar IA"**
4. A IA não responderá mais automaticamente nessa conversa
5. Envie suas mensagens manualmente pelo campo de texto
6. Para reativar a IA, clique em **"Reativar IA"**

⚡ **Dica:** A pausa é por conversa, não afeta outros leads.

[IR PARA: Conversas]`
  },
  "ver-estatisticas": {
    keywords: ["estatísticas", "relatório", "métricas", "dashboard", "resultados", "análise"],
    question: "Onde vejo as estatísticas?",
    answer: `Para ver o desempenho do seu atendimento:

1. Acesse o **Dashboard** (página inicial)
2. Você verá:
   - Total de leads e mensagens
   - Conversões e agendamentos
   - Orçamentos recentes detectados pela IA
   - Atividade recente

3. Para mais detalhes, acesse **Estatísticas** no menu

[IR PARA: Dashboard]`
  },
  "adicionar-membro": {
    keywords: ["adicionar membro", "equipe", "convite", "colaborador", "acesso", "usuário"],
    question: "Como adicionar membros à equipe?",
    answer: `Para adicionar colaboradores:

1. Acesse **Configurações** no menu
2. Vá na aba **"Equipe"**
3. Clique em **"Convidar Membro"**
4. Digite o email do colaborador
5. Escolha o **papel** (admin ou membro)
6. O convite será enviado por email

⚠️ **Nota:** O plano atual pode ter limite de membros.

[IR PARA: Configurações]`
  },
  "mudar-plano": {
    keywords: ["plano", "assinatura", "upgrade", "pagamento", "preço", "mudar plano", "cancelar"],
    question: "Como gerenciar meu plano?",
    answer: `Para ver ou alterar seu plano:

1. Acesse **Configurações** no menu
2. Vá na aba **"Plano"** ou **"Assinatura"**
3. Você pode:
   - Ver seu plano atual e recursos
   - Fazer upgrade para mais funcionalidades
   - Gerenciar forma de pagamento

💡 **Dúvidas sobre cobrança?** Entre em contato com nosso suporte.

[IR PARA: Configurações]
[ABRIR CHAMADO]`
  },
  "orcamentos": {
    keywords: ["orçamento", "orçamentos", "proposta", "valor", "preço cliente", "cotação", "quotes"],
    question: "Como funcionam os orçamentos?",
    answer: `O Appi AutoZap detecta automaticamente orçamentos nas conversas com IA:

🔍 **Detecção Automática:**
- Quando um cliente pergunta sobre preços, valores ou solicita orçamentos
- A IA identifica e registra automaticamente como um orçamento

📋 **Onde visualizar:**
- **Dashboard** → Card "Orçamentos Recentes"
- **Menu lateral** → **Orçamentos** (página dedicada)
- **Detalhes do Lead** → Aba **"Orçamentos"**

📊 **Status disponíveis:**
- 🟡 **Pendente:** Aguardando análise
- 🔵 **Em Negociação:** Cliente interessado
- 🟢 **Aceito:** Cliente confirmou
- 🔴 **Rejeitado:** Cliente recusou
- ✅ **Concluído:** Venda finalizada

📝 **Informações do orçamento:**
- Resumo gerado automaticamente pela IA
- Valor estimado
- Itens solicitados
- Notas do cliente
- Timeline completa (criação, aceite, conclusão)

💡 **Dica:** Acompanhe os orçamentos para não perder oportunidades de venda!

[IR PARA: Orçamentos]`
  },
  "modo-seletivo": {
    keywords: ["modo seletivo", "seletivo", "ia seletiva", "ativar ia", "desativar ia", "ia por lead", "lead ia", "selective", "escolher leads"],
    question: "O que é o Modo Seletivo da IA?",
    answer: `O **Modo Seletivo** permite que você escolha quais leads receberão atendimento automático da IA:

🎯 **Como funciona:**
- **Modo "Todos":** A IA responde automaticamente a todas as conversas
- **Modo "Seletivo":** A IA responde apenas aos leads que você autorizar

📱 **Como ativar/desativar IA para um lead:**
1. Em **Conversas**, clique com o botão direito em uma conversa
2. Selecione **"Ativar IA"** ou **"Desativar IA"**
3. Ou use o toggle no topo da conversa aberta

⚙️ **Como alternar entre os modos:**
1. Na página de **Conversas**, localize o seletor de modo no topo
2. Escolha entre **"Todos"** ou **"Seletivo"**
3. A mudança é aplicada imediatamente

🏷️ **Filtro por Tags (no Modo Seletivo):**
- Você pode configurar tags específicas para a IA atender
- Vá em **Conexões** → selecione a instância → configure as tags

💡 **Dica:** O modo seletivo é ideal quando você quer atendimento manual para alguns leads e automático para outros.

[IR PARA: Conversas]`
  },
  "problema-tecnico": {
    keywords: ["erro", "bug", "problema", "não funciona", "travou", "lento", "falha"],
    question: "Estou tendo um problema técnico",
    answer: `Sentimos muito pelo inconveniente! Para resolver problemas técnicos:

**Tente primeiro:**
1. Atualize a página (F5 ou Ctrl+R)
2. Limpe o cache do navegador
3. Tente em outro navegador (Chrome recomendado)
4. Verifique sua conexão com a internet

**Se o problema persistir:**
Abra um chamado detalhando:
- O que você estava fazendo
- Qual erro apareceu
- Prints de tela (se possível)

Nossa equipe técnica responderá em breve!

[ABRIR CHAMADO]`
  },
  "funcionalidades": {
    keywords: ["funcionalidades", "recursos", "como usar", "tutorial", "ajuda", "o que posso fazer"],
    question: "Quais são as funcionalidades da plataforma?",
    answer: `O Appi AutoZap oferece:

📱 **WhatsApp Automatizado**
- Conecte múltiplos números
- IA responde automaticamente 24/7
- Múltiplos agentes especializados

🤖 **Agentes IA Personalizados**
- 5 tipos: Vendas, Suporte, Agendamentos, Financeiro, Técnico
- Roteamento automático entre agentes
- Personalidade e conhecimento customizáveis

🎯 **Modo Seletivo de IA**
- Escolha quais leads a IA deve atender
- Alterne entre modo "Todos" e "Seletivo"
- Controle individual por conversa
- Filtre por tags específicas

👥 **Gestão de Leads**
- Cadastre e importe contatos
- Organize por status e tags
- Histórico completo de conversas e orçamentos

📅 **Agendamentos**
- Agende compromissos com leads
- Lembretes automáticos
- Integração com Google Calendar

💰 **Orçamentos**
- Detecção automática de pedidos de preço
- Acompanhamento de status por pipeline
- Resumos gerados por IA
- Timeline completa de cada orçamento

🤖 **Automação de Grupos**
- Boas-vindas automáticas para novos membros
- Funciona em grupos e comunidades WhatsApp
- Variáveis personalizáveis na mensagem
- Opção de enviar no privado ou no grupo

📊 **Estatísticas**
- Dashboard com métricas
- Acompanhe resultados

[IR PARA: Dashboard]`
  },
  "automacao-grupos": {
    keywords: ["grupo", "grupos", "comunidade", "comunidades", "boas-vindas", "welcome", "automação", "automático", "novo membro", "participante"],
    question: "Como configurar mensagens automáticas para grupos?",
    answer: `Para configurar boas-vindas automáticas em grupos WhatsApp:

1. Acesse **Agentes** no menu lateral
2. Vá na aba **Automações**
3. Clique em **"Adicionar Grupo"**
4. Selecione sua conexão WhatsApp e o grupo desejado
5. Personalize a mensagem usando variáveis:
   - \`{{nome_grupo}}\` - Nome do grupo
   - \`{{telefone}}\` - Número do novo membro
   - \`{{data}}\` - Data atual (formato DD/MM/AAAA)

⚙️ **Opções disponíveis:**
- **Enviar no privado (DM):** Mensagem vai direto para o chat particular do novo membro
- **Delay (segundos):** Aguardar antes de enviar (máximo 60s)

💡 Funciona com grupos e comunidades WhatsApp!

[IR PARA: Agentes]`
  }
};

const QUICK_SUGGESTIONS = [
  { label: "Como conectar o WhatsApp?", faqKey: "conectar-whatsapp", icon: Wifi },
  { label: "O que é Modo Seletivo?", faqKey: "modo-seletivo", icon: BookOpen },
  { label: "Como funcionam orçamentos?", faqKey: "orcamentos", icon: MessageCircleQuestion },
  { label: "Tenho outra dúvida", faqKey: null, icon: HelpCircle },
];

const SUPPORT_URL = SUPPORT_TICKET_URL;

const routeMap: Record<string, string> = {
  "Dashboard": "/",
  "Leads": "/leads",
  "Clientes": "/leads",
  "Conversas": "/conversations",
  "Agendamentos": "/appointments",
  "Orçamentos": "/quotes",
  "Configurações": "/settings",
  "Conexões": "/whatsapp",
  "WhatsApp": "/whatsapp",
  "Agentes": "/ai-settings",
  "Comportamento I.A.": "/ai-settings",
  "Estatísticas": "/statistics",
  "Menu": "/",
};

// ============================================
// FUNÇÃO DE MATCHING DE FAQ
// ============================================
function matchFAQ(userMessage: string): FAQEntry | null {
  const normalizedMessage = userMessage.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let bestMatch: { entry: FAQEntry; score: number } | null = null;

  for (const [, faq] of Object.entries(FAQ_DATABASE)) {
    let score = 0;

    for (const keyword of faq.keywords) {
      const normalizedKeyword = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedMessage.includes(normalizedKeyword)) {
        score += normalizedKeyword.length;
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { entry: faq, score };
    }
  }

  return bestMatch && bestMatch.score >= 5 ? bestMatch.entry : null;
}

// ============================================
// COMPONENTES AUXILIARES
// ============================================
const QuickActionButton = ({ action, navigate, isMobile }: { action: string; navigate: (path: string) => void; isMobile?: boolean }) => {
  const route = routeMap[action];
  if (!route) return null;

  return (
    <Button
      size={isMobile ? "default" : "sm"}
      variant="outline"
      className={`gap-2 ${isMobile ? "min-h-[44px] text-base" : "mt-2"}`}
      onClick={() => navigate(route)}
    >
      Ir para {action}
    </Button>
  );
};

const OpenTicketButton = ({ isMobile }: { isMobile?: boolean }) => (
  <a
    href={SUPPORT_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex items-center gap-2 mt-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all duration-200 font-medium shadow-md hover:shadow-lg hover:scale-[1.02] ${isMobile ? "px-5 py-3 text-base min-h-[48px]" : "px-4 py-2.5"
      }`}
  >
    <MdSupportAgent className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
    Abrir Chamado
    <ExternalLink className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
  </a>
);

interface QuickSuggestionButtonsProps {
  onSelect: (suggestion: { label: string; faqKey: string | null }) => void;
  disabled?: boolean;
  isMobile?: boolean;
}

const QuickSuggestionButtons = ({ onSelect, disabled, isMobile }: QuickSuggestionButtonsProps) => (
  <div className={`flex flex-wrap gap-2 mt-4 ${isMobile ? "gap-3" : ""}`}>
    {QUICK_SUGGESTIONS.map((suggestion, idx) => {
      const Icon = suggestion.icon;
      return (
        <button
          key={idx}
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className={`group flex items-center gap-2 bg-background border border-border/60 rounded-xl hover:bg-primary/10 hover:border-primary/40 hover:shadow-sm transition-all duration-200 text-foreground disabled:opacity-50 disabled:cursor-not-allowed ${isMobile
              ? "px-4 py-3 text-base min-h-[48px]"
              : "px-3.5 py-2 text-sm"
            }`}
        >
          <Icon className={`shrink-0 text-primary/70 group-hover:text-primary transition-colors ${isMobile ? "h-5 w-5" : "h-4 w-4"
            }`} />
          {suggestion.label}
        </button>
      );
    })}
  </div>
);

const InstantBadge = () => (
  <span className="inline-flex items-center gap-1 text-xs text-primary mb-2 bg-primary/10 px-2 py-0.5 rounded-full">
    <Zap className="h-3 w-3" />
    Resposta instantânea
  </span>
);

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-2 py-1">
    <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

const BotAvatar = ({ size = "sm" }: { size?: "sm" | "md" }) => (
  <div className={`shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm ${size === "md" ? "h-9 w-9" : "h-7 w-7"
    }`}>
    <MdSupportAgent className={`text-primary ${size === "md" ? "h-5 w-5" : "h-4 w-4"}`} />
  </div>
);

const parseActions = (content: string) => {
  const hasOpenTicket = content.includes("[ABRIR CHAMADO]");
  const goToMatches = content.match(/\[IR PARA: ([^\]]+)\]/g) || [];
  const actions = goToMatches.map((match) => {
    const actionMatch = match.match(/\[IR PARA: ([^\]]+)\]/);
    return actionMatch ? actionMatch[1] : null;
  }).filter(Boolean) as string[];

  let cleanContent = content
    .replace(/\[ABRIR CHAMADO\]/g, "")
    .replace(/\[IR PARA: [^\]]+\]/g, "")
    .trim();

  return { cleanContent, actions, hasOpenTicket };
};

// ============================================
// FUNÇÃO DE STREAMING COM IA
// ============================================
async function streamSupportChat(
  messages: { role: string; content: string }[],
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (error: Error) => void
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Usuário não autenticado");
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages }),
      }
    );

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Stream não disponível");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onDelta(content);
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    }

    onDone();
  } catch (error) {
    onError(error as Error);
  }
}

// ============================================
// CONTEÚDO DO CHAT (compartilhado entre mobile e desktop)
// ============================================
interface ChatContentProps {
  messages: Message[];
  isLoading: boolean;
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
  handleQuickSuggestion: (suggestion: { label: string; faqKey: string | null }) => void;
  clearHistory: () => void;
  onClose: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  navigate: (path: string) => void;
  isMobile: boolean;
}

const ChatContent = ({
  messages,
  isLoading,
  input,
  setInput,
  handleSend,
  handleQuickSuggestion,
  clearHistory,
  onClose,
  scrollRef,
  inputRef,
  navigate,
  isMobile,
}: ChatContentProps) => {
  const markdownComponents = {
    p: ({ children }: { children: React.ReactNode }) => (
      <p className={`mb-2 last:mb-0 ${isMobile ? "text-base leading-relaxed" : ""}`}>{children}</p>
    ),
    ul: ({ children }: { children: React.ReactNode }) => (
      <ul className={`list-disc pl-4 mb-2 space-y-1 ${isMobile ? "text-base" : ""}`}>{children}</ul>
    ),
    ol: ({ children }: { children: React.ReactNode }) => (
      <ol className={`list-decimal pl-4 mb-2 space-y-1 ${isMobile ? "text-base" : ""}`}>{children}</ol>
    ),
    li: ({ children }: { children: React.ReactNode }) => (
      <li className={`mb-1 ${isMobile ? "text-base" : ""}`}>{children}</li>
    ),
    strong: ({ children }: { children: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
    code: ({ children }: { children: React.ReactNode }) => (
      <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code>
    ),
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - Desktop only (mobile uses DrawerHeader) */}
      {!isMobile && (
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-sm">
              <MdSupportAgent className="h-5 w-5 text-primary" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full border-2 border-card">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Suporte Appi AutoZap</h2>
              <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">● Online agora</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearHistory}
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                title="Limpar conversa"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea
        className={`flex-1 ${isMobile ? "px-4 py-3" : "p-4"}`}
        ref={scrollRef}
      >
        <div className={`space-y-4 ${isMobile ? "pb-2" : ""}`}>
          {messages.map((message) => {
            const { cleanContent, actions, hasOpenTicket } = parseActions(message.content);

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start items-end gap-2"}`}
              >
                {message.role === "assistant" && (
                  <BotAvatar size={isMobile ? "md" : "sm"} />
                )}
                <div
                  className={`rounded-2xl ${isMobile ? "max-w-[85%] px-4 py-3" : "max-w-[80%] px-4 py-3"} ${message.role === "user"
                      ? "bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-muted/80 text-foreground shadow-sm border border-border/30"
                    }`}
                >
                  {message.role === "assistant" && message.isInstant && (
                    <InstantBadge />
                  )}

                  <ReactMarkdown components={markdownComponents}>
                    {cleanContent}
                  </ReactMarkdown>

                  {message.role === "assistant" && actions.length > 0 && (
                    <div className={`flex flex-wrap gap-2 ${isMobile ? "mt-3" : "mt-2"}`}>
                      {actions.map((action, idx) => (
                        <QuickActionButton key={idx} action={action} navigate={navigate} isMobile={isMobile} />
                      ))}
                    </div>
                  )}

                  {message.role === "assistant" && hasOpenTicket && (
                    <div className={isMobile ? "mt-3" : "mt-2"}>
                      <OpenTicketButton isMobile={isMobile} />
                    </div>
                  )}

                  {message.id === "welcome" && messages.length === 1 && (
                    <QuickSuggestionButtons
                      onSelect={handleQuickSuggestion}
                      disabled={isLoading}
                      isMobile={isMobile}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.content === "" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start items-end gap-2"
            >
              <BotAvatar size={isMobile ? "md" : "sm"} />
              <div className="bg-muted/80 rounded-2xl px-4 py-3 shadow-sm border border-border/30">
                <TypingIndicator />
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div
        className={`border-t border-border/50 bg-gradient-to-t from-background via-background to-background/80 backdrop-blur-sm ${isMobile
            ? "p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            : "p-4"
          }`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2.5"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Como podemos ajudar você?"
            disabled={isLoading}
            className={`flex-1 rounded-xl border-border/60 focus-visible:border-primary/50 focus-visible:ring-primary/20 transition-all ${isMobile ? "h-12 text-base" : ""
              }`}
          />
          <Button
            type="submit"
            size={isMobile ? "default" : "icon"}
            disabled={isLoading || !input.trim()}
            className={`rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:hover:scale-100 ${isMobile ? "h-12 w-12" : ""
              }`}
          >
            <Send className={`transition-transform ${isMobile ? "h-5 w-5" : "h-4 w-4"}`} />
          </Button>
        </form>
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export function SupportChatSidebar({ isOpen, onClose }: SupportChatSidebarProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! 👋 Sou o assistente de suporte do Autozap. Selecione uma opção abaixo ou descreva sua dúvida:",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const addInstantResponse = (userContent: string, faqAnswer: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
      timestamp: new Date(),
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: faqAnswer,
      timestamp: new Date(),
      isInstant: true,
      hasOpenTicket: faqAnswer.includes("[ABRIR CHAMADO]"),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
  };

  const sendToAI = async (userContent: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    const chatHistory = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    await streamSupportChat(
      [...chatHistory, { role: "user", content: userContent }],
      (delta) => {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg.role === "assistant") {
            lastMsg.content += delta;
            lastMsg.hasOpenTicket = lastMsg.content.includes("[ABRIR CHAMADO]");
          }
          return updated;
        });
      },
      () => setIsLoading(false),
      (error) => {
        console.error("Support chat error:", error);
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg.role === "assistant") {
            lastMsg.content = "Desculpe, ocorreu um erro. Por favor, tente novamente ou abra um chamado diretamente.\n\n[ABRIR CHAMADO]";
            lastMsg.hasOpenTicket = true;
          }
          return updated;
        });
        setIsLoading(false);
      }
    );
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    setInput("");

    const matchedFAQ = matchFAQ(userInput);

    if (matchedFAQ) {
      addInstantResponse(userInput, matchedFAQ.answer);
    } else {
      await sendToAI(userInput);
    }
  };

  const clearHistory = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Olá! 👋 Sou o assistente de suporte do Autozap. Selecione uma opção abaixo ou descreva sua dúvida:",
        timestamp: new Date(),
      },
    ]);
  };

  const handleQuickSuggestion = (suggestion: { label: string; faqKey: string | null }) => {
    if (suggestion.faqKey && FAQ_DATABASE[suggestion.faqKey]) {
      addInstantResponse(suggestion.label, FAQ_DATABASE[suggestion.faqKey].answer);
    } else {
      setInput("");
      inputRef.current?.focus();
    }
  };

  // Mobile: usa Drawer de baixo para cima
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[85vh] max-h-[85vh]">
          <DrawerHeader className="border-b border-border/50 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-sm">
                  <MdSupportAgent className="h-5 w-5 text-primary" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full border-2 border-card">
                    <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                  </span>
                </div>
                <div>
                  <DrawerTitle className="text-left">Suporte Autozap</DrawerTitle>
                  <p className="text-xs text-emerald-500 font-medium text-left flex items-center gap-1">● Online agora</p>
                </div>
              </div>
              {messages.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearHistory}
                  className="h-10 w-10 hover:bg-destructive/10 hover:text-destructive"
                  title="Limpar conversa"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">
            <ChatContent
              messages={messages}
              isLoading={isLoading}
              input={input}
              setInput={setInput}
              handleSend={handleSend}
              handleQuickSuggestion={handleQuickSuggestion}
              clearHistory={clearHistory}
              onClose={onClose}
              scrollRef={scrollRef}
              inputRef={inputRef}
              navigate={navigate}
              isMobile={true}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: sidebar lateral tradicional
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[45]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-xl z-[55] flex flex-col"
          >
            <ChatContent
              messages={messages}
              isLoading={isLoading}
              input={input}
              setInput={setInput}
              handleSend={handleSend}
              handleQuickSuggestion={handleQuickSuggestion}
              clearHistory={clearHistory}
              onClose={onClose}
              scrollRef={scrollRef}
              inputRef={inputRef}
              navigate={navigate}
              isMobile={false}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
