import { cn } from "@/lib/utils";

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showBeta?: boolean;
}

const Logo = ({ size = 'md', className, showBeta = true }: LogoProps) => {
  const sizes = {
    sm: { main: 'text-[26px]', prefix: 'text-[16px]', badge: 'text-[8px]' },
    md: { main: 'text-[31px]', prefix: 'text-[19px]', badge: 'text-[9px]' },
    lg: { main: 'text-[40px]', prefix: 'text-[24px]', badge: 'text-[10px]' },
  };

  return (
    <span className={cn("font-funnel font-semibold inline-flex items-baseline", className)}>
      <span className={cn(sizes[size].prefix, "text-primary/90 font-bold")}>
        {"{a}"}
      </span>
      <span className={cn(sizes[size].main, "text-foreground")}>
        AutoZap
      </span>
      {showBeta && (
        <span
          className={cn(
            sizes[size].badge,
            "ml-1 px-1 py-0.5 rounded",
            "bg-primary/10 text-primary font-medium uppercase",
            "self-start -mt-1"
          )}
        >
          beta
        </span>
      )}
    </span>
  );
};

export default Logo;
