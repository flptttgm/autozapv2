import { Link } from "react-router-dom";
import { Instagram, Linkedin, Lock, Shield, ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";

const PublicFooter = () => {
  return (
    <footer className="bg-secondary/50 border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Logo and Description */}
          <div className="space-y-4">
            <Logo size="sm" />
            <p className="text-muted-foreground text-sm">
              Transformando o atendimento ao cliente com inteligência artificial.
            </p>
            <p className="text-muted-foreground text-xs">
              <span className="font-medium">Appi Company</span>
              <br />
              CNPJ: 62.570.507/0001-38
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Produto</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/#features" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Recursos
                </Link>
              </li>
              <li>
                <Link to="/#pricing" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Preços
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Empresa</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/sobre" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Sobre
                </Link>
              </li>
              <li>
                <a href="mailto:contato@appicompany.com" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Contato
                </a>
              </li>
              <li>
                <a 
                  href="https://crm-appi-company.lovable.app/suporte-publico" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Suporte
                </a>
              </li>
              <li>
                <Link to="/vendedores" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Seja um Vendedor
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/termos-de-uso" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/politica-de-privacidade" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/politica-de-cookies" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Política de Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Security Seals Section */}
        <div className="border-t border-border pt-6 pb-6">
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">Dados Criptografados</p>
                <p>SSL/TLS 256-bit</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">Conforme LGPD</p>
                <p>Lei 13.709/2018</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">Pagamento Seguro</p>
                <p>Asaas Certificado</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-border pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Appi AutoZap. Todos os direitos reservados.
          </p>
          <div className="flex gap-4">
            <a href="https://www.instagram.com/appiautozap/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Instagram className="w-5 h-5" />
            </a>
            <a href="https://www.linkedin.com/company/appicompany" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
