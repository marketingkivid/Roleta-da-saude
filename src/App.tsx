import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Index = lazy(() => import("./pages/Index.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Leads = lazy(() => import("./pages/Leads.tsx"));
const PublicPanel = lazy(() => import("./pages/PublicPanel.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Carregando página"
    className="min-h-dvh flex items-center justify-center"
    style={{ background: '#f8f9f9' }}
  >
    <div className="space-y-4 w-64" aria-hidden="true">
      <div className="h-8 rounded-[20px] animate-pulse" style={{ background: '#E8E0EE' }} />
      <div className="h-4 rounded-[20px] w-3/4 animate-pulse" style={{ background: '#E8E0EE' }} />
    </div>
    <span className="sr-only">Carregando página…</span>
  </div>
);


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* /admin = painel público (só números, protegido por código) */}
            <Route path="/admin" element={<PublicPanel />} />
            {/* /gestao = backoffice real (login) — criar/editar campanhas, leads, exportação */}
            <Route path="/gestao" element={<Admin />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/:slug" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
