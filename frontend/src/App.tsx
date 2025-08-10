import "./App.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { BrowserRouter, Routes, Route } from "react-router";
import { Home } from "@/modules/Home/Home";
import { DatabaseList } from "@/modules/Connection/ConnectionList";
import { ClickhouseConnection } from "@/modules/Connection/Databases/Clickhouse";
import { Editor } from "@/modules/Editor/Editor";
import { ConnectionLayout } from "@/modules/Connection/Layout";
import { AppProvider } from "./modules/Context/AppContext";
import { NavigationBar } from "./modules/NavigationBar/NavigationBar";
import { Toaster } from "sonner";
import { EditorProvider } from "./modules/Context/EditorContext";
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'

const queryClient = new QueryClient({
  // defaultOptions: {
  //   queries: {
  //     refetchOnWindowFocus: false,
  //     retry: 2,
  //     staleTime: 10_000,
  //   },
  // },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppProvider>
        <BrowserRouter>
          <div className="h-screen w-screen flex flex-col overflow-hidden">
            <div
              style={{ ["--wails-draggable" as any]: "drag" }}
              className="shrink-0 "
            >
              <NavigationBar />
            </div>
            <Toaster position="top-center" richColors />
            <div className="flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/connect" element={<ConnectionLayout />}>
                  <Route index element={<DatabaseList />} />
                  <Route path="clickhouse" element={<ClickhouseConnection />} />
                </Route>

                <Route
                  path="/editor"
                  element={
                    <EditorProvider>
                      <Editor />{" "}
                    </EditorProvider>
                  }
                />
              </Routes>
            </div>
          </div>
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
