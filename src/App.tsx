import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Tasks from "./pages/Tasks.tsx";
import Duplicates from "./pages/Duplicates.tsx";
import Meetings from "./pages/Meetings.tsx";
import Deals from "./pages/Deals.tsx";
import AeTasks from "./pages/AeTasks.tsx";
import { CompanyDataProvider } from "@/hooks/useCompanyData";
import { GlobalHeader } from "@/components/GlobalHeader";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CompanyDataProvider>
          <GlobalHeader />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/duplicates" element={<Duplicates />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/ae-tasks" element={<AeTasks />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CompanyDataProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
