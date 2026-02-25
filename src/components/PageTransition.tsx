import { motion, Transition } from "framer-motion";
import { ReactNode, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface PageTransitionProps {
  children: ReactNode;
}

// Variants defined inside component to use isMobile

export const PageTransition = ({ children }: PageTransitionProps) => {
  const isMobile = useIsMobile();
  
  // Mobile: instant exit to prevent blank pages from overlapping components
  const pageVariants = useMemo(() => ({
    initial: {
      opacity: 0,
      y: isMobile ? 0 : 10,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    exit: isMobile ? {
      opacity: 0, // Instant exit on mobile
    } : {
      opacity: 0,
      y: -10,
    },
  }), [isMobile]);
  
  const pageTransition: Transition = useMemo(() => ({
    type: "tween",
    ease: "easeOut",
    duration: isMobile ? 0.1 : 0.25, // Much faster on mobile
  }), [isMobile]);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={pageTransition}
      className="w-full h-full min-h-0"
    >
      {children}
    </motion.div>
  );
};
