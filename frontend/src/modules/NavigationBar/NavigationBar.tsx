import { useLocation } from "react-router"
import { MenuBar } from "./Menubar"

export function NavigationBar() {
    const location = useLocation();
    return (
        <div className="flex cursor-default border-b border-border bg-background w-full justify-end">
           {location.pathname !== "/" && <MenuBar />}
        </div>
    )
}
