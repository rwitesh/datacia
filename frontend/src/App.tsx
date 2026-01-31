import "./App.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Routes, Route, HashRouter } from "react-router";
import { Home } from "@/windows/connection/Home";
import { DatabaseConnection } from "@/windows/connection/Connection";
import { WelcomePanel } from "@/windows/connection/WelcomePanel";
import { Editor } from "@/windows/editor/Editor";
import { License } from "@/windows/license/License";
import { Settings } from "@/windows/settings/Settings";
import { AppProvider } from "@/context/app/Provider";
import { Toaster } from "sonner";
import { EditorProvider } from "@/context/editor/Provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AppProvider>
          <HashRouter basename="/">
            <div className="h-screen w-screen flex flex-col overflow-hidden">
              <Toaster position="top-center" richColors closeButton />
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
                <Route path="/license" element={<License />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </HashRouter>
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;