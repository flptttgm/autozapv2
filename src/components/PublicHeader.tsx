import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Menu, X, Sun, Moon, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";

const PublicHeader = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <Logo size="md" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/#features" className="text-muted-foreground hover:text-foreground transition-colors">
            Recursos
          </Link>
          <Link to="/#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
            Preços
          </Link>
          <Link to="/blog" className="text-muted-foreground hover:text-foreground transition-colors">
            Blog
          </Link>
          <Link to="/afiliados" className="text-muted-foreground hover:text-foreground transition-colors">
            Afiliados
          </Link>
          <Link to="/sobre" className="text-muted-foreground hover:text-foreground transition-colors">
            Sobre
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-muted-foreground hover:text-foreground" />
            ) : (
              <Moon className="w-5 h-5 text-muted-foreground hover:text-foreground" />
            )}
          </button>
          <Link to="/auth">
            <Button variant="ghost">Entrar</Button>
          </Link>
          <Link to="/auth">
            <Button className="bg-primary hover:bg-primary/90">
              Começar Grátis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border p-4">
          <nav className="flex flex-col gap-4">
            <Link 
              to="/#features" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Recursos
            </Link>
            <Link 
              to="/#pricing" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Preços
            </Link>
            <Link 
              to="/blog" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Blog
            </Link>
            <Link 
              to="/afiliados" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Afiliados
            </Link>
            <Link 
              to="/sobre" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sobre
            </Link>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-5 h-5" />
                  Modo Claro
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5" />
                  Modo Escuro
                </>
              )}
            </button>
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                Entrar
              </Button>
            </Link>
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-primary hover:bg-primary/90">Começar Grátis</Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;
