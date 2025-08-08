import { useLocation} from "react-router"
import { MenuBar } from "./Menubar"
import { useAppContext } from "../Context/AppContext";
import { DatabaseMenuBar } from "./DatabaseMenubar";
export function NavigationBar() {
    const location = useLocation();
    const {database} = useAppContext();

    return (
        <div className="flex cursor-default border-b border-border bg-background w-full justify-end">
            <div className="flex items-center">
                {database && <DatabaseMenuBar />}
                {location.pathname !== "/" && <MenuBar />}</div>
        </div>
    )
}
