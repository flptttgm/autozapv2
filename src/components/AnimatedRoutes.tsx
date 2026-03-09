import { Routes, Route } from "react-router-dom";

import { lazy, Suspense } from "react";
import { PageTransition } from "./PageTransition";
import Layout from "./Layout";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminProtectedRoute } from "./admin/AdminProtectedRoute";
import { SellerProtectedRoute } from "./seller/SellerProtectedRoute";
import { PageSkeleton, DashboardSkeleton } from "./PageSkeleton";


// Critical pages - Auth only (Landing now lazy loaded for performance)
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

// Landing page - nova versão leve e focada em conversão
const LandingNew = lazy(() => import("@/pages/LandingNew"));
// Landing antiga mantida para rollback se necessário
const LandingOld = lazy(() => import("@/pages/Landing"));

// Lazy loaded pages - Dashboard group
const Index = lazy(() => import("@/pages/Index"));
const Leads = lazy(() => import("@/pages/Leads"));
const LeadDetails = lazy(() => import("@/pages/LeadDetails"));
const Conversations = lazy(() => import("@/pages/Conversations"));
const Appointments = lazy(() => import("@/pages/Appointments"));
const Settings = lazy(() => import("@/pages/Settings"));
const AISettings = lazy(() => import("@/pages/AISettings"));
const WhatsApp = lazy(() => import("@/pages/WhatsApp"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Statistics = lazy(() => import("@/pages/Statistics"));
const Quotes = lazy(() => import("@/pages/Quotes"));
const Referral = lazy(() => import("@/pages/Referral"));
const ProspectLeads = lazy(() => import("@/pages/ProspectLeads"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const Workspaces = lazy(() => import("@/pages/Workspaces"));

// Lazy loaded pages - Auth/Onboarding group
const AuthVerify = lazy(() => import("@/pages/AuthVerify"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const MemberOnboarding = lazy(() => import("@/pages/MemberOnboarding"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));

// Lazy loaded pages - Subscription group
const Plans = lazy(() => import("@/pages/Plans"));
const Checkout = lazy(() => import("@/pages/Checkout"));

// Lazy loaded pages - Static/Legal group
const TermsOfUse = lazy(() => import("@/pages/TermsOfUse"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const About = lazy(() => import("@/pages/About"));
const CookiesPolicy = lazy(() => import("@/pages/CookiesPolicy"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const CalendarCallback = lazy(() => import("@/pages/CalendarCallback"));
const Affiliates = lazy(() => import("@/pages/Affiliates"));

// Lazy loaded pages - Seller group
const SellerLanding = lazy(() => import("@/pages/SellerLanding"));
const SellerAuth = lazy(() => import("@/pages/SellerAuth"));
const SellerDashboard = lazy(() => import("@/pages/SellerDashboard"));

// Lazy loaded pages - Admin group
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminLogs = lazy(() => import("@/pages/admin/AdminLogs"));
const AdminLogins = lazy(() => import("@/pages/admin/AdminLogins"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/AdminSubscriptions"));
const AdminWhatsApp = lazy(() => import("@/pages/admin/AdminWhatsApp"));
const AdminWhatsAppMessages = lazy(() => import("@/pages/admin/AdminWhatsAppMessages"));
const AdminPayments = lazy(() => import("@/pages/admin/AdminPayments"));
const AdminNotifications = lazy(() => import("@/pages/admin/AdminNotifications"));
const AdminEmailAutomations = lazy(() => import("@/pages/admin/AdminEmailAutomations"));
const AdminReferrals = lazy(() => import("@/pages/admin/AdminReferrals"));
const AdminCoupons = lazy(() => import("@/pages/admin/AdminCoupons"));
const AdminSellers = lazy(() => import("@/pages/admin/AdminSellers"));
const AdminDebug = lazy(() => import("@/pages/admin/AdminDebug"));

// Route preloaders for prefetching on mobile
export const routePreloaders: Record<string, () => Promise<any>> = {
  '/conversations': () => import("@/pages/Conversations"),
  '/leads': () => import("@/pages/Leads"),
  '/appointments': () => import("@/pages/Appointments"),
  '/quotes': () => import("@/pages/Quotes"),
  '/dashboard': () => import("@/pages/Index"),
  '/settings': () => import("@/pages/Settings"),
  '/whatsapp': () => import("@/pages/WhatsApp"),
  '/notifications': () => import("@/pages/Notifications"),
};

export const AnimatedRoutes = () => {
  const routesContent = (
    <Routes>
      {/* Landing - nova versão leve focada em conversão */}
      <Route
        path="/"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <LandingNew />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/auth"
        element={
          <PageTransition>
            <Auth />
          </PageTransition>
        }
      />

      {/* Auth group */}
      <Route
        path="/auth/verify"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <AuthVerify />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute skipOnboardingCheck skipTrialCheck>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <Onboarding />
              </PageTransition>
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/member-onboarding"
        element={
          <ProtectedRoute skipOnboardingCheck skipTrialCheck>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <MemberOnboarding />
              </PageTransition>
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Dashboard routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Index />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Leads />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/prospect"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <ProspectLeads />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Invoices />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <LeadDetails />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/conversations"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Conversations />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Appointments />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/whatsapp"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <WhatsApp />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Settings />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspaces"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Workspaces />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-settings"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <AISettings />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Notifications />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/estatisticas"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <Statistics />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/indicacao"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Referral />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotes"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<DashboardSkeleton />}>
                <PageTransition>
                  <Quotes />
                </PageTransition>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Subscription routes */}
      <Route
        path="/plans"
        element={
          <ProtectedRoute skipTrialCheck>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <Plans />
              </PageTransition>
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkout"
        element={
          <ProtectedRoute skipTrialCheck>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <Checkout />
              </PageTransition>
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Static/Legal routes */}
      <Route
        path="/accept-invite"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <AcceptInvite />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/calendar-callback"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <CalendarCallback />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/termos-de-uso"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <TermsOfUse />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/politica-de-privacidade"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <PrivacyPolicy />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/sobre"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <About />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/politica-de-cookies"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <CookiesPolicy />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/blog"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <Blog />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/blog/:slug"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <BlogPost />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/afiliados"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <Affiliates />
            </PageTransition>
          </Suspense>
        }
      />

      {/* Seller Routes */}
      <Route
        path="/vendedores"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <SellerLanding />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/vendedores/login"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PageTransition>
              <SellerAuth />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/vendedores/dashboard"
        element={
          <SellerProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <SellerDashboard />
              </PageTransition>
            </Suspense>
          </SellerProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminDashboard />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminUsers />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/logs"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminLogs />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/subscriptions"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminSubscriptions />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/whatsapp"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminWhatsApp />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/whatsapp-messages"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminWhatsAppMessages />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/payments"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminPayments />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminNotifications />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/email-automations"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminEmailAutomations />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/referrals"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminReferrals />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/logins"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminLogins />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/coupons"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminCoupons />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/sellers"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminSellers />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/debug"
        element={
          <AdminProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <PageTransition>
                <AdminDebug />
              </PageTransition>
            </Suspense>
          </AdminProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <PageTransition>
            <NotFound />
          </PageTransition>
        }
      />
    </Routes>
  );

  // AnimatePresence removed - it was causing pages to not load when combined
  // with key on Routes. Individual PageTransition components handle their own
  // enter animations (fade-in) which is sufficient for smooth page transitions.
  return routesContent;
};
