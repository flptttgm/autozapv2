import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MessageSquare, BarChart3, LogIn, Users, MessagesSquare } from 'lucide-react';
import { LandingAIDemo } from './LandingAIDemo';

// Import screenshots
import dashboardImg from '@/assets/carousel/dashboard.png';
import loginImg from '@/assets/carousel/login.png';
import chatImg from '@/assets/carousel/chat.png';
import leadsImg from '@/assets/carousel/leads.png';

interface SlideData {
    id: string;
    label: string;
    icon: React.ElementType;
    type: 'component' | 'image';
    image?: string;
    alt?: string;
}

export const DemoCarousel = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [autoplay, setAutoplay] = useState(true);

    const slides: SlideData[] = [
        {
            id: 'ai-demo',
            label: 'Chat com IA',
            icon: MessageSquare,
            type: 'component',
        },
        {
            id: 'login',
            label: 'Cadastro',
            icon: LogIn,
            type: 'image',
            image: loginImg,
            alt: 'Tela de cadastro simples',
        },
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: BarChart3,
            type: 'image',
            image: dashboardImg,
            alt: 'Dashboard com métricas e gráficos',
        },
        {
            id: 'chat',
            label: 'Conversas',
            icon: MessagesSquare,
            type: 'image',
            image: chatImg,
            alt: 'Interface de chat com clientes',
        },
        {
            id: 'leads',
            label: 'Leads',
            icon: Users,
            type: 'image',
            image: leadsImg,
            alt: 'Gestão de leads e clientes',
        },
    ];

    // Autoplay
    useEffect(() => {
        if (!autoplay) return;
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % slides.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [autoplay, slides.length]);

    const goToSlide = (index: number) => {
        setAutoplay(false);
        setActiveIndex(index);
    };

    const goNext = () => {
        setAutoplay(false);
        setActiveIndex((prev) => (prev + 1) % slides.length);
    };

    const goPrev = () => {
        setAutoplay(false);
        setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
    };

    const currentSlide = slides[activeIndex];

    return (
        <div className="relative">
            {/* Carousel Content */}
            <div className="relative overflow-hidden rounded-2xl">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide.id}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                    >
                        {currentSlide.type === 'component' ? (
                            <LandingAIDemo />
                        ) : (
                            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-border/50 bg-zinc-900">
                                <img
                                    src={currentSlide.image}
                                    alt={currentSlide.alt || ''}
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/10 to-transparent" />
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Arrows */}
            <button
                onClick={goPrev}
                className="absolute -left-4 md:-left-16 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors z-10"
                aria-label="Slide anterior"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <button
                onClick={goNext}
                className="absolute -right-4 md:-right-16 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors z-10"
                aria-label="Próximo slide"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            {/* Tab Navigation - Scrollable on mobile */}
            <div className="flex justify-start md:justify-center gap-2 mt-6 overflow-x-auto pb-2 px-1 -mx-1">
                {slides.map((slide, index) => (
                    <button
                        key={slide.id}
                        onClick={() => goToSlide(index)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs md:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${activeIndex === index
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                            }`}
                    >
                        <slide.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        {slide.label}
                    </button>
                ))}
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center gap-1.5 mt-4">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`h-1.5 rounded-full transition-all ${activeIndex === index
                            ? 'w-6 bg-primary'
                            : 'w-1.5 bg-border hover:bg-muted-foreground'
                            }`}
                        aria-label={`Ir para slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default DemoCarousel;
