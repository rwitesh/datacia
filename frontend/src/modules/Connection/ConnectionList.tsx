import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNavigate } from "react-router"
import { Database } from "lucide-react"

export const DatabaseList = () => {
  return (
    <div className="min-h-screen min-w-screen p-4">
      <h1 className="text-3xl font-semibold mb-6 text-center">Select a Database to Connect</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <ConnectionCard icon={<Database />} title="ClickHouse" description="Connect to a ClickHouse instance to ingest or query metrics." />
      </div>
    </div>
  )
}



export const ConnectionCard = ({ icon, title, description }: { title: string, icon: React.ReactNode, description: string }) => {
  const navigate = useNavigate()

  const handleClickHouseConnect = () => {
    navigate("/connect/clickhouse")
  }
  return (
    <Card className="hover:shadow-xl transition-shadow cursor-pointer" onClick={handleClickHouseConnect}>
      <CardHeader className="flex items-center space-x-4">
        {icon}
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}
