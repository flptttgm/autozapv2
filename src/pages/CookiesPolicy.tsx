import { Cookie } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const CookiesPolicy = () => {
  return (
    <div className="min-h-screen bg-background font-funnel">
      <PublicHeader />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <Cookie className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Política de Cookies</h1>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            <p className="text-muted-foreground text-lg">
              Última atualização: Janeiro de 2025
            </p>

            {/* Company Info Section */}
            <section className="bg-secondary/50 p-6 rounded-lg border border-border space-y-2">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Controlador de Dados:</strong> Appi Company
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">CNPJ:</strong> 62.570.507/0001-38
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Encarregado de Proteção de Dados (DPO):</strong>{" "}
                <a href="mailto:contato@appicompany.com" className="text-primary hover:underline">
                  contato@appicompany.com
                </a>
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">O que são Cookies?</h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies são pequenos arquivos de texto que são armazenados no seu dispositivo quando você visita nosso site. 
                Eles nos ajudam a proporcionar uma melhor experiência de navegação, lembrando suas preferências e entendendo 
                como você utiliza nossa plataforma.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Tipos de Cookies que Utilizamos</h2>
              
              <div className="space-y-6">
                <div className="bg-secondary/50 p-6 rounded-lg border border-border">
                  <h3 className="text-xl font-medium text-primary mb-2">Cookies Essenciais</h3>
                  <p className="text-muted-foreground mb-3">
                    Necessários para o funcionamento básico do site. Incluem cookies de sessão, autenticação e segurança. 
                    Sem estes cookies, o site não funcionará corretamente.
                  </p>
                  <div className="bg-background/50 rounded p-3 text-sm">
                    <p className="text-muted-foreground"><strong className="text-foreground">Exemplos:</strong></p>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                      <li><code className="text-primary">sb-*-auth-token</code> - Autenticação do usuário (Sessão)</li>
                      <li><code className="text-primary">theme</code> - Preferência de tema claro/escuro (1 ano)</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-secondary/50 p-6 rounded-lg border border-border">
                  <h3 className="text-xl font-medium text-primary mb-2">Cookies de Desempenho</h3>
                  <p className="text-muted-foreground mb-3">
                    Coletam informações sobre como você usa nosso site, como páginas visitadas e erros encontrados. 
                    Estes dados nos ajudam a melhorar o desempenho e a experiência do usuário.
                  </p>
                  <div className="bg-background/50 rounded p-3 text-sm">
                    <p className="text-muted-foreground"><strong className="text-foreground">Exemplos:</strong></p>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                      <li><code className="text-primary">_ga</code> - Google Analytics, identificação de usuário (2 anos)</li>
                      <li><code className="text-primary">_gid</code> - Google Analytics, identificação de sessão (24 horas)</li>
                      <li><code className="text-primary">_gat</code> - Google Analytics, limitação de taxa (1 minuto)</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-secondary/50 p-6 rounded-lg border border-border">
                  <h3 className="text-xl font-medium text-primary mb-2">Cookies de Funcionalidade</h3>
                  <p className="text-muted-foreground mb-3">
                    Permitem que o site lembre suas escolhas, como idioma preferido, região e personalizações da interface. 
                    Proporcionam recursos aprimorados e mais personalizados.
                  </p>
                  <div className="bg-background/50 rounded p-3 text-sm">
                    <p className="text-muted-foreground"><strong className="text-foreground">Exemplos:</strong></p>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                      <li><code className="text-primary">cookie-consent</code> - Preferências de cookies (1 ano)</li>
                      <li><code className="text-primary">pwa-dismissed</code> - Banner de instalação PWA (30 dias)</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-secondary/50 p-6 rounded-lg border border-border">
                  <h3 className="text-xl font-medium text-primary mb-2">Cookies de Marketing</h3>
                  <p className="text-muted-foreground mb-3">
                    Utilizados para rastrear visitantes em diferentes sites. A intenção é exibir anúncios relevantes 
                    e envolventes para o usuário individual, tornando-os mais valiosos para editores e anunciantes.
                  </p>
                  <div className="bg-background/50 rounded p-3 text-sm">
                    <p className="text-muted-foreground"><strong className="text-foreground">Exemplos:</strong></p>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                      <li><code className="text-primary">_fbp</code> - Facebook Pixel (90 dias)</li>
                      <li><code className="text-primary">_gcl_au</code> - Google Ads (90 dias)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Tabela Resumo de Cookies</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-muted-foreground border border-border rounded-lg overflow-hidden">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left p-3 font-semibold text-foreground">Cookie</th>
                      <th className="text-left p-3 font-semibold text-foreground">Tipo</th>
                      <th className="text-left p-3 font-semibold text-foreground">Retenção</th>
                      <th className="text-left p-3 font-semibold text-foreground">Finalidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="p-3"><code className="text-primary">sb-*-auth-token</code></td>
                      <td className="p-3">Essencial</td>
                      <td className="p-3">Sessão</td>
                      <td className="p-3">Autenticação do usuário</td>
                    </tr>
                    <tr>
                      <td className="p-3"><code className="text-primary">theme</code></td>
                      <td className="p-3">Funcionalidade</td>
                      <td className="p-3">1 ano</td>
                      <td className="p-3">Preferência de tema</td>
                    </tr>
                    <tr>
                      <td className="p-3"><code className="text-primary">_ga</code></td>
                      <td className="p-3">Desempenho</td>
                      <td className="p-3">2 anos</td>
                      <td className="p-3">Google Analytics</td>
                    </tr>
                    <tr>
                      <td className="p-3"><code className="text-primary">_gid</code></td>
                      <td className="p-3">Desempenho</td>
                      <td className="p-3">24 horas</td>
                      <td className="p-3">Google Analytics</td>
                    </tr>
                    <tr>
                      <td className="p-3"><code className="text-primary">cookie-consent</code></td>
                      <td className="p-3">Funcionalidade</td>
                      <td className="p-3">1 ano</td>
                      <td className="p-3">Preferências de consentimento</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Como Gerenciar Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                Você pode controlar e/ou excluir cookies como desejar. Você pode excluir todos os cookies que já estão 
                no seu computador e pode configurar a maioria dos navegadores para impedir que sejam colocados. No entanto, 
                se você fizer isso, talvez tenha que ajustar manualmente algumas preferências toda vez que visitar um site, 
                e alguns serviços e funcionalidades podem não funcionar.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Para gerenciar cookies no seu navegador:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong>Chrome:</strong> Configurações → Privacidade e segurança → Cookies</li>
                <li><strong>Firefox:</strong> Opções → Privacidade e Segurança → Cookies</li>
                <li><strong>Safari:</strong> Preferências → Privacidade → Gerenciar Dados do Site</li>
                <li><strong>Edge:</strong> Configurações → Cookies e permissões do site</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Cookies de Terceiros</h2>
              <p className="text-muted-foreground leading-relaxed">
                Em alguns casos, utilizamos cookies de terceiros confiáveis. Estes incluem:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Google Analytics:</strong> Para análise de uso do site e métricas de desempenho.{" "}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Política de Privacidade do Google
                  </a>
                </li>
                <li>
                  <strong>Facebook Pixel:</strong> Para medição de eficácia de campanhas publicitárias.{" "}
                  <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Política de Privacidade do Facebook
                  </a>
                </li>
                <li>
                  <strong>Supabase:</strong> Para autenticação e gerenciamento de sessão.{" "}
                  <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Política de Privacidade do Supabase
                  </a>
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Seus Direitos</h2>
              <p className="text-muted-foreground leading-relaxed">
                De acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), você tem o direito de:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Acessar os dados coletados sobre você</li>
                <li>Corrigir dados incompletos ou desatualizados</li>
                <li>Solicitar a exclusão de cookies não essenciais</li>
                <li>Revogar o consentimento para cookies de marketing e desempenho</li>
                <li>Portar seus dados para outro serviço</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Para exercer esses direitos em relação aos cookies, você pode usar as configurações do seu navegador 
                ou entrar em contato conosco. Caso não esteja satisfeito com nossa resposta, você pode apresentar 
                reclamação à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Contato</h2>
              <p className="text-muted-foreground leading-relaxed">
                Se você tiver dúvidas sobre nossa Política de Cookies, entre em contato conosco:
              </p>
              <ul className="list-none text-muted-foreground space-y-2 ml-4 mt-4">
                <li><strong>Empresa:</strong> Appi Company</li>
                <li><strong>CNPJ:</strong> 62.570.507/0001-38</li>
                <li>
                  <strong>E-mail:</strong>{" "}
                  <a href="mailto:contato@appicompany.com" className="text-primary hover:underline">
                    contato@appicompany.com
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default CookiesPolicy;
