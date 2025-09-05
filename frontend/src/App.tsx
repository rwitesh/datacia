import "./App.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
// ⬇️ use react-router-dom
import { Routes, Route, HashRouter } from "react-router";
import { Home } from "@/modules/Home/Home";
import { ClickhouseConnection } from "@/modules/Connection/Databases/Clickhouse";
import { Editor } from "@/modules/Editor/Editor";
import { AppProvider } from "./modules/Context/App/Provider";
import { NavigationBar } from "./modules/NavigationBar/NavigationBar";
import { Toaster } from "sonner";
import { EditorProvider } from "./modules/Context/Editor/Provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AppProvider>
          <HashRouter basename="/">
            <div className="h-screen w-screen flex flex-col overflow-hidden">
              <div className="shrink-0">
                <NavigationBar />
              </div>
              <Toaster position="top-center" richColors closeButton />
              <div className="flex-1 overflow-hidden">
                <Routes>
                  <Route path="/" element={<Home />}>
                    <Route
                      path="connect/clickhouse"
                      element={<ClickhouseConnection />}
                    />
                  </Route>

                  <Route
                    path="/editor"
                    element={
                      <EditorProvider>
                        <Editor />
                      </EditorProvider>
                    }
                  />
                </Routes>
              </div>
            </div>
          </HashRouter>
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
