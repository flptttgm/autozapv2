import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Check, CheckCheck } from "lucide-react";

interface Message {
  id: number;
  content: string;
  isBot: boolean;
  delay: number;
}

const messages: Message[] = [
  { id: 1, content: "Olá! Gostaria de saber sobre os preços 💰", isBot: false, delay: 0 },
  { id: 2, content: "Olá! 👋 Sou a IA do Autozap. Temos planos a partir de R$ 287/mês. Posso te ajudar a encontrar o ideal para você!", isBot: true, delay: 1500 },
  { id: 3, content: "Quantas mensagens vocês recebem por mês?", isBot: false, delay: 4000 },
  { id: 4, content: "Ótima pergunta! Nosso plano Start suporta até 1.000 contatos. Para volumes maiores, temos Pro (5.000) e Business (20.000) 📊", isBot: true, delay: 5500 },
  { id: 5, content: "Quero o plano Pro! Como faço?", isBot: false, delay: 8500 },
  { id: 6, content: "Perfeito! 🎉 Vou gerar um link de pagamento para você. O trial de 48 horas é grátis! Qual seu e-mail?", isBot: true, delay: 10000 },
];

const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="flex justify-start"
  >
    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
      <motion.span
        className="w-2 h-2 bg-muted-foreground/50 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
      />
      <motion.span
        className="w-2 h-2 bg-muted-foreground/50 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
      />
      <motion.span
        className="w-2 h-2 bg-muted-foreground/50 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
      />
    </div>
  </motion.div>
);

const MessageBubble = ({ message, isNew }: { message: Message; isNew: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 25 }}
    className={`flex ${message.isBot ? "justify-start" : "justify-end"}`}
  >
    <div
      className={`max-w-[280px] px-4 py-2 ${
        message.isBot
          ? "bg-muted rounded-2xl rounded-bl-sm"
          : "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
      }`}
    >
      <p className="text-sm">{message.content}</p>
      {!message.isBot && (
        <div className="flex justify-end mt-1">
          <CheckCheck className={`w-4 h-4 ${isNew ? "text-primary-foreground/50" : "text-blue-400"}`} />
        </div>
      )}
    </div>
  </motion.div>
);

export const AnimatedChat = () => {
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only within the chat container
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [visibleMessages, isTyping]);

  useEffect(() => {
    if (currentIndex >= messages.length) {
      // Reset after all messages shown
      const timeout = setTimeout(() => {
        setVisibleMessages([]);
        setCurrentIndex(0);
      }, 5000);
      return () => clearTimeout(timeout);
    }

    const message = messages[currentIndex];
    const delay = currentIndex === 0 ? 1000 : message.delay - (messages[currentIndex - 1]?.delay || 0);

    // Show typing for bot messages
    if (message.isBot) {
      const typingTimeout = setTimeout(() => {
        setIsTyping(true);
      }, delay - 1200);

      const messageTimeout = setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages(prev => [...prev, message]);
        setCurrentIndex(prev => prev + 1);
      }, delay);

      return () => {
        clearTimeout(typingTimeout);
        clearTimeout(messageTimeout);
      };
    } else {
      const messageTimeout = setTimeout(() => {
        setVisibleMessages(prev => [...prev, message]);
        setCurrentIndex(prev => prev + 1);
      }, delay);

      return () => clearTimeout(messageTimeout);
    }
  }, [currentIndex]);

  return (
    <div className="bg-gradient-dark rounded-2xl p-4 md:p-8 shadow-hover">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
          </div>
          <div className="flex-1">
            <p className="font-semibold font-funnel">AutoZap IA</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Online agora
            </p>
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          ref={messagesContainerRef}
          className="p-4 space-y-3 h-[320px] overflow-y-auto bg-gradient-to-b from-background to-muted/10 scrollbar-hide"
        >
          <AnimatePresence mode="popLayout">
            {visibleMessages.map((message, index) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                isNew={index === visibleMessages.length - 1}
              />
            ))}
          </AnimatePresence>
          
          <AnimatePresence>
            {isTyping && <TypingIndicator />}
          </AnimatePresence>
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background rounded-full px-4 py-2 border border-border flex items-center">
              <span className="text-muted-foreground text-sm">Digite uma mensagem...</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Stats overlay */}
      <motion.div 
        className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        <div className="bg-card/80 backdrop-blur rounded-lg p-2 sm:p-3 border border-border/50 text-center">
          <p className="text-xl sm:text-2xl font-bold text-primary">2.5s</p>
          <p className="text-xs text-muted-foreground">Tempo de resposta</p>
        </div>
        <div className="bg-card/80 backdrop-blur rounded-lg p-2 sm:p-3 border border-border/50 text-center">
          <p className="text-xl sm:text-2xl font-bold text-primary">98%</p>
          <p className="text-xs text-muted-foreground">Satisfação</p>
        </div>
        <div className="bg-card/80 backdrop-blur rounded-lg p-2 sm:p-3 border border-border/50 text-center">
          <p className="text-xl sm:text-2xl font-bold text-primary">24/7</p>
          <p className="text-xs text-muted-foreground">Disponível</p>
        </div>
      </motion.div>
    </div>
  );
};