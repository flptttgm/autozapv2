import { motion } from "framer-motion";
import { MessageSquare, Zap, Bot, Heart, Check, Send, User, Users, Star, Sparkles } from "lucide-react";

// WhatsApp SVG icon component
const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// Logo {a} component
const LogoA = ({ className }: { className?: string }) => (
    <span className={`font-black text-primary ${className}`}>
        {"{a}"}
    </span>
);

// Floating background elements - tripled for more density
const floatingBgItems = [
    // First set - reduced generic icons
    { type: 'icon', icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/5', startX: '5%', startY: '15%', duration: 25 },
    { type: 'icon', icon: Heart, color: 'text-pink-400', bg: 'bg-pink-400/5', startX: '75%', startY: '65%', duration: 22 },
    { type: 'icon', icon: Send, color: 'text-blue-400', bg: 'bg-blue-400/5', startX: '90%', startY: '50%', duration: 27 },
    { type: 'icon', icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/5', startX: '70%', startY: '80%', duration: 24 },
    { type: 'whatsapp', startX: '92%', startY: '35%', duration: 29 },
    { type: 'logo', startX: '12%', startY: '25%', duration: 26 },
    { type: 'logo', startX: '60%', startY: '12%', duration: 23 },
    { type: 'logo', startX: '85%', startY: '82%', duration: 31 }, // Moved from 68%, 22%

    // Second set - reduced generic icons
    { type: 'icon', icon: Bot, color: 'text-primary', bg: 'bg-primary/5', startX: '88%', startY: '60%', duration: 24 },
    { type: 'icon', icon: Check, color: 'text-primary', bg: 'bg-primary/5', startX: '65%', startY: '40%', duration: 26 },
    { type: 'icon', icon: User, color: 'text-blue-400', bg: 'bg-blue-400/5', startX: '78%', startY: '15%', duration: 28 },
    { type: 'whatsapp', startX: '22%', startY: '82%', duration: 34 },
    { type: 'logo', startX: '95%', startY: '45%', duration: 29 },
    { type: 'logo', startX: '42%', startY: '92%', duration: 27 },

    // Third set - reduced generic icons
    { type: 'icon', icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/5', startX: '72%', startY: '28%', duration: 31 },
    { type: 'icon', icon: Bot, color: 'text-primary', bg: 'bg-primary/5', startX: '52%', startY: '68%', duration: 29 },
    { type: 'whatsapp', startX: '58%', startY: '42%', duration: 32 },
    { type: 'whatsapp', startX: '15%', startY: '62%', duration: 25 },
    { type: 'logo', startX: '10%', startY: '40%', duration: 26 },
];

export const FloatingElements = () => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {floatingBgItems.map((item, index) => {
                // Random movement paths - seeded by index for consistency
                const seed = index * 7;
                const xPath = [
                    0,
                    ((seed % 60) - 30),
                    (((seed * 3) % 40) - 20),
                    (((seed * 5) % 50) - 25),
                    0
                ];
                const yPath = [
                    0,
                    (((seed * 2) % 50) - 25),
                    (((seed * 4) % 60) - 30),
                    (((seed * 6) % 40) - 20),
                    0
                ];
                return (
                    <motion.div
                        key={index}
                        className="absolute"
                        style={{ left: item.startX, top: item.startY }}
                        animate={{
                            x: [0, ((seed % 80) - 40), (((seed * 3) % 60) - 30), (((seed * 5) % 80) - 40), 0], // More drift
                            y: [0, (((seed * 2) % 60) - 30), (((seed * 4) % 80) - 40), (((seed * 6) % 60) - 30), 0], // More drift
                            rotate: [0, (seed % 15) - 7, ((seed * 2) % 12) - 6, (seed % 10) - 5, 0], // Subtler rotation
                            opacity: [0.2, 0.5, 0.3, 0.6, 0.2], // Pulsating opacity
                            scale: [1, 1.1, 0.95, 1.05, 1], // Breathing effect like orbs
                        }}
                        transition={{
                            duration: item.duration * 1.5, // Slower movement (30-50s)
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}            >
                        {item.type === 'icon' && item.icon && (
                            <div className={`p-2 rounded-lg ${item.bg} border border-white/10 backdrop-blur-sm`}>
                                <item.icon className={`w-4 h-4 ${item.color}`} />
                            </div>
                        )}
                        {item.type === 'whatsapp' && (
                            <div className="p-2 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 backdrop-blur-sm">
                                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                            </div>
                        )}
                        {item.type === 'logo' && (
                            <div className="px-2 py-1 rounded-md bg-primary/10 border border-primary/20 backdrop-blur-sm">
                                <LogoA className="text-sm" />
                            </div>
                        )}
                    </motion.div>
                );
            })}
        </div >
    );
};

export const GlowOrbs = () => {
    return (
        <>
            {/* Primary glow orbs */}
            <motion.div
                className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary/20 blur-3xl"
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.3, 0.2],
                    x: [0, 30, 0],
                    y: [0, -20, 0],
                }}
                transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
            <motion.div
                className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-primary/15 blur-3xl"
                animate={{
                    scale: [1.2, 1, 1.2],
                    opacity: [0.15, 0.25, 0.15],
                    x: [0, -40, 0],
                    y: [0, 30, 0],
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
            <motion.div
                className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-green-500/10 blur-3xl"
                animate={{
                    x: [0, 80, -30, 50, 0],
                    y: [0, -50, 40, -30, 0],
                    opacity: [0.1, 0.2, 0.15, 0.2, 0.1],
                }}
                transition={{
                    duration: 18,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
            {/* WhatsApp green glow - wandering */}
            <motion.div
                className="absolute top-1/4 right-1/4 w-40 h-40 rounded-full bg-[#25D366]/15 blur-3xl"
                animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.1, 0.2, 0.1],
                    x: [0, -60, 40, 0],
                    y: [0, 40, -30, 0],
                }}
                transition={{
                    duration: 14,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
            {/* Additional wandering orb */}
            <motion.div
                className="absolute bottom-1/3 left-1/4 w-32 h-32 rounded-full bg-blue-500/10 blur-3xl"
                animate={{
                    x: [0, 50, -40, 30, 0],
                    y: [0, -40, 50, -20, 0],
                    opacity: [0.08, 0.15, 0.1, 0.15, 0.08],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
        </>
    );
};
