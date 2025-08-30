import { useLocation } from "react-router";
import { MenuBar } from "./Menubar";
import { useAppContext } from "../Context/App/Index";
import { DatabaseMenuBar } from "./DatabaseMenubar";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export function NavigationBar() {
  const location = useLocation();
  const { database } = useAppContext();
  const queryClient = useQueryClient();

  const Reload = () => {
    queryClient.invalidateQueries({ queryKey: ["databases"] });
    if (database) {
      queryClient.invalidateQueries({ queryKey: ["tables", database] });
    }
  };

  return (
    <div className="flex cursor-default border-b border-border bg-background w-full justify-end">
      <div className="flex items-center">
        {database && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => Reload()}
            >
              <RotateCw className="h-5 w-5" />
            </Button>
            <DatabaseMenuBar />
          </>
        )}
        {location.pathname !== "/" && <MenuBar />}
      </div>
    </div>
  );
}
