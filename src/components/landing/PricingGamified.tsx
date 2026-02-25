import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, TrendingUp, Clock, Users, DollarSign, Sparkles, Check, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface PricingCalculatorProps {
    onPlanSelect?: (plan: string) => void;
}

export const PricingCalculator = ({ onPlanSelect }: PricingCalculatorProps) => {
    const [messagesPerDay, setMessagesPerDay] = useState(50);
    const [hoursPerDay, setHoursPerDay] = useState(4);
    const [costPerHour, setCostPerHour] = useState(25);

    // Calculations
    const manualCostPerMonth = hoursPerDay * costPerHour * 22; // 22 working days
    const autozapCost = 687; // Start plan price
    const savings = manualCostPerMonth - autozapCost;
    const savingsPercentage = Math.round((savings / manualCostPerMonth) * 100);
    const hoursFreed = hoursPerDay * 22;
    const moreLeadsPercentage = Math.min(Math.round((messagesPerDay / 50) * 40), 300);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-4xl mx-auto"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                    <Calculator className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h3 className="text-xl font-bold">Calculadora de Economia</h3>
                    <p className="text-sm text-muted-foreground">
                        Descubra quanto você pode economizar
                    </p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Left - Sliders */}
                <div className="space-y-6">
                    {/* Messages per day */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-sm font-medium">Mensagens por dia</label>
                            <span className="text-lg font-bold text-primary">{messagesPerDay}</span>
                        </div>
                        <Slider
                            value={[messagesPerDay]}
                            onValueChange={(v) => setMessagesPerDay(v[0])}
                            min={10}
                            max={500}
                            step={10}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>10</span>
                            <span>500</span>
                        </div>
                    </div>

                    {/* Hours per day */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-sm font-medium">Horas/dia em atendimento</label>
                            <span className="text-lg font-bold text-primary">{hoursPerDay}h</span>
                        </div>
                        <Slider
                            value={[hoursPerDay]}
                            onValueChange={(v) => setHoursPerDay(v[0])}
                            min={1}
                            max={12}
                            step={1}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>1h</span>
                            <span>12h</span>
                        </div>
                    </div>

                    {/* Cost per hour */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-sm font-medium">Custo/hora atendente</label>
                            <span className="text-lg font-bold text-primary">R$ {costPerHour}</span>
                        </div>
                        <Slider
                            value={[costPerHour]}
                            onValueChange={(v) => setCostPerHour(v[0])}
                            min={10}
                            max={100}
                            step={5}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>R$ 10</span>
                            <span>R$ 100</span>
                        </div>
                    </div>
                </div>

                {/* Right - Results */}
                <div className="space-y-4">
                    {/* Current cost */}
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                        <div className="flex items-center gap-2 text-destructive mb-1">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-sm font-medium">Custo atual mensal</span>
                        </div>
                        <div className="text-2xl font-bold text-destructive">
                            R$ {manualCostPerMonth.toLocaleString("pt-BR")}
                        </div>
                    </div>

                    {/* Autozap cost */}
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <Zap className="w-4 h-4" />
                            <span className="text-sm font-medium">Com Autozap (Plano Start)</span>
                        </div>
                        <div className="text-2xl font-bold text-primary">
                            R$ {autozapCost.toLocaleString("pt-BR")}/mês
                        </div>
                    </div>

                    {/* Savings */}
                    <motion.div
                        key={savings}
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30"
                    >
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-sm font-medium">Economia mensal</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-primary">
                                R$ {Math.max(0, savings).toLocaleString("pt-BR")}
                            </span>
                            {savings > 0 && (
                                <span className="text-sm font-medium text-primary/80">
                                    ({savingsPercentage}% menos)
                                </span>
                            )}
                        </div>
                    </motion.div>

                    {/* Extra benefits */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <Clock className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                            <div className="text-lg font-bold">{hoursFreed}h</div>
                            <div className="text-xs text-muted-foreground">liberadas/mês</div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <Users className="w-5 h-5 mx-auto mb-1 text-green-500" />
                            <div className="text-lg font-bold">+{moreLeadsPercentage}%</div>
                            <div className="text-xs text-muted-foreground">mais leads</div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// Animated pricing card with glow effect
interface AnimatedPricingCardProps {
    name: string;
    connections: number;
    monthlyPrice: number;
    annualPrice: number;
    popular: boolean;
    features: string[];
    isAnnual: boolean;
    onSelect: () => void;
    index: number;
}

export const AnimatedPricingCard = ({
    name,
    connections,
    monthlyPrice,
    annualPrice,
    popular,
    features,
    isAnnual,
    onSelect,
    index,
}: AnimatedPricingCardProps) => {
    const displayPrice = isAnnual ? annualPrice : monthlyPrice;
    const savings = (monthlyPrice - annualPrice) * 12;
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative group"
        >
            {/* Glow effect for popular */}
            {popular && (
                <motion.div
                    className="absolute -inset-1 bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40 rounded-3xl blur-lg"
                    animate={{
                        opacity: [0.5, 0.8, 0.5],
                        scale: [1, 1.02, 1],
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            )}

            <motion.div
                animate={{
                    scale: isHovered ? 1.02 : 1,
                    y: isHovered ? -5 : 0,
                }}
                transition={{ duration: 0.2 }}
                className={`relative p-6 rounded-2xl bg-background border-2 flex flex-col h-full ${popular
                    ? "border-primary shadow-xl"
                    : "border-border hover:border-primary/50"
                    }`}
            >
                {/* Popular badge with animation */}
                {popular && (
                    <motion.div
                        className="absolute -top-3 left-1/2 -translate-x-1/2"
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-green-400 text-primary-foreground text-xs font-bold whitespace-nowrap flex items-center gap-1.5 shadow-lg">
                            <Sparkles className="w-3.5 h-3.5" />
                            Mais Popular
                        </span>
                    </motion.div>
                )}

                <div className="text-center mb-6 pt-2">
                    <h3 className="text-xl font-bold mb-1">{name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        {connections} {connections === 1 ? "conexão" : "conexões"} WhatsApp
                    </p>

                    <div className="flex flex-col items-center">
                        <AnimatePresence mode="wait">
                            {isAnnual && (
                                <motion.span
                                    key="original"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="text-lg text-muted-foreground line-through"
                                >
                                    R$ {monthlyPrice.toLocaleString("pt-BR")}
                                </motion.span>
                            )}
                        </AnimatePresence>

                        <motion.div
                            key={displayPrice}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex items-baseline gap-1"
                        >
                            <span className="text-3xl font-bold">
                                R$ {displayPrice.toLocaleString("pt-BR")}
                            </span>
                            <span className="text-muted-foreground">/mês</span>
                        </motion.div>

                        <AnimatePresence>
                            {isAnnual && (
                                <motion.span
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="text-xs text-primary font-medium mt-1 flex items-center gap-1"
                                >
                                    <TrendingUp className="w-3 h-3" />
                                    Economia de R$ {savings.toLocaleString("pt-BR")}/ano
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-grow">
                    {features.map((feature, fIndex) => (
                        <motion.li
                            key={fIndex}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 + fIndex * 0.05 }}
                            className="flex items-center gap-2.5"
                        >
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-primary" />
                            </div>
                            <span className="text-sm">{feature}</span>
                        </motion.li>
                    ))}
                </ul>

                <Button
                    size="lg"
                    variant={popular ? "default" : "outline"}
                    className={`w-full h-11 font-semibold mt-auto transition-all ${popular ? "btn-shimmer animate-pulse-glow" : ""
                        }`}
                    onClick={onSelect}
                >
                    {popular ? "Começar Agora" : "Escolher Plano"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </motion.div>
        </motion.div>
    );
};

// Comparison row for showing value
export const ValueComparison = () => {
    const comparisons = [
        {
            competitor: "Atendente CLT",
            price: "R$ 2.500+/mês",
            autozap: "R$ 687/mês",
            savings: "73%",
        },
        {
            competitor: "Outros chatbots",
            price: "Cobra por mensagem",
            autozap: "Ilimitado",
            savings: "100%",
        },
        {
            competitor: "Agência de marketing",
            price: "R$ 3.000+/mês",
            autozap: "Tudo incluso",
            savings: "∞",
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 max-w-3xl mx-auto"
        >
            <h4 className="text-center text-lg font-semibold mb-6">
                Compare e economize
            </h4>
            <div className="space-y-3">
                {comparisons.map((item, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50"
                    >
                        <div className="flex-1">
                            <div className="text-sm text-muted-foreground">{item.competitor}</div>
                            <div className="font-medium line-through text-destructive/70">
                                {item.price}
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-muted-foreground">→</div>
                        <div className="flex-1 text-right">
                            <div className="text-sm text-muted-foreground">Autozap</div>
                            <div className="font-bold text-primary">{item.autozap}</div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold">
                            -{item.savings}
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};
