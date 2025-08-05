import { Outlet } from "react-router"

export const ConnectionLayout = () => {
  return (
    <div className="flex h-[calc(100vh-64px)] w-full">
      <Outlet />
    </div>
  )
}
