import { useLocation } from "react-router";
import { MenuBar } from "./Menubar";
import { useAppContext } from "../Context/App/Index";
import { DatabaseMenuBar } from "./DatabaseMenubar";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NavigationBar() {
  const location = useLocation();
  const { reload} = useAppContext();
  return (
    <div className="flex cursor-default border-b border-border  bg-transparent w-full justify-end">
      <div className="flex items-center">
        {location.pathname === "/editor" ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="cursor-pointer"
              onClick={reload}
            >
              <RotateCw className="h-5 w-5" />
            </Button>
            <DatabaseMenuBar />
          </>
        ) : (
          <></>
        )}
        <MenuBar />
      </div>
    </div>
  );
}
