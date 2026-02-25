import React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export const OnboardingProgress = ({ currentStep, totalSteps }: OnboardingProgressProps) => {
  return (
    <div className="flex items-center justify-center">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <React.Fragment key={index}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300
                ${isCompleted 
                  ? 'bg-primary text-primary-foreground' 
                  : isCurrent 
                    ? 'bg-primary/20 text-primary border-2 border-primary' 
                    : 'bg-muted text-muted-foreground'
                }
              `}
            >
              {isCompleted ? (
                <Check className="w-5 h-5" />
              ) : (
                stepNumber
              )}
              {isCurrent && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ opacity: 0.3 }}
                />
              )}
            </motion.div>
            
            {index < totalSteps - 1 && (
              <div className={`relative z-0 w-14 h-1 -mx-1 rounded-full transition-colors duration-300 ${
                isCompleted ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
