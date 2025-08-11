import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router"
import logo from "@/assets/logo.png"

export const Home = () => {
  const navigate = useNavigate()

  return (
    <div
      style={{ ['--wails-draggable' as any]: 'drag' }}
      className="relative h-[calc(100vh-64px)] text-white flex flex-col items-center justify-center px-4 overflow-hidden cursor-default select-none text-center"
    >
      <div className="z-10 max-w-3xl flex flex-col items-center">
        <img
          src={logo}
          alt="LayerBit Logo"
          className="w-25 h-25 mb-2"
          draggable={false}
        />
        <div className="text-lg text-foreground uppercase tracking-widest mb-2">
          LayerBit
        </div>
        <h1 className="text-5xl leading-[1.2] font-semibold text-foreground mb-4">
          Your database, reimagined for speed and clarity
        </h1>
        <p className="text-lg text-foreground">
          A modern SQL editor built for speed, clarity, and control.
        </p>
      </div>

      <div className="z-10 mt-8">
        <Button
          size="lg"
          className="px-8 text-base cursor-pointer"
          onClick={() => navigate("/connect/clickhouse")}
        >
          Get Started
        </Button>
      </div>
    </div>
  )
}
