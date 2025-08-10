import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Eye, EyeOff, Save } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { Connect } from "@/services/clickhouse"
import { useAppContext } from "@/modules/Context/AppContext"
import { toast } from "sonner"

type FormValues = {
  connectionName: string
  host: string
  port: string
  username: string
  password: string
  database: string
}

export const ClickhouseConnection = () => {
  const navigate = useNavigate()
  const { setDatabase } = useAppContext()
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    getValues,
  } = useForm<FormValues>({
    defaultValues: {
      connectionName: "",
      host: "localhost",
      port: "9000",
      username: "default",
      password: "default",
      database: "default",
    },
  })

  const onTest = async () => {
    const data = getValues()

    try {
      await Connect(data.host, Number(data.port), data.username, data.password, data.database)
      toast.success("Connection test successful")
    } catch (error: any) {
      toast.error("Connection refused", {
        description: error
      })
    }
  }


  const onSubmit = async (data: FormValues) => {
    try {
      await Connect(data.host, Number(data.port), data.username, data.password, data.database)
      setDatabase(data.database)
      navigate("/editor")
    } catch (error: any) {
      toast.error("Connection refused", {
        description: error
      })
    }
  }

  return (
    <div className="flex flex-1 min-w-screen items-center justify-center">
      <Card className={`transition-all duration-300 shadow-md w-full max-w-md`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="px-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>
          <CardTitle className="mt-2 text-lg cursor-default select-none">Connect to ClickHouse</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label htmlFor="connectionName">Connection Name</Label>
              <Input
                id="connectionName"
                {...register("connectionName")}
                placeholder="e.g., Local ClickHouse"
                className="h-8 px-2 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  {...register("host")}
                  placeholder="http://localhost"
                  className="h-8 px-2 text-sm"
                />
              </div>

              <div className="w-24 space-y-1">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  {...register("port")}
                  className="h-8 px-2 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                {...register("username")}
                className="h-8 px-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  className="h-8 px-2 pr-8 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                {...register("database")}
                className="h-8 px-2 text-sm"
              />
            </div>

            <div className="flex justify-between items-center gap-2 mt-8">
              {/* Save Button on the left with icon */}
              <Button
                type="button"
                variant="secondary"
                className="h-9 text-sm flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-9 h-9" />
                Save
              </Button>

              {/* Test + Connect Buttons on the right */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="h-9 text-sm cursor-pointer"
                  onClick={onTest}
                >
                  Test
                </Button>
                <Button
                  type="submit"
                  className="h-9 text-sm cursor-pointer"
                  disabled={isSubmitting}
                >
                  Connect
                </Button>
              </div>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}

