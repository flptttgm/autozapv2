import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Quote, Building2, Store, Briefcase, Heart, Stethoscope, GraduationCap } from "lucide-react";

// Gera um número aleatório de mensagens entre 500 e 1200
const generateMessageCount = () => Math.floor(Math.random() * 701) + 500;

// Logos de segmentos que usam o Autozap (ícones representativos)
const segments = [
    { icon: Store, label: "E-commerce" },
    { icon: Building2, label: "Imobiliárias" },
    { icon: Briefcase, label: "Consultórios" },
    { icon: Heart, label: "Clínicas Estéticas" },
    { icon: Stethoscope, label: "Saúde" },
    { icon: GraduationCap, label: "Educação" },
];

const testimonials = [
    {
        name: "Marcos Silva",
        role: "CEO, TechStore Brasil",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=marcos&backgroundColor=00ff88",
        content: "Aumentamos em 340% a conversão de leads após implementar o Autozap. A IA responde 24/7 e nossos clientes adoram.",
        rating: 5,
    },
    {
        name: "Dra. Carolina Mendes",
        role: "Proprietária, Clínica Estética Premium",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=carolina&backgroundColor=00dd74",
        content: "Eliminamos 80% das tarefas manuais de agendamento. A secretária virtual é incrível!",
        rating: 5,
    },
    {
        name: "Roberto Almeida",
        role: "Diretor, Imobiliária Central",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=roberto&backgroundColor=00c064",
        content: "Antes perdíamos leads fora do horário comercial. Agora a IA qualifica e agenda visitas automaticamente.",
        rating: 5,
    },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export const ClientLogos = () => {
    return (
        <section className="py-12 border-y border-border/30 bg-secondary/20 overflow-hidden">
            <div className="container mx-auto px-4">
                <p className="text-center text-sm text-muted-foreground mb-8 uppercase tracking-widest font-medium">
                    Empresas de diversos segmentos confiam no Autozap
                </p>

                {/* Marquee animation */}
                <div className="relative">
                    <div className="flex animate-marquee gap-12 items-center">
                        {[...segments, ...segments].map((segment, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 px-6 py-3 rounded-full bg-card/50 border border-border/30 backdrop-blur-sm shrink-0"
                            >
                                <segment.icon className="w-5 h-5 text-primary" />
                                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                                    {segment.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export const Testimonials = () => {
    return (
        <section className="py-16 md:py-24 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-4">
                        <Star className="w-4 h-4 fill-primary" />
                        Histórias de Sucesso
                    </span>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        O que nossos clientes dizem
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        Empresas de todos os tamanhos estão transformando seu atendimento com o Autozap
                    </p>
                </motion.div>

                <motion.div
                    className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    variants={containerVariants}
                >
                    {testimonials.map((testimonial, index) => (
                        <motion.div
                            key={index}
                            variants={itemVariants}
                            className="relative group"
                        >
                            {/* Glow effect on hover */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <div className="relative bg-card border border-border rounded-2xl p-6 h-full hover:border-primary/30 transition-all duration-300 hover:shadow-xl">
                                <Quote className="w-8 h-8 text-primary/20 mb-4" />

                                <p className="text-muted-foreground mb-6 leading-relaxed">
                                    "{testimonial.content}"
                                </p>

                                <div className="flex items-center gap-4 mt-auto">
                                    <img
                                        src={testimonial.image}
                                        alt={testimonial.name}
                                        className="w-12 h-12 rounded-full bg-primary/10"
                                    />
                                    <div>
                                        <h4 className="font-semibold text-foreground">
                                            {testimonial.name}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {testimonial.role}
                                        </p>
                                    </div>
                                </div>

                                {/* Star rating */}
                                <div className="flex gap-1 mt-4">
                                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export const LiveCounter = () => {
    const [messageCount, setMessageCount] = useState(generateMessageCount);

    useEffect(() => {
        // Atualiza o contador a cada hora (3600000 ms)
        const intervalId = setInterval(() => {
            setMessageCount(generateMessageCount());
        }, 3600000);

        return () => clearInterval(intervalId);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-card/80 border border-border/50 backdrop-blur-sm"
        >
            <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{messageCount.toLocaleString('pt-BR')}</span> mensagens enviadas na última hora
            </span>
        </motion.div>
    );
};
