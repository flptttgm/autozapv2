import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TypingHeadlineProps {
    staticText: string;
    dynamicWords: string[];
    className?: string;
    highlightClass?: string;
}

export const TypingHeadline = ({
    staticText,
    dynamicWords,
    className = "",
    highlightClass = "text-[#00ff88]",
}: TypingHeadlineProps) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);

    useEffect(() => {
        const word = dynamicWords[currentIndex];

        if (isWaiting) {
            const waitTimer = setTimeout(() => {
                setIsWaiting(false);
                setIsDeleting(true);
            }, 2000);
            return () => clearTimeout(waitTimer);
        }

        if (isDeleting) {
            if (displayedText.length === 0) {
                setIsDeleting(false);
                setCurrentIndex((prev) => (prev + 1) % dynamicWords.length);
                return;
            }
            const deleteTimer = setTimeout(() => {
                setDisplayedText(displayedText.slice(0, -1));
            }, 50);
            return () => clearTimeout(deleteTimer);
        }

        if (displayedText.length < word.length) {
            const typeTimer = setTimeout(() => {
                setDisplayedText(word.slice(0, displayedText.length + 1));
            }, 100);
            return () => clearTimeout(typeTimer);
        } else {
            setIsWaiting(true);
        }
    }, [displayedText, isDeleting, isWaiting, currentIndex, dynamicWords]);

    return (
        <h1 className={className}>
            {staticText}{" "}
            <span className={highlightClass}>
                <AnimatePresence mode="wait">
                    <motion.span
                        key={displayedText}
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 1 }}
                        className="inline-block"
                    >
                        {displayedText}
                    </motion.span>
                </AnimatePresence>
                <motion.span
                    className="inline-block w-[3px] h-[0.9em] bg-current ml-1 align-middle"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
                />
            </span>
        </h1>
    );
};

export default TypingHeadline;
