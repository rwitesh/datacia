import { lazy, Suspense } from "react";
import "./App.css";
import { ThemeProvider } from "@/components/theme";
import { Routes, Route, HashRouter } from "react-router";
import { HostKeyProvider } from "@/shared/HostKey/HostKeyProvider";
import { Home } from "@/windows/connection/Home";
import { DatabaseConnection } from "@/windows/connection/Connection";
import { WelcomePanel } from "@/windows/connection/WelcomePanel";
import { AppProvider } from "@/context/app/Provider";
import { Toaster } from "sonner";
import { EditorProvider } from "@/context/editor/Provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Each window only loads the route it shows.
const Editor = lazy(() => import("@/windows/editor/Editor").then((m) => ({ default: m.Editor })));
const Settings = lazy(() => import("@/windows/settings/Settings").then((m) => ({ default: m.Settings })));

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <ThemeProvider>
          <HostKeyProvider>
            <HashRouter basename="/">
              <div className="h-screen w-screen flex flex-col overflow-hidden">
                <Toaster position="top-center" richColors closeButton />
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/" element={<Home />}>
                      <Route index element={<WelcomePanel />} />
                      <Route path="connect" element={<DatabaseConnection />} />
                    </Route>
                    <Route
                      path="/editor"
                      element={
                        <EditorProvider>
                          <Editor />
                        </EditorProvider>
                      }
                    />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Suspense>
              </div>
            </HashRouter>
          </HostKeyProvider>
        </ThemeProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;