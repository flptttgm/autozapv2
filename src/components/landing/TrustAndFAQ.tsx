import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    Lock,
    Award,
    Headphones,
    ChevronDown,
    CheckCircle2,
    Star,
    Users,
    Zap
} from "lucide-react";

// Trust Signals Component
export const TrustSignals = () => {
    const signals = [
        {
            icon: Shield,
            title: "100% Seguro",
            description: "Seus dados protegidos com criptografia de ponta",
        },
        {
            icon: Lock,
            title: "Conexão Oficial",
            description: "API autorizada, sem riscos para seu número",
        },
        {
            icon: Award,
            title: "Garantia 7 Dias",
            description: "Não gostou? Devolvemos seu dinheiro",
        },
        {
            icon: Headphones,
            title: "Suporte Humano",
            description: "Equipe real pronta para te ajudar",
        },
    ];

    return (
        <section className="py-12 border-y border-border/30 bg-card/30">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                    {signals.map((signal, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="flex flex-col items-center text-center group"
                        >
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <signal.icon className="w-5 h-5 text-primary" />
                            </div>
                            <h4 className="font-semibold text-sm mb-1">{signal.title}</h4>
                            <p className="text-xs text-muted-foreground">{signal.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// Trust Badges (smaller inline version)
export const TrustBadges = () => {
    const badges = [
        { icon: CheckCircle2, text: "Sem fidelidade" },
        { icon: Star, text: "4.9/5 avaliação" },
        { icon: Users, text: "+100 clientes" },
        { icon: Zap, text: "Ativação imediata" },
    ];

    return (
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {badges.map((badge, index) => (
                <div
                    key={index}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                    <badge.icon className="w-4 h-4 text-primary" />
                    <span>{badge.text}</span>
                </div>
            ))}
        </div>
    );
};

// FAQ Component
interface FAQItem {
    question: string;
    answer: string;
}

const faqData: FAQItem[] = [
    {
        question: "Preciso de conhecimento técnico para usar?",
        answer: "Não! O Autozap foi feito para ser simples. Basta escanear o QR Code com seu WhatsApp e pronto. A configuração leva menos de 5 minutos e nossa equipe está disponível para ajudar se precisar.",
    },
    {
        question: "Meu número pode ser bloqueado?",
        answer: "Usamos a API oficial do WhatsApp Business e tecnologia de fila inteligente que respeita os limites do WhatsApp. Nossa taxa de bloqueio é praticamente zero quando você segue as boas práticas que ensinamos.",
    },
    {
        question: "Quantas mensagens posso enviar por mês?",
        answer: "Ilimitadas! Diferente de outras plataformas, não cobramos por mensagem. O preço é fixo mensal, independente do volume de mensagens que você enviar ou receber.",
    },
    {
        question: "Posso testar antes de assinar?",
        answer: "Sim! Oferecemos 48 horas de teste gratuito com acesso a todas as funcionalidades. Não pedimos cartão de crédito para o trial.",
    },
    {
        question: "A IA responde qualquer pergunta?",
        answer: "A IA responde baseada nos documentos e informações que você fornecer. Quanto mais você treinar, melhores serão as respostas. Para perguntas que não souber responder, ela pode transferir para um atendente humano.",
    },
    {
        question: "Posso cancelar a qualquer momento?",
        answer: "Sim, sem multa ou fidelidade. Você pode cancelar diretamente pelo painel. Se cancelar nos primeiros 7 dias, devolvemos 100% do valor pago.",
    },
    {
        question: "Funciona com WhatsApp Business?",
        answer: "Sim! Funciona tanto com WhatsApp normal quanto com WhatsApp Business. Você usa seu próprio número, mantendo todo o histórico de conversas.",
    },
    {
        question: "Como funciona a captação de leads?",
        answer: "Com os créditos inclusos no seu plano, você pode buscar leads qualificados por segmento, cidade e outros filtros. Recebe dados completos: nome, telefone, email e mais.",
    },
];

export const FAQ = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section id="faq" className="py-16 md:py-24">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Perguntas Frequentes
                    </h2>
                    <p className="text-muted-foreground max-w-xl mx-auto">
                        Tire suas dúvidas sobre o Autozap
                    </p>
                </div>

                <div className="max-w-3xl mx-auto">
                    {faqData.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-border last:border-b-0"
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full py-5 flex items-center justify-between text-left group"
                            >
                                <span className="font-medium pr-4 group-hover:text-primary transition-colors">
                                    {item.question}
                                </span>
                                <motion.div
                                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex-shrink-0"
                                >
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                </motion.div>
                            </button>

                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <p className="pb-5 text-muted-foreground leading-relaxed">
                                            {item.answer}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="text-center mt-10">
                    <p className="text-muted-foreground mb-4">
                        Ainda tem dúvidas?
                    </p>
                    <a
                        href={`https://wa.me/556596312685?text=${encodeURIComponent("Olá! Tenho uma dúvida sobre o Autozap")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                        <Headphones className="w-4 h-4" />
                        Fale com nosso time
                    </a>
                </div>
            </div>
        </section>
    );
};
