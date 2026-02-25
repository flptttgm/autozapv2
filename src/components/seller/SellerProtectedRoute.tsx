import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSeller } from "@/hooks/useSeller";
import { Loader2 } from "lucide-react";

interface SellerProtectedRouteProps {
  children: React.ReactNode;
}

export function SellerProtectedRoute({ children }: SellerProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isSeller, isCheckingRole, seller, isLoadingSeller } = useSeller();

  // Show loading while checking auth and seller status
  if (authLoading || isCheckingRole || (isSeller && isLoadingSeller)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated - redirect to seller login
  if (!user) {
    return <Navigate to="/vendedores/login" replace />;
  }

  // Not a seller - redirect to seller landing
  if (!isSeller) {
    return <Navigate to="/vendedores" replace />;
  }

  // Seller is suspended or pending
  if (seller && seller.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold mb-4">Conta {seller.status === 'pending' ? 'Pendente' : 'Suspensa'}</h1>
          <p className="text-muted-foreground">
            {seller.status === 'pending' 
              ? 'Sua conta de vendedor está aguardando aprovação. Você será notificado por email quando for aprovada.'
              : 'Sua conta de vendedor foi suspensa. Entre em contato com o suporte para mais informações.'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
