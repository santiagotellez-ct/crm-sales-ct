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
import Login from "./pages/Login.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import { CompanyDataProvider } from "@/hooks/useCompanyData";
import { GlobalHeader } from "@/components/GlobalHeader";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <CompanyDataProvider>
                    <GlobalHeader />
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/tasks" element={<Tasks />} />
                      <Route path="/duplicates" element={<Duplicates />} />
                      <Route path="/meetings" element={<Meetings />} />
                      <Route path="/deals" element={<Deals />} />
                      <Route path="/ae-tasks" element={<AeTasks />} />
                      <Route
                        path="/admin/users"
                        element={
                          <AdminRoute>
                            <AdminUsers />
                          </AdminRoute>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </CompanyDataProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
