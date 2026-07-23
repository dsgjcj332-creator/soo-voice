/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { PublicLayout } from "./components/layout/PublicLayout";
import { DashboardOverview } from "./pages/DashboardOverview";
import { KnowledgeBase } from "./pages/KnowledgeBase";
import { Settings } from "./pages/Settings";
import { Conversations } from "./pages/Conversations";
import { SuperAdminDashboard } from "./pages/SuperAdminDashboard";
import { AdminMerchants } from "./pages/admin/Merchants";
import { AdminServers } from "./pages/admin/Servers";
import { AdminSystemSettings } from "./pages/admin/SystemSettings";
import { AdminVoices } from "./pages/admin/Voices";
import { VoiceWidget } from "./components/widget/VoiceWidget";
import { LanguageProvider } from "./contexts/LanguageContext";
import { LandingPage } from "./pages/LandingPage";
import { StoreDemo } from "./pages/StoreDemo";
import { CartProvider } from "./contexts/CartContext";
import { Auth } from "./pages/Auth";
import { Integration } from "./pages/Integration";
import { Analytics } from "./pages/Analytics";
import { Notifications } from "./pages/Notifications";
import { DigitalMenu } from "./pages/DigitalMenu";
import { Billing } from "./pages/Billing";
import { WidgetStandalone } from "./pages/WidgetStandalone";
import { SettingsProvider } from "./contexts/SettingsContext";
import { KnowledgeProvider } from "./contexts/KnowledgeContext";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { OAuthInstall } from "./pages/OAuthInstall";
import { TermsOfService } from "./pages/TermsOfService";
import { Security } from "./pages/Security";
import { AboutUs } from "./pages/AboutUs";
import { SuperAdminLayout } from "./components/layout/SuperAdminLayout";
import { SuperAdminAuth } from "./pages/SuperAdminAuth";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

function AppRoutes() {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Pages with Shared Header/Footer */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/security" element={<Security />} />
          <Route path="/about" element={<AboutUs />} />
        </Route>

        <Route path="/auth" element={user ? <Navigate to="/app" /> : <Auth />} />
        <Route path="/store" element={<StoreDemo />} />
        <Route path="/widget-standalone" element={<WidgetStandalone />} />
        <Route path="/oauth/authorize" element={<OAuthInstall />} />
        <Route path="/admin-auth" element={isSuperAdmin ? <Navigate to="/admin" /> : <SuperAdminAuth />} />
        
        {/* Independent Admin Layout */}
        <Route path="/admin" element={isSuperAdmin ? <SuperAdminLayout /> : <Navigate to="/admin-auth" />}>
          <Route index element={<SuperAdminDashboard />} />
          <Route path="merchants" element={<AdminMerchants />} />
          <Route path="voices" element={<AdminVoices />} />
          <Route path="servers" element={<AdminServers />} />
          <Route path="settings" element={<AdminSystemSettings />} />
        </Route>

        <Route path="/app" element={user ? <DashboardLayout /> : <Navigate to="/auth" />}>
          <Route index element={<DashboardOverview />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="settings" element={<Settings />} />
          <Route path="integration" element={<Integration />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="digital-menu" element={<DigitalMenu />} />
          <Route path="billing" element={<Billing />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <SettingsProvider>
          <KnowledgeProvider>
            <CartProvider>
              <AppRoutes />
            </CartProvider>
          </KnowledgeProvider>
        </SettingsProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
