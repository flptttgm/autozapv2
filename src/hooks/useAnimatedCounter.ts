import { useEffect, useState, useRef } from "react";

interface UseAnimatedCounterOptions {
  end: number;
  duration?: number;
  startOnMount?: boolean;
}

export function useAnimatedCounter({
  end,
  duration = 1.5,
  startOnMount = true,
}: UseAnimatedCounterOptions) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!startOnMount || hasStarted) return;

    // Small delay to ensure component is mounted
    const startDelay = setTimeout(() => {
      setHasStarted(true);
    }, 100);

    return () => clearTimeout(startDelay);
  }, [startOnMount, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);

      // Easing function for smooth animation (easeOutQuart)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, hasStarted]);

  return { count, ref };
}