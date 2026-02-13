import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Gallery from "./pages/Gallery";
import Login from "./pages/Login";
import { About, Impressum } from "./pages/Static.jsx";
import { I18nProvider, useI18n } from "./i18n";
import { Toaster } from "./components/ui/toaster";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { AdminProvider, useAdmin } from "./context/AdminContext";
import { Card } from "./components/ui/card";
import { Image, User, FileText } from "lucide-react";
import AdminDashboard from "./pages/AdminDashboard";
import { trackEvent } from "./lib/api";

import "./App.css";

function AppHeader() {
  const { lang, setLang, languages, t } = useI18n();
  const { isAdmin, logout } = useAdmin();

  return (
    <div className="border-b">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-bold heading-serif hover:opacity-80 transition-opacity">
            {t("app.title")}
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">{t("nav.gallery")}</Link>
            <Link to="/about" className="hover:text-foreground">{t("nav.about")}</Link>
            <Link to="/impressum" className="hover:text-foreground">{t("nav.impressum")}</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button className="text-sm underline" onClick={logout}>
              Logout (Admin)
            </button>
          )}

          <span className="text-sm text-muted-foreground hidden sm:block">{t("nav.language")}:</span>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l} value={l} className="uppercase">
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function TopCardNav() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/">
          <Card className="p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <Image className="h-5 w-5" />
            <div>
              <div className="font-medium">{t("nav.gallery")}</div>
              <div className="text-xs text-muted-foreground">{t("nav.gallery_sub")}</div>
            </div>
          </Card>
        </Link>
        <Link to="/about">
          <Card className="p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <User className="h-5 w-5" />
            <div>
              <div className="font-medium">{t("nav.about")}</div>
              <div className="text-xs text-muted-foreground">{t("nav.about_sub")}</div>
            </div>
          </Card>
        </Link>
        <Link to="/impressum">
          <Card className="p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <FileText className="h-5 w-5" />
            <div>
              <div className="font-medium">{t("nav.impressum")}</div>
              <div className="text-xs text-muted-foreground">{t("nav.impressum_sub")}</div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function RouteTracker() {
  const loc = useLocation();
  useEffect(() => {
    trackEvent("pageview", { path: loc.pathname });
  }, [loc.pathname]);
  return null;
}

function AppInner() {
  // Secret shortcut: Ctrl+Alt+L -> /login
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "l") {
        window.location.assign("/login");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <BrowserRouter>
      <AppHeader />
      <TopCardNav />
      <RouteTracker />
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/about" element={<About />} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <I18nProvider>
        <AdminProvider>
          <AppInner />
        </AdminProvider>
      </I18nProvider>
    </div>
  );
}

export default App;
