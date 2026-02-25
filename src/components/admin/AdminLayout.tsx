import { ReactNode, useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Shield } from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar fixa em desktop */}
      {!isMobile && <AdminSidebar />}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header mobile com drawer */}
        {isMobile && (
          <header className="sticky top-0 z-40 p-4 border-b border-border bg-card flex items-center gap-4">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <AdminSidebar onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2 text-primary">
              <Shield className="h-5 w-5" />
              <span className="font-bold">Admin Panel</span>
            </div>
          </header>
        )}
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
