import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Send, Sparkles, MessageSquare } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

const DEMO_CONVERSATIONS = [
    {
        user: "Qual o horário de funcionamento?",
        assistant: "Funcionamos de segunda a sexta, das 8h às 18h, e aos sábados das 9h às 13h. Posso agendar um horário para você? 📅",
    },
    {
        user: "Quero agendar para amanhã",
        assistant: "Perfeito! Temos horários disponíveis às 10h, 14h e 16h. Qual prefere? Preciso só do seu nome para confirmar. ✅",
    },
    {
        user: "14h, meu nome é João",
        assistant: "Pronto, João! Agendado para amanhã às 14h. Você receberá uma confirmação por WhatsApp. Até lá! 🎉",
    },
];

const TypingDots = () => (
    <div className="flex gap-1 items-center px-3 py-2">
        {[0, 1, 2].map((i) => (
            <motion.span
                key={i}
                className="w-2 h-2 bg-primary/50 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
            />
        ))}
    </div>
);

export const HeroChatDemo = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [showInput, setShowInput] = useState(true);

    useEffect(() => {
        const runDemo = async () => {
            if (currentStep >= DEMO_CONVERSATIONS.length) {
                // Reset after 3 seconds
                setTimeout(() => {
                    setMessages([]);
                    setCurrentStep(0);
                    setShowInput(true);
                }, 4000);
                return;
            }

            const conversation = DEMO_CONVERSATIONS[currentStep];

            // Type user message
            setInputValue("");
            for (let i = 0; i <= conversation.user.length; i++) {
                await new Promise((r) => setTimeout(r, 30));
                setInputValue(conversation.user.slice(0, i));
            }
            await new Promise((r) => setTimeout(r, 500));

            // Send user message
            setMessages((prev) => [...prev, { role: "user", content: conversation.user }]);
            setInputValue("");
            setShowInput(false);

            // Show typing
            await new Promise((r) => setTimeout(r, 300));
            setIsTyping(true);
            await new Promise((r) => setTimeout(r, 1500));
            setIsTyping(false);

            // Show assistant message
            setMessages((prev) => [...prev, { role: "assistant", content: conversation.assistant }]);
            setShowInput(true);

            await new Promise((r) => setTimeout(r, 2000));
            setCurrentStep((prev) => prev + 1);
        };

        const timer = setTimeout(runDemo, 1000);
        return () => clearTimeout(timer);
    }, [currentStep]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative w-full max-w-md mx-auto"
        >
            {/* Phone frame */}
            <div className="relative bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
                {/* Phone notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-background rounded-b-2xl z-10" />

                {/* Header */}
                <div className="bg-gradient-to-r from-primary/20 to-primary/10 px-4 py-4 pt-8 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-primary" />
                            </div>
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm">Assistente IA</h4>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                Online agora
                            </p>
                        </div>
                        <div className="ml-auto">
                            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="h-72 overflow-hidden bg-gradient-to-b from-muted/30 to-background p-4 space-y-3">
                    {/* Welcome message */}
                    {messages.length === 0 && !isTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-2"
                        >
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                                <p className="text-sm">Olá! 👋 Como posso ajudar você hoje?</p>
                            </div>
                        </motion.div>
                    )}

                    <AnimatePresence mode="popLayout">
                        {messages.map((msg, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.3 }}
                                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
                            >
                                {msg.role === "assistant" && (
                                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                )}
                                <div
                                    className={`rounded-2xl px-3 py-2 max-w-[80%] ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                        : "bg-card border border-border rounded-tl-sm"
                                        }`}
                                >
                                    <p className="text-sm">{msg.content}</p>
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Typing indicator */}
                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-2"
                        >
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="bg-card border border-border rounded-2xl rounded-tl-sm">
                                <TypingDots />
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Input */}
                <div className="p-3 border-t border-border bg-card/50">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full px-4 py-2.5 flex items-center">
                            <span className="text-sm text-muted-foreground flex-1 truncate">
                                {inputValue || "Digite sua mensagem..."}
                            </span>
                        </div>
                        <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                            <Send className="w-4 h-4 text-primary-foreground" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Floating labels */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 }}
                className="absolute -left-4 top-1/4 hidden lg:block"
            >
                <div className="bg-gradient-to-r from-primary/20 to-primary/5 border-l-2 border-primary rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Respostas em &lt;3s
                    </p>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
                className="absolute -right-4 top-1/2 hidden lg:block"
            >
                <div className="bg-gradient-to-l from-primary/20 to-primary/5 border-r-2 border-primary rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                        <Sparkles className="w-3.5 h-3.5" />
                        IA Treinada
                    </p>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 }}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2"
            >
                <div className="bg-primary text-primary-foreground rounded-full px-4 py-1.5 shadow-lg">
                    <p className="text-xs font-bold">100% Automatizado</p>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default HeroChatDemo;
