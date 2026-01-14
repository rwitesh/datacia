import { useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MenuBar } from "./Menubar";
import { useAppContext } from "../Context/App/Index";
import { DatabaseMenuBar } from "./DatabaseMenubar";
import { RotateCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseCurrentConnection } from "@/services/bindings/connection";

export function NavigationBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { reload } = useAppContext();

  const DisconnectHandler = async () => {
    try {
      await CloseCurrentConnection();
      // Invalidate current connection query so it refetches (will return null)
      queryClient.invalidateQueries({ queryKey: ["current-connection"] });
      // Redirect to home after successful disconnection
      navigate("/");
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error disconnecting:", error.message);
      } else {
        console.error("Unknown error disconnecting:", error);
      }
    }
  };

  const isEditorPage = location.pathname === "/editor";

  return (
    <div className="flex cursor-default border-b border-border bg-transparent w-full justify-end">
      <div className="flex items-center">
        {isEditorPage && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="cursor-pointer"
              onClick={reload}
              title="Refresh"
            >
              <RotateCw className="h-5 w-5" />
            </Button>
            <DatabaseMenuBar />
          </>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="cursor-pointer"
          onClick={DisconnectHandler}
          title="Disconnect"
        >
          <LogOut className="h-5 w-5" />
        </Button>
        <MenuBar />
      </div>
    </div>
  );
}
