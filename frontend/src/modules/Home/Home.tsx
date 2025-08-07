// Intro.tsx
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { useNavigate } from "react-router"

export const Home = () => {
    const navigate = useNavigate()
    return (
      <div style={{ ['--wails-draggable' as any]: 'drag' }}  className="relative h-[calc(100vh-64px)] text-white flex flex-col items-center justify-center px-4 overflow-hidden">
            <motion.div
                className="absolute w-48 h-48 rounded-full z-0"
                style={{
                    backgroundColor: "#1c31be",
                    filter: "blur(4px)",
                }}
                animate={{
                    scaleX: [1, 1.3, 1.2, 1, 0.6, 1],
                    scaleY: [1, 0.6, 1.2, 1, 1.3, 1],
                    opacity: [0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
                    boxShadow: [
                        "0 0 0px #1c31be",
                        "0 0 20px #1c31be",
                        "0 0 10px #1c31be",
                        "0 0 16px #1c31be",
                    ],
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            <div className="relative z-10 text-center mt-[-5vh] mb-8">
                <div className="text-md text-foreground uppercase tracking-widest mb-2">
                    LayerBit
                </div>
                <h1 className="text-4xl text-foreground md:text-5xl font-semibold mb-4">
                    Your database, reimagined for speed and clarity
                </h1>
                <p className="text-foreground text-lg max-w-xl mx-auto">
                    A modern SQL editor built for speed, clarity, and control.
                </p>
            </div>
            <div className="relative z-10 text-center mt-8">
                <Button size="lg" className="px-8 text-base cursor-pointer" onClick={() => navigate("/connect/clickhouse")}>
                    Get Started
                </Button>
            </div>

        </div>
    )
}
