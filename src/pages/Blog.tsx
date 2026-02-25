import { Link } from "react-router-dom";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PublicHeader from "@/components/PublicHeader";
import SEOHead from "@/components/SEOHead";
import SchemaOrg from "@/components/SchemaOrg";
import { blogPosts } from "@/data/blogPosts";

const Blog = () => {
  return (
    <div className="min-h-screen bg-background font-funnel">
      <SEOHead
        title="Blog AutoZap - Dicas de Automação de WhatsApp, Chatbots e IA"
        description="Artigos sobre automação de WhatsApp, chatbots com IA, vendas pelo WhatsApp e atendimento automático. Aprenda a escalar seu negócio."
        url="https://appiautozap.com/blog"
        type="website"
        keywords="blog automação whatsapp, dicas chatbot, whatsapp business, atendimento automático, ia whatsapp"
      />
      <SchemaOrg
        schema={{
          type: "WebSite",
          name: "Blog AutoZap",
          url: "https://appiautozap.com/blog",
          description: "Dicas, tutoriais e novidades sobre automação, atendimento ao cliente e WhatsApp Business",
        }}
      />
      <PublicHeader />
      
      <div className="container mx-auto px-4 py-12 max-w-6xl pt-24">
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">Blog</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Dicas, tutoriais e novidades sobre automação, atendimento ao cliente e WhatsApp Business
          </p>
        </div>

        {/* Featured Post */}
        <Link to={`/blog/${blogPosts[0].slug}`}>
          <Card className="mb-12 overflow-hidden border-border bg-card hover:shadow-lg transition-shadow duration-300 group">
            <div className="md:flex">
              <div className="md:w-1/2 overflow-hidden">
                <img
                  src={blogPosts[0].image}
                  alt={blogPosts[0].title}
                  className="w-full h-64 md:h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
                <Badge variant="secondary" className="w-fit mb-4">
                  {blogPosts[0].category}
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors">
                  {blogPosts[0].title}
                </h2>
                <p className="text-muted-foreground mb-6">{blogPosts[0].excerpt}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {blogPosts[0].date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {blogPosts[0].readTime}
                  </span>
                </div>
                <Button className="w-fit">
                  Ler artigo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        </Link>

        {/* Posts Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogPosts.slice(1).map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`}>
              <Card className="overflow-hidden border-border bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group h-full">
                <div className="relative overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <Badge 
                    variant="secondary" 
                    className="absolute top-4 left-4"
                  >
                    {post.category}
                  </Badge>
                </div>
                <CardHeader className="pb-2">
                  <h3 className="text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="text-muted-foreground text-sm line-clamp-2">{post.excerpt}</p>
                </CardContent>
                <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.readTime}
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Blog;
