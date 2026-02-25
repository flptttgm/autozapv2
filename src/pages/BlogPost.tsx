import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, User, Share2, Facebook, Twitter, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import PublicHeader from "@/components/PublicHeader";
import SEOHead from "@/components/SEOHead";
import SchemaOrg from "@/components/SchemaOrg";
import DOMPurify from "dompurify";
import { getPostBySlug, getRelatedPosts } from "@/data/blogPosts";

const BlogPost = () => {
  const { slug } = useParams();
  const post = slug ? getPostBySlug(slug) : undefined;
  const relatedPosts = slug ? getRelatedPosts(slug, 3) : [];

  if (!post) {
    return (
      <div className="min-h-screen bg-background font-funnel">
        <PublicHeader />
        <div className="flex items-center justify-center pt-32">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Artigo não encontrado</h1>
            <Link to="/blog">
              <Button>Voltar ao Blog</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const postUrl = `https://appiautozap.com/blog/${post.slug}`;

  return (
    <div className="min-h-screen bg-background font-funnel">
      <SEOHead
        title={`${post.title} | AutoZap Blog`}
        description={post.excerpt}
        image={post.image}
        url={postUrl}
        type="article"
        publishedTime={post.dateISO}
        author={post.author}
        section={post.category}
      />
      <SchemaOrg
        schema={{
          type: "BlogPosting",
          title: post.title,
          description: post.excerpt,
          image: post.image,
          datePublished: post.dateISO,
          author: post.author,
          url: postUrl,
        }}
      />
      <SchemaOrg
        schema={{
          type: "BreadcrumbList",
          items: [
            { name: "Home", url: "https://appiautozap.com" },
            { name: "Blog", url: "https://appiautozap.com/blog" },
            { name: post.title, url: postUrl },
          ],
        }}
      />
      <PublicHeader />
      
      {/* Breadcrumb */}
      <div className="bg-secondary/30 border-b border-border pt-20">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <Link to="/blog" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Blog
          </Link>
        </div>
      </div>

      {/* Hero Image */}
      <div className="w-full h-64 md:h-96 overflow-hidden">
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <article className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Meta */}
        <div className="mb-8">
          <Badge variant="secondary" className="mb-4">
            {post.category}
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {post.date}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {post.readTime} de leitura
            </span>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Article Content */}
        <div 
          className="prose-blog"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
        />

        <Separator className="my-12" />

        {/* Share */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Share2 className="w-5 h-5" />
            <span>Compartilhar:</span>
          </div>
          <div className="flex gap-2">
            <a 
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="icon" className="rounded-full">
                <Facebook className="w-4 h-4" />
              </Button>
            </a>
            <a 
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="icon" className="rounded-full">
                <Twitter className="w-4 h-4" />
              </Button>
            </a>
            <a 
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="icon" className="rounded-full">
                <Linkedin className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>

        <Separator className="my-12" />

        {/* Related Posts */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Artigos Relacionados</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {relatedPosts.map((related) => (
              <Link key={related.id} to={`/blog/${related.slug}`}>
                <Card className="overflow-hidden border-border bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="relative overflow-hidden">
                    <img
                      src={related.image}
                      alt={related.title}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                  <CardHeader className="pb-2">
                    <Badge variant="secondary" className="w-fit mb-2 text-xs">
                      {related.category}
                    </Badge>
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2">
                      {related.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {related.readTime}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 bg-primary/10 rounded-2xl p-8 text-center border border-primary/30">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Pronto para automatizar seu atendimento?
          </h2>
          <p className="text-muted-foreground mb-6">
            Comece gratuitamente e veja os resultados na primeira semana.
          </p>
          <Link to="/auth">
            <Button size="lg">
              Começar Grátis
            </Button>
          </Link>
        </div>
      </article>
    </div>
  );
};

export default BlogPost;
